-- Decisão 145: Compras atende um item do "À comprar" pelo estoque do Almoxarifado (uma venda interna).
-- O comprador vê o disponível (saldo menos o já reservado), escolhe o produto do estoque e a quantidade. A reserva para o
-- projeto (ou setor) vale na hora, sem aprovação, com o custo da última compra do produto. Atendimento parcial divide o item:
-- o resto continua à comprar. O Almoxarifado separa e entrega a reserva, e aí sai do saldo (movimento de retirada).
set lock_timeout = '10s';

alter table public.compras_requisicao_itens drop constraint compras_requisicao_itens_status_check;
alter table public.compras_requisicao_itens add constraint compras_requisicao_itens_status_check
  check (status in ('a_comprar', 'comprado', 'recebido', 'cancelado', 'estoque'));

alter table public.alm_reservas
  add column alm_item_id uuid references public.alm_itens(id),
  add column compra_item_id uuid references public.compras_requisicao_itens(id),
  add column custo_unit numeric(14,4),
  add column movimento_id uuid references public.alm_movimentos(id),
  add column cancelado_motivo text not null default '';
alter table public.alm_reservas drop constraint alm_reservas_status_check;
alter table public.alm_reservas add constraint alm_reservas_status_check check (status in ('reservado', 'entregue', 'cancelado'));
create index alm_reservas_estoque_idx on public.alm_reservas (alm_item_id) where status = 'reservado';

-- Quanto do saldo já está reservado (ainda não entregue).
create or replace function public.alm_reservado(p_item uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(quantidade), 0) from alm_reservas where alm_item_id = p_item and status = 'reservado';
$$;

-- Custo da última compra: a última entrada de uma OC; sem ela, o último preço "comprado" do produto; sem ele, o custo médio.
create or replace function public.alm_custo_ultima_compra(p_item uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select m.custo_unit from alm_movimentos m where m.item_id = p_item and m.tipo = 'entrada' and m.pedido_id is not null and m.custo_unit > 0
      order by m.criado_em desc limit 1),
    (select p.valor_unit from bib_item_precos p join alm_itens a on a.bib_tipo = 'item' and a.bib_id = p.item_id
      where a.id = p_item and p.origem = 'comprado' order by p.data desc, p.criado_em desc limit 1),
    (select custo_medio from alm_itens where id = p_item), 0);
$$;

-- Estoque visto por Compras: disponível = saldo − reservado.
create or replace function public.compras_estoque_disponivel()
returns table(id uuid, bib_tipo text, bib_id uuid, grupo text, descricao text, unidade text, saldo numeric, reservado numeric,
  disponivel numeric, local text, custo numeric)
language sql stable security definer set search_path = public as $$
  select a.id, a.bib_tipo, a.bib_id,
    case a.bib_tipo when 'chapa' then 'Chapas' when 'perfil' then 'Perfis' else bi.grupo end,
    coalesce(case a.bib_tipo when 'chapa' then bc.descricao when 'perfil' then bp.descricao else bi.descricao end, '(produto removido do cadastro)'),
    a.unidade, a.saldo, alm_reservado(a.id), greatest(a.saldo - alm_reservado(a.id), 0), a.local, alm_custo_ultima_compra(a.id)
  from alm_itens a
  left join bib_chapas bc on a.bib_tipo = 'chapa' and bc.id = a.bib_id
  left join bib_perfis bp on a.bib_tipo = 'perfil' and bp.id = a.bib_id
  left join bib_itens bi on a.bib_tipo = 'item' and bi.id = a.bib_id
  where a.ativo and tem_permissao('compras', 'ler');
$$;

create or replace function public.compras_atender_estoque(p_item uuid, p_estoque uuid, p_quantidade numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare it compras_requisicao_itens; r compras_requisicoes; a alm_itens; v_disp numeric; v_custo numeric; v_item uuid; v_res uuid;
begin
  if not tem_permissao('compras', 'editar') then raise exception 'Sem permissão para editar Compras.'; end if;
  if p_quantidade is null or p_quantidade <= 0 then raise exception 'Informe a quantidade.'; end if;
  select * into it from compras_requisicao_itens where id = p_item for update;
  if not found then raise exception 'Item não encontrado.'; end if;
  if it.status <> 'a_comprar' then raise exception 'Só dá para atender pelo estoque um item que está à comprar.'; end if;
  if it.pacote_id is not null then raise exception 'O item está num pacote de cotação. Tire do pacote antes.'; end if;
  if not compras_requisicao_aberta(it.requisicao_id) then raise exception 'A requisição deste item não está aberta.'; end if;
  if p_quantidade > it.quantidade then raise exception 'O item pede só % %.', trim_scale(it.quantidade), it.unidade; end if;
  select * into r from compras_requisicoes where id = it.requisicao_id;
  if r.origem = 'almoxarifado' then raise exception 'Este item foi pedido pelo Almoxarifado para repor o estoque.'; end if;
  select * into a from alm_itens where id = p_estoque and ativo for update;
  if not found then raise exception 'Produto do estoque não encontrado.'; end if;
  v_disp := a.saldo - alm_reservado(a.id);
  if p_quantidade > v_disp then raise exception 'No estoque há só % % disponível.', trim_scale(greatest(v_disp, 0)), a.unidade; end if;
  v_custo := alm_custo_ultima_compra(a.id);

  perform set_config('erp.rpc', 'on', true);
  if p_quantidade < it.quantidade then
    update compras_requisicao_itens set quantidade = quantidade - p_quantidade where id = it.id;
    insert into compras_requisicao_itens (requisicao_id, ordem, grupo, descricao, quantidade, unidade, observacoes, bib_tipo, bib_id, status,
      referencia_link, referencia_imagem)
    values (it.requisicao_id, it.ordem, it.grupo, it.descricao, p_quantidade, it.unidade, it.observacoes, it.bib_tipo, it.bib_id, 'estoque',
      it.referencia_link, it.referencia_imagem)
    returning id into v_item;
  else
    update compras_requisicao_itens set status = 'estoque' where id = it.id;
    v_item := it.id;
  end if;
  insert into alm_reservas (projeto_id, projeto_codigo, projeto_titulo, descricao, unidade, quantidade, bib_tipo, bib_id, pedido_codigo,
    alm_item_id, compra_item_id, custo_unit)
  values (r.projeto_id, coalesce(r.projeto_codigo, ''), coalesce(nullif(r.projeto_titulo, ''), r.setor, ''), alm_descricao(a.bib_tipo, a.bib_id),
    a.unidade, p_quantidade, a.bib_tipo, a.bib_id, '', a.id, v_item, v_custo)
  returning id into v_res;
  insert into compras_eventos (requisicao_id, tipo, de, para, justificativa, dados)
  values (it.requisicao_id, 'status', 'a_comprar', 'estoque', 'Atendido pelo estoque',
    jsonb_build_object('item_id', v_item, 'descricao', it.descricao, 'quantidade', p_quantidade, 'unidade', it.unidade, 'custo_unit', v_custo, 'reserva_id', v_res));
  perform set_config('erp.rpc', 'off', true);
  perform compras_atualizar_requisicao(it.requisicao_id);
  return v_res;
end;
$$;

-- Desfaz enquanto o Almoxarifado ainda não entregou: a reserva é cancelada e o item volta para à comprar.
create or replace function public.compras_desfazer_estoque(p_item uuid, p_motivo text default '')
returns void language plpgsql security definer set search_path = public as $$
declare it compras_requisicao_itens; v_res alm_reservas;
begin
  if not tem_permissao('compras', 'editar') then raise exception 'Sem permissão para editar Compras.'; end if;
  select * into it from compras_requisicao_itens where id = p_item for update;
  if not found or it.status <> 'estoque' then raise exception 'Este item não está atendido pelo estoque.'; end if;
  select * into v_res from alm_reservas where compra_item_id = it.id and status <> 'cancelado' for update;
  if v_res.status = 'entregue' then raise exception 'O Almoxarifado já entregou este material.'; end if;
  if v_res.id is not null then
    update alm_reservas set status = 'cancelado', cancelado_motivo = trim(coalesce(p_motivo, '')) where id = v_res.id;
  end if;
  perform set_config('erp.rpc', 'on', true);
  update compras_requisicao_itens set status = 'a_comprar' where id = it.id;
  insert into compras_eventos (requisicao_id, tipo, de, para, justificativa, dados)
  values (it.requisicao_id, 'status', 'estoque', 'a_comprar', coalesce(nullif(trim(p_motivo), ''), 'Atendimento pelo estoque desfeito'),
    jsonb_build_object('item_id', it.id, 'descricao', it.descricao, 'quantidade', it.quantidade, 'unidade', it.unidade));
  perform set_config('erp.rpc', 'off', true);
  perform compras_atualizar_requisicao(it.requisicao_id);
end;
$$;

-- Entrega da reserva: a que veio do estoque sai do saldo agora, com o custo da reserva.
create or replace function public.alm_entregar_reserva(p_reserva uuid, p_para text)
returns void language plpgsql security definer set search_path = public as $$
declare v alm_reservas; m alm_movimentos;
begin
  if not tem_permissao('almoxarifado', 'editar') then raise exception 'Sem permissão para entregar reservas.'; end if;
  if length(trim(coalesce(p_para, ''))) < 2 then raise exception 'Informe para quem foi entregue.'; end if;
  select * into v from alm_reservas where id = p_reserva and status = 'reservado' for update;
  if not found then raise exception 'Reserva não encontrada ou já entregue.'; end if;
  if v.alm_item_id is not null then
    m := alm_movimentar(v.alm_item_id, 'retirada', -v.quantidade, v.custo_unit, null, null, null,
      'Reserva do estoque entregue a ' || trim(p_para) || coalesce(nullif(' · ' || v.projeto_codigo, ' · '), ''));
  end if;
  update alm_reservas set status = 'entregue', entregue_para = trim(p_para), entregue_em = now(), entregue_por = auth.uid(), movimento_id = m.id
  where id = v.id;
end;
$$;

-- Itens atendidos pelo estoque, com a reserva: Compras acompanha se o Almoxarifado já entregou e pode desfazer antes disso.
create or replace function public.compras_atendidos_estoque()
returns table(item_id uuid, requisicao_id uuid, requisicao_codigo text, requisicao_titulo text, destino text, descricao text,
  quantidade numeric, unidade text, estoque_descricao text, custo_unit numeric, reserva_status text, entregue_para text, entregue_em timestamptz,
  criado_em timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, q.id, q.codigo, q.titulo, coalesce(nullif(q.projeto_codigo, ''), q.setor), i.descricao, r.quantidade, r.unidade, r.descricao,
    r.custo_unit, r.status, r.entregue_para, r.entregue_em, r.criado_em
  from compras_requisicao_itens i
  join compras_requisicoes q on q.id = i.requisicao_id
  join alm_reservas r on r.compra_item_id = i.id and r.status <> 'cancelado'
  where i.status = 'estoque' and tem_permissao('compras', 'ler')
  order by r.criado_em desc
  limit 500;
$$;

-- Para a Engenharia, item atendido pelo estoque conta como comprado: a requisição deixa de ser substituível por nova revisão
-- da lista (senão o material seria pedido de novo) e aparece "em compra". Troca só a condição nas funções vigentes.
do $$
declare f record;
begin
  for f in select p.oid from pg_proc p where p.pronamespace = 'public'::regnamespace
    and p.proname in ('eng_enviar_lista', 'engenharia_solicitar_compra', 'engenharia_solicitacoes')
  loop
    execute replace(pg_get_functiondef(f.oid), '(''comprado'', ''recebido'')', '(''comprado'', ''recebido'', ''estoque'')');
  end loop;
end $$;

revoke execute on function public.alm_reservado(uuid), public.alm_custo_ultima_compra(uuid), public.compras_estoque_disponivel(),
  public.compras_atender_estoque(uuid, uuid, numeric), public.compras_desfazer_estoque(uuid, text), public.compras_atendidos_estoque() from public, anon;
grant execute on function public.alm_reservado(uuid), public.alm_custo_ultima_compra(uuid), public.compras_estoque_disponivel(),
  public.compras_atender_estoque(uuid, uuid, numeric), public.compras_desfazer_estoque(uuid, text), public.compras_atendidos_estoque() to authenticated;
