-- Decisão 88 (22/10/2026, pedido do Gabriel): nenhuma proposta sai de "À enviar" sem vendedor (responsavel_id),
-- e uma proposta já enviada não pode ficar sem vendedor. Propostas antigas sem vendedor não travam outras edições.
-- E a 26-07-007 passa a ter o vendedor Gabriel Alves.
set lock_timeout = '10s';

create or replace function public.exigir_vendedor_proposta() returns trigger
language plpgsql set search_path = public as $fn$
begin
  if new.status <> 'À enviar' and new.responsavel_id is null
     and (old.status = 'À enviar' or old.responsavel_id is not null) then
    raise exception 'Escolha o vendedor da proposta antes de enviá-la (aba Dados → Vendedor).';
  end if;
  return new;
end;
$fn$;
revoke execute on function public.exigir_vendedor_proposta() from public, anon, authenticated;
create trigger propostas_exigir_vendedor before update of status, responsavel_id on public.propostas
  for each row execute function exigir_vendedor_proposta();

update public.propostas p set responsavel_id = v.usuario_id
  from public.vendedores v
 where p.codigo = '26-07-007' and p.excluido_em is null and p.responsavel_id is null
   and v.nome = 'Gabriel Alves' and v.ativo;
