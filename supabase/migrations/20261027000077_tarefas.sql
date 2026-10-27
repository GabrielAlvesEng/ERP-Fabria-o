-- Tarefas por pessoa (docs/PLANEJAMENTO_TAREFAS.md, aprovado em 27/10/2026, decisão 116).
-- Cada pessoa com login ativo tem a sua lista de tarefas (check box). Qualquer logado cria tarefa para si ou para
-- outra pessoa e todos veem as tarefas de todos. Só o dono marca como feita, muda texto, urgência, prazo e a ordem;
-- o dono e quem criou podem apagar (exclusão lógica). Tudo passa pelas funções abaixo, que conferem a regra.

create table public.tarefas (
  id uuid primary key default gen_random_uuid(),
  dono_id uuid not null references public.usuarios(id),
  texto text not null check (length(trim(texto)) between 1 and 500),
  urgencia text not null default 'media' check (urgencia in ('alta', 'media', 'baixa')),
  prazo date,
  -- Ordem que o dono escolheu (menor fica em cima). Tarefa nova entra no topo.
  ordem double precision not null default 0,
  criado_por uuid not null default auth.uid() references public.usuarios(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  feita_em timestamptz,
  -- Quando o dono viu a tarefa que outra pessoa passou (para o número de novas no menu).
  vista_em timestamptz,
  excluido_em timestamptz,
  excluido_por uuid references public.usuarios(id)
);
create index tarefas_dono_idx on public.tarefas (dono_id, ordem) where excluido_em is null;

create trigger tarefas_atualizado before update on public.tarefas for each row execute function tocar_atualizado_em();
create trigger tarefas_auditoria after insert or update on public.tarefas for each row execute function registrar_auditoria();

-- Regras -------------------------------------------------------------------------------------------------------

create or replace function public.tarefa_exigir_login() returns void
language plpgsql stable security definer set search_path = public as $fn$
begin
  if auth.uid() is null or not exists (select 1 from usuarios where id = auth.uid() and ativo) then
    raise exception 'Faça login para mexer nas tarefas.';
  end if;
end;
$fn$;

-- A tarefa (não apagada) do dono logado; senão, erro.
create or replace function public.tarefa_minha(p_id uuid) returns tarefas
language plpgsql stable security definer set search_path = public as $fn$
declare t tarefas;
begin
  perform tarefa_exigir_login();
  select * into t from tarefas where id = p_id and excluido_em is null;
  if not found then raise exception 'Tarefa não encontrada.'; end if;
  if t.dono_id <> auth.uid() then raise exception 'Só o dono da tarefa pode alterar.'; end if;
  return t;
end;
$fn$;

create or replace function public.tarefa_criar(p_dono uuid, p_texto text, p_urgencia text, p_prazo date) returns uuid
language plpgsql security definer set search_path = public as $fn$
declare v_id uuid;
begin
  perform tarefa_exigir_login();
  if not exists (select 1 from usuarios where id = p_dono and ativo) then
    raise exception 'Essa pessoa não tem login ativo no ERP.';
  end if;
  if length(trim(coalesce(p_texto, ''))) = 0 then raise exception 'Escreva a tarefa.'; end if;
  insert into tarefas (dono_id, texto, urgencia, prazo, ordem, vista_em)
  values (p_dono, trim(p_texto), coalesce(p_urgencia, 'media'), p_prazo,
    coalesce((select min(ordem) from tarefas where dono_id = p_dono and excluido_em is null), 0) - 1,
    case when p_dono = auth.uid() then now() end)
  returning id into v_id;
  return v_id;
end;
$fn$;

create or replace function public.tarefa_editar(p_id uuid, p_texto text, p_urgencia text, p_prazo date) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  perform tarefa_minha(p_id);
  if length(trim(coalesce(p_texto, ''))) = 0 then raise exception 'Escreva a tarefa.'; end if;
  update tarefas set texto = trim(p_texto), urgencia = p_urgencia, prazo = p_prazo where id = p_id;
end;
$fn$;

create or replace function public.tarefa_marcar(p_id uuid, p_feita boolean) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  perform tarefa_minha(p_id);
  update tarefas set feita_em = case when p_feita then now() end, vista_em = coalesce(vista_em, now()) where id = p_id;
end;
$fn$;

-- O dono arrasta as tarefas: recebe os ids na ordem nova (só os dele contam).
create or replace function public.tarefa_ordenar(p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  perform tarefa_exigir_login();
  update tarefas t set ordem = x.pos
  from unnest(p_ids) with ordinality as x(id, pos)
  where t.id = x.id and t.dono_id = auth.uid() and t.excluido_em is null and t.ordem is distinct from x.pos;
end;
$fn$;

create or replace function public.tarefa_apagar(p_id uuid) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  perform tarefa_exigir_login();
  update tarefas set excluido_em = now(), excluido_por = auth.uid()
  where id = p_id and excluido_em is null and auth.uid() in (dono_id, criado_por);
  if not found then raise exception 'Só o dono e quem criou a tarefa podem apagar.'; end if;
end;
$fn$;

-- Ao abrir a própria lista, as tarefas passadas por outros deixam de contar como novas.
create or replace function public.tarefas_marcar_vistas() returns void
language sql security definer set search_path = public as $$
  update tarefas set vista_em = now() where dono_id = auth.uid() and vista_em is null and excluido_em is null;
$$;

-- Segurança ----------------------------------------------------------------------------------------------------

alter table public.tarefas enable row level security;
create policy tarefas_ler on public.tarefas for select to authenticated using (true);
revoke all on public.tarefas from anon, authenticated;
grant select on public.tarefas to authenticated;

do $$
declare f text;
begin
  foreach f in array array['tarefa_exigir_login()', 'tarefa_minha(uuid)', 'tarefa_criar(uuid, text, text, date)',
    'tarefa_editar(uuid, text, text, date)', 'tarefa_marcar(uuid, boolean)', 'tarefa_ordenar(uuid[])', 'tarefa_apagar(uuid)',
    'tarefas_marcar_vistas()']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Ao vivo: a lista atualiza sozinha quando outra pessoa cria, marca ou apaga.
alter publication supabase_realtime add table public.tarefas;
