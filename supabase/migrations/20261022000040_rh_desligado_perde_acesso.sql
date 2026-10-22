-- RH, entrega 4 (decisão 69): funcionário desligado perde o acesso ao ERP. Protege o último usuário com acesso total.
-- Funcionário desligado perde o acesso na hora: o usuário fica inativo (tem_permissao deixa de valer).
-- A Edge Function também bloqueia o login no Auth quando o RH desliga pela tela.
create or replace function public.desligado_perde_acesso() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if new.situacao = 'desligado' and old.situacao <> 'desligado' and new.usuario_id is not null then
    if exists (select 1 from usuario_perfis up join perfis p on p.id = up.perfil_id where up.usuario_id = new.usuario_id and p.acesso_total)
       and not exists (select 1 from usuario_perfis up join perfis p on p.id = up.perfil_id join usuarios u on u.id = up.usuario_id
                       where p.acesso_total and up.usuario_id <> new.usuario_id and u.ativo) then
      raise exception 'Este é o único usuário com acesso total; dê o acesso total a outra pessoa antes de desligá-lo.';
    end if;
    update usuarios set ativo = false where id = new.usuario_id;
  end if;
  return null;
end;
$fn$;
revoke execute on function public.desligado_perde_acesso() from public, anon, authenticated;
create trigger funcionarios_desligado_acesso after update of situacao on public.funcionarios for each row execute function desligado_perde_acesso();
