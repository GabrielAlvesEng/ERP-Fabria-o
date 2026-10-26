-- Financeiro: conta a pagar de OC que vem de um pacote de cotação (decisão 111 de Compras, decisão 112 aqui).
-- Essa OC pode juntar várias solicitações (requisicao_id nulo). Como os itens da OC são gravados depois dela,
-- projeto e descrição da conta são preenchidos quando os itens entram: um projeto mostra o código e o título;
-- vários projetos mostram os códigos separados por vírgula. Sem projeto, a descrição usa o pacote (CT-AA-NNN · título).

create or replace function public.fin_conta_origem(p_pedido uuid) returns void
language plpgsql security definer set search_path = public as $$
declare pd compras_pedidos; pc compras_pacotes; v_cods text[]; v_tit text; v_reqs text;
begin
  select * into pd from compras_pedidos where id = p_pedido;
  if not found or pd.requisicao_id is not null then return; end if;
  select * into pc from compras_pacotes where id = pd.pacote_id;

  select coalesce(array_agg(distinct r.projeto_codigo order by r.projeto_codigo) filter (where r.projeto_codigo <> ''), '{}'),
         string_agg(distinct r.codigo, ', ')
    into v_cods, v_reqs
    from compras_pedido_itens pi
    join compras_requisicao_itens ri on ri.id = pi.item_id
    join compras_requisicoes r on r.id = ri.requisicao_id
   where pi.pedido_id = p_pedido;
  if cardinality(v_cods) = 1 then
    select r.projeto_titulo into v_tit from compras_requisicoes r where r.projeto_codigo = v_cods[1] limit 1;
  end if;

  update fin_contas_pagar set
    projeto_codigo = array_to_string(v_cods, ', '),
    projeto_titulo = case when cardinality(v_cods) = 1 then coalesce(v_tit, '') when cardinality(v_cods) > 1 then 'Vários projetos' else '' end,
    descricao = coalesce(nullif(concat_ws(' · ', pc.codigo, pc.titulo), ''), '') || coalesce(' (' || v_reqs || ')', '')
  where pedido_id = p_pedido;
end $$;
revoke all on function public.fin_conta_origem(uuid) from public, anon, authenticated;

create or replace function public.fin_pedido_item_criado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform fin_conta_origem(new.pedido_id);
  return new;
end $$;

create trigger compras_pedido_itens_fin_origem after insert on public.compras_pedido_itens
  for each row execute function fin_pedido_item_criado();
