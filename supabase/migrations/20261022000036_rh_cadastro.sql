-- RH, entrega 1 (decisão 69, 22/10/2026): setores, funções e o cadastro de funcionários.
-- Dados pessoais só para quem tem rh.ler; o próprio funcionário lê a sua ficha (resposta 6). Nada é apagado:
-- setor e função ficam inativos, funcionário fica desligado. Salário e dados bancários não entram (ficam no Financeiro).
-- Telefone e nascimento ficam iguais na ficha e em Meu perfil (usuarios), nos dois sentidos.
set lock_timeout = '10s';

insert into public.permissoes (modulo, acao) values ('rh', 'critica') on conflict do nothing;
insert into public.perfil_permissoes (perfil_id, permissao_id)
select p.id, pm.id from public.perfis p join public.permissoes pm on pm.modulo = 'rh' where p.nome = 'RH'
on conflict do nothing;

create table public.setores (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 2 and 60),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create unique index setores_nome_unico on public.setores (lower(nome));

create table public.funcoes (
  id uuid primary key default gen_random_uuid(),
  setor_id uuid not null references public.setores(id),
  nome text not null check (length(trim(nome)) between 2 and 80),
  descricao text not null default '',
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create unique index funcoes_nome_unico on public.funcoes (setor_id, lower(nome));

create table public.funcionarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 3 and 120),
  cpf text check (cpf ~ '^\d{11}$'),
  rg text not null default '',
  nascimento date check (nascimento between date '1920-01-01' and current_date),
  telefone text not null default '',
  email_pessoal text not null default '',
  email_corporativo text not null default '',
  cep text not null default '',
  endereco text not null default '',
  cidade text not null default '',
  uf text not null default '' check (uf = '' or uf ~ '^[A-Z]{2}$'),
  emergencia_nome text not null default '',
  emergencia_telefone text not null default '',
  matricula text,
  funcao_id uuid references public.funcoes(id),
  admissao date,
  vinculo text not null default '' check (vinculo in ('', 'CLT', 'PJ', 'Sócio', 'Temporário', 'Estágio')),
  situacao text not null default 'ativo' check (situacao in ('ativo', 'ferias', 'afastado', 'desligado')),
  desligamento date,
  usuario_id uuid unique references public.usuarios(id),
  observacoes text not null default '',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid default auth.uid() references public.usuarios(id),
  constraint funcionarios_desligamento check ((situacao = 'desligado') = (desligamento is not null)),
  constraint funcionarios_datas check (desligamento is null or admissao is null or desligamento >= admissao)
);
create unique index funcionarios_cpf_unico on public.funcionarios (cpf) where cpf is not null;
create unique index funcionarios_matricula_unica on public.funcionarios (lower(matricula)) where matricula is not null;

alter table public.setores enable row level security;
alter table public.funcoes enable row level security;
alter table public.funcionarios enable row level security;

-- Setores e funções não são dados pessoais: todos os logados leem (servem a outros módulos). Só o RH grava.
create policy setores_ler on public.setores for select to authenticated using (true);
create policy setores_criar on public.setores for insert to authenticated with check (tem_permissao('rh', 'editar'));
create policy setores_editar on public.setores for update to authenticated using (tem_permissao('rh', 'editar')) with check (tem_permissao('rh', 'editar'));
create policy funcoes_ler on public.funcoes for select to authenticated using (true);
create policy funcoes_criar on public.funcoes for insert to authenticated with check (tem_permissao('rh', 'editar'));
create policy funcoes_editar on public.funcoes for update to authenticated using (tem_permissao('rh', 'editar')) with check (tem_permissao('rh', 'editar'));

create policy funcionarios_ler on public.funcionarios for select to authenticated
  using (tem_permissao('rh', 'ler') or usuario_id = auth.uid());
create policy funcionarios_criar on public.funcionarios for insert to authenticated with check (tem_permissao('rh', 'editar'));
create policy funcionarios_editar on public.funcionarios for update to authenticated using (tem_permissao('rh', 'editar')) with check (tem_permissao('rh', 'editar'));

revoke all on public.setores, public.funcoes, public.funcionarios from anon;
revoke all on public.setores, public.funcoes, public.funcionarios from authenticated;
grant select, insert, update on public.setores, public.funcoes, public.funcionarios to authenticated;

create trigger funcionarios_atualizado before update on public.funcionarios for each row execute function tocar_atualizado_em();
create trigger setores_auditoria after insert or update on public.setores for each row execute function registrar_auditoria();
create trigger funcoes_auditoria after insert or update on public.funcoes for each row execute function registrar_auditoria();
create trigger funcionarios_auditoria after insert or update on public.funcionarios for each row execute function registrar_auditoria();

-- Função nova ou trocada precisa estar ativa (a que já estava pode continuar, mesmo se for desativada depois).
create or replace function public.validar_funcao_funcionario() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if new.funcao_id is not null and (tg_op = 'INSERT' or new.funcao_id is distinct from old.funcao_id)
     and not exists (select 1 from funcoes f join setores s on s.id = f.setor_id where f.id = new.funcao_id and f.ativo and s.ativo) then
    raise exception 'Escolha uma função ativa.';
  end if;
  return new;
end;
$fn$;
revoke execute on function public.validar_funcao_funcionario() from public, anon, authenticated;
create trigger funcionarios_funcao before insert or update of funcao_id on public.funcionarios for each row execute function validar_funcao_funcionario();

-- Telefone e nascimento iguais na ficha e em Meu perfil. Ao ligar a ficha a um usuário, o que estiver vazio
-- na ficha vem do usuário; depois, quem mudar por último vale para os dois. Para quando os valores já são iguais.
create or replace function public.funcionario_puxar_usuario() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare u usuarios;
begin
  if new.usuario_id is not null and (tg_op = 'INSERT' or new.usuario_id is distinct from old.usuario_id) then
    select * into u from usuarios where id = new.usuario_id;
    if new.telefone = '' then new.telefone := u.telefone; end if;
    if new.nascimento is null then new.nascimento := u.nascimento; end if;
  end if;
  return new;
end;
$fn$;
revoke execute on function public.funcionario_puxar_usuario() from public, anon, authenticated;
create trigger funcionarios_puxar_usuario before insert or update of usuario_id on public.funcionarios for each row execute function funcionario_puxar_usuario();

create or replace function public.funcionario_para_usuario() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if new.usuario_id is not null then
    update usuarios set telefone = new.telefone, nascimento = new.nascimento
    where id = new.usuario_id and (telefone is distinct from new.telefone or nascimento is distinct from new.nascimento);
  end if;
  return null;
end;
$fn$;
revoke execute on function public.funcionario_para_usuario() from public, anon, authenticated;
create trigger funcionarios_para_usuario after insert or update of telefone, nascimento, usuario_id on public.funcionarios for each row execute function funcionario_para_usuario();

create or replace function public.usuario_para_funcionario() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  update funcionarios set telefone = new.telefone, nascimento = new.nascimento
  where usuario_id = new.id and (telefone is distinct from new.telefone or nascimento is distinct from new.nascimento);
  return null;
end;
$fn$;
revoke execute on function public.usuario_para_funcionario() from public, anon, authenticated;
create trigger usuarios_para_funcionario after update of telefone, nascimento on public.usuarios for each row execute function usuario_para_funcionario();

-- Carga inicial (resposta 9): setores padrão, as funções da lista e os 5 funcionários, todos em Engenharia.
-- Quem já tem login fica ligado ao seu usuário (pelo e-mail).
insert into public.setores (nome) values
  ('Administrativo'), ('Comercial'), ('Engenharia'), ('Preparação'), ('Fabricação'), ('Qualidade'), ('Campo e Montagem');

insert into public.funcoes (setor_id, nome)
select s.id, f.nome from public.setores s
cross join (values ('Engenheiro/CEO'), ('Projetista Mecânico'), ('Desenhista Mecânico'), ('Administrador Geral/Dono')) as f(nome)
where s.nome = 'Engenharia';

insert into public.funcionarios (nome, funcao_id, usuario_id, criado_por)
select c.nome, f.id, u.id, null
from (values
  ('Gabriel Alves', 'Engenheiro/CEO', 'gabriel.alves@fabriacobrasil.com.br'),
  ('Guilherme Santos Silva', 'Projetista Mecânico', 'guilherme.santos@fabriacobrasil.com.br'),
  ('Pedro Vinicius da Silva Pereira', 'Desenhista Mecânico', 'pedro.vinicius@fabriacobrasil.com.br'),
  ('Caio Henrique Alves da Silva', 'Desenhista Mecânico', null),
  ('Fabiano Alves da Silva', 'Administrador Geral/Dono', null)
) as c(nome, funcao, email)
join public.funcoes f on f.nome = c.funcao
join public.setores s on s.id = f.setor_id and s.nome = 'Engenharia'
left join public.usuarios u on lower(u.email) = c.email;
