-- Decisão 120 (29/10/2026, pedido do Gabriel; altera a decisão 70): o local de entrega da proposta pode ser
-- diferente do endereço da empresa cliente (obra ou outra unidade). Vazio = endereço da empresa, como antes.
-- Depois de enviada, frete e local de entrega ficam congelados como os outros dados da proposta.
set lock_timeout = '10s';

alter table public.propostas add column local_entrega text not null default '' check (length(local_entrega) <= 300);

create or replace function public.proteger_proposta() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('erp.rpc', true), '') = 'on' then return new; end if;
  if new.codigo is distinct from old.codigo or new.ano is distinct from old.ano
     or new.sequencial is distinct from old.sequencial or new.contato_numeracao_id is distinct from old.contato_numeracao_id
     or new.status is distinct from old.status or new.revisao_atual is distinct from old.revisao_atual
     or new.excluido_em is distinct from old.excluido_em then
    raise exception 'Código, status, revisão e exclusão da proposta só mudam pelas ações do sistema.';
  end if;
  if old.status <> 'À enviar' and (new.titulo, new.descricao, new.valor, new.empresa_id, new.contato_id, new.condicoes_comerciais, new.prazo_previsto, new.validade, new.data_emissao, new.frete, new.local_entrega)
     is distinct from (old.titulo, old.descricao, old.valor, old.empresa_id, old.contato_id, old.condicoes_comerciais, old.prazo_previsto, old.validade, old.data_emissao, old.frete, old.local_entrega) then
    raise exception 'Proposta enviada não pode ser editada. Volte-a para À enviar para criar uma nova revisão.';
  end if;
  return new;
end;
$$;
