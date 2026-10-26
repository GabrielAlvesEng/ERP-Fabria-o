-- Compras: IPI por item no orçamento (pedido do Gabriel de 26/10/2026, decisão 113): os fornecedores mandam o IPI
-- separado do valor unitário. O total do item passa a ser quantidade × valor unitário × (1 + IPI%), e a OC (e a conta a
-- pagar do Financeiro, que usa o total da OC) já sai com o IPI.
set lock_timeout = '10s';

alter table public.compras_cotacao_precos add column ipi numeric(5,2) not null default 0 check (ipi >= 0 and ipi <= 100);
alter table public.compras_pedido_itens add column ipi numeric(5,2) not null default 0 check (ipi >= 0 and ipi <= 100);

-- Histórico do produto com o IPI pago (coluna nova no fim da view).
create or replace view public.compras_historico with (security_invoker = true) as
select pi.pedido_id, pi.item_id, i.bib_tipo, i.bib_id, i.grupo, i.descricao, i.unidade, pi.quantidade, pi.valor_unit,
  pi.quantidade_recebida, o.codigo as pedido_codigo, o.emitido_em, o.status as pedido_status, o.fornecedor_id, f.nome as fornecedor_nome,
  r.codigo as requisicao_codigo, r.projeto_codigo, r.origem, pi.ipi
from compras_pedido_itens pi
join compras_pedidos o on o.id = pi.pedido_id
join compras_requisicao_itens i on i.id = pi.item_id
join compras_requisicoes r on r.id = i.requisicao_id
join fornecedores f on f.id = o.fornecedor_id
where o.status <> 'cancelada';

-- OC do pacote (decisão 111) com o IPI de cada item.
create or replace function public.compras_gerar_pedido_pacote(p_pacote uuid, p_cotacao uuid, p_previsao date default null, p_observacoes text default '') returns text
language plpgsql security definer set search_path = public as $$
declare k compras_cotacoes; o compras_pedidos; v_itens numeric; v_req uuid; n integer;
begin
  if not tem_permissao('compras', 'editar') then raise exception 'Sem permissão para gerar ordem de compra.'; end if;
  perform 1 from compras_pacotes where id = p_pacote and status = 'aberto' for update;
  if not found then raise exception 'O pacote não está mais aberto.'; end if;
  select * into k from compras_cotacoes where id = p_cotacao and pacote_id = p_pacote;
  if not found then raise exception 'Orçamento não pertence a este pacote.'; end if;

  select count(*), coalesce(sum(round(i.quantidade * p.valor_unit * (1 + p.ipi / 100), 2)), 0) into n, v_itens
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
  insert into compras_pedido_itens (pedido_id, item_id, quantidade, valor_unit, ipi)
  select o.id, i.id, i.quantidade, p.valor_unit, p.ipi from compras_requisicao_itens i join compras_cotacao_precos p on p.cotacao_id = k.id and p.item_id = i.id
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
