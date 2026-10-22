-- RH, entrega 4, correção (22/10/2026): a Edge Function rh-acesso usa a service_role só no Auth (criar usuário, gerar
-- link, bloquear login). Neste projeto a service_role não tem acesso às tabelas, e é melhor assim: o que mexe em tabela
-- passa por estas funções, chamadas como o usuário logado, com as mesmas regras do banco.

-- Liga um login à ficha (criar login ou refazer um convite que não foi ligado). Só um login sem ficha.
create or replace function public.vincular_login_funcionario(p_funcionario uuid, p_usuario uuid) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if not tem_permissao('rh', 'critica') then raise exception 'Sem permissão para gerenciar acessos.'; end if;
  if not exists (select 1 from usuarios where id = p_usuario) then raise exception 'Usuário não encontrado.'; end if;
  if exists (select 1 from funcionarios where usuario_id = p_usuario and id <> p_funcionario) then
    raise exception 'Este login já está ligado a outra ficha.';
  end if;
  update funcionarios set usuario_id = p_usuario where id = p_funcionario and (usuario_id is null or usuario_id = p_usuario);
  if not found then raise exception 'Ficha não encontrada ou já ligada a outro login.'; end if;
end;
$fn$;
revoke execute on function public.vincular_login_funcionario(uuid, uuid) from public, anon;
grant execute on function public.vincular_login_funcionario(uuid, uuid) to authenticated;

-- Ativa ou desativa o usuário no ERP (a Edge Function bloqueia também no Auth). Não deixa o ERP sem acesso total.
create or replace function public.definir_login_ativo(p_usuario uuid, p_ativo boolean) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  perform conferir_gestao_acesso(p_usuario);
  if p_usuario = auth.uid() then raise exception 'Você não pode mudar o próprio acesso.'; end if;
  if p_ativo and exists (select 1 from funcionarios where usuario_id = p_usuario and situacao = 'desligado') then
    raise exception 'O funcionário está desligado. Mude a situação na ficha antes de reativar o login.';
  end if;
  if not p_ativo
     and exists (select 1 from usuario_perfis up join perfis p on p.id = up.perfil_id where up.usuario_id = p_usuario and p.acesso_total)
     and not exists (select 1 from usuario_perfis up join perfis p on p.id = up.perfil_id join usuarios u on u.id = up.usuario_id
                     where p.acesso_total and up.usuario_id <> p_usuario and u.ativo) then
    raise exception 'Este é o único usuário com acesso total; dê o acesso total a outra pessoa antes.';
  end if;
  update usuarios set ativo = p_ativo where id = p_usuario;
  insert into auditoria (tabela, registro_id, acao, antes, depois)
  values ('usuarios', p_usuario::text, 'UPDATE', null, jsonb_build_object('ativo', p_ativo));
end;
$fn$;
revoke execute on function public.definir_login_ativo(uuid, boolean) from public, anon;
grant execute on function public.definir_login_ativo(uuid, boolean) to authenticated;

-- Registra na auditoria o que a Edge Function fez no Auth (login criado, link gerado). Nunca guarda o link.
create or replace function public.registrar_acesso_rh(p_usuario uuid, p_dados jsonb) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if not tem_permissao('rh', 'critica') then raise exception 'Sem permissão para gerenciar acessos.'; end if;
  insert into auditoria (tabela, registro_id, acao, antes, depois) values ('auth.users', p_usuario::text, 'UPDATE', null, p_dados);
end;
$fn$;
revoke execute on function public.registrar_acesso_rh(uuid, jsonb) from public, anon;
grant execute on function public.registrar_acesso_rh(uuid, jsonb) to authenticated;
