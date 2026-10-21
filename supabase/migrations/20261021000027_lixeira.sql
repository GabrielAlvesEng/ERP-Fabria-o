-- Lixeira (decisão 60, 21/10/2026): exclusão de projeto igual à da proposta; propostas e projetos excluídos ficam na
-- Lixeira da Administração por 30 dias (restaurar ou excluir definitivamente) e depois são apagados sozinhos.
-- Apagar de vez remove a proposta/projeto e tudo ligado a ele. O Storage não deixa o banco apagar arquivo
-- (gatilho protect_objects_delete): os caminhos vão para arquivos_a_remover e a tela da Lixeira os remove pela API.
-- Aplicada em blocos pelo SQL (a ferramenta de migrations travava em blocos maiores).
set lock_timeout = '10s';

-- 1) Permissão de excluir na Engenharia e senha "Excluir Projeto".
insert into public.permissoes (modulo, acao) values ('engenharia', 'excluir') on conflict do nothing;
insert into public.perfil_permissoes (perfil_id, permissao_id)
select distinct pp.perfil_id, (select id from public.permissoes where modulo = 'engenharia' and acao = 'excluir')
from public.perfil_permissoes pp join public.permissoes pm on pm.id = pp.permissao_id
where pm.modulo = 'engenharia' and pm.acao = 'editar'
on conflict do nothing;
alter table public.senhas_administrativas drop constraint senhas_administrativas_acao_check;
alter table public.senhas_administrativas add constraint senhas_administrativas_acao_check check (acao in ('excluir_proposta', 'excluir_projeto'));

-- 2) Projeto excluído (lógico) some das telas da Engenharia.
alter table public.projetos
  add column excluido_em timestamptz,
  add column excluido_por uuid references public.usuarios(id),
  add column exclusao_justificativa text;
alter policy projetos_ler on public.projetos using (tem_permissao('engenharia', 'ler') and excluido_em is null);
alter policy projetos_editar on public.projetos using (tem_permissao('engenharia', 'editar') and excluido_em is null);

create or replace function public.projeto_exclusao_exige_senha(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from projeto_pecas where projeto_id = p_id and excluido_em is null)
      or exists (select 1 from projeto_conjuntos where projeto_id = p_id and excluido_em is null and tipo <> 'geral');
$fn$;

-- Retorna 'ok' ou 'senha_incorreta' (sem erro, para a tentativa errada contar no limite).
create or replace function public.excluir_projeto(p_id uuid, p_justificativa text, p_senha text default null) returns text
language plpgsql security definer set search_path = public as $fn$
declare v projetos; exige boolean;
begin
  if not tem_permissao('engenharia', 'excluir') then raise exception 'Sem permissão para excluir projetos.'; end if;
  select * into v from projetos where id = p_id and excluido_em is null for update;
  if not found then raise exception 'Projeto não encontrado.'; end if;
  if length(trim(coalesce(p_justificativa, ''))) < 5 then raise exception 'Informe a justificativa da exclusão.'; end if;
  exige := projeto_exclusao_exige_senha(v.id);
  if exige and not conferir_senha('excluir_projeto', p_senha) then return 'senha_incorreta'; end if;
  perform set_config('erp.rpc', 'on', true);
  update projetos set excluido_em = now(), excluido_por = auth.uid(), exclusao_justificativa = trim(p_justificativa) where id = v.id;
  perform set_config('erp.rpc', 'off', true);
  return 'ok';
end;
$fn$;

create or replace function public.projetos_excluidos() returns table (id uuid, codigo text, titulo text, empresa text, excluido_em timestamptz, excluido_por text, justificativa text)
language sql stable security definer set search_path = public as $fn$
  select p.id, p.codigo, p.titulo, e.nome_fantasia, p.excluido_em, u.nome, p.exclusao_justificativa
  from projetos p left join empresas e on e.id = p.empresa_id left join usuarios u on u.id = p.excluido_por
  where p.excluido_em is not null and tem_permissao('admin', 'editar')
  order by p.excluido_em desc;
$fn$;

create or replace function public.restaurar_projeto(p_id uuid) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if not tem_permissao('admin', 'editar') then raise exception 'Somente a Administração restaura projetos.'; end if;
  perform set_config('erp.rpc', 'on', true);
  update projetos set excluido_em = null, excluido_por = null, exclusao_justificativa = null where id = p_id and excluido_em is not null;
  perform set_config('erp.rpc', 'off', true);
end;
$fn$;

-- 3) Arquivos que o banco não pode apagar: a tela da Lixeira remove pelo Storage e confirma.
create table public.arquivos_a_remover (
  id bigint generated always as identity primary key,
  bucket text not null,
  caminho text not null,
  criado_em timestamptz not null default now()
);
alter table public.arquivos_a_remover enable row level security;
create policy arquivos_a_remover_ler on public.arquivos_a_remover for select to authenticated using (tem_permissao('admin', 'editar'));
grant select on public.arquivos_a_remover to authenticated;
create policy vendas_remover_lixeira on storage.objects for delete to authenticated
  using (bucket_id = 'vendas' and public.tem_permissao('admin', 'editar')
         and exists (select 1 from public.arquivos_a_remover a where a.bucket = 'vendas' and a.caminho = objects.name));

-- confirmar_arquivos_removidos, as funções de apagar, as permissões de execução e o agendamento estão na 0028.
