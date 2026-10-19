-- ERP Fabriaço — Base: usuários, perfis, permissões, auditoria, configurações.
-- Empresa única (decisão 14): nenhuma tabela tem organization_id.

create extension if not exists pgcrypto;

-- Usuários (espelho de auth.users) ---------------------------------------
create table public.usuarios (
  id uuid primary key references auth.users(id) on delete restrict,
  nome text not null default '',
  email text not null default '',
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.perfis (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  descricao text not null default '',
  acesso_total boolean not null default false
);

create table public.permissoes (
  id uuid primary key default gen_random_uuid(),
  modulo text not null,
  acao text not null check (acao in ('ler','criar','editar','aprovar','excluir','critica')),
  unique (modulo, acao)
);

create table public.perfil_permissoes (
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  permissao_id uuid not null references public.permissoes(id) on delete cascade,
  primary key (perfil_id, permissao_id)
);

create table public.usuario_perfis (
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  primary key (usuario_id, perfil_id)
);

-- Ajuste individual: concedida=false nega mesmo que o perfil conceda.
create table public.usuario_permissoes (
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  permissao_id uuid not null references public.permissoes(id) on delete cascade,
  concedida boolean not null,
  primary key (usuario_id, permissao_id)
);

create table public.configuracoes (
  chave text primary key,
  valor jsonb not null,
  atualizado_em timestamptz not null default now()
);

create table public.auditoria (
  id bigint generated always as identity primary key,
  tabela text not null,
  registro_id text not null,
  acao text not null,
  antes jsonb,
  depois jsonb,
  usuario_id uuid default auth.uid(),
  criado_em timestamptz not null default now()
);
create index auditoria_registro_idx on public.auditoria (tabela, registro_id);

-- Funções de permissão ---------------------------------------------------
create or replace function public.tem_acesso_total() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from usuario_perfis up join perfis p on p.id = up.perfil_id
    join usuarios u on u.id = up.usuario_id
    where up.usuario_id = auth.uid() and u.ativo and p.acesso_total
  );
$$;

create or replace function public.tem_permissao(p_modulo text, p_acao text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then false
    when not exists (select 1 from usuarios where id = auth.uid() and ativo) then false
    when tem_acesso_total() then true
    else coalesce(
      (select upm.concedida from usuario_permissoes upm join permissoes pm on pm.id = upm.permissao_id
        where upm.usuario_id = auth.uid() and pm.modulo = p_modulo and pm.acao = p_acao),
      exists (select 1 from usuario_perfis up join perfil_permissoes pp on pp.perfil_id = up.perfil_id
        join permissoes pm on pm.id = pp.permissao_id
        where up.usuario_id = auth.uid() and pm.modulo = p_modulo and pm.acao = p_acao))
  end;
$$;

-- Lista das permissões efetivas do usuário logado (para a interface).
create or replace function public.minhas_permissoes() returns table (modulo text, acao text)
language sql stable security definer set search_path = public as $$
  select pm.modulo, pm.acao from permissoes pm where tem_permissao(pm.modulo, pm.acao);
$$;

-- Novo usuário do Auth vira usuário do ERP. O primeiro recebe Administração
-- (decisão 21: no início, um único usuário geral). Cadastro público deve ficar desligado no Auth.
create or replace function public.criar_usuario_erp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into usuarios (id, nome, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)), coalesce(new.email, ''));
  if not exists (select 1 from usuario_perfis up join perfis p on p.id = up.perfil_id where p.acesso_total) then
    insert into usuario_perfis (usuario_id, perfil_id) select new.id, id from perfis where nome = 'Administração';
  end if;
  return new;
end;
$$;
create trigger auth_usuario_criado after insert on auth.users
  for each row execute function public.criar_usuario_erp();

-- Auditoria genérica ------------------------------------------------------
create or replace function public.registrar_auditoria() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_id text;
begin
  v_id := coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id', '');
  insert into auditoria (tabela, registro_id, acao, antes, depois)
  values (tg_table_name, v_id, tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end;
$$;

create or replace function public.tocar_atualizado_em() returns trigger
language plpgsql as $$ begin new.atualizado_em := now(); return new; end; $$;

-- Dados iniciais ----------------------------------------------------------
insert into public.perfis (nome, descricao, acesso_total) values
  ('Administração', 'Acesso total ao sistema', true),
  ('Comercial', 'Empresas, contatos e propostas; pode aprovar propostas', false),
  ('Financeiro', 'Vê propostas e move Finalizado, Emitido NF e Pago', false),
  ('Consulta', 'Somente leitura', false);

insert into public.permissoes (modulo, acao) values
  ('vendas','ler'), ('vendas','criar'), ('vendas','editar'), ('vendas','aprovar'), ('vendas','excluir'), ('vendas','critica'),
  ('financeiro','editar'), ('admin','editar');

insert into public.perfil_permissoes (perfil_id, permissao_id)
select p.id, pm.id from public.perfis p join public.permissoes pm on
  (p.nome = 'Comercial' and pm.modulo = 'vendas' and pm.acao in ('ler','criar','editar','aprovar'))
  or (p.nome = 'Financeiro' and ((pm.modulo = 'vendas' and pm.acao = 'ler') or (pm.modulo = 'financeiro' and pm.acao = 'editar')))
  or (p.nome = 'Consulta' and pm.modulo = 'vendas' and pm.acao = 'ler');

insert into public.configuracoes (chave, valor) values ('followup_prazo_padrao_dias', '5');

-- RLS ---------------------------------------------------------------------
alter table public.usuarios enable row level security;
alter table public.perfis enable row level security;
alter table public.permissoes enable row level security;
alter table public.perfil_permissoes enable row level security;
alter table public.usuario_perfis enable row level security;
alter table public.usuario_permissoes enable row level security;
alter table public.configuracoes enable row level security;
alter table public.auditoria enable row level security;

create policy usuarios_ler on public.usuarios for select to authenticated using (true);
create policy usuarios_admin on public.usuarios for update to authenticated using (tem_permissao('admin','editar')) with check (tem_permissao('admin','editar'));
create policy perfis_ler on public.perfis for select to authenticated using (true);
create policy permissoes_ler on public.permissoes for select to authenticated using (true);
create policy perfil_permissoes_ler on public.perfil_permissoes for select to authenticated using (true);
create policy perfil_permissoes_admin on public.perfil_permissoes for all to authenticated using (tem_permissao('admin','editar')) with check (tem_permissao('admin','editar'));
create policy usuario_perfis_ler on public.usuario_perfis for select to authenticated using (usuario_id = auth.uid() or tem_permissao('admin','editar'));
create policy usuario_perfis_admin on public.usuario_perfis for all to authenticated using (tem_permissao('admin','editar')) with check (tem_permissao('admin','editar'));
create policy usuario_permissoes_ler on public.usuario_permissoes for select to authenticated using (usuario_id = auth.uid() or tem_permissao('admin','editar'));
create policy usuario_permissoes_admin on public.usuario_permissoes for all to authenticated using (tem_permissao('admin','editar')) with check (tem_permissao('admin','editar'));
create policy configuracoes_ler on public.configuracoes for select to authenticated using (true);
create policy configuracoes_admin on public.configuracoes for all to authenticated using (tem_permissao('admin','editar')) with check (tem_permissao('admin','editar'));
create policy auditoria_ler on public.auditoria for select to authenticated using (tem_permissao('admin','editar'));

revoke execute on function public.criar_usuario_erp() from public, anon, authenticated;
revoke execute on function public.registrar_auditoria() from public, anon, authenticated;
