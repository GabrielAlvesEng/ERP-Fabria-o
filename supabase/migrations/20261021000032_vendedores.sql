-- Vendedores (decisão 62, 21/10/2026): vendedor é um usuário do ERP (funcionário com login); só o RH cadastra.
-- Enquanto o módulo RH não existe, a permissão "rh" fica com a Administração (acesso total) e com o perfil RH, criado agora.
-- A proposta continua usando responsavel_id como o vendedor (um por proposta). Comissão fica para o Financeiro.
set lock_timeout = '10s';

insert into public.permissoes (modulo, acao) values ('rh', 'ler'), ('rh', 'editar') on conflict do nothing;
insert into public.perfis (nome, descricao, acesso_total) values ('RH', 'Recursos Humanos: cadastro de funcionários e vendedores', false) on conflict (nome) do nothing;
insert into public.perfil_permissoes (perfil_id, permissao_id)
select p.id, pm.id from public.perfis p join public.permissoes pm on pm.modulo = 'rh' where p.nome = 'RH'
on conflict do nothing;

create table public.vendedores (
  usuario_id uuid primary key references public.usuarios(id),
  cargo text not null default 'Vendedor',
  telefone text not null default '',
  observacoes text not null default '',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid default auth.uid() references public.usuarios(id)
);
alter table public.vendedores enable row level security;
create policy vendedores_ler on public.vendedores for select to authenticated using (tem_permissao('vendas', 'ler') or tem_permissao('rh', 'ler'));
create policy vendedores_criar on public.vendedores for insert to authenticated with check (tem_permissao('rh', 'editar'));
create policy vendedores_editar on public.vendedores for update to authenticated using (tem_permissao('rh', 'editar')) with check (tem_permissao('rh', 'editar'));
grant select, insert, update on public.vendedores to authenticated;
create trigger vendedores_atualizado before update on public.vendedores for each row execute function tocar_atualizado_em();
create trigger vendedores_auditoria after insert or update on public.vendedores for each row execute function registrar_auditoria();

-- Quem já é responsável por propostas vira vendedor (hoje: o usuário do Gabriel).
insert into public.vendedores (usuario_id, cargo, criado_por)
select distinct responsavel_id, 'Vendedor', null from public.propostas where responsavel_id is not null
on conflict do nothing;

-- O vendedor da proposta tem de ser um vendedor ativo. Na criação, se quem cria não for vendedor, a proposta
-- fica sem vendedor (escolhido depois); numa troca, o banco recusa.
create or replace function public.validar_vendedor_proposta() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if new.responsavel_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.responsavel_id is not distinct from old.responsavel_id then return new; end if;
  if not exists (select 1 from vendedores where usuario_id = new.responsavel_id and ativo) then
    if tg_op = 'INSERT' then new.responsavel_id := null;
    else raise exception 'Escolha um vendedor ativo (o cadastro de vendedores é feito pelo RH).'; end if;
  end if;
  return new;
end;
$fn$;
revoke execute on function public.validar_vendedor_proposta() from public, anon, authenticated;
create trigger propostas_vendedor before insert or update of responsavel_id on public.propostas for each row execute function validar_vendedor_proposta();

-- Nome de exibição do vendedor (o usuário pode ter só o login, ex.: "gabriel.alves"). Aplicado como "vendedores_nome".
alter table public.vendedores add column nome text not null default '';
update public.vendedores v set nome = case when u.nome = 'gabriel.alves' then 'Gabriel Alves' else u.nome end from public.usuarios u where u.id = v.usuario_id and v.nome = '';
