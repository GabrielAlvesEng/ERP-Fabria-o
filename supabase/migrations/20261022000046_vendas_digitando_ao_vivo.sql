-- Decisão 85: o que está sendo digitado vai direto para as outras telas (Realtime Broadcast) no canal privado de
-- Vendas ("proposta:vendas"). Só quem lê Vendas recebe; só quem edita Vendas envia.
create policy digitando_proposta_ler on realtime.messages for select to authenticated
  using (realtime.topic() like 'proposta:%' and extension = 'broadcast' and public.tem_permissao('vendas','ler'));
create policy digitando_proposta_enviar on realtime.messages for insert to authenticated
  with check (realtime.topic() like 'proposta:%' and extension = 'broadcast' and public.tem_permissao('vendas','editar'));
