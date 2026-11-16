-- Decisão 133 (Gabriel, 16/11/2026): o cadastro do produto é feito na emissão da ordem de compra, não antes.
-- "acho que deveria fazer o cadastro do produto só depois que emitir o pedido de compra (realizar a compra realmente)";
-- "Serviços fica de fora". A cotação segue com a descrição livre; ao gerar a OC, cada item sem produto é ligado a um
-- produto que já existe ou a um produto novo. A OC recusa item sem produto, menos os do grupo Serviços.

-- 1) Conexões e Válvulas também viram tipos de produto (decisão 130 criou os grupos).
alter table public.bib_itens drop constraint bib_itens_grupo_check;
alter table public.bib_itens add constraint bib_itens_grupo_check
  check (grupo in ('Chapas', 'Perfis', 'Barras', 'Comerciais', 'Conexões', 'Válvulas', 'Fixadores', 'Consumíveis'));

-- 2) Ligar um item à comprar a um produto do cadastro. O item passa a usar a descrição e o tipo do produto
-- (quantidade e unidade ficam como estão). Os preços já lançados nas cotações do item entram no histórico do produto
-- como "cotado" (o gatilho compras_preco_para_produto roda de novo para cada preço).
create or replace function public.compras_vincular_produto(p_item uuid, p_produto uuid)
returns void language plpgsql security definer set search_path = public as $$
declare it compras_requisicao_itens; pr bib_itens;
begin
  if not tem_permissao('compras', 'editar') then raise exception 'Sem permissão para ligar produtos.'; end if;
  select * into it from compras_requisicao_itens where id = p_item for update;
  if not found then raise exception 'Item não encontrado.'; end if;
  if it.status <> 'a_comprar' then raise exception 'Item já comprado não muda.'; end if;
  select * into pr from bib_itens where id = p_produto and ativo;
  if not found then raise exception 'Produto não encontrado no cadastro.'; end if;
  -- Preços cotados que estavam no produto antigo saem dele.
  if it.bib_tipo = 'item' and it.bib_id is not null and it.bib_id <> p_produto then
    delete from bib_item_precos where item_id = it.bib_id and cotacao_id in (select cotacao_id from compras_cotacao_precos where item_id = it.id);
  end if;
  perform set_config('erp.rpc', 'on', true);
  update compras_requisicao_itens set bib_tipo = 'item', bib_id = pr.id, descricao = pr.descricao, grupo = pr.grupo where id = it.id;
  perform set_config('erp.rpc', 'off', true);
  update compras_cotacao_precos set valor_unit = valor_unit where item_id = it.id;
end;
$$;
revoke execute on function public.compras_vincular_produto(uuid, uuid) from public, anon;
grant execute on function public.compras_vincular_produto(uuid, uuid) to authenticated;

-- 3) Gerar a OC do pacote: recusa item sem produto (menos Serviços).
create or replace function public.compras_gerar_pedido_pacote(p_pacote uuid, p_cotacao uuid, p_previsao date default null, p_observacoes text default '') returns text
language plpgsql security definer set search_path = public as $$
declare k compras_cotacoes; o compras_pedidos; v_itens numeric; v_req uuid; n integer; v_falta text;
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
  -- Decisão 133: todo item da OC sai com produto do cadastro (menos Serviços).
  select string_agg(i.descricao, ', ' order by i.ordem) into v_falta
  from compras_requisicao_itens i join compras_cotacao_precos p on p.cotacao_id = k.id and p.item_id = i.id
  where i.pacote_id = p_pacote and i.status = 'a_comprar' and i.bib_id is null and i.grupo <> 'Serviços';
  if v_falta is not null then raise exception 'Escolha ou cadastre o produto antes de gerar a OC: %', v_falta; end if;

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
