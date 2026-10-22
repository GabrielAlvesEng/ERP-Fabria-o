-- Comunicação (docs/PLANEJAMENTO_COMUNICACAO.md, aprovado em 22/10/2026).
-- Líderes de setor mandam comunicados para o próprio setor; quem tem "Comunicado geral" (comunicacao.critica) manda
-- para a empresa toda. Todo logado recebe e lê os seus. O aviso no celular sai pela Edge Function comunicacao-envio,
-- chamada como quem enviou: ela lê os aparelhos e e-mails pelas funções daqui, que conferem quem pode.

insert into public.permissoes (modulo, acao) values ('comunicacao', 'critica') on conflict do nothing;

-- Perfil para quem só recebe comunicados (chão de fábrica): sem permissão nenhuma, vê Comunicação e Meu perfil.
insert into public.perfis (nome, descricao, acesso_total)
values ('Funcionário', 'Recebe os comunicados e vê o próprio perfil', false) on conflict (nome) do nothing;

-- Líderes de cada setor (marcados pelo RH). Um setor pode ter mais de um. Nada é apagado: quem deixa de ser líder
-- fica com removido_em.
create table public.setor_lideres (
  id uuid primary key default gen_random_uuid(),
  setor_id uuid not null references public.setores(id),
  funcionario_id uuid not null references public.funcionarios(id),
  criado_em timestamptz not null default now(),
  removido_em timestamptz
);
create unique index setor_lideres_unico on public.setor_lideres (setor_id, funcionario_id) where removido_em is null;

create table public.comunicados (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null default auth.uid() references public.usuarios(id),
  alcance text not null check (alcance in ('empresa', 'setores', 'pessoas')),
  titulo text not null check (length(trim(titulo)) between 3 and 120),
  texto text not null check (length(trim(texto)) between 1 and 5000),
  urgente boolean not null default false,
  exige_ciente boolean not null default false,
  enviar_email boolean not null default false,
  fixado_ate date,
  anexo_caminho text,
  anexo_nome text,
  lembrado_em timestamptz,
  criado_em timestamptz not null default now(),
  cancelado_em timestamptz,
  cancelado_por uuid references public.usuarios(id)
);
create index comunicados_autor_idx on public.comunicados (autor_id, criado_em desc);

create table public.comunicado_setores (
  comunicado_id uuid not null references public.comunicados(id),
  setor_id uuid not null references public.setores(id),
  primary key (comunicado_id, setor_id)
);

-- Uma linha por pessoa, gerada no envio. Daqui saem a caixa de entrada, o contador e o relatório de leitura.
create table public.comunicado_destinatarios (
  comunicado_id uuid not null references public.comunicados(id),
  usuario_id uuid not null references public.usuarios(id),
  funcionario_id uuid references public.funcionarios(id),
  push_enviado_em timestamptz,
  email_enviado_em timestamptz,
  lido_em timestamptz,
  ciente_em timestamptz,
  primary key (comunicado_id, usuario_id)
);
create index comunicado_destinatarios_usuario_idx on public.comunicado_destinatarios (usuario_id, comunicado_id);

-- Celulares e computadores com o aviso ativado (inscrição Web Push do navegador).
create table public.push_aparelhos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references public.usuarios(id),
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  nome text not null default '',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  ultimo_envio_em timestamptz
);

-- Regras -------------------------------------------------------------------------------------------------------

create or replace function public.comunicacao_geral() returns boolean
language sql stable security definer set search_path = public as $$ select tem_permissao('comunicacao', 'critica'); $$;

-- Setores que o usuário logado lidera (como funcionário não desligado, com login ativo).
create or replace function public.meus_setores_liderados() returns setof uuid
language sql stable security definer set search_path = public as $$
  select sl.setor_id from setor_lideres sl
  join funcionarios f on f.id = sl.funcionario_id
  join setores s on s.id = sl.setor_id and s.ativo
  join usuarios u on u.id = f.usuario_id and u.ativo
  where f.usuario_id = auth.uid() and f.situacao <> 'desligado' and sl.removido_em is null;
$$;

-- O que a tela precisa saber de quem está logado: manda para a empresa toda? Lidera quais setores?
create or replace function public.comunicacao_meu_papel() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('geral', comunicacao_geral(),
    'setores', coalesce((select jsonb_agg(x) from meus_setores_liderados() x), '[]'::jsonb));
$$;

-- Pessoas para quem o usuário logado pode mandar (o chefe vê todas; o líder, as dos seus setores). Só nome, setor e
-- função, sem dados pessoais. Quem não tem login ativo aparece, marcado, porque não vai receber.
create or replace function public.comunicacao_pessoas() returns table (
  funcionario_id uuid, usuario_id uuid, nome text, setor_id uuid, setor text, funcao text, tem_login boolean, aparelhos int)
language sql stable security definer set search_path = public as $$
  select f.id, case when u.ativo then f.usuario_id end, f.nome, s.id, s.nome, fn.nome,
    coalesce(u.ativo, false),
    (select count(*)::int from push_aparelhos a where a.usuario_id = f.usuario_id and a.ativo)
  from funcionarios f
  join funcoes fn on fn.id = f.funcao_id
  join setores s on s.id = fn.setor_id
  left join usuarios u on u.id = f.usuario_id
  where f.situacao <> 'desligado'
    and (comunicacao_geral() or s.id in (select meus_setores_liderados()))
  order by s.nome, f.nome;
$$;

create or replace function public.pode_ler_comunicado(p_comunicado uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select comunicacao_geral()
    or exists (select 1 from comunicados c where c.id = p_comunicado and c.autor_id = auth.uid())
    or exists (select 1 from comunicado_destinatarios d join comunicados c on c.id = d.comunicado_id
               where d.comunicado_id = p_comunicado and d.usuario_id = auth.uid() and c.cancelado_em is null);
$$;

create or replace function public.pode_gerir_comunicado(p_comunicado uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select comunicacao_geral() or exists (select 1 from comunicados c where c.id = p_comunicado and c.autor_id = auth.uid());
$$;

-- Envia: confere quem pode mandar para quem e gera os destinatários (quem está no setor agora, com login ativo).
-- Quem envia não recebe o próprio comunicado.
create or replace function public.enviar_comunicado(
  p_alcance text, p_setores uuid[], p_pessoas uuid[], p_titulo text, p_texto text,
  p_urgente boolean, p_exige_ciente boolean, p_enviar_email boolean, p_fixado_ate date
) returns uuid
language plpgsql security definer set search_path = public as $fn$
declare
  v_geral boolean := comunicacao_geral();
  v_lider uuid[] := array(select meus_setores_liderados());
  v_id uuid;
  v_n int;
begin
  if auth.uid() is null or not exists (select 1 from usuarios where id = auth.uid() and ativo) then
    raise exception 'Faça login para enviar.';
  end if;
  if not v_geral and cardinality(v_lider) = 0 then
    raise exception 'Só os líderes de setor e quem tem "Comunicado geral" podem enviar comunicados.';
  end if;
  if p_alcance = 'empresa' and not v_geral then
    raise exception 'Só quem tem "Comunicado geral" pode mandar para a empresa toda.';
  end if;
  if p_alcance = 'setores' then
    if coalesce(cardinality(p_setores), 0) = 0 then raise exception 'Escolha pelo menos um setor.'; end if;
    if not v_geral and exists (select 1 from unnest(p_setores) s where s <> all (v_lider)) then
      raise exception 'Você só pode mandar para o setor que lidera.';
    end if;
  elsif p_alcance = 'pessoas' then
    if coalesce(cardinality(p_pessoas), 0) = 0 then raise exception 'Escolha pelo menos uma pessoa.'; end if;
    if not v_geral and exists (
      select 1 from unnest(p_pessoas) p left join funcionarios f on f.id = p left join funcoes fn on fn.id = f.funcao_id
      where fn.setor_id is null or fn.setor_id <> all (v_lider)) then
      raise exception 'Você só pode mandar para pessoas do setor que lidera.';
    end if;
  elsif p_alcance <> 'empresa' then
    raise exception 'Escolha para quem enviar.';
  end if;
  if p_fixado_ate is not null and p_fixado_ate < current_date then raise exception 'A data de fixar já passou.'; end if;

  insert into comunicados (alcance, titulo, texto, urgente, exige_ciente, enviar_email, fixado_ate)
  values (p_alcance, trim(p_titulo), trim(p_texto), coalesce(p_urgente, false), coalesce(p_exige_ciente, false),
          coalesce(p_enviar_email, false), p_fixado_ate)
  returning id into v_id;
  if p_alcance = 'setores' then
    insert into comunicado_setores (comunicado_id, setor_id) select distinct v_id, s from unnest(p_setores) s;
  end if;

  insert into comunicado_destinatarios (comunicado_id, usuario_id, funcionario_id)
  select distinct on (f.usuario_id) v_id, f.usuario_id, f.id
  from funcionarios f
  join usuarios u on u.id = f.usuario_id and u.ativo
  left join funcoes fn on fn.id = f.funcao_id
  where f.situacao <> 'desligado' and f.usuario_id <> auth.uid()
    and case p_alcance
      when 'empresa' then true
      when 'setores' then fn.setor_id = any (p_setores)
      else f.id = any (p_pessoas) end;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'Nenhum destinatário tem login ativo no ERP. Peça ao RH para criar os logins.'; end if;
  return v_id;
end;
$fn$;

create or replace function public.anexar_comunicado(p_comunicado uuid, p_caminho text, p_nome text) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if not exists (select 1 from comunicados where id = p_comunicado and autor_id = auth.uid() and anexo_caminho is null) then
    raise exception 'Só quem enviou pode anexar, uma vez.';
  end if;
  if split_part(p_caminho, '/', 1) <> p_comunicado::text then raise exception 'Caminho do anexo inválido.'; end if;
  update comunicados set anexo_caminho = p_caminho, anexo_nome = left(p_nome, 200) where id = p_comunicado;
end;
$fn$;

create or replace function public.marcar_comunicado_lido(p_comunicado uuid) returns void
language sql security definer set search_path = public as $$
  update comunicado_destinatarios set lido_em = now()
  where comunicado_id = p_comunicado and usuario_id = auth.uid() and lido_em is null;
$$;

create or replace function public.dar_ciente_comunicado(p_comunicado uuid) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  update comunicado_destinatarios d set ciente_em = now(), lido_em = coalesce(d.lido_em, now())
  from comunicados c
  where c.id = d.comunicado_id and d.comunicado_id = p_comunicado and d.usuario_id = auth.uid()
    and c.exige_ciente and c.cancelado_em is null and d.ciente_em is null;
end;
$fn$;

create or replace function public.cancelar_comunicado(p_comunicado uuid) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if not pode_gerir_comunicado(p_comunicado) then raise exception 'Só quem enviou pode cancelar.'; end if;
  update comunicados set cancelado_em = now(), cancelado_por = auth.uid() where id = p_comunicado and cancelado_em is null;
end;
$fn$;

-- Para a Edge Function (chamada como quem enviou): o comunicado e, por destinatário, e-mail e aparelhos ativos.
-- modo 'enviar': quem ainda não recebeu o aviso; modo 'lembrete': quem ainda não leu (no máximo 1 por hora).
create or replace function public.comunicado_para_envio(p_comunicado uuid, p_modo text) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare c comunicados;
begin
  if not pode_gerir_comunicado(p_comunicado) then raise exception 'Só quem enviou pode mandar os avisos.'; end if;
  select * into c from comunicados where id = p_comunicado;
  if c.cancelado_em is not null then raise exception 'Comunicado cancelado.'; end if;
  if p_modo = 'lembrete' then
    if c.lembrado_em > now() - interval '1 hour' then raise exception 'Já foi lembrado há menos de 1 hora.'; end if;
    update comunicados set lembrado_em = now() where id = p_comunicado;
  elsif p_modo <> 'enviar' then
    raise exception 'Modo inválido.';
  end if;
  return jsonb_build_object(
    'id', c.id, 'titulo', c.titulo, 'texto', c.texto, 'urgente', c.urgente, 'enviar_email', c.enviar_email,
    'autor', (select nome from usuarios where id = c.autor_id),
    'destinatarios', coalesce((
      select jsonb_agg(jsonb_build_object(
        'usuario_id', d.usuario_id, 'nome', u.nome,
        'email', case when d.email_enviado_em is null then coalesce(nullif(f.email_corporativo, ''), u.email) end,
        'aparelhos', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'endpoint', a.endpoint, 'p256dh', a.p256dh, 'auth', a.auth))
                               from push_aparelhos a where a.usuario_id = d.usuario_id and a.ativo), '[]'::jsonb)))
      from comunicado_destinatarios d
      join usuarios u on u.id = d.usuario_id and u.ativo
      left join funcionarios f on f.id = d.funcionario_id
      where d.comunicado_id = c.id
        and case when p_modo = 'lembrete' then d.lido_em is null else d.push_enviado_em is null end), '[]'::jsonb));
end;
$fn$;

-- A Edge Function conta o que saiu: aviso no celular, e-mail, e os aparelhos que não existem mais (desativados).
create or replace function public.registrar_envio_comunicado(p_comunicado uuid, p_push uuid[], p_email uuid[], p_aparelhos_ok uuid[], p_aparelhos_mortos uuid[])
returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if not pode_gerir_comunicado(p_comunicado) then raise exception 'Sem permissão.'; end if;
  update comunicado_destinatarios set push_enviado_em = coalesce(push_enviado_em, now())
  where comunicado_id = p_comunicado and usuario_id = any (coalesce(p_push, '{}'));
  update comunicado_destinatarios set email_enviado_em = now()
  where comunicado_id = p_comunicado and usuario_id = any (coalesce(p_email, '{}')) and email_enviado_em is null;
  update push_aparelhos a set ultimo_envio_em = now()
  where a.id = any (coalesce(p_aparelhos_ok, '{}'))
    and exists (select 1 from comunicado_destinatarios d where d.comunicado_id = p_comunicado and d.usuario_id = a.usuario_id);
  update push_aparelhos a set ativo = false
  where a.id = any (coalesce(p_aparelhos_mortos, '{}'))
    and exists (select 1 from comunicado_destinatarios d where d.comunicado_id = p_comunicado and d.usuario_id = a.usuario_id);
end;
$fn$;

-- Aparelhos: cada um ativa e desativa os seus. Um navegador que troca de usuário passa a avisar só o novo.
create or replace function public.registrar_aparelho(p_endpoint text, p_p256dh text, p_auth text, p_nome text) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if auth.uid() is null then raise exception 'Faça login.'; end if;
  insert into push_aparelhos (usuario_id, endpoint, p256dh, auth, nome)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(coalesce(p_nome, ''), 80))
  on conflict (endpoint) do update set usuario_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth,
    nome = excluded.nome, ativo = true, criado_em = case when push_aparelhos.usuario_id = auth.uid() then push_aparelhos.criado_em else now() end;
end;
$fn$;

create or replace function public.remover_aparelho(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  update push_aparelhos set ativo = false where endpoint = p_endpoint and usuario_id = auth.uid();
$$;

-- RH → Setores: define a lista de líderes de um setor (os que saem ficam com removido_em).
create or replace function public.definir_lideres(p_setor uuid, p_funcionarios uuid[]) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if not tem_permissao('rh', 'editar') then raise exception 'Só o RH define os líderes.'; end if;
  update setor_lideres set removido_em = now()
  where setor_id = p_setor and removido_em is null and funcionario_id <> all (coalesce(p_funcionarios, '{}'));
  insert into setor_lideres (setor_id, funcionario_id)
  select p_setor, f from unnest(coalesce(p_funcionarios, '{}')) f
  where not exists (select 1 from setor_lideres where setor_id = p_setor and funcionario_id = f and removido_em is null);
end;
$fn$;

-- Login desativado (inclusive funcionário desligado) deixa de receber no celular.
create or replace function public.inativo_perde_aparelhos() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if not new.ativo and old.ativo then update push_aparelhos set ativo = false where usuario_id = new.id; end if;
  return null;
end;
$fn$;
create trigger usuarios_inativo_aparelhos after update of ativo on public.usuarios for each row execute function inativo_perde_aparelhos();

-- Líder precisa ser funcionário não desligado.
create or replace function public.validar_lider() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if exists (select 1 from funcionarios where id = new.funcionario_id and situacao = 'desligado') then
    raise exception 'Funcionário desligado não pode ser líder.';
  end if;
  return new;
end;
$fn$;
create trigger setor_lideres_validar before insert on public.setor_lideres for each row execute function validar_lider();

-- Segurança ----------------------------------------------------------------------------------------------------

alter table public.setor_lideres enable row level security;
alter table public.comunicados enable row level security;
alter table public.comunicado_setores enable row level security;
alter table public.comunicado_destinatarios enable row level security;
alter table public.push_aparelhos enable row level security;

create policy setor_lideres_ler on public.setor_lideres for select to authenticated using (true);

create policy comunicados_ler on public.comunicados for select to authenticated using (pode_ler_comunicado(id));
create policy comunicado_setores_ler on public.comunicado_setores for select to authenticated using (pode_ler_comunicado(comunicado_id));
create policy comunicado_destinatarios_ler on public.comunicado_destinatarios for select to authenticated
  using (usuario_id = auth.uid() or pode_gerir_comunicado(comunicado_id));
create policy push_aparelhos_ler on public.push_aparelhos for select to authenticated using (usuario_id = auth.uid());

revoke all on public.setor_lideres, public.comunicados, public.comunicado_setores, public.comunicado_destinatarios, public.push_aparelhos from anon, authenticated;
grant select on public.setor_lideres to authenticated;
grant select on public.comunicados, public.comunicado_setores, public.comunicado_destinatarios to authenticated;
grant select on public.push_aparelhos to authenticated;

do $$
declare f text;
begin
  foreach f in array array['comunicacao_geral()', 'meus_setores_liderados()', 'comunicacao_meu_papel()', 'comunicacao_pessoas()',
    'pode_ler_comunicado(uuid)', 'pode_gerir_comunicado(uuid)',
    'enviar_comunicado(text, uuid[], uuid[], text, text, boolean, boolean, boolean, date)', 'anexar_comunicado(uuid, text, text)',
    'marcar_comunicado_lido(uuid)', 'dar_ciente_comunicado(uuid)', 'cancelar_comunicado(uuid)', 'comunicado_para_envio(uuid, text)',
    'registrar_envio_comunicado(uuid, uuid[], uuid[], uuid[], uuid[])', 'registrar_aparelho(text, text, text, text)', 'remover_aparelho(text)', 'definir_lideres(uuid, uuid[])']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.inativo_perde_aparelhos() from public, anon, authenticated;
revoke execute on function public.validar_lider() from public, anon, authenticated;

create trigger setor_lideres_auditoria after insert or update on public.setor_lideres for each row execute function registrar_auditoria();
create trigger comunicados_auditoria after insert or update on public.comunicados for each row execute function registrar_auditoria();

-- Anexo (foto ou PDF) em espaço privado: {id do comunicado}/{arquivo}. Quem enviou grava; quem pode ler o comunicado lê.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comunicacao', 'comunicacao', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy comunicacao_ler on storage.objects for select to authenticated
  using (bucket_id = 'comunicacao' and exists (
    select 1 from public.comunicados c where c.id::text = split_part(name, '/', 1) and public.pode_ler_comunicado(c.id)));
create policy comunicacao_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'comunicacao' and exists (
    select 1 from public.comunicados c where c.id::text = split_part(name, '/', 1) and c.autor_id = auth.uid() and c.anexo_caminho is null));

-- Ao vivo: caixa de entrada, contador e relatório atualizam sozinhos (o Realtime respeita o RLS acima).
alter publication supabase_realtime add table public.comunicados, public.comunicado_destinatarios;
