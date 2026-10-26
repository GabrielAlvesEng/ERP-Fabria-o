-- Almoxarifado (decisão 104): "Solicitar compra" do estoque vira uma requisição em Compras com setor Almoxarifado, sem
-- projeto. Usa public.compras_solicitar('almoxarifado', ...) quando o Compras v2 estiver no banco; até lá, cria a
-- requisição pelas mesmas tabelas de Compras (decisão 101). O vínculo item do estoque → requisição fica em alm_solicitacoes.
set lock_timeout = '10s';

create table public.alm_solicitacoes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.alm_itens(id),
  requisicao_id uuid not null references public.compras_requisicoes(id),
  quantidade numeric(14,3) not null check (quantidade > 0),
  usuario_id uuid default auth.uid() references public.usuarios(id),
  criado_em timestamptz not null default now()
);
create index alm_solicitacoes_item on public.alm_solicitacoes (item_id);

create or replace function public.alm_solicitar_compra(p_itens jsonb, p_necessario_em date, p_prioridade text, p_observacoes text) returns uuid
language plpgsql security definer set search_path = public as $$
declare x jsonb; i record; v_req uuid; v_itens jsonb := '[]'; v_n integer := 0; v_qtd numeric; v_titulo text;
begin
  if not (tem_permissao('almoxarifado', 'criar') or tem_permissao('almoxarifado', 'editar')) then raise exception 'Sem permissão para solicitar compras do estoque.'; end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then raise exception 'Inclua pelo menos um item.'; end if;
  for x in select * from jsonb_array_elements(p_itens) loop
    v_qtd := (x->>'quantidade')::numeric;
    if v_qtd is null or v_qtd <= 0 then raise exception 'Quantidade inválida.'; end if;
    select a.id, a.bib_tipo, a.bib_id, a.unidade, e.grupo, e.descricao into i
      from alm_itens a join alm_estoque_interno() e on e.id = a.id where a.id = (x->>'item_id')::uuid;
    if not found then raise exception 'Item de estoque não encontrado.'; end if;
    v_itens := v_itens || jsonb_build_array(jsonb_build_object('item_id', i.id, 'grupo', i.grupo, 'descricao', i.descricao, 'quantidade', v_qtd,
      'unidade', i.unidade, 'bib_tipo', i.bib_tipo, 'bib_id', i.bib_id, 'observacoes', 'Reposição de estoque'));
    v_n := v_n + 1;
  end loop;
  v_titulo := case when v_n = 1 then 'Estoque: ' || (v_itens->0->>'descricao') else format('Reposição do estoque (%s itens)', v_n) end;

  if to_regprocedure('public.compras_solicitar(text,jsonb,jsonb)') is not null then
    execute 'select public.compras_solicitar($1, $2, $3)' into v_req
      using 'almoxarifado', jsonb_build_object('titulo', left(v_titulo, 200), 'necessario_em', p_necessario_em,
        'prioridade', coalesce(nullif(p_prioridade, ''), 'normal'), 'observacoes', coalesce(p_observacoes, '')), v_itens;
  else
    insert into compras_requisicoes (titulo, setor, necessario_em, prioridade, observacoes)
    values (left(v_titulo, 200), 'Almoxarifado', p_necessario_em, coalesce(nullif(p_prioridade, ''), 'normal'), coalesce(p_observacoes, ''))
    returning id into v_req;
    insert into compras_requisicao_itens (requisicao_id, ordem, grupo, descricao, quantidade, unidade, observacoes)
    select v_req, n - 1, e->>'grupo', e->>'descricao', (e->>'quantidade')::numeric, e->>'unidade', e->>'observacoes'
    from jsonb_array_elements(v_itens) with ordinality t(e, n);
  end if;

  insert into alm_solicitacoes (item_id, requisicao_id, quantidade)
  select (e->>'item_id')::uuid, v_req, (e->>'quantidade')::numeric from jsonb_array_elements(v_itens) e;
  return v_req;
end;
$$;

-- Descrição e grupo do item sem a checagem de leitura (uso interno; alm_estoque() continua sendo a leitura da tela).
create or replace function public.alm_estoque_interno() returns table (id uuid, grupo text, descricao text)
language sql stable security definer set search_path = public as $$
  select a.id,
    case a.bib_tipo when 'chapa' then 'Chapas' when 'perfil' then 'Perfis' else bi.grupo end,
    coalesce(case a.bib_tipo when 'chapa' then bc.descricao when 'perfil' then bp.descricao else bi.descricao end, '(produto removido do cadastro)')
  from alm_itens a
  left join bib_chapas bc on a.bib_tipo = 'chapa' and bc.id = a.bib_id
  left join bib_perfis bp on a.bib_tipo = 'perfil' and bp.id = a.bib_id
  left join bib_itens bi on a.bib_tipo = 'item' and bi.id = a.bib_id;
$$;

-- Solicitações do estoque ainda em andamento em Compras (nem entregues nem canceladas), a mais recente por item.
create or replace function public.alm_compras_abertas() returns table (item_id uuid, requisicao_codigo text, criado_em timestamptz)
language sql stable security definer set search_path = public as $$
  select distinct on (s.item_id) s.item_id, r.codigo, s.criado_em
  from alm_solicitacoes s join compras_requisicoes r on r.id = s.requisicao_id
  where tem_permissao('almoxarifado', 'ler') and r.status not in ('entregue', 'cancelada')
  order by s.item_id, s.criado_em desc;
$$;

alter table public.alm_solicitacoes enable row level security;
create policy alm_solicitacoes_ler on public.alm_solicitacoes for select to authenticated using (tem_permissao('almoxarifado', 'ler'));
grant select on public.alm_solicitacoes to authenticated;
create trigger alm_solicitacoes_auditoria after insert or update or delete on public.alm_solicitacoes for each row execute function registrar_auditoria();

revoke execute on function public.alm_solicitar_compra(jsonb, date, text, text) from public, anon;
grant execute on function public.alm_solicitar_compra(jsonb, date, text, text) to authenticated;
revoke execute on function public.alm_compras_abertas() from public, anon;
grant execute on function public.alm_compras_abertas() to authenticated;
revoke execute on function public.alm_estoque_interno() from public, anon, authenticated;
