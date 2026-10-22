-- RH, entrega 2 (decisão 69, 22/10/2026): tipos de documento, requisitos por função e individuais,
-- documentos do funcionário com arquivo e validade, e a situação de cada requisito (painel e aviso de 30 dias).
-- Nada é apagado: renovar guarda o anterior no histórico; um documento lançado por engano fica excluído (excluido_em).
-- Quem lê: o RH (rh.ler) e o próprio funcionário (resposta 6). Quem grava: rh.editar.
set lock_timeout = '10s';

create table public.tipos_documento (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 2 and 80),
  categoria text not null default 'Outro' check (categoria in ('Documento pessoal', 'CNH', 'Saúde (ASO)', 'Treinamento NR', 'Certificação', 'Registro profissional', 'Outro')),
  tem_validade boolean not null default true,
  validade_meses integer check (validade_meses between 1 and 120),
  aviso_dias integer not null default 30 check (aviso_dias between 1 and 365),
  descricao text not null default '',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint tipos_documento_validade check (tem_validade or validade_meses is null)
);
create unique index tipos_documento_nome_unico on public.tipos_documento (lower(nome));

create table public.funcao_requisitos (
  funcao_id uuid not null references public.funcoes(id),
  tipo_documento_id uuid not null references public.tipos_documento(id),
  primary key (funcao_id, tipo_documento_id)
);

create table public.funcionario_requisitos (
  funcionario_id uuid not null references public.funcionarios(id),
  tipo_documento_id uuid not null references public.tipos_documento(id),
  primary key (funcionario_id, tipo_documento_id)
);

create table public.funcionario_documentos (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references public.funcionarios(id),
  tipo_documento_id uuid not null references public.tipos_documento(id),
  numero text not null default '',
  emissao date,
  validade date,
  arquivo_caminho text,
  arquivo_nome text not null default '',
  observacoes text not null default '',
  substituido_em timestamptz,
  excluido_em timestamptz,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid() references public.usuarios(id),
  constraint funcionario_documentos_datas check (validade is null or emissao is null or validade >= emissao)
);
create index funcionario_documentos_func_idx on public.funcionario_documentos (funcionario_id, tipo_documento_id);

alter table public.tipos_documento enable row level security;
alter table public.funcao_requisitos enable row level security;
alter table public.funcionario_requisitos enable row level security;
alter table public.funcionario_documentos enable row level security;

-- É a ficha do próprio usuário logado?
-- Recebe texto para servir também às pastas do Storage (o nome da pasta é o id do funcionário).
create or replace function public.eh_meu_funcionario(p_funcionario text) returns boolean
language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from funcionarios where id::text = p_funcionario and usuario_id = auth.uid());
$fn$;
revoke execute on function public.eh_meu_funcionario(text) from public, anon;
grant execute on function public.eh_meu_funcionario(text) to authenticated;

create policy tipos_documento_ler on public.tipos_documento for select to authenticated using (true);
create policy tipos_documento_criar on public.tipos_documento for insert to authenticated with check (tem_permissao('rh', 'editar'));
create policy tipos_documento_editar on public.tipos_documento for update to authenticated using (tem_permissao('rh', 'editar')) with check (tem_permissao('rh', 'editar'));

create policy funcao_requisitos_ler on public.funcao_requisitos for select to authenticated using (true);
create policy funcao_requisitos_criar on public.funcao_requisitos for insert to authenticated with check (tem_permissao('rh', 'editar'));
create policy funcao_requisitos_remover on public.funcao_requisitos for delete to authenticated using (tem_permissao('rh', 'editar'));

create policy funcionario_requisitos_ler on public.funcionario_requisitos for select to authenticated using (tem_permissao('rh', 'ler') or eh_meu_funcionario(funcionario_id::text));
create policy funcionario_requisitos_criar on public.funcionario_requisitos for insert to authenticated with check (tem_permissao('rh', 'editar'));
create policy funcionario_requisitos_remover on public.funcionario_requisitos for delete to authenticated using (tem_permissao('rh', 'editar'));

create policy funcionario_documentos_ler on public.funcionario_documentos for select to authenticated using (tem_permissao('rh', 'ler') or eh_meu_funcionario(funcionario_id::text));
create policy funcionario_documentos_criar on public.funcionario_documentos for insert to authenticated with check (tem_permissao('rh', 'editar'));
create policy funcionario_documentos_editar on public.funcionario_documentos for update to authenticated using (tem_permissao('rh', 'editar')) with check (tem_permissao('rh', 'editar'));

revoke all on public.tipos_documento, public.funcao_requisitos, public.funcionario_requisitos, public.funcionario_documentos from anon, authenticated;
grant select, insert, update on public.tipos_documento, public.funcionario_documentos to authenticated;
grant select, insert, delete on public.funcao_requisitos, public.funcionario_requisitos to authenticated;

create trigger tipos_documento_auditoria after insert or update on public.tipos_documento for each row execute function registrar_auditoria();
create trigger funcionario_documentos_auditoria after insert or update on public.funcionario_documentos for each row execute function registrar_auditoria();

-- Requisitos não têm coluna id: a auditoria guarda a função (ou o funcionário) como registro.
create or replace function public.auditar_requisito() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare r jsonb := to_jsonb(coalesce(new, old));
begin
  insert into auditoria (tabela, registro_id, acao, antes, depois)
  values (tg_table_name, coalesce(r->>'funcao_id', r->>'funcionario_id'), tg_op,
    case when tg_op = 'DELETE' then r end, case when tg_op = 'INSERT' then r end);
  return null;
end;
$fn$;
revoke execute on function public.auditar_requisito() from public, anon, authenticated;
create trigger funcao_requisitos_auditoria after insert or delete on public.funcao_requisitos for each row execute function auditar_requisito();
create trigger funcionario_requisitos_auditoria after insert or delete on public.funcionario_requisitos for each row execute function auditar_requisito();

-- Documento novo: confere validade e arquivo, e o anterior do mesmo tipo vai para o histórico.
-- Depois de lançado, só observações e a exclusão (lançado por engano) podem mudar.
create or replace function public.validar_documento_funcionario() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare t tipos_documento;
begin
  if tg_op = 'UPDATE' then
    if (new.funcionario_id, new.tipo_documento_id, new.numero, new.emissao, new.validade, new.arquivo_caminho)
       is distinct from (old.funcionario_id, old.tipo_documento_id, old.numero, old.emissao, old.validade, old.arquivo_caminho) then
      raise exception 'Documento lançado não muda: para corrigir, exclua e lance de novo, ou use Renovar.';
    end if;
    if old.excluido_em is not null and new.excluido_em is null then raise exception 'Documento excluído não volta.'; end if;
    return new;
  end if;
  select * into t from tipos_documento where id = new.tipo_documento_id;
  if not t.ativo then raise exception 'Este tipo de documento está inativo.'; end if;
  if t.tem_validade and new.validade is null then raise exception 'Informe a validade do documento (%).', t.nome; end if;
  if not t.tem_validade then new.validade := null; end if;
  if new.arquivo_caminho is not null and split_part(new.arquivo_caminho, '/', 1) <> new.funcionario_id::text then
    raise exception 'Arquivo fora da pasta do funcionário.';
  end if;
  new.substituido_em := null; new.excluido_em := null;
  update funcionario_documentos set substituido_em = now()
  where funcionario_id = new.funcionario_id and tipo_documento_id = new.tipo_documento_id and substituido_em is null and excluido_em is null;
  return new;
end;
$fn$;
revoke execute on function public.validar_documento_funcionario() from public, anon, authenticated;
create trigger funcionario_documentos_validar before insert or update on public.funcionario_documentos for each row execute function validar_documento_funcionario();

-- Ao excluir o documento atual, o anterior (se houver) volta a valer.
create or replace function public.reativar_documento_anterior() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if old.excluido_em is null and new.excluido_em is not null and old.substituido_em is null then
    update funcionario_documentos set substituido_em = null
    where id = (select id from funcionario_documentos
                where funcionario_id = new.funcionario_id and tipo_documento_id = new.tipo_documento_id
                  and id <> new.id and excluido_em is null
                order by criado_em desc limit 1);
  end if;
  return null;
end;
$fn$;
revoke execute on function public.reativar_documento_anterior() from public, anon, authenticated;
create trigger funcionario_documentos_reativar after update of excluido_em on public.funcionario_documentos for each row execute function reativar_documento_anterior();

-- Situação de cada requisito por funcionário (não desligado): os exigidos pela função e os individuais,
-- mais qualquer documento atual com validade que a pessoa tenha. Em dia, vencendo (dentro do aviso), vencido ou faltando.
-- security_invoker: cada um vê só o que o RLS das tabelas deixa (RH vê todos; o funcionário, os seus).
create or replace view public.situacao_requisitos with (security_invoker = true) as
with exigidos as (
  select f.id funcionario_id, fr.tipo_documento_id from funcionarios f join funcao_requisitos fr on fr.funcao_id = f.funcao_id
  union
  select funcionario_id, tipo_documento_id from funcionario_requisitos
),
atuais as (
  select * from funcionario_documentos where substituido_em is null and excluido_em is null
),
pares as (
  select funcionario_id, tipo_documento_id, true exigido from exigidos
  union all
  select a.funcionario_id, a.tipo_documento_id, false from atuais a
  where a.validade is not null and not exists (select 1 from exigidos e where e.funcionario_id = a.funcionario_id and e.tipo_documento_id = a.tipo_documento_id)
)
select p.funcionario_id, p.tipo_documento_id, p.exigido, t.nome tipo_nome, t.categoria, t.aviso_dias,
  a.id documento_id, a.numero, a.emissao, a.validade,
  case
    when a.id is null then 'faltando'
    when a.validade is null then 'em_dia'
    when a.validade < (now() at time zone 'America/Sao_Paulo')::date then 'vencido'
    when a.validade <= (now() at time zone 'America/Sao_Paulo')::date + t.aviso_dias then 'vencendo'
    else 'em_dia'
  end situacao
from pares p
join funcionarios f on f.id = p.funcionario_id and f.situacao <> 'desligado'
join tipos_documento t on t.id = p.tipo_documento_id
left join atuais a on a.funcionario_id = p.funcionario_id and a.tipo_documento_id = p.tipo_documento_id;

revoke all on public.situacao_requisitos from anon, authenticated;
grant select on public.situacao_requisitos to authenticated;

-- Arquivos dos documentos: espaço privado "rh", pasta {id do funcionário}/. RH lê e envia; o funcionário lê os seus.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rh', 'rh', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

create policy rh_ler on storage.objects for select to authenticated
  using (bucket_id = 'rh' and (tem_permissao('rh', 'ler') or eh_meu_funcionario((storage.foldername(name))[1])));
create policy rh_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'rh' and tem_permissao('rh', 'editar')
    and exists (select 1 from public.funcionarios f where f.id::text = (storage.foldername(name))[1]));

-- Catálogo inicial (editável em RH → Documentos). Validades padrão só onde a norma fixa a periodicidade;
-- nas outras o RH informa a data de cada documento.
insert into public.tipos_documento (nome, categoria, tem_validade, validade_meses, descricao) values
  ('ASO (atestado de saúde ocupacional)', 'Saúde (ASO)', true, 12, 'Exame periódico (NR-7). A periodicidade pode variar pelo PCMSO.'),
  ('CNH', 'CNH', true, null, 'Guarde a categoria no número (ex.: 01234567890 - D).'),
  ('RG', 'Documento pessoal', false, null, ''),
  ('NR-10 (segurança em eletricidade)', 'Treinamento NR', true, 24, 'Reciclagem bienal.'),
  ('NR-11 (operador de munck / guindauto)', 'Treinamento NR', true, null, 'Operação de equipamentos de transporte e movimentação de cargas.'),
  ('NR-12 (máquinas e equipamentos)', 'Treinamento NR', false, null, ''),
  ('NR-18 (construção civil)', 'Treinamento NR', true, 24, 'Treinamento periódico bienal.'),
  ('NR-33 (espaço confinado)', 'Treinamento NR', true, 12, 'Reciclagem anual.'),
  ('NR-35 (trabalho em altura)', 'Treinamento NR', true, 24, 'Reciclagem bienal.');
