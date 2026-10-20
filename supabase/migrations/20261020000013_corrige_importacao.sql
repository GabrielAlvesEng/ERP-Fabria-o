-- Correção da 0012: a variável "tipo" de importar_solidworks tinha o mesmo nome de uma coluna (erro 42702).
-- Renomeada para v_tipo; o resto da função é igual.
create or replace function public.importar_solidworks(p_projeto uuid, p_plano jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pj projetos; geral projeto_conjuntos; pai projeto_conjuntos; novo projeto_conjuntos;
  mapa jsonb := '{}'; nos jsonb; pc jsonb; cod text; sufixo text; n integer; v_tipo text;
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
    v_tipo := nos->>'tipo';
    sufixo := nos->>'sufixo';
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

