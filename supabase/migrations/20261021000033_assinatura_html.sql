-- Assinatura de e-mail importada do Outlook (decisão 66, 21/10/2026): cada vendedor envia o arquivo .htm da
-- sua assinatura uma vez, no próprio cartão em Vendas → Vendedores. O HTML (já limpo no navegador, com as
-- imagens embutidas) vai no fim do e-mail da proposta. A assinatura em texto antiga (coluna assinatura) fica guardada.
set lock_timeout = '10s';

alter table public.usuarios add column assinatura_html text not null default '';
alter table public.usuarios add column assinatura_atualizada_em timestamptz;

create or replace function public.salvar_minha_assinatura_html(p_html text) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if auth.uid() is null then raise exception 'Faça login.'; end if;
  if length(coalesce(p_html, '')) > 1500000 then raise exception 'Assinatura muito grande (imagens pesadas). Use imagens menores.'; end if;
  if p_html ~* '<\s*(script|iframe|object|embed)' then raise exception 'A assinatura tem conteúdo não permitido.'; end if;
  update usuarios set assinatura_html = coalesce(p_html, ''), assinatura_atualizada_em = now() where id = auth.uid();
end;
$fn$;
revoke execute on function public.salvar_minha_assinatura_html(text) from public, anon;
grant execute on function public.salvar_minha_assinatura_html(text) to authenticated;
