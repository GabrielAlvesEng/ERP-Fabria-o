-- Importação do SolidWorks (decisões 34 a 36).
-- Conjunto soldado como nó próprio; corpos da lista de corte como peças <código>.01, .02...
-- O ERP usa o final do código CAD sob o prefixo do projeto e guarda o código CAD original.

alter table public.projeto_conjuntos drop constraint projeto_conjuntos_tipo_check;
alter table public.projeto_conjuntos add constraint projeto_conjuntos_tipo_check check (tipo in ('geral','submontagem','conjunto','soldado'));

alter table public.projeto_conjuntos
  add column codigo_cad text not null default '',
  add column arquivo_cad text not null default '',
  add column chave_cad text,
  add column dados_cad jsonb not null default '{}';
alter table public.projeto_pecas
  add column codigo_cad text not null default '',
  add column arquivo_cad text not null default '',
  add column chave_cad text,
  add column comprimento numeric(12,2),
  add column dados_cad jsonb not null default '{}';
alter table public.projetos
  add column dados_cad jsonb not null default '{}',
  add column importado_cad_em timestamptz;

-- Próximo código livre na posição de peça sob um conjunto (…-XX-NN-001, 002…), sem repetir
-- códigos de peças nem de conjuntos soldados do projeto.
create or replace function public.proximo_codigo_peca(p_conjunto uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare c projeto_conjuntos; n integer; cod text;
begin
  select * into c from projeto_conjuntos where id = p_conjunto;
  if c.tipo = 'soldado' then
    select coalesce(max(seq), 0) + 1 into n from projeto_pecas where conjunto_id = c.id;
    return c.codigo || '.' || lpad(n::text, 2, '0');
  end if;
  for n in 1..999 loop
    cod := left(c.codigo, length(c.codigo) - 3) || lpad(n::text, 3, '0');
    if not exists (select 1 from projeto_pecas where projeto_id = c.projeto_id and codigo = cod)
       and not exists (select 1 from projeto_conjuntos where projeto_id = c.projeto_id and codigo = cod) then
      return cod;
    end if;
  end loop;
  raise exception 'Limite de peças neste conjunto atingido.';
end;
$$;
revoke execute on function public.proximo_codigo_peca(uuid) from public, anon, authenticated;

-- adicionar_peca passa a usar o gerador acima (o resto igual à 0007).
create or replace function public.adicionar_peca(p_conjunto uuid, p_dados jsonb) returns public.projeto_pecas
language plpgsql security definer set search_path = public as $$
declare c projeto_conjuntos; cod text; n integer; nova projeto_pecas;
begin
  if not tem_permissao('engenharia','editar') then raise exception 'Sem permissão.'; end if;
  select * into c from projeto_conjuntos where id = p_conjunto and excluido_em is null for update;
  if not found then raise exception 'Conjunto não encontrado.'; end if;
  cod := proximo_codigo_peca(c.id);
  n := case when c.tipo = 'soldado' then split_part(cod, '.', 2)::int else right(cod, 3)::int end;
  perform set_config('erp.rpc', 'on', true);
  insert into projeto_pecas (projeto_id, conjunto_id, seq, codigo, descricao, quantidade, cod_op, material, espessura, peso_unit, ordem)
  values (c.projeto_id, c.id, n, cod,
    coalesce(p_dados->>'descricao', ''), coalesce(nullif(p_dados->>'quantidade', '')::numeric, 1),
    coalesce((select array_agg(x) from jsonb_array_elements_text(p_dados->'cod_op') x), '{}'),
    coalesce(p_dados->>'material', ''), nullif(p_dados->>'espessura', '')::numeric, nullif(p_dados->>'peso_unit', '')::numeric, n)
  returning * into nova;
  perform set_config('erp.rpc', 'off', true);
  return nova;
end;
$$;

-- Conjunto soldado não tem subconjuntos (só peças).
create or replace function public.adicionar_conjunto(p_pai uuid, p_nome text, p_quantidade numeric default 1) returns public.projeto_conjuntos
language plpgsql security definer set search_path = public as $$
declare pai projeto_conjuntos; pj projetos; n integer; novo projeto_conjuntos;
begin
  if not tem_permissao('engenharia','editar') then raise exception 'Sem permissão.'; end if;
  select * into pai from projeto_conjuntos where id = p_pai and excluido_em is null for update;
  if not found then raise exception 'Conjunto pai não encontrado.'; end if;
  select * into pj from projetos where id = pai.projeto_id;
  perform set_config('erp.rpc', 'on', true);
  if pai.tipo = 'geral' then
    select coalesce(max(case when sub ~ '^[0-9][A-Z]$' then (substr(sub,1,1)::int * 26 + ascii(substr(sub,2,1)) - 64) end), 0) + 1 into n
      from projeto_conjuntos where projeto_id = pai.projeto_id and tipo = 'submontagem';
    if n > 260 then raise exception 'Limite de submontagens atingido.'; end if;
    insert into projeto_conjuntos (projeto_id, pai_id, tipo, sub, conj, codigo, nome, quantidade, ordem)
    values (pai.projeto_id, pai.id, 'submontagem', codigo_sub(n), 0, pj.codigo || '-' || codigo_sub(n) || '-00-000', p_nome, coalesce(p_quantidade, 1), n)
    returning * into novo;
  elsif pai.tipo = 'submontagem' then
    select coalesce(max(conj), 0) + 1 into n from projeto_conjuntos where projeto_id = pai.projeto_id and pai_id = pai.id and tipo = 'conjunto';
    if n > 99 then raise exception 'Limite de conjuntos nesta submontagem atingido.'; end if;
    insert into projeto_conjuntos (projeto_id, pai_id, tipo, sub, conj, codigo, nome, quantidade, ordem)
    values (pai.projeto_id, pai.id, 'conjunto', pai.sub, n, pj.codigo || '-' || pai.sub || '-' || lpad(n::text, 2, '0') || '-000', p_nome, coalesce(p_quantidade, 1), n)
    returning * into novo;
  elsif pai.tipo = 'soldado' then
    raise exception 'Conjunto soldado não tem subconjuntos. Adicione peças a ele.';
  else
    raise exception 'Conjuntos secundários não têm subníveis. Adicione peças a ele.';
  end if;
  perform set_config('erp.rpc', 'off', true);
  return novo;
end;
$$;

-- Importa o plano montado pela tela a partir do JSON da macro.
-- p_plano = { projeto_dados, raiz:{chave_cad,codigo_cad,arquivo_cad,dados_cad},
--             nos:[{ref,pai_ref,tipo,sufixo,nome,quantidade,codigo_cad,arquivo_cad,chave_cad,dados_cad}],
--             pecas:[{no_ref,sufixo,descricao,quantidade,cod_op[],cod_mat,espessura,peso_unit,comprimento,codigo_cad,arquivo_cad,chave_cad,dados_cad}] }
create or replace function public.importar_solidworks(p_projeto uuid, p_plano jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pj projetos; geral projeto_conjuntos; pai projeto_conjuntos; novo projeto_conjuntos;
  mapa jsonb := '{}'; nos jsonb; pc jsonb; cod text; sufixo text; n integer; tipo text;
  qtd_nos integer := 0; qtd_pecas integer := 0; cm text;
begin
  if not tem_permissao('engenharia','editar') then raise exception 'Sem permissão.'; end if;
  select * into pj from projetos where id = p_projeto for update;
  if not found then raise exception 'Projeto não encontrado.'; end if;
  if exists (select 1 from projeto_conjuntos where projeto_id = pj.id and chave_cad is not null and excluido_em is null)
     or exists (select 1 from projeto_pecas where projeto_id = pj.id and chave_cad is not null and excluido_em is null) then
    raise exception 'Este projeto já tem itens importados do SolidWorks. A reimportação (nova revisão) ainda não está disponível.';
  end if;
  select * into geral from projeto_conjuntos where projeto_id = pj.id and tipo = 'geral' and excluido_em is null;
  perform set_config('erp.rpc', 'on', true);

  update projeto_conjuntos set codigo_cad = coalesce(p_plano->'raiz'->>'codigo_cad', ''), arquivo_cad = coalesce(p_plano->'raiz'->>'arquivo_cad', ''),
    chave_cad = p_plano->'raiz'->>'chave_cad', dados_cad = coalesce(p_plano->'raiz'->'dados_cad', '{}')
    where id = geral.id;
  update projetos set dados_cad = coalesce(p_plano->'projeto_dados', '{}'), importado_cad_em = now() where id = pj.id;

  for nos in select * from jsonb_array_elements(coalesce(p_plano->'nos', '[]')) loop
    if nos->>'pai_ref' is null then pai := geral;
    else select * into pai from projeto_conjuntos where id = (mapa->>(nos->>'pai_ref'))::uuid; end if;
    if pai.id is null then raise exception 'Nó pai não encontrado para %.', nos->>'nome'; end if;
    tipo := nos->>'tipo';
    sufixo := nos->>'sufixo';
    if tipo = 'submontagem' and pai.tipo <> 'geral' then raise exception 'Submontagem % precisa estar na montagem geral.', nos->>'nome'; end if;
    if tipo = 'conjunto' and pai.tipo <> 'submontagem' then raise exception 'Conjunto % precisa estar numa submontagem.', nos->>'nome'; end if;
    if tipo = 'soldado' and pai.tipo = 'soldado' then raise exception 'Conjunto soldado % não pode ficar dentro de outro soldado.', nos->>'nome'; end if;
    if tipo not in ('submontagem','conjunto','soldado') then raise exception 'Tipo inválido: %.', tipo; end if;

    if sufixo is not null and sufixo ~ '^[0-9][A-Z0-9]-[0-9]{2}-[0-9]{3}$' then
      cod := pj.codigo || '-' || sufixo;
    elsif tipo = 'submontagem' then
      select coalesce(max(case when sub ~ '^[0-9][A-Z]$' then (substr(sub,1,1)::int * 26 + ascii(substr(sub,2,1)) - 64) end), 0) + 1 into n
        from projeto_conjuntos where projeto_id = pj.id and tipo = 'submontagem';
      cod := pj.codigo || '-' || codigo_sub(n) || '-00-000';
    elsif tipo = 'conjunto' then
      select coalesce(max(conj), 0) + 1 into n from projeto_conjuntos where projeto_id = pj.id and pai_id = pai.id and tipo = 'conjunto';
      cod := pj.codigo || '-' || pai.sub || '-' || lpad(n::text, 2, '0') || '-000';
    else
      cod := proximo_codigo_peca(pai.id);
    end if;
    if exists (select 1 from projeto_conjuntos where projeto_id = pj.id and codigo = cod)
       or exists (select 1 from projeto_pecas where projeto_id = pj.id and codigo = cod) then
      raise exception 'O código % (de %) já existe neste projeto.', cod, nos->>'nome';
    end if;

    insert into projeto_conjuntos (projeto_id, pai_id, tipo, sub, conj, codigo, nome, quantidade, ordem, codigo_cad, arquivo_cad, chave_cad, dados_cad)
    values (pj.id, pai.id, tipo, split_part(substr(cod, length(pj.codigo) + 2), '-', 1),
      coalesce(nullif(split_part(substr(cod, length(pj.codigo) + 2), '-', 2), '')::int, 0),
      cod, coalesce(nullif(nos->>'nome', ''), cod), greatest(coalesce((nos->>'quantidade')::numeric, 1), 0.001),
      qtd_nos + 1, coalesce(nos->>'codigo_cad', ''), coalesce(nos->>'arquivo_cad', ''), nos->>'chave_cad', coalesce(nos->'dados_cad', '{}'))
    returning * into novo;
    mapa := mapa || jsonb_build_object(nos->>'ref', novo.id);
    qtd_nos := qtd_nos + 1;
  end loop;

  for pc in select * from jsonb_array_elements(coalesce(p_plano->'pecas', '[]')) loop
    if pc->>'no_ref' is null then pai := geral;
    else select * into pai from projeto_conjuntos where id = (mapa->>(pc->>'no_ref'))::uuid; end if;
    if pai.id is null then raise exception 'Conjunto não encontrado para a peça %.', pc->>'descricao'; end if;
    sufixo := pc->>'sufixo';
    if pai.tipo <> 'soldado' and sufixo is not null and sufixo ~ '^[0-9][A-Z0-9]-[0-9]{2}-[0-9]{3}$' then
      cod := pj.codigo || '-' || sufixo;
      if exists (select 1 from projeto_conjuntos where projeto_id = pj.id and codigo = cod)
         or exists (select 1 from projeto_pecas where projeto_id = pj.id and codigo = cod) then
        raise exception 'O código % (de %) já existe neste projeto.', cod, pc->>'descricao';
      end if;
    else
      cod := proximo_codigo_peca(pai.id);
    end if;
    n := case when pai.tipo = 'soldado' then split_part(cod, '.', 2)::int else right(cod, 3)::int end;
    cm := pc->>'cod_mat';
    if cm is not null and not exists (select 1 from catalogo_materiais where cod_mat = cm) then cm := null; end if;
    insert into projeto_pecas (projeto_id, conjunto_id, seq, codigo, descricao, quantidade, cod_op, material, cod_mat, espessura, peso_unit,
      comprimento, ordem, codigo_cad, arquivo_cad, chave_cad, dados_cad)
    values (pj.id, pai.id, n, cod, coalesce(pc->>'descricao', ''), greatest(coalesce((pc->>'quantidade')::numeric, 1), 0.001),
      coalesce((select array_agg(x) from jsonb_array_elements_text(pc->'cod_op') x where x in ('LC','LP','PO','GU','DO','CL','US','CM')), '{}'),
      coalesce((select nome from catalogo_materiais where cod_mat = cm), coalesce(pc->>'material', '')), cm,
      nullif(pc->>'espessura', '')::numeric, nullif(pc->>'peso_unit', '')::numeric, nullif(pc->>'comprimento', '')::numeric,
      n, coalesce(pc->>'codigo_cad', ''), coalesce(pc->>'arquivo_cad', ''), pc->>'chave_cad', coalesce(pc->'dados_cad', '{}'));
    qtd_pecas := qtd_pecas + 1;
  end loop;

  insert into auditoria (tabela, registro_id, acao, depois)
  values ('projetos', pj.id::text, 'IMPORTACAO_SOLIDWORKS', jsonb_build_object('nos', qtd_nos, 'pecas', qtd_pecas, 'raiz', p_plano->'raiz'->>'codigo_cad'));
  perform set_config('erp.rpc', 'off', true);
  return jsonb_build_object('nos', qtd_nos, 'pecas', qtd_pecas);
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['public.importar_solidworks(uuid, jsonb)', 'public.adicionar_peca(uuid, jsonb)', 'public.adicionar_conjunto(uuid, text, numeric)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
