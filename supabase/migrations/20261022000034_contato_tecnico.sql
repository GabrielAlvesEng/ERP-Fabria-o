-- Contato técnico do cliente na proposta (decisão 67, 22/10/2026): a proposta técnica vai A/C dele (ex.: o engenheiro)
-- e a comercial A/C do contato da proposta (ex.: o comprador). No envio por e-mail ele entra em C/C.
-- Precisa ser um contato da mesma empresa da proposta; a regra de edição segue a da proposta (proteger_proposta).
set lock_timeout = '10s';

alter table public.propostas add column contato_tecnico_id uuid references public.contatos(id);
create index propostas_contato_tecnico_idx on public.propostas (contato_tecnico_id);

create or replace function public.validar_contato_tecnico() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if new.contato_tecnico_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.contato_tecnico_id is not distinct from old.contato_tecnico_id and new.empresa_id is not distinct from old.empresa_id then return new; end if;
  if not exists (select 1 from contatos where id = new.contato_tecnico_id and empresa_id = new.empresa_id and excluido_em is null) then
    raise exception 'O contato técnico precisa ser um contato da mesma empresa da proposta.';
  end if;
  return new;
end;
$fn$;
revoke execute on function public.validar_contato_tecnico() from public, anon, authenticated;
create trigger propostas_contato_tecnico before insert or update of contato_tecnico_id, empresa_id on public.propostas
  for each row execute function validar_contato_tecnico();
