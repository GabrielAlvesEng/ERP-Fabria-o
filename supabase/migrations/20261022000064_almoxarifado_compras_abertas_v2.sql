-- Almoxarifado (decisão 104): no Compras v2 a requisição termina como 'concluida' (o 'entregue' some). Vale antes e depois.
create or replace function public.alm_compras_abertas() returns table (item_id uuid, requisicao_codigo text, criado_em timestamptz)
language sql stable security definer set search_path = public as $$
  select distinct on (s.item_id) s.item_id, r.codigo, s.criado_em
  from alm_solicitacoes s join compras_requisicoes r on r.id = s.requisicao_id
  where tem_permissao('almoxarifado', 'ler') and r.status not in ('entregue', 'concluida', 'cancelada')
  order by s.item_id, s.criado_em desc;
$$;
