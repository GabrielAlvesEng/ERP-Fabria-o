-- Reimportação de nova revisão do CAD (decisão 38, regras R1 a R8 de docs/PLANEJAMENTO_SOLIDWORKS.md, etapa 2).
-- A tela compara o JSON novo com a árvore e manda as operações; o banco valida e aplica tudo numa transação.

-- R1: removido do CAD fica marcado (não apagado) e sai da lista de materiais.
alter table public.projeto_conjuntos add column removido_cad_em timestamptz;
alter table public.projeto_pecas add column removido_cad_em timestamptz;

-- Histórico de importações do CAD por projeto.
create table public.projeto_importacoes_cad (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos(id),
  tipo text not null check (tipo in ('inicial','revisao')),
  arquivo text not null default '',
  codigo_cad text not null default '',
  macro text not null default '',
  resumo jsonb not null default '{}',
  usuario_id uuid default auth.uid() references public.usuarios(id),
  criado_em timestamptz not null default now()
);
create index projeto_importacoes_cad_idx on public.projeto_importacoes_cad (projeto_id, criado_em);
alter table public.projeto_importacoes_cad enable row level security;
create policy importacoes_cad_ler on public.projeto_importacoes_cad for select to authenticated using (tem_permissao('engenharia','ler'));
grant select on public.projeto_importacoes_cad to authenticated;

-- A primeira importação já feita (antes desta migration) entra no histórico a partir da auditoria.
insert into public.projeto_importacoes_cad (projeto_id, tipo, codigo_cad, resumo, usuario_id, criado_em)
select a.registro_id::uuid, 'inicial', coalesce(a.depois->>'raiz', ''), jsonb_build_object('novos', coalesce((a.depois->>'nos')::int, 0) + coalesce((a.depois->>'pecas')::int, 0)), a.usuario_id, a.criado_em
from public.auditoria a where a.acao = 'IMPORTACAO_SOLIDWORKS' and a.tabela = 'projetos';

-- Inserção de um nó vindo do CAD sob um pai já existente (mesmas regras de código da importação inicial).
create or replace function public.inserir_no_cad(pj public.projetos, pai public.projeto_conjuntos, nos jsonb, p_ordem integer) returns public.projeto_conjuntos
language plpgsql security definer set search_path = public as $$
declare v_tipo text := nos->>'tipo'; sufixo text := nos->>'sufixo'; cod text; n integer; novo projeto_conjuntos;
begin
  if v_tipo = 'submontagem' and pai.tipo <> 'geral' then raise exception 'Submontagem % precisa estar na montagem geral.', nos->>'nome'; end if;
  if v_tipo = 'conjunto' and pai.tipo <> 'submontagem' then raise exception 'Conjunto % precisa estar numa submontagem.', nos->>'nome'; end if;
  if v_tipo = 'soldado' and pai.tipo = 'soldado' then raise exception 'Conjunto soldado % não pode ficar dentro de outro soldado.', nos->>'nome'; end if;
  if v_tipo not in ('submontagem','conjunto','soldado') then raise exception 'Tipo inválido: %.', v_tipo; end if;
  if sufixo is not null and sufixo ~ '^[0-9][A-Z0-9]-[0-9]{2}-[0-9]{3}$' then
    cod := pj.codigo || '-' || sufixo;
  elsif v_tipo = 'submontagem' then
    select coalesce(max(case when sub ~ '^[0-9][A-Z]$' then (substr(sub,1,1)::int * 26 + ascii(substr(sub,2,1)) - 64) end), 0) + 1 into n
      from projeto_conjuntos where projeto_id = pj.id and tipo = 'submontagem';
    cod := pj.codigo || '-' || codigo_sub(n) || '-00-000';
  elsif v_tipo = 'conjunto' then
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
  values (pj.id, pai.id, v_tipo, split_part(substr(cod, length(pj.codigo) + 2), '-', 1),
    coalesce(nullif(split_part(substr(cod, length(pj.codigo) + 2), '-', 2), '')::int, 0),
    cod, coalesce(nullif(nos->>'nome', ''), cod), greatest(coalesce((nos->>'quantidade')::numeric, 1), 0.001),
    p_ordem, coalesce(nos->>'codigo_cad', ''), coalesce(nos->>'arquivo_cad', ''), nos->>'chave_cad', coalesce(nos->'dados_cad', '{}'))
  returning * into novo;
  return novo;
end;
$$;

create or replace function public.inserir_peca_cad(pj public.projetos, pai public.projeto_conjuntos, pc jsonb) returns public.projeto_pecas
language plpgsql security definer set search_path = public as $$
declare sufixo text := pc->>'sufixo'; cod text; n integer; cm text; nova projeto_pecas;
begin
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
    n, coalesce(pc->>'codigo_cad', ''), coalesce(pc->>'arquivo_cad', ''), pc->>'chave_cad', coalesce(pc->'dados_cad', '{}'))
  returning * into nova;
  return nova;
end;
$$;
revoke execute on function public.inserir_no_cad(public.projetos, public.projeto_conjuntos, jsonb, integer) from public, anon, authenticated;
revoke execute on function public.inserir_peca_cad(public.projetos, public.projeto_conjuntos, jsonb) from public, anon, authenticated;

-- Atualização por nova revisão do CAD.
-- p_plano = { arquivo, macro, codigo_cad_raiz, projeto_dados, raiz_dados,
--   novos_nos:[{ref, pai_id|pai_ref, tipo, sufixo, nome, quantidade, codigo_cad, arquivo_cad, chave_cad, dados_cad}],
--   novas_pecas:[{conjunto_id|no_ref, sufixo, descricao, quantidade, cod_op[], cod_mat, material, espessura, peso_unit, comprimento, codigo_cad, arquivo_cad, chave_cad, dados_cad}],
--   alterar_conjuntos:[{id, dados:{nome, quantidade, codigo_cad, arquivo_cad, chave_cad, dados_cad, restaurar}}],
--   alterar_pecas:[{id, dados:{descricao, quantidade, cod_op, cod_mat, material, espessura, peso_unit, comprimento, codigo_cad, arquivo_cad, chave_cad, dados_cad, restaurar}}],
--   remover_conjuntos:[id], remover_pecas:[id], resumo:{} }
create or replace function public.atualizar_solidworks(p_projeto uuid, p_plano jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pj projetos; geral projeto_conjuntos; pai projeto_conjuntos; novo projeto_conjuntos; nova projeto_pecas;
  mapa jsonb := '{}'; item jsonb; d jsonb; v_id uuid; cm text;
  afetados uuid[] := '{}'; ordem_base integer; qtd jsonb; liberados integer;
  n_novos integer := 0; n_alt integer := 0; n_rem integer := 0;
begin
  if not tem_permissao('engenharia','editar') then raise exception 'Sem permissão.'; end if;
  select * into pj from projetos where id = p_projeto for update;
  if not found then raise exception 'Projeto não encontrado.'; end if;
  select * into geral from projeto_conjuntos where projeto_id = pj.id and tipo = 'geral' and excluido_em is null;
  if coalesce(geral.codigo_cad, '') = '' then raise exception 'Este projeto ainda não foi importado do SolidWorks. Use a importação inicial.'; end if;
  -- R7: só a mesma montagem.
  if upper(coalesce(p_plano->>'codigo_cad_raiz', '')) <> upper(geral.codigo_cad) then
    raise exception 'Este JSON é da montagem %, mas o projeto foi importado de %.', p_plano->>'codigo_cad_raiz', geral.codigo_cad;
  end if;
  perform set_config('erp.rpc', 'on', true);
  select coalesce(max(ordem), 0) into ordem_base from projeto_conjuntos where projeto_id = pj.id;

  -- Novos nós (pais existentes ou criados nesta mesma importação; a tela manda pais antes dos filhos).
  for item in select * from jsonb_array_elements(coalesce(p_plano->'novos_nos', '[]')) loop
    if item->>'pai_ref' is not null then
      select * into pai from projeto_conjuntos where id = (mapa->>(item->>'pai_ref'))::uuid;
    else
      select * into pai from projeto_conjuntos where id = (item->>'pai_id')::uuid and projeto_id = pj.id and excluido_em is null;
    end if;
    if pai.id is null then raise exception 'Pai não encontrado para %.', item->>'nome'; end if;
    ordem_base := ordem_base + 1;
    novo := inserir_no_cad(pj, pai, item, ordem_base);
    mapa := mapa || jsonb_build_object(item->>'ref', novo.id);
    afetados := afetados || pai.id;
    n_novos := n_novos + 1;
  end loop;

  -- Novas peças.
  for item in select * from jsonb_array_elements(coalesce(p_plano->'novas_pecas', '[]')) loop
    if item->>'no_ref' is not null then
      select * into pai from projeto_conjuntos where id = (mapa->>(item->>'no_ref'))::uuid;
    else
      select * into pai from projeto_conjuntos where id = (item->>'conjunto_id')::uuid and projeto_id = pj.id and excluido_em is null;
    end if;
    if pai.id is null then raise exception 'Conjunto não encontrado para a peça %.', item->>'descricao'; end if;
    nova := inserir_peca_cad(pj, pai, item);
    afetados := afetados || pai.id;
    n_novos := n_novos + 1;
  end loop;

  -- Conjuntos alterados (R2 já aplicada pela tela: só vêm os campos que o CAD trouxe e que mudaram). R6: só itens do CAD.
  for item in select * from jsonb_array_elements(coalesce(p_plano->'alterar_conjuntos', '[]')) loop
    v_id := (item->>'id')::uuid; d := item->'dados';
    if not exists (select 1 from projeto_conjuntos where id = v_id and projeto_id = pj.id and chave_cad is not null and excluido_em is null) then
      raise exception 'Conjunto % não é do CAD deste projeto.', v_id;
    end if;
    update projeto_conjuntos set
      nome = case when d ? 'nome' then coalesce(nullif(d->>'nome', ''), nome) else nome end,
      quantidade = case when d ? 'quantidade' then greatest((d->>'quantidade')::numeric, 0.001) else quantidade end,
      codigo_cad = case when d ? 'codigo_cad' then coalesce(d->>'codigo_cad', '') else codigo_cad end,
      arquivo_cad = case when d ? 'arquivo_cad' then coalesce(d->>'arquivo_cad', '') else arquivo_cad end,
      chave_cad = case when d ? 'chave_cad' then d->>'chave_cad' else chave_cad end,
      dados_cad = case when d ? 'dados_cad' then d->'dados_cad' else dados_cad end,
      removido_cad_em = case when (d->>'restaurar')::boolean then null else removido_cad_em end
    where id = v_id;
    afetados := afetados || v_id;
    n_alt := n_alt + 1;
  end loop;

  -- Peças alteradas.
  for item in select * from jsonb_array_elements(coalesce(p_plano->'alterar_pecas', '[]')) loop
    v_id := (item->>'id')::uuid; d := item->'dados';
    if not exists (select 1 from projeto_pecas where id = v_id and projeto_id = pj.id and chave_cad is not null and excluido_em is null) then
      raise exception 'Peça % não é do CAD deste projeto.', v_id;
    end if;
    cm := case when d ? 'cod_mat' then d->>'cod_mat' end;
    if cm is not null and not exists (select 1 from catalogo_materiais where cod_mat = cm) then cm := null; end if;
    update projeto_pecas set
      descricao = case when d ? 'descricao' then coalesce(nullif(d->>'descricao', ''), descricao) else descricao end,
      quantidade = case when d ? 'quantidade' then greatest((d->>'quantidade')::numeric, 0.001) else quantidade end,
      cod_op = case when d ? 'cod_op' then coalesce((select array_agg(x) from jsonb_array_elements_text(d->'cod_op') x where x in ('LC','LP','PO','GU','DO','CL','US','CM')), '{}') else cod_op end,
      cod_mat = case when d ? 'cod_mat' and cm is not null then cm else cod_mat end,
      material = case when d ? 'cod_mat' and cm is not null then (select nome from catalogo_materiais where cod_mat = cm)
                      when d ? 'material' then coalesce(nullif(d->>'material', ''), material) else material end,
      espessura = case when d ? 'espessura' then nullif(d->>'espessura', '')::numeric else espessura end,
      peso_unit = case when d ? 'peso_unit' then nullif(d->>'peso_unit', '')::numeric else peso_unit end,
      comprimento = case when d ? 'comprimento' then nullif(d->>'comprimento', '')::numeric else comprimento end,
      codigo_cad = case when d ? 'codigo_cad' then coalesce(d->>'codigo_cad', '') else codigo_cad end,
      arquivo_cad = case when d ? 'arquivo_cad' then coalesce(d->>'arquivo_cad', '') else arquivo_cad end,
      chave_cad = case when d ? 'chave_cad' then d->>'chave_cad' else chave_cad end,
      dados_cad = case when d ? 'dados_cad' then d->'dados_cad' else dados_cad end,
      removido_cad_em = case when (d->>'restaurar')::boolean then null else removido_cad_em end
    where id = v_id
    returning conjunto_id into v_id;
    afetados := afetados || v_id;
    n_alt := n_alt + 1;
  end loop;

  -- R1: removidos do CAD ficam marcados.
  for item in select * from jsonb_array_elements(coalesce(p_plano->'remover_conjuntos', '[]')) loop
    v_id := (item #>> '{}')::uuid;
    update projeto_conjuntos set removido_cad_em = now()
      where id = v_id and projeto_id = pj.id and chave_cad is not null and tipo <> 'geral' and removido_cad_em is null and excluido_em is null
      returning pai_id into v_id;
    if not found then raise exception 'Conjunto removido inválido.'; end if;
    afetados := afetados || v_id;
    n_rem := n_rem + 1;
  end loop;
  for item in select * from jsonb_array_elements(coalesce(p_plano->'remover_pecas', '[]')) loop
    v_id := (item #>> '{}')::uuid;
    update projeto_pecas set removido_cad_em = now()
      where id = v_id and projeto_id = pj.id and chave_cad is not null and removido_cad_em is null and excluido_em is null
      returning conjunto_id into v_id;
    if not found then raise exception 'Peça removida inválida.'; end if;
    afetados := afetados || v_id;
    n_rem := n_rem + 1;
  end loop;

  -- R5: conjunto Liberado que mudou volta para Em revisão e sobe a revisão.
  update projeto_conjuntos set status = 'revisao',
    revisao = case when revisao ~ '^R[0-9]+$' then 'R' || (substr(revisao, 2)::int + 1) else 'R1' end
  where id = any(afetados) and status = 'liberado';
  get diagnostics liberados = row_count;

  update projeto_conjuntos set dados_cad = coalesce(p_plano->'raiz_dados', dados_cad) where id = geral.id;
  update projetos set dados_cad = coalesce(p_plano->'projeto_dados', dados_cad) where id = pj.id;

  qtd := jsonb_build_object('novos', n_novos, 'alterados', n_alt, 'removidos', n_rem, 'liberados_em_revisao', liberados);
  insert into projeto_importacoes_cad (projeto_id, tipo, arquivo, codigo_cad, macro, resumo)
  values (pj.id, 'revisao', coalesce(p_plano->>'arquivo', ''), geral.codigo_cad, coalesce(p_plano->>'macro', ''), qtd || coalesce(p_plano->'resumo', '{}'));
  insert into auditoria (tabela, registro_id, acao, depois) values ('projetos', pj.id::text, 'REIMPORTACAO_SOLIDWORKS', qtd);
  perform set_config('erp.rpc', 'off', true);
  return qtd;
end;
$$;
revoke execute on function public.atualizar_solidworks(uuid, jsonb) from public, anon;
grant execute on function public.atualizar_solidworks(uuid, jsonb) to authenticated;

-- A importação inicial passa a gravar também no histórico (o resto é igual à 0013).
create or replace function public.registrar_importacao_inicial() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.acao = 'IMPORTACAO_SOLIDWORKS' and new.tabela = 'projetos' then
    insert into projeto_importacoes_cad (projeto_id, tipo, codigo_cad, resumo, usuario_id)
    values (new.registro_id::uuid, 'inicial', coalesce(new.depois->>'raiz', ''),
      jsonb_build_object('novos', coalesce((new.depois->>'nos')::int, 0) + coalesce((new.depois->>'pecas')::int, 0)), new.usuario_id);
  end if;
  return new;
end;
$$;
create trigger auditoria_importacao_inicial after insert on public.auditoria for each row execute function public.registrar_importacao_inicial();
revoke execute on function public.registrar_importacao_inicial() from public, anon, authenticated;
