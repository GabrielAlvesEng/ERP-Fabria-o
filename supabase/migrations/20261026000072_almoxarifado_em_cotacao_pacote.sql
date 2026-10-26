-- Almoxarifado → Solicitações (decisão 110), ajuste pela decisão 111 de Compras: "em cotação" passa a ser o item
-- à comprar que já está num pacote de cotação (pacote_id), e não mais o item com preço lançado.
set lock_timeout = '10s';

create or replace function public.alm_minhas_solicitacoes(p_desde date default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x.o order by x.criado_em desc), '[]') from (
    select r.criado_em, jsonb_build_object('id', r.id, 'codigo', r.codigo, 'titulo', r.titulo, 'status', r.status, 'prioridade', r.prioridade,
      'necessario_em', r.necessario_em, 'observacoes', r.observacoes, 'criado_em', r.criado_em, 'solicitante', u.nome,
      'itens', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'descricao', i.descricao, 'grupo', i.grupo, 'quantidade', i.quantidade,
          'unidade', i.unidade, 'cadastrado', i.bib_id is not null, 'observacoes', i.observacoes,
          'situacao', case when i.status = 'a_comprar' and i.pacote_id is not null then 'em_cotacao' else i.status end,
          'pedido', (select p.codigo from compras_pedido_itens pi join compras_pedidos p on p.id = pi.pedido_id where pi.item_id = i.id and p.status <> 'cancelada' order by p.emitido_em desc limit 1),
          'recebida', (select coalesce(sum(pi.quantidade_recebida), 0) from compras_pedido_itens pi join compras_pedidos p on p.id = pi.pedido_id where pi.item_id = i.id and p.status <> 'cancelada'))
          order by i.ordem), '[]') from compras_requisicao_itens i where i.requisicao_id = r.id)) o
    from compras_requisicoes r left join usuarios u on u.id = r.solicitante_id
    where tem_permissao('almoxarifado', 'ler') and r.origem = 'almoxarifado' and (p_desde is null or r.criado_em >= p_desde)
  ) x;
$$;
