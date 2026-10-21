-- Gerador de propostas (decisão 61): textos padrão (Administração) e documentos técnico/comercial de cada revisão.
-- O conteúdo é o JSON do editor (src/modules/vendas/documentos/modelo.ts). Revisão enviada fica só leitura;
-- uma nova revisão copia os documentos da anterior.
set lock_timeout = '10s';

create table public.documento_padroes (
  chave text primary key check (chave in ('empresa', 'tecnica', 'comercial')),
  conteudo jsonb not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid() references public.usuarios(id)
);
alter table public.documento_padroes enable row level security;
create policy documento_padroes_ler on public.documento_padroes for select to authenticated using (tem_permissao('vendas', 'ler') or tem_permissao('admin', 'editar'));
create policy documento_padroes_criar on public.documento_padroes for insert to authenticated with check (tem_permissao('admin', 'editar'));
create policy documento_padroes_editar on public.documento_padroes for update to authenticated using (tem_permissao('admin', 'editar')) with check (tem_permissao('admin', 'editar'));
grant select, insert, update on public.documento_padroes to authenticated;
create trigger documento_padroes_atualizado before update on public.documento_padroes for each row execute function tocar_atualizado_em();
create trigger documento_padroes_auditoria after insert or update on public.documento_padroes for each row execute function registrar_auditoria();

create table public.proposta_documentos (
  id uuid primary key default gen_random_uuid(),
  revisao_id uuid not null references public.proposta_revisoes(id),
  tipo text not null check (tipo in ('tecnica', 'comercial')),
  conteudo jsonb not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid() references public.usuarios(id),
  unique (revisao_id, tipo)
);
alter table public.proposta_documentos enable row level security;
create policy proposta_documentos_ler on public.proposta_documentos for select to authenticated using (tem_permissao('vendas', 'ler'));
create policy proposta_documentos_criar on public.proposta_documentos for insert to authenticated
  with check (tem_permissao('vendas', 'editar') and exists (select 1 from proposta_revisoes r where r.id = revisao_id and r.status = 'rascunho'));
create policy proposta_documentos_editar on public.proposta_documentos for update to authenticated
  using (tem_permissao('vendas', 'editar') and exists (select 1 from proposta_revisoes r where r.id = revisao_id and r.status = 'rascunho'))
  with check (tem_permissao('vendas', 'editar') and exists (select 1 from proposta_revisoes r where r.id = revisao_id and r.status = 'rascunho'));
grant select, insert, update on public.proposta_documentos to authenticated;
create trigger proposta_documentos_atualizado before update on public.proposta_documentos for each row execute function tocar_atualizado_em();
create trigger proposta_documentos_auditoria after insert or update on public.proposta_documentos for each row execute function registrar_auditoria();

-- Nova revisão (R1, R2…) começa com os textos da revisão anterior.
create or replace function public.copiar_documentos_revisao() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  insert into proposta_documentos (revisao_id, tipo, conteudo)
  select new.id, d.tipo, d.conteudo
  from proposta_documentos d join proposta_revisoes r on r.id = d.revisao_id
  where r.proposta_id = new.proposta_id and r.numero = new.numero - 1
  on conflict (revisao_id, tipo) do nothing;
  return new;
end;
$fn$;
revoke execute on function public.copiar_documentos_revisao() from public, anon, authenticated;
create trigger proposta_revisoes_copiar_documentos after insert on public.proposta_revisoes for each row execute function copiar_documentos_revisao();

-- Excluir proposta definitivamente (Lixeira) também leva os documentos: está na 0030, que precisa ser colada no
-- SQL Editor (o conector do Supabase pede confirmação para comandos com a palavra de exclusão).
