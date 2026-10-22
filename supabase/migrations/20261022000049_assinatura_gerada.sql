-- Decisão 89 (22/10/2026, pedido do Gabriel): o RH gera a assinatura de e-mail de cada funcionário com login
-- (imagem no padrão da Fabriaço, feita no navegador) e grava no usuário dele, a mesma usada no e-mail da proposta.
-- Mesmas regras da assinatura importada do Outlook (decisão 66): tamanho e conteúdo.
set lock_timeout = '10s';

create or replace function public.salvar_assinatura_gerada(p_usuario uuid, p_html text) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if not tem_permissao('rh', 'editar') then raise exception 'Somente o RH gera assinaturas.'; end if;
  if not exists (select 1 from usuarios where id = p_usuario) then raise exception 'Usuário não encontrado.'; end if;
  if length(coalesce(p_html, '')) > 1500000 then raise exception 'Assinatura muito grande.'; end if;
  if p_html ~* '<\s*(script|iframe|object|embed)' then raise exception 'A assinatura tem conteúdo não permitido.'; end if;
  update usuarios set assinatura_html = coalesce(p_html, ''), assinatura_atualizada_em = now() where id = p_usuario;
end;
$fn$;
revoke execute on function public.salvar_assinatura_gerada(uuid, text) from public, anon;
grant execute on function public.salvar_assinatura_gerada(uuid, text) to authenticated;
