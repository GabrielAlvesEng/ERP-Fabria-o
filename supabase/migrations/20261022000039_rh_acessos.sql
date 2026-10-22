-- RH, entrega 4 (decisão 69, 22/10/2026): o RH gerencia os logins do ERP (resposta 1). Criar login, mandar link
-- de senha e desativar passam pela Edge Function rh-acesso (precisa da chave service_role, que fica só no Supabase).
-- Perfis e ajustes individuais de permissão passam pelas funções abaixo, que exigem rh.critica.
-- Proteções: só quem tem acesso total dá um perfil de acesso total, mexe em quem tem acesso total ou em si mesmo;
-- ninguém dá uma permissão que não tem. O ERP nunca guarda nem mostra senhas.
create policy usuario_perfis_ler_rh on public.usuario_perfis for select to authenticated using (tem_permissao('rh', 'critica'));
create policy usuario_permissoes_ler_rh on public.usuario_permissoes for select to authenticated using (tem_permissao('rh', 'critica'));

create or replace function public.conferir_gestao_acesso(p_usuario uuid) returns void
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not tem_permissao('rh', 'critica') then raise exception 'Sem permissão para gerenciar acessos.'; end if;
  if tem_acesso_total() then return; end if;
  if p_usuario = auth.uid() then raise exception 'Você não pode mudar o próprio acesso. Peça à Administração.'; end if;
  if exists (select 1 from usuario_perfis up join perfis p on p.id = up.perfil_id where up.usuario_id = p_usuario and p.acesso_total) then
    raise exception 'Só a Administração muda o acesso de quem tem acesso total.';
  end if;
end;
$fn$;
revoke execute on function public.conferir_gestao_acesso(uuid) from public, anon;
grant execute on function public.conferir_gestao_acesso(uuid) to authenticated;
