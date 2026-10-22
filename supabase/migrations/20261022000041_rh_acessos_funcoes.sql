-- RH, entrega 4 (decisão 69): o RH troca perfis e faz ajustes individuais de permissão, com as proteções de
-- conferir_gestao_acesso (migration 39). Tudo vai para a auditoria.
-- Troca os perfis do usuário pela lista informada.
create or replace function public.definir_perfis_usuario(p_usuario uuid, p_perfis uuid[]) returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_antes jsonb;
begin
  perform conferir_gestao_acesso(p_usuario);
  if not exists (select 1 from usuarios where id = p_usuario) then raise exception 'Usuário não encontrado.'; end if;
  if not tem_acesso_total() and exists (select 1 from perfis where id = any(p_perfis) and acesso_total) then
    raise exception 'Só a Administração dá o perfil de acesso total.';
  end if;
  if not tem_acesso_total() and exists (
    select 1 from perfil_permissoes pp join permissoes pm on pm.id = pp.permissao_id
    where pp.perfil_id = any(p_perfis) and not tem_permissao(pm.modulo, pm.acao)
  ) then raise exception 'Você não pode dar um perfil com permissões que você não tem.'; end if;
  -- Não deixa o ERP sem ninguém com acesso total.
  if exists (select 1 from usuario_perfis up join perfis p on p.id = up.perfil_id where up.usuario_id = p_usuario and p.acesso_total)
     and not exists (select 1 from perfis where id = any(p_perfis) and acesso_total)
     and not exists (select 1 from usuario_perfis up join perfis p on p.id = up.perfil_id join usuarios u on u.id = up.usuario_id
                     where p.acesso_total and up.usuario_id <> p_usuario and u.ativo) then
    raise exception 'Este é o único usuário com acesso total; dê o acesso total a outra pessoa antes.';
  end if;
  select coalesce(jsonb_agg(perfil_id), '[]') into v_antes from usuario_perfis where usuario_id = p_usuario;
  delete from usuario_perfis where usuario_id = p_usuario and not (perfil_id = any(p_perfis));
  insert into usuario_perfis (usuario_id, perfil_id) select p_usuario, unnest(p_perfis) on conflict do nothing;
  insert into auditoria (tabela, registro_id, acao, antes, depois)
  values ('usuario_perfis', p_usuario::text, 'UPDATE', jsonb_build_object('perfis', v_antes), jsonb_build_object('perfis', to_jsonb(p_perfis)));
end;
$fn$;
revoke execute on function public.definir_perfis_usuario(uuid, uuid[]) from public, anon;
grant execute on function public.definir_perfis_usuario(uuid, uuid[]) to authenticated;

-- Ajuste individual: p_concedida true concede, false nega (mesmo que o perfil conceda), null volta ao padrão do perfil.
create or replace function public.definir_permissao_usuario(p_usuario uuid, p_modulo text, p_acao text, p_concedida boolean) returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_perm uuid;
  v_antes boolean;
begin
  perform conferir_gestao_acesso(p_usuario);
  select id into v_perm from permissoes where modulo = p_modulo and acao = p_acao;
  if v_perm is null then raise exception 'Permissão inexistente.'; end if;
  if p_concedida and not tem_permissao(p_modulo, p_acao) then raise exception 'Você não pode dar uma permissão que você não tem.'; end if;
  select concedida into v_antes from usuario_permissoes where usuario_id = p_usuario and permissao_id = v_perm;
  if p_concedida is null then
    delete from usuario_permissoes where usuario_id = p_usuario and permissao_id = v_perm;
  else
    insert into usuario_permissoes (usuario_id, permissao_id, concedida) values (p_usuario, v_perm, p_concedida)
    on conflict (usuario_id, permissao_id) do update set concedida = excluded.concedida;
  end if;
  insert into auditoria (tabela, registro_id, acao, antes, depois)
  values ('usuario_permissoes', p_usuario::text, 'UPDATE', jsonb_build_object(p_modulo || '.' || p_acao, v_antes), jsonb_build_object(p_modulo || '.' || p_acao, p_concedida));
end;
$fn$;
revoke execute on function public.definir_permissao_usuario(uuid, text, text, boolean) from public, anon;
grant execute on function public.definir_permissao_usuario(uuid, text, text, boolean) to authenticated;
