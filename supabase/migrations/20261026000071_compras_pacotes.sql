-- Compras: "À comprar" e pacotes de cotação (pedido do Gabriel de 26/10/2026, decisão 111).
-- O comprador junta itens de qualquer solicitação e categoria num pacote (CT-AA-NNN), manda o pedido de cotação aos
-- fornecedores, lança os orçamentos, escolhe UM fornecedor para o pacote e gera uma ordem de compra.
-- Item no pacote = "em cotação". A OC pode juntar itens de várias solicitações (requisicao_id só quando é uma só).
set lock_timeout = '10s';

alter table public.compras_contadores drop constraint compras_contadores_tipo_check;
alter table public.compras_contadores add constraint compras_contadores_tipo_check check (tipo in ('RC', 'OC', 'CT'));

create table public.compras_pacotes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  titulo text not null check (length(trim(titulo)) >= 2),
  status text not null default 'aberto' check (status in ('aberto', 'comprado', 'cancelado')),
  observacoes text not null default '',
  criado_por uuid references public.usuarios(id) default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.compras_requisicao_itens add column pacote_id uuid references public.compras_pacotes(id);
create index compras_itens_pacote_idx on public.compras_requisicao_itens (pacote_id);

alter table public.compras_cotacoes alter column requisicao_id drop not null;
alter table public.compras_cotacoes add column pacote_id uuid references public.compras_pacotes(id) on delete cascade;
alter table public.compras_cotacoes add constraint compras_cotacoes_pacote_fornecedor_key unique (pacote_id, fornecedor_id);
alter table public.compras_cotacoes add constraint compras_cotacoes_dono_check check ((requisicao_id is null) <> (pacote_id is null));

alter table public.compras_pedidos alter column requisicao_id drop not null;
alter table public.compras_pedidos add column pacote_id uuid references public.compras_pacotes(id);

alter table public.compras_eventos alter column requisicao_id drop not null;
alter table public.compras_eventos add column pacote_id uuid references public.compras_pacotes(id) on delete cascade;
alter table public.compras_eventos drop constraint compras_eventos_tipo_check;
alter table public.compras_eventos add constraint compras_eventos_tipo_check check (tipo in ('criada', 'status', 'cotacao', 'pedido', 'entrega', 'cancelamento', 'pacote'));

-- Código e dono do pacote; status só pelas funções.
create or replace function public.compras_pacote_antes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.codigo := compras_proximo_codigo('CT');
    new.status := 'aberto';
    new.criado_por := auth.uid();
  elsif coalesce(current_setting('erp.rpc', true), '') <> 'on' and (new.status, new.codigo) is distinct from (old.status, old.codigo) then
    raise exception 'A situação do pacote só muda pelos botões do fluxo.';
  end if;
  return new;
end;
$$;
create trigger compras_pacotes_antes before insert or update on public.compras_pacotes for each row execute function compras_pacote_antes();
create trigger compras_pacotes_atualizado before update on public.compras_pacotes for each row execute function tocar_atualizado_em();
create trigger compras_pacotes_auditoria after insert or update or delete on public.compras_pacotes for each row execute function registrar_auditoria();

-- O pacote do item também só muda pelas funções.
create or replace function public.compras_item_antes() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('erp.rpc', true), '') = 'on' then return new; end if;
  if tg_op = 'INSERT' then new.status := 'a_comprar'; new.pacote_id := null; return new; end if;
  if new.status is distinct from old.status then raise exception 'A situação do item só muda pelo fluxo de Compras.'; end if;
  if new.pacote_id is distinct from old.pacote_id then raise exception 'O pacote de cotação do item só muda pelos botões do fluxo.'; end if;
  if old.status <> 'a_comprar' then raise exception 'Item já comprado não muda.'; end if;
  return new;
end;
$$;

create or replace function public.compras_pacote_aberto(p_pacote uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from compras_pacotes where id = p_pacote and status = 'aberto');
$$;

-- Evento da cotação: na requisição (antigo) ou no pacote.
create or replace function public.compras_cotacao_criada() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into compras_eventos (requisicao_id, pacote_id, tipo, dados)
  values (new.requisicao_id, new.pacote_id, 'cotacao', jsonb_build_object('fornecedor', (select nome from fornecedores where id = new.fornecedor_id)));
  return new;
end;
$$;

-- Itens que podem entrar num pacote: à comprar, sem pacote, de solicitação aberta.
create or replace function public.compras_conferir_itens(p_itens uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if p_itens is null or cardinality(p_itens) = 0 then raise exception 'Selecione os itens.'; end if;
  select count(*) into n from compras_requisicao_itens i join compras_requisicoes r on r.id = i.requisicao_id
  where i.id = any(p_itens) and i.status = 'a_comprar' and i.pacote_id is null and r.status = 'aberta';
  if n <> cardinality(p_itens) then raise exception 'Algum item selecionado já está em cotação, foi comprado ou cancelado. Atualize a tela.'; end if;
end;
$$;

-- Cria o pacote com os itens selecionados.
create or replace function public.compras_criar_pacote(p_titulo text, p_itens uuid[], p_observacoes text default '') returns uuid
language plpgsql security definer set search_path = public as $$
declare v compras_pacotes;
begin
  if not tem_permissao('compras', 'editar') then raise exception 'Sem permissão para criar pacote de cotação.'; end if;
  perform compras_conferir_itens(p_itens);
  insert into compras_pacotes (titulo, observacoes) values (trim(p_titulo), coalesce(p_observacoes, '')) returning * into v;
  perform set_config('erp.rpc', 'on', true);
  update compras_requisicao_itens set pacote_id = v.id where id = any(p_itens);
  perform set_config('erp.rpc', 'off', true);
  insert into compras_eventos (pacote_id, tipo, dados) values (v.id, 'pacote', jsonb_build_object('acao', 'criado', 'itens', cardinality(p_itens)));
  return v.id;
end;
$$;

create or replace function public.compras_pacote_adicionar(p_pacote uuid, p_itens uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('compras', 'editar') then raise exception 'Sem permissão.'; end if;
  if not compras_pacote_aberto(p_pacote) then raise exception 'O pacote não está mais aberto.'; end if;
  perform compras_conferir_itens(p_itens);
  perform set_config('erp.rpc', 'on', true);
  update compras_requisicao_itens set pacote_id = p_pacote where id = any(p_itens);
  perform set_config('erp.rpc', 'off', true);
  insert into compras_eventos (pacote_id, tipo, dados) values (p_pacote, 'pacote', jsonb_build_object('acao', 'adicionados', 'itens', cardinality(p_itens)));
end;
$$;

-- Tira itens do pacote: voltam para "À comprar" (os preços lançados para eles saem).
create or replace function public.compras_pacote_retirar(p_pacote uuid, p_itens uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('compras', 'editar') then raise exception 'Sem permissão.'; end if;
  if not compras_pacote_aberto(p_pacote) then raise exception 'O pacote não está mais aberto.'; end if;
  delete from compras_cotacao_precos p using compras_cotacoes c
   where p.cotacao_id = c.id and c.pacote_id = p_pacote and p.item_id = any(p_itens);
  perform set_config('erp.rpc', 'on', true);
  update compras_requisicao_itens set pacote_id = null where pacote_id = p_pacote and status = 'a_comprar' and id = any(p_itens);
  perform set_config('erp.rpc', 'off', true);
  insert into compras_eventos (pacote_id, tipo, dados) values (p_pacote, 'pacote', jsonb_build_object('acao', 'retirados', 'itens', cardinality(p_itens)));
end;
$$;

-- Cancela o pacote: todos os itens voltam para "À comprar".
create or replace function public.compras_cancelar_pacote(p_pacote uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('compras', 'editar') then raise exception 'Sem permissão.'; end if;
  if not compras_pacote_aberto(p_pacote) then raise exception 'O pacote não está mais aberto.'; end if;
  perform set_config('erp.rpc', 'on', true);
  update compras_requisicao_itens set pacote_id = null where pacote_id = p_pacote and status = 'a_comprar';
  update compras_pacotes set status = 'cancelado' where id = p_pacote;
  perform set_config('erp.rpc', 'off', true);
  insert into compras_eventos (pacote_id, tipo, justificativa, dados) values (p_pacote, 'cancelamento', trim(coalesce(p_motivo, '')), '{}');
end;
$$;

-- Gera a OC do pacote com o fornecedor escolhido. Itens sem preço nesse orçamento voltam para "À comprar".
create or replace function public.compras_gerar_pedido_pacote(p_pacote uuid, p_cotacao uuid, p_previsao date default null, p_observacoes text default '') returns text
language plpgsql security definer set search_path = public as $$
declare k compras_cotacoes; o compras_pedidos; v_itens numeric; v_req uuid; n integer;
begin
  if not tem_permissao('compras', 'editar') then raise exception 'Sem permissão para gerar ordem de compra.'; end if;
  perform 1 from compras_pacotes where id = p_pacote and status = 'aberto' for update;
  if not found then raise exception 'O pacote não está mais aberto.'; end if;
  select * into k from compras_cotacoes where id = p_cotacao and pacote_id = p_pacote;
  if not found then raise exception 'Orçamento não pertence a este pacote.'; end if;

  select count(*), coalesce(sum(round(i.quantidade * p.valor_unit, 2)), 0) into n, v_itens
  from compras_requisicao_itens i join compras_cotacao_precos p on p.cotacao_id = k.id and p.item_id = i.id
  where i.pacote_id = p_pacote and i.status = 'a_comprar';
  if n = 0 then raise exception 'Este fornecedor não tem preço para nenhum item do pacote.'; end if;

  select case when count(distinct i.requisicao_id) = 1 then min(i.requisicao_id::text)::uuid end into v_req
  from compras_requisicao_itens i join compras_cotacao_precos p on p.cotacao_id = k.id and p.item_id = i.id
  where i.pacote_id = p_pacote and i.status = 'a_comprar';

  insert into compras_pedidos (codigo, requisicao_id, pacote_id, cotacao_id, fornecedor_id, valor_itens, frete, valor_total, previsao_entrega,
    condicao_tipo, condicao_dias, condicao_texto, orcamento_caminho, observacoes)
  values (compras_proximo_codigo('OC'), v_req, p_pacote, k.id, k.fornecedor_id, v_itens, k.frete, v_itens + k.frete,
    coalesce(p_previsao, case when k.prazo_dias is not null then ano_atual_data() + k.prazo_dias end),
    k.condicao_tipo, k.condicao_dias, k.condicao_pagamento, k.orcamento_caminho, coalesce(p_observacoes, ''))
  returning * into o;
  insert into compras_pedido_itens (pedido_id, item_id, quantidade, valor_unit)
  select o.id, i.id, i.quantidade, p.valor_unit from compras_requisicao_itens i join compras_cotacao_precos p on p.cotacao_id = k.id and p.item_id = i.id
  where i.pacote_id = p_pacote and i.status = 'a_comprar';

  perform set_config('erp.rpc', 'on', true);
  update compras_requisicao_itens set status = 'comprado', cotacao_escolhida_id = k.id where id in (select item_id from compras_pedido_itens where pedido_id = o.id);
  update compras_requisicao_itens set pacote_id = null where pacote_id = p_pacote and status = 'a_comprar';
  update compras_pacotes set status = 'comprado' where id = p_pacote;
  perform set_config('erp.rpc', 'off', true);

  insert into compras_eventos (pacote_id, tipo, dados) values (p_pacote, 'pedido', jsonb_build_object('codigo', o.codigo, 'total', o.valor_total, 'fornecedor', (select nome from fornecedores where id = o.fornecedor_id)));
  insert into compras_eventos (requisicao_id, tipo, dados)
  select distinct i.requisicao_id, 'pedido', jsonb_build_object('codigo', o.codigo, 'total', o.valor_total, 'fornecedor', (select nome from fornecedores where id = o.fornecedor_id))
  from compras_pedido_itens pi join compras_requisicao_itens i on i.id = pi.item_id where pi.pedido_id = o.id;
  return o.codigo;
end;
$$;

-- Cancelar OC: os itens voltam para "À comprar" (fora do pacote); requisições atualizadas.
create or replace function public.compras_cancelar_pedido(p_pedido uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare o compras_pedidos; r uuid;
begin
  if not tem_permissao('compras', 'editar') then raise exception 'Sem permissão para cancelar ordem de compra.'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Informe o motivo do cancelamento.'; end if;
  select * into o from compras_pedidos where id = p_pedido for update;
  if not found then raise exception 'Ordem de compra não encontrada.'; end if;
  if o.status <> 'aguardando_entrega' then raise exception 'Só uma ordem sem entrega pode ser cancelada.'; end if;
  update compras_pedidos set status = 'cancelada', cancelado_motivo = trim(p_motivo), cancelado_em = now() where id = p_pedido;
  perform set_config('erp.rpc', 'on', true);
  update compras_requisicao_itens set status = 'a_comprar', pacote_id = null, cotacao_escolhida_id = null
   where id in (select item_id from compras_pedido_itens where pedido_id = p_pedido) and status = 'comprado';
  perform set_config('erp.rpc', 'off', true);
  if o.pacote_id is not null then
    insert into compras_eventos (pacote_id, tipo, de, para, justificativa, dados) values (o.pacote_id, 'cancelamento', o.status, 'cancelada', trim(p_motivo), jsonb_build_object('codigo', o.codigo));
  end if;
  for r in select distinct i.requisicao_id from compras_pedido_itens pi join compras_requisicao_itens i on i.id = pi.item_id where pi.pedido_id = p_pedido loop
    insert into compras_eventos (requisicao_id, tipo, de, para, justificativa, dados) values (r, 'cancelamento', o.status, 'cancelada', trim(p_motivo), jsonb_build_object('codigo', o.codigo));
    perform compras_atualizar_requisicao(r);
  end loop;
end;
$$;

-- Recebimento (Almoxarifado): atualiza todas as requisições dos itens da OC.
create or replace function public.compras_registrar_entrega(p_pedido uuid, p_data date, p_itens jsonb default null, p_observacao text default '') returns void
language plpgsql security definer set search_path = public as $$
declare o compras_pedidos; i jsonb; v_status text; r uuid;
begin
  if not tem_permissao('almoxarifado', 'editar') then raise exception 'Só o Almoxarifado registra o recebimento.'; end if;
  select * into o from compras_pedidos where id = p_pedido for update;
  if not found then raise exception 'Ordem de compra não encontrada.'; end if;
  if o.status in ('entregue', 'cancelada') then raise exception 'Esta ordem de compra já foi %.', case o.status when 'entregue' then 'entregue' else 'cancelada' end; end if;
  if p_data is null then raise exception 'Informe a data da entrega.'; end if;

  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    update compras_pedido_itens set quantidade_recebida = quantidade where pedido_id = p_pedido;
  else
    for i in select * from jsonb_array_elements(p_itens) loop
      if (i->>'quantidade')::numeric < 0 then raise exception 'Quantidade inválida.'; end if;
      update compras_pedido_itens set quantidade_recebida = quantidade_recebida + (i->>'quantidade')::numeric
      where pedido_id = p_pedido and item_id = (i->>'item_id')::uuid;
      if not found then raise exception 'Item não pertence a esta ordem de compra.'; end if;
    end loop;
  end if;

  perform set_config('erp.rpc', 'on', true);
  update compras_requisicao_itens ri set status = 'recebido'
  from compras_pedido_itens pi where pi.pedido_id = p_pedido and pi.item_id = ri.id and pi.quantidade_recebida >= pi.quantidade and ri.status = 'comprado';
  perform set_config('erp.rpc', 'off', true);

  v_status := case when not exists (select 1 from compras_pedido_itens where pedido_id = p_pedido and quantidade_recebida < quantidade) then 'entregue' else 'entregue_parcial' end;
  update compras_pedidos set status = v_status, entregue_em = case when v_status = 'entregue' then p_data else entregue_em end where id = p_pedido;
  for r in select distinct ri.requisicao_id from compras_pedido_itens pi join compras_requisicao_itens ri on ri.id = pi.item_id where pi.pedido_id = p_pedido loop
    insert into compras_eventos (requisicao_id, tipo, de, para, justificativa, dados)
    values (r, 'entrega', o.status, v_status, coalesce(p_observacao, ''), jsonb_build_object('data', p_data, 'codigo', o.codigo));
    perform compras_atualizar_requisicao(r);
  end loop;
end;
$$;

-- Almoxarifado (decisão 108): a OC do pacote pode juntar várias solicitações (requisicao_id vazio). A lista de OCs a
-- receber passa a mostrar as solicitações dos itens e o destino de cada item pela solicitação dele.
create or replace function public.alm_ocs_a_receber() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not tem_permissao('almoxarifado', 'ler') then return '[]'; end if;
  if not alm_recebimento_disponivel() then return '[]'; end if;
  select coalesce(jsonb_agg(o order by o->>'previsao' nulls last, o->>'codigo'), '[]') into v from (
    select jsonb_build_object(
      'id', p.id, 'codigo', p.codigo, 'status', p.status, 'previsao', p.previsao_entrega, 'emitido_em', p.emitido_em,
      'fornecedor', f.nome, 'requisicao_codigo', rs.codigos, 'requisicao_titulo', rs.titulos, 'origem', rs.origem, 'setor', rs.setores,
      'projeto_codigo', rs.projetos, 'projeto_titulo', rs.projeto_titulos,
      'itens', (select jsonb_agg(jsonb_build_object(
          'item_id', ri.id, 'descricao', ri.descricao, 'unidade', ri.unidade, 'grupo', ri.grupo,
          'quantidade', pi.quantidade, 'recebida', pi.quantidade_recebida, 'valor_unit', pi.valor_unit,
          'destino', case when r.projeto_id is not null then 'projeto' when ri.bib_id is not null then 'estoque' else 'setor' end,
          'requisicao_codigo', r.codigo, 'projeto_codigo', r.projeto_codigo)
          order by r.codigo, ri.ordem)
        from compras_pedido_itens pi join compras_requisicao_itens ri on ri.id = pi.item_id join compras_requisicoes r on r.id = ri.requisicao_id
        where pi.pedido_id = p.id)) o
    from compras_pedidos p
    left join fornecedores f on f.id = p.fornecedor_id
    cross join lateral (
      select string_agg(distinct r.codigo, ', ') codigos, string_agg(distinct r.titulo, ' · ') titulos,
        case when count(distinct r.origem) = 1 then min(r.origem) else 'compras' end origem,
        coalesce(string_agg(distinct nullif(r.setor, ''), ', '), '') setores,
        coalesce(string_agg(distinct nullif(r.projeto_codigo, ''), ', '), '') projetos,
        coalesce(string_agg(distinct nullif(r.projeto_titulo, ''), ' · '), '') projeto_titulos
      from compras_pedido_itens pi join compras_requisicao_itens ri on ri.id = pi.item_id join compras_requisicoes r on r.id = ri.requisicao_id
      where pi.pedido_id = p.id) rs
    where p.status in ('aguardando_entrega', 'entregue_parcial')
  ) x(o);
  return v;
end;
$$;

-- Segurança ----------------------------------------------------------------------------------------------------
alter table public.compras_pacotes enable row level security;
create policy compras_pacotes_ler on public.compras_pacotes for select to authenticated using (tem_permissao('compras', 'ler'));
create policy compras_pacotes_criar on public.compras_pacotes for insert to authenticated with check (false);
create policy compras_pacotes_editar on public.compras_pacotes for update to authenticated
  using (tem_permissao('compras', 'editar') and status = 'aberto') with check (tem_permissao('compras', 'editar'));
grant select, update (titulo, observacoes) on public.compras_pacotes to authenticated;

drop policy compras_cotacoes_gravar on public.compras_cotacoes;
create policy compras_cotacoes_gravar on public.compras_cotacoes for all to authenticated
  using (tem_permissao('compras', 'editar') and (compras_requisicao_aberta(requisicao_id) or compras_pacote_aberto(pacote_id)))
  with check (tem_permissao('compras', 'editar') and (compras_requisicao_aberta(requisicao_id) or compras_pacote_aberto(pacote_id)));

do $$
declare f text;
begin
  foreach f in array array[
    'public.compras_pacote_aberto(uuid)', 'public.compras_criar_pacote(text, uuid[], text)', 'public.compras_pacote_adicionar(uuid, uuid[])',
    'public.compras_pacote_retirar(uuid, uuid[])', 'public.compras_cancelar_pacote(uuid, text)', 'public.compras_gerar_pedido_pacote(uuid, uuid, date, text)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.compras_conferir_itens(uuid[]) from public, anon, authenticated;
