-- ERP Fabriaço — Vendas: empresas, contatos por ano, propostas, revisões, arquivos,
-- eventos, follow-ups, aprovação e reprovação. Mudanças sensíveis só por RPC.

create table public.segmentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true
);

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  razao_social text not null default '',
  nome_fantasia text not null check (length(trim(nome_fantasia)) >= 1),
  cnpj text check (cnpj is null or cnpj ~ '^[0-9]{14}$'),
  inscricao_estadual text not null default '',
  cep text not null default '',
  logradouro text not null default '',
  numero text not null default '',
  complemento text not null default '',
  bairro text not null default '',
  cidade text not null default '',
  uf text not null default '' check (length(uf) <= 2),
  telefones text not null default '',
  emails text not null default '',
  site text not null default '',
  segmento_id uuid references public.segmentos(id),
  observacoes text not null default '',
  ativo boolean not null default true,
  criado_por uuid default auth.uid() references public.usuarios(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por uuid references public.usuarios(id)
);
create unique index empresas_cnpj_unico on public.empresas (cnpj) where cnpj is not null and excluido_em is null;

create table public.contatos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  nome text not null check (length(trim(nome)) >= 2),
  cargo text not null default '',
  departamento text not null default '',
  email text not null default '',
  telefone text not null default '',
  whatsapp text not null default '',
  unidade text not null default '',
  classificacao text not null default 'lead' check (classificacao in ('lead','cliente')),
  cliente_desde date,
  observacoes text not null default '',
  ativo boolean not null default true,
  criado_por uuid default auth.uid() references public.usuarios(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por uuid references public.usuarios(id)
);
create index contatos_empresa_idx on public.contatos (empresa_id);

-- Participação anual. CC é do ano (decisões 8, 9 e 18).
create table public.contato_anos (
  contato_id uuid not null references public.contatos(id),
  ano integer not null check (ano between 2000 and 2099),
  codigo_comercial integer not null check (codigo_comercial > 0),
  origem text not null default 'manual' check (origem in ('manual','proposta','importacao')),
  criado_por uuid default auth.uid() references public.usuarios(id),
  criado_em timestamptz not null default now(),
  primary key (contato_id, ano),
  unique (ano, codigo_comercial)
);

create table public.contadores_contato (
  ano integer primary key,
  ultimo_valor integer not null check (ultimo_valor >= 0)
);

create table public.contadores_proposta (
  ano integer not null,
  contato_id uuid not null references public.contatos(id),
  ultimo_valor integer not null check (ultimo_valor >= 0),
  primary key (ano, contato_id)
);

create table public.propostas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  ano integer not null,
  contato_numeracao_id uuid not null references public.contatos(id),
  sequencial integer not null check (sequencial > 0),
  empresa_id uuid not null references public.empresas(id),
  contato_id uuid not null references public.contatos(id),
  titulo text not null check (length(trim(titulo)) >= 3),
  descricao text not null default '',
  responsavel_id uuid references public.usuarios(id),
  valor numeric(16,2) not null default 0 check (valor >= 0),
  status text not null default 'À enviar' check (status in
    ('À enviar','Enviados','Follow-up','Aprovado','Reprovado','Finalizado','Emitido NF','Pago')),
  revisao_atual integer not null default 0,
  data_emissao date not null default (now() at time zone 'America/Sao_Paulo')::date,
  prazo_previsto text not null default '',
  validade date,
  condicoes_comerciais text not null default '',
  proximo_followup date,
  observacoes text not null default '',
  ordem_kanban double precision not null default extract(epoch from now()),
  criado_por uuid default auth.uid() references public.usuarios(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por uuid references public.usuarios(id),
  unique (ano, contato_numeracao_id, sequencial)
);
create index propostas_status_idx on public.propostas (ano, status) where excluido_em is null;

create table public.proposta_revisoes (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references public.propostas(id),
  numero integer not null check (numero >= 0),
  status text not null default 'rascunho' check (status in ('rascunho','enviada')),
  dados jsonb,
  valor numeric(16,2),
  enviada_em date,
  enviada_por uuid references public.usuarios(id),
  motivo text not null default '',
  criado_por uuid default auth.uid() references public.usuarios(id),
  criado_em timestamptz not null default now(),
  unique (proposta_id, numero)
);

create table public.proposta_arquivos (
  id uuid primary key default gen_random_uuid(),
  revisao_id uuid not null references public.proposta_revisoes(id),
  tipo text not null check (tipo in ('tecnica','comercial','anexo','documento_tecnico')),
  caminho text not null unique,
  nome text not null,
  tamanho bigint not null default 0,
  enviado_por uuid default auth.uid() references public.usuarios(id),
  criado_em timestamptz not null default now()
);

create table public.proposta_eventos (
  id bigint generated always as identity primary key,
  proposta_id uuid not null references public.propostas(id),
  tipo text not null,
  status_de text,
  status_para text,
  descricao text not null default '',
  dados jsonb not null default '{}',
  usuario_id uuid default auth.uid() references public.usuarios(id),
  criado_em timestamptz not null default now()
);
create index proposta_eventos_idx on public.proposta_eventos (proposta_id, criado_em);

create table public.proposta_followups (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references public.propostas(id),
  data_contato date not null,
  canal text not null check (canal in ('Ligação','WhatsApp','E-mail','Presencial','Outro')),
  resumo text not null default '',
  proxima_data date,
  usuario_id uuid default auth.uid() references public.usuarios(id),
  criado_em timestamptz not null default now()
);

create table public.proposta_aprovacoes (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references public.propostas(id),
  revisao_id uuid not null references public.proposta_revisoes(id),
  forma text not null check (forma in ('PC','E-mail','WhatsApp','Contrato','Outra')),
  numero_documento text not null default '',
  data_aprovacao date not null,
  valor_aprovado numeric(16,2) not null check (valor_aprovado >= 0),
  comprovante_caminho text not null,
  comprovante_nome text not null default '',
  observacoes text not null default '',
  registrado_por uuid default auth.uid() references public.usuarios(id),
  criado_em timestamptz not null default now()
);

create table public.proposta_reprovacoes (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references public.propostas(id),
  revisao_id uuid not null references public.proposta_revisoes(id),
  motivo text not null check (motivo in ('Preço','Prazo','Concorrência','Projeto cancelado','Cliente desistiu','Outro')),
  concorrente text not null default '',
  valor_concorrente numeric(16,2),
  observacoes text not null default '',
  registrado_por uuid default auth.uid() references public.usuarios(id),
  criado_em timestamptz not null default now()
);

-- Gatilhos: atualizado_em e auditoria ----------------------------------------
create trigger empresas_atualizado before update on public.empresas for each row execute function tocar_atualizado_em();
create trigger contatos_atualizado before update on public.contatos for each row execute function tocar_atualizado_em();
create trigger propostas_atualizado before update on public.propostas for each row execute function tocar_atualizado_em();

create trigger empresas_auditoria after insert or update or delete on public.empresas for each row execute function registrar_auditoria();
create trigger contatos_auditoria after insert or update or delete on public.contatos for each row execute function registrar_auditoria();
create trigger contato_anos_auditoria after insert or update or delete on public.contato_anos for each row execute function registrar_auditoria();
create trigger propostas_auditoria after insert or update or delete on public.propostas for each row execute function registrar_auditoria();
create trigger proposta_revisoes_auditoria after insert or update or delete on public.proposta_revisoes for each row execute function registrar_auditoria();
create trigger proposta_arquivos_auditoria after insert or update or delete on public.proposta_arquivos for each row execute function registrar_auditoria();
create trigger proposta_aprovacoes_auditoria after insert or update or delete on public.proposta_aprovacoes for each row execute function registrar_auditoria();
create trigger proposta_reprovacoes_auditoria after insert or update or delete on public.proposta_reprovacoes for each row execute function registrar_auditoria();

-- Campos protegidos da proposta: só as RPCs (que ligam a flag) podem mudar.
create or replace function public.proteger_proposta() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('erp.rpc', true), '') = 'on' then return new; end if;
  if new.codigo is distinct from old.codigo or new.ano is distinct from old.ano
     or new.sequencial is distinct from old.sequencial or new.contato_numeracao_id is distinct from old.contato_numeracao_id
     or new.status is distinct from old.status or new.revisao_atual is distinct from old.revisao_atual
     or new.excluido_em is distinct from old.excluido_em then
    raise exception 'Código, status, revisão e exclusão da proposta só mudam pelas ações do sistema.';
  end if;
  if old.status <> 'À enviar' and (new.titulo, new.descricao, new.valor, new.empresa_id, new.contato_id, new.condicoes_comerciais, new.prazo_previsto, new.validade, new.data_emissao)
     is distinct from (old.titulo, old.descricao, old.valor, old.empresa_id, old.contato_id, old.condicoes_comerciais, old.prazo_previsto, old.validade, old.data_emissao) then
    raise exception 'Proposta enviada não pode ser editada. Volte-a para À enviar para criar uma nova revisão.';
  end if;
  return new;
end;
$$;
create trigger propostas_proteger before update on public.propostas for each row execute function proteger_proposta();

create or replace function public.proteger_contato_ano() returns trigger
language plpgsql as $$
begin
  if new.codigo_comercial is distinct from old.codigo_comercial or new.ano is distinct from old.ano or new.contato_id is distinct from old.contato_id then
    raise exception 'O código do cliente no ano é permanente.';
  end if;
  return new;
end;
$$;
create trigger contato_anos_proteger before update on public.contato_anos for each row execute function proteger_contato_ano();

-- Funções auxiliares -----------------------------------------------------------
create or replace function public.ano_atual() returns integer
language sql stable as $$ select extract(year from now() at time zone 'America/Sao_Paulo')::integer $$;

-- Garante o vínculo contato+ano e devolve o CC (atribuído pela ordem de entrada).
create or replace function public.garantir_contato_ano(p_contato uuid, p_ano integer, p_origem text default 'manual')
returns integer language plpgsql security definer set search_path = public as $$
declare v_cc integer;
begin
  select codigo_comercial into v_cc from contato_anos where contato_id = p_contato and ano = p_ano;
  if found then return v_cc; end if;
  insert into contadores_contato (ano, ultimo_valor) values (p_ano, 1)
  on conflict (ano) do update set ultimo_valor = contadores_contato.ultimo_valor + 1
  returning ultimo_valor into v_cc;
  insert into contato_anos (contato_id, ano, codigo_comercial, origem) values (p_contato, p_ano, v_cc, p_origem);
  return v_cc;
end;
$$;
revoke execute on function public.garantir_contato_ano(uuid, integer, text) from public, anon, authenticated;

create or replace function public.incluir_contato_no_ano(p_contato uuid, p_ano integer)
returns integer language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('vendas','editar') then raise exception 'Sem permissão para editar contatos.'; end if;
  if not exists (select 1 from contatos where id = p_contato and excluido_em is null) then raise exception 'Contato não encontrado.'; end if;
  return garantir_contato_ano(p_contato, p_ano, 'manual');
end;
$$;

create or replace function public.registrar_evento(p_proposta uuid, p_tipo text, p_de text, p_para text, p_desc text, p_dados jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into proposta_eventos (proposta_id, tipo, status_de, status_para, descricao, dados)
  values (p_proposta, p_tipo, p_de, p_para, p_desc, coalesce(p_dados, '{}'));
$$;
revoke execute on function public.registrar_evento(uuid, text, text, text, text, jsonb) from public, anon, authenticated;

-- Criar proposta: código AA-CC-NNN gerado no banco ------------------------------
create or replace function public.criar_proposta(p_dados jsonb) returns public.propostas
language plpgsql security definer set search_path = public as $$
declare
  v_ano integer := coalesce((p_dados->>'ano')::integer, ano_atual());
  v_contato contatos;
  v_cc integer; v_seq integer; v_prop propostas;
begin
  if not tem_permissao('vendas','criar') then raise exception 'Sem permissão para criar propostas.'; end if;
  select * into v_contato from contatos where id = (p_dados->>'contato_id')::uuid and excluido_em is null;
  if not found then raise exception 'Selecione um contato cadastrado.'; end if;
  if v_contato.empresa_id <> (p_dados->>'empresa_id')::uuid then raise exception 'O contato não pertence à empresa escolhida.'; end if;
  v_cc := garantir_contato_ano(v_contato.id, v_ano, 'proposta');
  insert into contadores_proposta (ano, contato_id, ultimo_valor) values (v_ano, v_contato.id, 1)
  on conflict (ano, contato_id) do update set ultimo_valor = contadores_proposta.ultimo_valor + 1
  returning ultimo_valor into v_seq;
  perform set_config('erp.rpc', 'on', true);
  insert into propostas (codigo, ano, contato_numeracao_id, sequencial, empresa_id, contato_id, titulo, descricao,
    responsavel_id, valor, prazo_previsto, validade, condicoes_comerciais, observacoes)
  values (
    right(v_ano::text, 2) || '-' || lpad(v_cc::text, 2, '0') || '-' || lpad(v_seq::text, 3, '0'),
    v_ano, v_contato.id, v_seq, v_contato.empresa_id, v_contato.id,
    p_dados->>'titulo', coalesce(p_dados->>'descricao', ''),
    coalesce(nullif(p_dados->>'responsavel_id', '')::uuid, auth.uid()),
    coalesce(nullif(p_dados->>'valor', '')::numeric, 0), coalesce(p_dados->>'prazo_previsto', ''),
    nullif(p_dados->>'validade', '')::date, coalesce(p_dados->>'condicoes_comerciais', ''), coalesce(p_dados->>'observacoes', ''))
  returning * into v_prop;
  insert into proposta_revisoes (proposta_id, numero) values (v_prop.id, 0);
  perform registrar_evento(v_prop.id, 'criacao', null, 'À enviar', 'Proposta criada (R0).');
  perform set_config('erp.rpc', 'off', true);
  return v_prop;
end;
$$;

-- Mover no Kanban: aplica a tabela de transições aprovada ------------------------
create or replace function public.mover_proposta(p_id uuid, p_para text, p_dados jsonb default '{}')
returns public.propostas language plpgsql security definer set search_path = public as $$
declare
  v propostas; v_de text; v_rev proposta_revisoes; v_novo integer; v_dias integer; v_just text := coalesce(p_dados->>'justificativa', '');
begin
  select * into v from propostas where id = p_id and excluido_em is null for update;
  if not found then raise exception 'Proposta não encontrada.'; end if;
  v_de := v.status;
  if v_de = p_para then return v; end if;
  select * into v_rev from proposta_revisoes where proposta_id = v.id and numero = v.revisao_atual;
  perform set_config('erp.rpc', 'on', true);

  if p_para in ('Aprovado','Reprovado') and v_de in ('Enviados','Follow-up') then
    raise exception 'Use o formulário de % para registrar os dados obrigatórios.', lower(p_para);

  elsif v_de = 'À enviar' and p_para = 'Enviados' then
    if not tem_permissao('vendas','editar') then raise exception 'Sem permissão para enviar propostas.'; end if;
    select coalesce((valor)::text::integer, 5) into v_dias from configuracoes where chave = 'followup_prazo_padrao_dias';
    update proposta_revisoes set status = 'enviada', dados = to_jsonb(v), valor = v.valor,
      enviada_em = coalesce(nullif(p_dados->>'data_envio', '')::date, ano_atual_data()), enviada_por = auth.uid()
      where id = v_rev.id;
    update propostas set status = 'Enviados',
      proximo_followup = coalesce(nullif(p_dados->>'proximo_followup', '')::date, ano_atual_data() + coalesce(v_dias, 5))
      where id = v.id returning * into v;

  elsif (v_de = 'Enviados' and p_para = 'Follow-up') or (v_de = 'Follow-up' and p_para = 'Enviados') then
    if not tem_permissao('vendas','editar') then raise exception 'Sem permissão.'; end if;
    update propostas set status = p_para where id = v.id returning * into v;

  elsif v_de in ('Enviados','Follow-up','Reprovado') and p_para = 'À enviar' then
    if not tem_permissao('vendas','editar') then raise exception 'Sem permissão.'; end if;
    v_novo := v.revisao_atual + 1;
    insert into proposta_revisoes (proposta_id, numero, motivo) values (v.id, v_novo, v_just);
    update propostas set status = 'À enviar', revisao_atual = v_novo, proximo_followup = null where id = v.id returning * into v;
    perform registrar_evento(v.id, 'revisao', v_de, p_para, 'Nova revisão R' || v_novo || ' criada.', jsonb_build_object('motivo', v_just));

  elsif (v_de = 'Aprovado' and p_para = 'Finalizado') or (v_de = 'Finalizado' and p_para = 'Emitido NF') or (v_de = 'Emitido NF' and p_para = 'Pago') then
    if not tem_permissao('financeiro','editar') then raise exception 'Somente o Financeiro move para %.', p_para; end if;
    update propostas set status = p_para where id = v.id returning * into v;

  elsif v_de in ('Aprovado','Finalizado','Emitido NF','Pago') then
    if not tem_acesso_total() then raise exception 'Somente a Administração pode voltar uma proposta aprovada.'; end if;
    if length(trim(v_just)) < 5 then raise exception 'Informe a justificativa para voltar a etapa.'; end if;
    if p_para not in ('Aprovado','Finalizado','Emitido NF','Enviados') then raise exception 'Transição não permitida.'; end if;
    update propostas set status = p_para where id = v.id returning * into v;

  else
    raise exception 'Não é permitido mover de "%" para "%".', v_de, p_para;
  end if;

  if not (v_de in ('Enviados','Follow-up','Reprovado') and p_para = 'À enviar') then
    perform registrar_evento(v.id, 'status', v_de, p_para, coalesce(nullif(p_dados->>'observacao', ''), v_de || ' → ' || p_para),
      case when v_just <> '' then jsonb_build_object('justificativa', v_just) else '{}' end);
  end if;
  perform set_config('erp.rpc', 'off', true);
  return v;
end;
$$;

create or replace function public.ano_atual_data() returns date
language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

create or replace function public.reordenar_proposta(p_id uuid, p_ordem double precision) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('vendas','editar') then raise exception 'Sem permissão.'; end if;
  update propostas set ordem_kanban = p_ordem where id = p_id;
end;
$$;

create or replace function public.aprovar_proposta(p_id uuid, p_dados jsonb) returns public.propostas
language plpgsql security definer set search_path = public as $$
declare v propostas; v_rev proposta_revisoes; v_de text;
begin
  if not tem_permissao('vendas','aprovar') then raise exception 'Sem permissão para aprovar propostas.'; end if;
  select * into v from propostas where id = p_id and excluido_em is null for update;
  if not found then raise exception 'Proposta não encontrada.'; end if;
  if v.status not in ('Enviados','Follow-up') then raise exception 'Só propostas enviadas podem ser aprovadas.'; end if;
  if coalesce(p_dados->>'forma', '') = '' then raise exception 'Informe a forma de aprovação.'; end if;
  if coalesce(p_dados->>'comprovante_caminho', '') = '' then raise exception 'Anexe o comprovante da aprovação.'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'vendas' and name = p_dados->>'comprovante_caminho') then
    raise exception 'Comprovante não encontrado no armazenamento.';
  end if;
  select * into v_rev from proposta_revisoes where proposta_id = v.id and numero = v.revisao_atual;
  v_de := v.status;
  insert into proposta_aprovacoes (proposta_id, revisao_id, forma, numero_documento, data_aprovacao, valor_aprovado, comprovante_caminho, comprovante_nome, observacoes)
  values (v.id, v_rev.id, p_dados->>'forma', coalesce(p_dados->>'numero_documento', ''),
    coalesce(nullif(p_dados->>'data_aprovacao', '')::date, ano_atual_data()),
    coalesce(nullif(p_dados->>'valor_aprovado', '')::numeric, v.valor), p_dados->>'comprovante_caminho',
    coalesce(p_dados->>'comprovante_nome', ''), coalesce(p_dados->>'observacoes', ''));
  perform set_config('erp.rpc', 'on', true);
  update propostas set status = 'Aprovado', proximo_followup = null where id = v.id returning * into v;
  update contatos set classificacao = 'cliente', cliente_desde = coalesce(cliente_desde, ano_atual_data())
    where id = v.contato_id and classificacao = 'lead';
  perform registrar_evento(v.id, 'aprovacao', v_de, 'Aprovado', 'Aprovada por ' || (p_dados->>'forma') || '.');
  perform set_config('erp.rpc', 'off', true);
  return v;
end;
$$;

create or replace function public.reprovar_proposta(p_id uuid, p_dados jsonb) returns public.propostas
language plpgsql security definer set search_path = public as $$
declare v propostas; v_rev proposta_revisoes; v_de text;
begin
  if not tem_permissao('vendas','editar') then raise exception 'Sem permissão.'; end if;
  select * into v from propostas where id = p_id and excluido_em is null for update;
  if not found then raise exception 'Proposta não encontrada.'; end if;
  if v.status not in ('Enviados','Follow-up') then raise exception 'Só propostas enviadas podem ser reprovadas.'; end if;
  select * into v_rev from proposta_revisoes where proposta_id = v.id and numero = v.revisao_atual;
  v_de := v.status;
  insert into proposta_reprovacoes (proposta_id, revisao_id, motivo, concorrente, valor_concorrente, observacoes)
  values (v.id, v_rev.id, p_dados->>'motivo', coalesce(p_dados->>'concorrente', ''),
    nullif(p_dados->>'valor_concorrente', '')::numeric, coalesce(p_dados->>'observacoes', ''));
  perform set_config('erp.rpc', 'on', true);
  update propostas set status = 'Reprovado', proximo_followup = null where id = v.id returning * into v;
  perform registrar_evento(v.id, 'reprovacao', v_de, 'Reprovado', 'Motivo: ' || (p_dados->>'motivo') || '.');
  perform set_config('erp.rpc', 'off', true);
  return v;
end;
$$;

create or replace function public.registrar_followup(p_id uuid, p_dados jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v propostas;
begin
  if not tem_permissao('vendas','editar') then raise exception 'Sem permissão.'; end if;
  select * into v from propostas where id = p_id and excluido_em is null for update;
  if not found then raise exception 'Proposta não encontrada.'; end if;
  if v.status not in ('Enviados','Follow-up') then raise exception 'Follow-up só para propostas enviadas.'; end if;
  insert into proposta_followups (proposta_id, data_contato, canal, resumo, proxima_data)
  values (v.id, coalesce(nullif(p_dados->>'data_contato', '')::date, ano_atual_data()), p_dados->>'canal',
    coalesce(p_dados->>'resumo', ''), nullif(p_dados->>'proxima_data', '')::date);
  update propostas set proximo_followup = nullif(p_dados->>'proxima_data', '')::date where id = v.id;
  perform registrar_evento(v.id, 'followup', null, null, 'Contato por ' || (p_dados->>'canal') || ': ' || coalesce(p_dados->>'resumo', ''));
end;
$$;

-- RLS ------------------------------------------------------------------------
alter table public.segmentos enable row level security;
alter table public.empresas enable row level security;
alter table public.contatos enable row level security;
alter table public.contato_anos enable row level security;
alter table public.contadores_contato enable row level security;
alter table public.contadores_proposta enable row level security;
alter table public.propostas enable row level security;
alter table public.proposta_revisoes enable row level security;
alter table public.proposta_arquivos enable row level security;
alter table public.proposta_eventos enable row level security;
alter table public.proposta_followups enable row level security;
alter table public.proposta_aprovacoes enable row level security;
alter table public.proposta_reprovacoes enable row level security;

create policy segmentos_ler on public.segmentos for select to authenticated using (tem_permissao('vendas','ler'));
create policy segmentos_admin on public.segmentos for all to authenticated using (tem_permissao('admin','editar')) with check (tem_permissao('admin','editar'));

create policy empresas_ler on public.empresas for select to authenticated using (tem_permissao('vendas','ler') and excluido_em is null);
create policy empresas_criar on public.empresas for insert to authenticated with check (tem_permissao('vendas','criar'));
create policy empresas_editar on public.empresas for update to authenticated using (tem_permissao('vendas','editar')) with check (tem_permissao('vendas','editar'));

create policy contatos_ler on public.contatos for select to authenticated using (tem_permissao('vendas','ler') and excluido_em is null);
create policy contatos_criar on public.contatos for insert to authenticated with check (tem_permissao('vendas','criar'));
create policy contatos_editar on public.contatos for update to authenticated using (tem_permissao('vendas','editar')) with check (tem_permissao('vendas','editar'));

create policy contato_anos_ler on public.contato_anos for select to authenticated using (tem_permissao('vendas','ler'));

create policy propostas_ler on public.propostas for select to authenticated using (tem_permissao('vendas','ler') and excluido_em is null);
create policy propostas_editar on public.propostas for update to authenticated using (tem_permissao('vendas','editar')) with check (tem_permissao('vendas','editar'));

create policy revisoes_ler on public.proposta_revisoes for select to authenticated using (tem_permissao('vendas','ler'));
create policy arquivos_ler on public.proposta_arquivos for select to authenticated using (tem_permissao('vendas','ler'));
create policy arquivos_criar on public.proposta_arquivos for insert to authenticated with check (
  tem_permissao('vendas','editar') and exists (select 1 from public.proposta_revisoes r where r.id = revisao_id and r.status = 'rascunho'));
create policy arquivos_remover on public.proposta_arquivos for delete to authenticated using (
  tem_permissao('vendas','editar') and exists (select 1 from public.proposta_revisoes r where r.id = revisao_id and r.status = 'rascunho'));
create policy eventos_ler on public.proposta_eventos for select to authenticated using (tem_permissao('vendas','ler'));
create policy followups_ler on public.proposta_followups for select to authenticated using (tem_permissao('vendas','ler'));
create policy aprovacoes_ler on public.proposta_aprovacoes for select to authenticated using (tem_permissao('vendas','ler'));
create policy reprovacoes_ler on public.proposta_reprovacoes for select to authenticated using (tem_permissao('vendas','ler'));

-- Storage: bucket privado "vendas" ---------------------------------------------
-- Caminhos: propostas/{proposta_id}/{revisao_id}/{arquivo}  e  aprovacoes/{proposta_id}/{arquivo}
insert into storage.buckets (id, name, public, file_size_limit)
values ('vendas', 'vendas', false, 52428800) on conflict (id) do nothing;

create policy vendas_ler on storage.objects for select to authenticated
  using (bucket_id = 'vendas' and public.tem_permissao('vendas','ler'));
create policy vendas_enviar_proposta on storage.objects for insert to authenticated
  with check (bucket_id = 'vendas' and (storage.foldername(name))[1] = 'propostas' and public.tem_permissao('vendas','editar')
    and exists (select 1 from public.proposta_revisoes r where r.id::text = (storage.foldername(name))[3] and r.status = 'rascunho'));
create policy vendas_remover_proposta on storage.objects for delete to authenticated
  using (bucket_id = 'vendas' and (storage.foldername(name))[1] = 'propostas' and public.tem_permissao('vendas','editar')
    and exists (select 1 from public.proposta_revisoes r where r.id::text = (storage.foldername(name))[3] and r.status = 'rascunho'));
create policy vendas_enviar_comprovante on storage.objects for insert to authenticated
  with check (bucket_id = 'vendas' and (storage.foldername(name))[1] = 'aprovacoes' and public.tem_permissao('vendas','aprovar'));
