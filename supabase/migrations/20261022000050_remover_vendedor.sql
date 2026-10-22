-- Decisão 91 (22/10/2026, pedido do Gabriel): o RH pode remover vendedores, e só quem tem ficha no RH
-- (funcionário não desligado, com login) pode ser cadastrado como vendedor.
-- Remover é exclusão lógica: o vendedor some das listas e das novas propostas, mas as propostas dele
-- continuam com o nome dele. Cadastrar de novo a mesma pessoa traz o cadastro de volta.
set lock_timeout = '10s';

alter table public.vendedores add column removido_em timestamptz;
alter table public.vendedores add column removido_por uuid references public.usuarios(id);

create or replace function public.remover_vendedor(p_usuario uuid) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if not tem_permissao('rh', 'editar') then raise exception 'Somente o RH remove vendedores.'; end if;
  update vendedores set ativo = false, removido_em = now(), removido_por = auth.uid()
   where usuario_id = p_usuario and removido_em is null;
  if not found then raise exception 'Vendedor não encontrado.'; end if;
end;
$fn$;
revoke execute on function public.remover_vendedor(uuid) from public, anon;
grant execute on function public.remover_vendedor(uuid) to authenticated;

-- Novo vendedor (ou um removido que volta) precisa ter ficha no RH.
create or replace function public.validar_vendedor_rh() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if (tg_op = 'INSERT' or (old.removido_em is not null and new.removido_em is null))
     and not exists (select 1 from funcionarios where usuario_id = new.usuario_id and situacao <> 'desligado') then
    raise exception 'Só funcionários cadastrados no RH (com login e não desligados) podem ser vendedores.';
  end if;
  if new.removido_em is not null then new.ativo := false; end if;
  return new;
end;
$fn$;
revoke execute on function public.validar_vendedor_rh() from public, anon, authenticated;
create trigger vendedores_validar_rh before insert or update on public.vendedores
  for each row execute function validar_vendedor_rh();
