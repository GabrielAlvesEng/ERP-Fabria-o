-- Migration 82 (decisão 126): parte do SolidAuto no banco do ERP. Aplicada pelo Gabriel no SQL Editor em 13/11/2026.
-- Fonte: repositório SolidAuto, supabase/migrations/20261113170000_solidauto.sql.
-- SolidAuto no banco do ERP Fabriaço.
-- Os projetos, a árvore (projeto_conjuntos) e as peças (projeto_pecas) são as tabelas do ERP.
-- Aqui fica só o que é do SolidAuto: o vínculo de cada projeto com a montagem geral do SolidWorks
-- e as funções que o app chama. Nada do ERP é alterado.

create table if not exists public.solidauto_vinculos (
  projeto_id uuid primary key references public.projetos(id) on delete cascade,
  caminho_relativo text not null default '',
  configuracao text not null default '',
  propriedades jsonb not null default '{}',
  escolhas_cm_ref jsonb not null default '{}',
  datas jsonb not null default '{}',
  vinculado_por uuid references public.usuarios(id),
  vinculado_em timestamptz not null default now(),
  atualizado_por uuid references public.usuarios(id),
  atualizado_em timestamptz not null default now(),
  arvore_enviada_em timestamptz,
  arvore_enviada_por uuid references public.usuarios(id)
);

comment on table public.solidauto_vinculos is
  'SolidAuto: montagem geral do SolidWorks ligada a cada projeto do ERP (caminho a partir da pasta raiz de projetos de cada PC), propriedades lidas, escolhas CM/REF e datas das etapas.';

alter table public.solidauto_vinculos enable row level security;

drop policy if exists solidauto_vinculos_ler on public.solidauto_vinculos;
create policy solidauto_vinculos_ler on public.solidauto_vinculos
  for select to authenticated using (tem_permissao('engenharia', 'ler'));
-- Gravação só pelas funções abaixo.

-- Quem entrou e o que pode fazer.
create or replace function public.solidauto_eu()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', u.id, 'nome', u.nome, 'email', u.email, 'ativo', u.ativo,
    'ler', tem_permissao('engenharia', 'ler'),
    'editar', tem_permissao('engenharia', 'editar'))
  from usuarios u where u.id = auth.uid();
$$;

-- Projetos do ERP para a área de trabalho do SolidAuto.
create or replace function public.solidauto_projetos()
returns table (
  id uuid, codigo text, titulo text, cliente text, status text, pausado boolean, prazo date,
  criado_em timestamptz, atualizado_em timestamptz, fabricacao_concluida_em date,
  importado_cad_em timestamptz, conjuntos integer, pecas integer, em_execucao boolean, vinculo jsonb)
language sql stable security definer set search_path = public as $$
  select p.id, p.codigo, p.titulo, coalesce(e.nome_fantasia, ''), p.status, p.pausado, p.prazo,
    p.criado_em, greatest(p.atualizado_em, v.atualizado_em), p.fabricacao_concluida_em, p.importado_cad_em,
    (select count(*)::int from projeto_conjuntos c where c.projeto_id = p.id and c.excluido_em is null and c.removido_cad_em is null),
    (select count(*)::int from projeto_pecas c where c.projeto_id = p.id and c.excluido_em is null and c.removido_cad_em is null),
    p.status in ('nao_iniciado', 'em_andamento', 'liberado'),
    case when v.projeto_id is null then null else jsonb_build_object(
      'caminho_relativo', v.caminho_relativo, 'configuracao', v.configuracao,
      'propriedades', v.propriedades, 'escolhas_cm_ref', v.escolhas_cm_ref, 'datas', v.datas,
      'vinculado_por', (select nome from usuarios where id = v.vinculado_por), 'vinculado_em', v.vinculado_em,
      'atualizado_por', (select nome from usuarios where id = v.atualizado_por), 'atualizado_em', v.atualizado_em,
      'arvore_enviada_em', v.arvore_enviada_em,
      'arvore_enviada_por', (select nome from usuarios where id = v.arvore_enviada_por)) end
  from projetos p
  left join empresas e on e.id = p.empresa_id
  left join solidauto_vinculos v on v.projeto_id = p.id
  where tem_permissao('engenharia', 'ler') and p.excluido_em is null and not p.exemplo
  order by p.codigo desc;
$$;

-- Liga (ou atualiza) a montagem geral de um projeto. p_dados: caminho_relativo, configuracao,
-- propriedades, escolhas_cm_ref, datas. Campos ausentes ficam como estão.
create or replace function public.solidauto_vincular(p_projeto uuid, p_dados jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare outro text;
begin
  if not tem_permissao('engenharia', 'editar') then raise exception 'Sem permissão para editar projetos da Engenharia.'; end if;
  if not exists (select 1 from projetos where id = p_projeto and excluido_em is null) then raise exception 'Projeto não encontrado no ERP.'; end if;
  if coalesce(p_dados->>'caminho_relativo', '') <> '' then
    select p.codigo into outro from solidauto_vinculos v join projetos p on p.id = v.projeto_id
      where v.projeto_id <> p_projeto and lower(v.caminho_relativo) = lower(p_dados->>'caminho_relativo') and p.excluido_em is null;
    if outro is not null then raise exception 'Esta montagem já está vinculada ao projeto %.', outro; end if;
  end if;
  insert into solidauto_vinculos as v (projeto_id, caminho_relativo, configuracao, propriedades, escolhas_cm_ref, datas, vinculado_por, atualizado_por)
  values (p_projeto, coalesce(p_dados->>'caminho_relativo', ''), coalesce(p_dados->>'configuracao', ''),
    coalesce(p_dados->'propriedades', '{}'), coalesce(p_dados->'escolhas_cm_ref', '{}'), coalesce(p_dados->'datas', '{}'),
    auth.uid(), auth.uid())
  on conflict (projeto_id) do update set
    caminho_relativo = case when p_dados ? 'caminho_relativo' then excluded.caminho_relativo else v.caminho_relativo end,
    configuracao = case when p_dados ? 'configuracao' then excluded.configuracao else v.configuracao end,
    propriedades = case when p_dados ? 'propriedades' then excluded.propriedades else v.propriedades end,
    escolhas_cm_ref = case when p_dados ? 'escolhas_cm_ref' then excluded.escolhas_cm_ref else v.escolhas_cm_ref end,
    datas = case when p_dados ? 'datas' then excluded.datas else v.datas end,
    atualizado_por = auth.uid(), atualizado_em = now();
end;
$$;

create or replace function public.solidauto_desvincular(p_projeto uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('engenharia', 'editar') then raise exception 'Sem permissão para editar projetos da Engenharia.'; end if;
  delete from solidauto_vinculos where projeto_id = p_projeto;
end;
$$;

-- Envia a árvore lida pelo SolidAuto. A primeira vez usa importar_solidworks; depois monta o
-- plano de diferenças (por chave_cad) e usa atualizar_solidworks, com as mesmas regras do ERP
-- (removidos ficam marcados, liberado que muda volta para revisão).
-- p_arvore: { arquivo, macro, raiz: {codigo_cad, arquivo_cad, chave_cad, dados_cad}, projeto_dados,
--   nos: [{ref, pai_ref, tipo, sufixo, nome, quantidade, codigo_cad, arquivo_cad, chave_cad, dados_cad}],
--   pecas: [{no_ref, sufixo, descricao, quantidade, cod_op, cod_mat, material, espessura, peso_unit,
--            comprimento, codigo_cad, arquivo_cad, chave_cad, dados_cad}] }
-- ref/no_ref/pai_ref são a chave_cad do nó; pai_ref nulo = montagem geral.
create or replace function public.solidauto_enviar_arvore(p_projeto uuid, p_arvore jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  geral projeto_conjuntos; ex projeto_conjuntos; exp projeto_pecas; item jsonb; d jsonb;
  novos_nos jsonb := '[]'; novas_pecas jsonb := '[]'; alt_c jsonb := '[]'; alt_p jsonb := '[]';
  rem_c jsonb := '[]'; rem_p jsonb := '[]'; novos text[] := '{}'; chaves_c text[]; chaves_p text[];
  pai_id uuid; resultado jsonb; primeira boolean;
begin
  if not tem_permissao('engenharia', 'editar') then raise exception 'Sem permissão para editar projetos da Engenharia.'; end if;
  if coalesce(p_arvore->'raiz'->>'chave_cad', '') = '' then raise exception 'A árvore não tem a montagem geral.'; end if;

  select array_agg(x->>'chave_cad') into chaves_c from jsonb_array_elements(coalesce(p_arvore->'nos', '[]')) x;
  select array_agg(x->>'chave_cad') into chaves_p from jsonb_array_elements(coalesce(p_arvore->'pecas', '[]')) x;
  if (select count(*) from unnest(chaves_c) c where c is null or c = '') > 0
     or (select count(*) from unnest(chaves_p) c where c is null or c = '') > 0 then
    raise exception 'Todo item da árvore precisa de chave_cad.';
  end if;
  if coalesce(cardinality(chaves_c), 0) <> (select count(distinct lower(c)) from unnest(chaves_c) c)
     or coalesce(cardinality(chaves_p), 0) <> (select count(distinct lower(c)) from unnest(chaves_p) c) then
    raise exception 'Há itens repetidos na árvore (mesma chave_cad).';
  end if;

  select * into geral from projeto_conjuntos where projeto_id = p_projeto and tipo = 'geral' and excluido_em is null;
  if geral.id is null then raise exception 'Projeto sem montagem geral no ERP.'; end if;
  primeira := coalesce(geral.codigo_cad, '') = '';

  if primeira then
    resultado := importar_solidworks(p_projeto, p_arvore);
  else
    for item in select * from jsonb_array_elements(coalesce(p_arvore->'nos', '[]')) loop
      select * into ex from projeto_conjuntos
        where projeto_id = p_projeto and lower(chave_cad) = lower(item->>'chave_cad') and excluido_em is null limit 1;
      if ex.id is null then
        if item->>'pai_ref' is null then pai_id := geral.id;
        elsif lower(item->>'pai_ref') = any(novos) then pai_id := null;
        else
          select id into pai_id from projeto_conjuntos
            where projeto_id = p_projeto and lower(chave_cad) = lower(item->>'pai_ref') and excluido_em is null limit 1;
          if pai_id is null then raise exception 'Pai de % não encontrado.', item->>'nome'; end if;
        end if;
        if pai_id is null then
          novos_nos := novos_nos || jsonb_build_array(item);
        else
          novos_nos := novos_nos || jsonb_build_array((item - 'pai_ref') || jsonb_build_object('pai_id', pai_id));
        end if;
        novos := novos || lower(item->>'chave_cad');
      else
        d := '{}';
        if ex.nome is distinct from coalesce(nullif(item->>'nome', ''), ex.nome) then d := d || jsonb_build_object('nome', item->>'nome'); end if;
        if ex.quantidade is distinct from greatest(coalesce((item->>'quantidade')::numeric, 1), 0.001) then d := d || jsonb_build_object('quantidade', item->'quantidade'); end if;
        if ex.codigo_cad is distinct from coalesce(item->>'codigo_cad', '') then d := d || jsonb_build_object('codigo_cad', item->>'codigo_cad'); end if;
        if ex.arquivo_cad is distinct from coalesce(item->>'arquivo_cad', '') then d := d || jsonb_build_object('arquivo_cad', item->>'arquivo_cad'); end if;
        if ex.dados_cad is distinct from coalesce(item->'dados_cad', '{}') then d := d || jsonb_build_object('dados_cad', coalesce(item->'dados_cad', '{}')); end if;
        if ex.removido_cad_em is not null then d := d || '{"restaurar": true}'; end if;
        if d <> '{}' then alt_c := alt_c || jsonb_build_array(jsonb_build_object('id', ex.id, 'dados', d)); end if;
      end if;
    end loop;

    for item in select * from jsonb_array_elements(coalesce(p_arvore->'pecas', '[]')) loop
      select * into exp from projeto_pecas
        where projeto_id = p_projeto and lower(chave_cad) = lower(item->>'chave_cad') and excluido_em is null limit 1;
      if exp.id is null then
        if item->>'no_ref' is null then pai_id := geral.id;
        elsif lower(item->>'no_ref') = any(novos) then pai_id := null;
        else
          select id into pai_id from projeto_conjuntos
            where projeto_id = p_projeto and lower(chave_cad) = lower(item->>'no_ref') and excluido_em is null limit 1;
          if pai_id is null then raise exception 'Conjunto da peça % não encontrado.', item->>'descricao'; end if;
        end if;
        if pai_id is null then
          novas_pecas := novas_pecas || jsonb_build_array(item);
        else
          novas_pecas := novas_pecas || jsonb_build_array((item - 'no_ref') || jsonb_build_object('conjunto_id', pai_id));
        end if;
      else
        d := '{}';
        if exp.descricao is distinct from coalesce(nullif(item->>'descricao', ''), exp.descricao) then d := d || jsonb_build_object('descricao', item->>'descricao'); end if;
        if exp.quantidade is distinct from greatest(coalesce((item->>'quantidade')::numeric, 1), 0.001) then d := d || jsonb_build_object('quantidade', item->'quantidade'); end if;
        if exp.cod_op is distinct from coalesce((select array_agg(x) from jsonb_array_elements_text(item->'cod_op') x where x in ('LC','LP','PO','GU','DO','CL','US','CM')), '{}') then d := d || jsonb_build_object('cod_op', coalesce(item->'cod_op', '[]')); end if;
        if item ? 'cod_mat' and exp.cod_mat is distinct from item->>'cod_mat' then d := d || jsonb_build_object('cod_mat', item->>'cod_mat'); end if;
        if item->>'cod_mat' is null and exp.material is distinct from coalesce(nullif(item->>'material', ''), exp.material) then d := d || jsonb_build_object('material', item->>'material'); end if;
        if exp.espessura is distinct from nullif(item->>'espessura', '')::numeric then d := d || jsonb_build_object('espessura', coalesce(item->>'espessura', '')); end if;
        if exp.peso_unit is distinct from nullif(item->>'peso_unit', '')::numeric then d := d || jsonb_build_object('peso_unit', coalesce(item->>'peso_unit', '')); end if;
        if exp.comprimento is distinct from nullif(item->>'comprimento', '')::numeric then d := d || jsonb_build_object('comprimento', coalesce(item->>'comprimento', '')); end if;
        if exp.codigo_cad is distinct from coalesce(item->>'codigo_cad', '') then d := d || jsonb_build_object('codigo_cad', item->>'codigo_cad'); end if;
        if exp.arquivo_cad is distinct from coalesce(item->>'arquivo_cad', '') then d := d || jsonb_build_object('arquivo_cad', item->>'arquivo_cad'); end if;
        if exp.dados_cad is distinct from coalesce(item->'dados_cad', '{}') then d := d || jsonb_build_object('dados_cad', coalesce(item->'dados_cad', '{}')); end if;
        if exp.removido_cad_em is not null then d := d || '{"restaurar": true}'; end if;
        if d <> '{}' then alt_p := alt_p || jsonb_build_array(jsonb_build_object('id', exp.id, 'dados', d)); end if;
      end if;
    end loop;

    select coalesce(jsonb_agg(c.id), '[]') into rem_c from projeto_conjuntos c
      where c.projeto_id = p_projeto and c.chave_cad is not null and c.tipo <> 'geral' and c.excluido_em is null and c.removido_cad_em is null
        and not (lower(c.chave_cad) = any(select lower(x) from unnest(coalesce(chaves_c, '{}')) x));
    select coalesce(jsonb_agg(c.id), '[]') into rem_p from projeto_pecas c
      where c.projeto_id = p_projeto and c.chave_cad is not null and c.excluido_em is null and c.removido_cad_em is null
        and not (lower(c.chave_cad) = any(select lower(x) from unnest(coalesce(chaves_p, '{}')) x));

    resultado := atualizar_solidworks(p_projeto, jsonb_build_object(
      'codigo_cad_raiz', p_arvore->'raiz'->>'codigo_cad',
      'arquivo', p_arvore->>'arquivo', 'macro', p_arvore->>'macro', 'resumo', p_arvore->'resumo',
      'raiz_dados', p_arvore->'raiz'->'dados_cad', 'projeto_dados', p_arvore->'projeto_dados',
      'novos_nos', novos_nos, 'novas_pecas', novas_pecas,
      'alterar_conjuntos', alt_c, 'alterar_pecas', alt_p,
      'remover_conjuntos', rem_c, 'remover_pecas', rem_p));
  end if;

  update solidauto_vinculos set arvore_enviada_em = now(), arvore_enviada_por = auth.uid() where projeto_id = p_projeto;
  return coalesce(resultado, '{}') || jsonb_build_object('primeira', primeira);
end;
$$;

revoke all on function public.solidauto_eu() from public, anon;
revoke all on function public.solidauto_projetos() from public, anon;
revoke all on function public.solidauto_vincular(uuid, jsonb) from public, anon;
revoke all on function public.solidauto_desvincular(uuid) from public, anon;
revoke all on function public.solidauto_enviar_arvore(uuid, jsonb) from public, anon;
grant execute on function public.solidauto_eu() to authenticated;
grant execute on function public.solidauto_projetos() to authenticated;
grant execute on function public.solidauto_vincular(uuid, jsonb) to authenticated;
grant execute on function public.solidauto_desvincular(uuid) to authenticated;
grant execute on function public.solidauto_enviar_arvore(uuid, jsonb) to authenticated;
