-- Decisão 132 (pedido do Gabriel, 16/11/2026): "Deixe um botão para excluir o item lá em À comprar de compras".
-- Exclusão lógica: o item vira "cancelado" (continua na requisição e no histórico), com evento e motivo.
-- Só item à comprar e fora de pacote de cotação. Se era o último pendente, a requisição é concluída.
create or replace function public.compras_cancelar_item(p_item uuid, p_motivo text default '')
returns void language plpgsql security definer set search_path = public as $$
declare it compras_requisicao_itens;
begin
  if not tem_permissao('compras', 'editar') then raise exception 'Sem permissão para excluir itens de Compras.'; end if;
  select * into it from compras_requisicao_itens where id = p_item for update;
  if not found then raise exception 'Item não encontrado.'; end if;
  if it.status <> 'a_comprar' then raise exception 'Só dá para excluir item que ainda está à comprar.'; end if;
  if it.pacote_id is not null then raise exception 'O item está num pacote de cotação. Tire do pacote antes de excluir.'; end if;
  if not compras_requisicao_aberta(it.requisicao_id) then raise exception 'A requisição deste item não está aberta.'; end if;
  perform set_config('erp.rpc', 'on', true);
  update compras_requisicao_itens set status = 'cancelado' where id = p_item;
  insert into compras_eventos (requisicao_id, tipo, de, para, justificativa, dados)
  values (it.requisicao_id, 'cancelamento', 'a_comprar', 'cancelado', trim(coalesce(p_motivo, '')),
          jsonb_build_object('item_id', it.id, 'descricao', it.descricao, 'quantidade', it.quantidade, 'unidade', it.unidade));
  perform set_config('erp.rpc', 'off', true);
  perform compras_atualizar_requisicao(it.requisicao_id);
end;
$$;
revoke execute on function public.compras_cancelar_item(uuid, text) from public, anon;
grant execute on function public.compras_cancelar_item(uuid, text) to authenticated;
