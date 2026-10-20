-- Assinatura de e-mail por usuário (decisão 32). Cada um edita só a própria, por RPC.
alter table public.usuarios add column assinatura text not null default '';

create or replace function public.salvar_minha_assinatura(p_assinatura text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Faça login.'; end if;
  if length(p_assinatura) > 4000 then raise exception 'Assinatura muito longa.'; end if;
  update usuarios set assinatura = coalesce(p_assinatura, '') where id = auth.uid();
end;
$$;
revoke execute on function public.salvar_minha_assinatura(text) from public, anon;
grant execute on function public.salvar_minha_assinatura(text) to authenticated;

create trigger usuarios_auditoria after update on public.usuarios for each row execute function registrar_auditoria();
