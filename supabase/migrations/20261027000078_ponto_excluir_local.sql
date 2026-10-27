-- Ponto: excluir local (decisão 117, pedido do Gabriel). Exclusão lógica: o local some da lista e deixa de
-- aceitar batidas, mas as batidas já feitas nele continuam no histórico.
alter table public.ponto_locais add column if not exists excluido_em timestamptz;
alter table public.ponto_locais add column if not exists excluido_por uuid references public.usuarios(id);

create or replace function public.ponto_excluir_local(p_local uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('rh', 'editar') then raise exception 'Só o RH exclui locais de ponto.'; end if;
  update ponto_locais set excluido_em = now(), excluido_por = auth.uid(), ativo = false
  where id = p_local and excluido_em is null;
  if not found then raise exception 'Local não encontrado ou já excluído.'; end if;
end $$;
revoke all on function public.ponto_excluir_local(uuid) from public, anon;
grant execute on function public.ponto_excluir_local(uuid) to authenticated;

-- Local excluído não volta a ficar ativo por edição.
create or replace function public.ponto_local_excluido_inativo() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.excluido_em is not null then new.ativo := false; end if;
  return new;
end $$;
revoke execute on function public.ponto_local_excluido_inativo() from public, anon, authenticated;
create trigger ponto_locais_excluido before update on public.ponto_locais for each row execute function ponto_local_excluido_inativo();
