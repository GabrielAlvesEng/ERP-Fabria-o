-- Kick-off da proposta aprovada (Documento Mestre 8.10; planejamento 4.9).
-- Uma reunião por versão; finalizada fica só leitura; nova versão copia a anterior.

create table public.kickoff_modelo_itens (
  id uuid primary key default gen_random_uuid(),
  setor text not null,
  descricao text not null,
  ordem integer not null default 0,
  ativo boolean not null default true,
  unique (setor, descricao)
);

insert into public.kickoff_modelo_itens (setor, descricao, ordem) values
  ('Engenharia', 'Levantamento de medidas em campo', 1),
  ('Engenharia', 'Desenvolvimento do projeto e modelamento 3D', 2),
  ('Engenharia', 'Memorial de cálculo / ART', 3),
  ('Engenharia', 'Aprovação do projeto pelo cliente', 4),
  ('Engenharia', 'Detalhamento, desenhos e lista de materiais', 5),
  ('Compras', 'Matéria-prima (chapas, perfis, tubos)', 10),
  ('Compras', 'Itens comerciais', 11),
  ('Compras', 'Suprimentos e consumíveis', 12),
  ('Compras', 'Ferramentas especiais', 13),
  ('Compras', 'Locação de equipamentos (munck, guindaste, PTA, andaime)', 14),
  ('Compras', 'Contratação de terceiros (usinagem, pintura, galvanização, elétrica)', 15),
  ('Fabricação', 'Fabricação na Fabriaço', 20),
  ('Fabricação', 'Pintura / tratamento superficial', 21),
  ('Fabricação', 'Pré-montagem e testes na fábrica', 22),
  ('Fabricação', 'Inspeção dimensional e ensaios', 23),
  ('Montagem em campo', 'Montagem em campo', 30),
  ('Montagem em campo', 'Soldagem em campo', 31),
  ('Montagem em campo', 'Içamento e movimentação de carga', 32),
  ('Logística', 'Transporte com veículo próprio', 40),
  ('Logística', 'Transportadora contratada', 41),
  ('Logística', 'Embalagem / proteção especial', 42),
  ('Logística', 'Restrições de acesso e horários do cliente', 43),
  ('RH e Segurança', 'Integração de segurança no cliente', 50),
  ('RH e Segurança', 'Documentação de acesso (ASO, APR, PT)', 51),
  ('RH e Segurança', 'Treinamentos específicos (NR-10, NR-12, NR-33, NR-35)', 52),
  ('Financeiro', 'Condições de pagamento confirmadas', 60),
  ('Financeiro', 'Faturamento por marcos (medição)', 61),
  ('Financeiro', 'Garantias e retenções contratuais', 62),
  ('Prazos', 'Prazo de entrega acordado', 70),
  ('Prazos', 'Datas de marcos intermediários', 71);

create table public.kickoffs (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references public.propostas(id),
  versao integer not null default 1,
  data_reuniao date,
  participantes text not null default '',
  observacoes text not null default '',
  marcos jsonb not null default '[]',   -- [{descricao, percentual, evento}]
  status text not null default 'rascunho' check (status in ('rascunho','finalizado')),
  finalizado_por uuid references public.usuarios(id),
  finalizado_em timestamptz,
  criado_por uuid default auth.uid() references public.usuarios(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (proposta_id, versao)
);

create table public.kickoff_itens (
  id uuid primary key default gen_random_uuid(),
  kickoff_id uuid not null references public.kickoffs(id) on delete cascade,
  setor text not null,
  descricao text not null,
  necessario text not null default 'a_definir' check (necessario in ('sim','nao','a_definir')),
  responsavel text not null default '',
  prazo date,
  observacao text not null default '',
  ordem integer not null default 0
);
create index kickoff_itens_idx on public.kickoff_itens (kickoff_id, ordem);

create trigger kickoffs_atualizado before update on public.kickoffs for each row execute function tocar_atualizado_em();
create trigger kickoffs_auditoria after insert or update or delete on public.kickoffs for each row execute function registrar_auditoria();
create trigger kickoff_itens_auditoria after insert or update or delete on public.kickoff_itens for each row execute function registrar_auditoria();

create or replace function public.kickoff_em_rascunho(p_kickoff uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from kickoffs where id = p_kickoff and status = 'rascunho');
$$;

-- Finalizado não volta para rascunho por edição direta.
create or replace function public.proteger_kickoff() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('erp.rpc', true), '') = 'on' then return new; end if;
  if old.status = 'finalizado' then raise exception 'Kick-off finalizado não pode ser alterado. Crie uma nova versão.'; end if;
  if (new.status, new.proposta_id, new.versao, new.finalizado_por, new.finalizado_em) is distinct from (old.status, old.proposta_id, old.versao, old.finalizado_por, old.finalizado_em) then
    raise exception 'Use as ações do sistema para finalizar o kick-off.';
  end if;
  return new;
end;
$$;
create trigger kickoffs_proteger before update on public.kickoffs for each row execute function proteger_kickoff();

-- Inicia o kick-off (versão 1) ou uma nova versão a partir da última finalizada.
create or replace function public.iniciar_kickoff(p_proposta uuid) returns public.kickoffs
language plpgsql security definer set search_path = public as $$
declare v propostas; ult kickoffs; novo kickoffs;
begin
  if not tem_permissao('vendas','editar') then raise exception 'Sem permissão.'; end if;
  select * into v from propostas where id = p_proposta and excluido_em is null;
  if not found then raise exception 'Proposta não encontrada.'; end if;
  if v.status not in ('Aprovado','Finalizado','Emitido NF','Pago') then raise exception 'O kick-off é feito depois da aprovação.'; end if;
  select * into ult from kickoffs where proposta_id = v.id order by versao desc limit 1;
  if found and ult.status = 'rascunho' then raise exception 'Já existe um kick-off em andamento.'; end if;
  perform set_config('erp.rpc', 'on', true);
  insert into kickoffs (proposta_id, versao, data_reuniao, participantes, observacoes, marcos)
  values (v.id, coalesce(ult.versao, 0) + 1, case when ult.id is null then ano_atual_data() else ult.data_reuniao end,
    coalesce(ult.participantes, ''), coalesce(ult.observacoes, ''), coalesce(ult.marcos, '[]'))
  returning * into novo;
  if ult.id is null then
    insert into kickoff_itens (kickoff_id, setor, descricao, ordem)
    select novo.id, setor, descricao, ordem from kickoff_modelo_itens where ativo order by ordem;
  else
    insert into kickoff_itens (kickoff_id, setor, descricao, necessario, responsavel, prazo, observacao, ordem)
    select novo.id, setor, descricao, necessario, responsavel, prazo, observacao, ordem from kickoff_itens where kickoff_id = ult.id;
  end if;
  perform registrar_evento(v.id, 'kickoff', null, null, 'Kick-off versão ' || novo.versao || ' iniciado.');
  perform set_config('erp.rpc', 'off', true);
  return novo;
end;
$$;

create or replace function public.finalizar_kickoff(p_kickoff uuid) returns public.kickoffs
language plpgsql security definer set search_path = public as $$
declare k kickoffs; pend integer;
begin
  if not tem_permissao('vendas','editar') then raise exception 'Sem permissão.'; end if;
  select * into k from kickoffs where id = p_kickoff for update;
  if not found then raise exception 'Kick-off não encontrado.'; end if;
  if k.status = 'finalizado' then return k; end if;
  if k.data_reuniao is null then raise exception 'Informe a data da reunião.'; end if;
  select count(*) into pend from kickoff_itens where kickoff_id = k.id and necessario = 'a_definir';
  if pend > 0 then raise exception 'Ainda há % item(ns) "A definir". Marque Sim ou Não em todos antes de finalizar.', pend; end if;
  perform set_config('erp.rpc', 'on', true);
  update kickoffs set status = 'finalizado', finalizado_por = auth.uid(), finalizado_em = now() where id = k.id returning * into k;
  perform registrar_evento(k.proposta_id, 'kickoff', null, null, 'Kick-off versão ' || k.versao || ' finalizado.');
  perform set_config('erp.rpc', 'off', true);
  return k;
end;
$$;

alter table public.kickoff_modelo_itens enable row level security;
alter table public.kickoffs enable row level security;
alter table public.kickoff_itens enable row level security;

create policy kickoff_modelo_ler on public.kickoff_modelo_itens for select to authenticated using (true);
create policy kickoff_modelo_admin on public.kickoff_modelo_itens for all to authenticated using (tem_permissao('admin','editar')) with check (tem_permissao('admin','editar'));
create policy kickoffs_ler on public.kickoffs for select to authenticated using (tem_permissao('vendas','ler') or tem_permissao('engenharia','ler'));
create policy kickoffs_editar on public.kickoffs for update to authenticated using (tem_permissao('vendas','editar')) with check (tem_permissao('vendas','editar'));
create policy kickoff_itens_ler on public.kickoff_itens for select to authenticated using (tem_permissao('vendas','ler') or tem_permissao('engenharia','ler'));
create policy kickoff_itens_escrever on public.kickoff_itens for all to authenticated
  using (tem_permissao('vendas','editar') and kickoff_em_rascunho(kickoff_id))
  with check (tem_permissao('vendas','editar') and kickoff_em_rascunho(kickoff_id));

grant select on public.kickoff_modelo_itens, public.kickoffs, public.kickoff_itens to authenticated;
grant insert, update, delete on public.kickoff_modelo_itens, public.kickoff_itens to authenticated;
grant update on public.kickoffs to authenticated;

do $$
declare f text;
begin
  foreach f in array array['public.kickoff_em_rascunho(uuid)', 'public.iniciar_kickoff(uuid)', 'public.finalizar_kickoff(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
