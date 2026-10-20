-- Custos da proposta (decisões 29 a 31). Cada revisão tem itens (A, B, C...) e cada item tem linhas por seção.
-- Total da linha = quantidade × fator × valor_unitario (coluna gerada, o banco calcula).

-- Permissões ---------------------------------------------------------------
insert into public.permissoes (modulo, acao) values ('custos','ler'), ('custos','editar') on conflict do nothing;
insert into public.perfil_permissoes (perfil_id, permissao_id)
select p.id, pm.id from public.perfis p join public.permissoes pm on pm.modulo = 'custos'
where p.nome = 'Comercial' on conflict do nothing;

-- Tabelas de referência (Administração edita; propostas guardam o valor do momento) --------
create table public.ref_materiais (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('Chapas','Perfis','Comerciais')),
  descricao text not null,
  unidade text not null default '' check (unidade in ('','Kg','Mts','Un')),
  preco numeric(14,4) not null default 0 check (preco >= 0),
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now(),
  unique (tipo, descricao)
);

create table public.ref_mao_obra (
  id uuid primary key default gen_random_uuid(),
  etapa text not null,
  funcao text not null,
  valor_hora numeric(12,2) not null default 0 check (valor_hora >= 0),
  ordem integer not null default 0,
  ativo boolean not null default true,
  unique (etapa, funcao)
);

create table public.ref_maquinas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  terceirizada boolean not null default false,
  valor_hora numeric(12,2) not null default 0 check (valor_hora >= 0),
  ordem integer not null default 0,
  ativo boolean not null default true
);

insert into public.ref_mao_obra (etapa, funcao, valor_hora, ordem) values
  ('Visita Técnica','Engenheiro Mecânico',100,1),
  ('Engenharia','Engenheiro Mecânico',100,2), ('Engenharia','Projetista',70,3), ('Engenharia','Desenhista',50,4),
  ('Fabricação','Montador',120,5), ('Fabricação','Soldador',120,6), ('Fabricação','Acabamentista',120,7), ('Fabricação','Pintor',120,8), ('Fabricação','Ajudante',120,9),
  ('Instalação','Montador',120,10), ('Instalação','Soldador',120,11), ('Instalação','Acabamentista',120,12), ('Instalação','Pintor',120,13), ('Instalação','Ajudante',120,14),
  ('Segurança','Técnico Segurança do Trabalho',80,15),
  ('Administrativo','Gerente',100,16), ('Administrativo','Comprador',50,17);

insert into public.ref_maquinas (nome, terceirizada, valor_hora, ordem) values
  ('Corte Laser c/ nitrogênio', true, 220, 1), ('Corte Laser s/ nitrogênio', true, 180, 2), ('Guilhotina', false, 100, 3),
  ('Viradeira hidráulica', false, 100, 4), ('Dobradeira', true, 180, 5), ('Calandra', false, 80, 6), ('Furadeira', false, 70, 7), ('Torno', false, 160, 8);

insert into public.configuracoes (chave, valor) values
  ('custos_padrao', '{"lucro_pct": 20, "negociacao_pct": 5, "imposto_pct": 20, "imposto_modo": "dentro"}')
on conflict (chave) do nothing;

-- Itens e linhas -----------------------------------------------------------
create table public.custo_itens (
  id uuid primary key default gen_random_uuid(),
  revisao_id uuid not null references public.proposta_revisoes(id),
  letra text not null check (letra ~ '^[A-Z]{1,2}$'),
  descricao text not null default '',
  quantidade numeric(12,3) not null default 1 check (quantidade > 0),
  lucro_pct numeric(6,2) not null default 20 check (lucro_pct >= 0),
  negociacao_pct numeric(6,2) not null default 5 check (negociacao_pct >= 0),
  imposto_pct numeric(6,2) not null default 20 check (imposto_pct >= 0 and imposto_pct < 100),
  imposto_modo text not null default 'dentro' check (imposto_modo in ('dentro','fora')),
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (revisao_id, letra)
);

create table public.custo_linhas (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.custo_itens(id) on delete cascade,
  secao text not null check (secao in ('materiais','acessorios','mao_obra','maquinas','deslocamento','alimentacao','hospedagem','fretes')),
  grupo text not null default '',       -- materiais: tipo; mão de obra: etapa
  descricao text not null default '',   -- material, função, máquina, tipo de frete...
  detalhe text not null default '',     -- destino, cidade, partida, terceirizada...
  detalhe2 text not null default '',    -- destino do frete
  unidade text not null default '',
  quantidade numeric(14,3) not null default 0,
  fator numeric(14,3) not null default 1,      -- materiais: und/peso/mts; alimentação: dias
  valor_unitario numeric(14,4) not null default 0,
  total numeric(18,2) generated always as (round(quantidade * fator * valor_unitario, 2)) stored,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);
create index custo_linhas_item_idx on public.custo_linhas (item_id, secao, ordem);

create trigger custo_itens_atualizado before update on public.custo_itens for each row execute function tocar_atualizado_em();
create trigger custo_itens_auditoria after insert or update or delete on public.custo_itens for each row execute function registrar_auditoria();
create trigger custo_linhas_auditoria after insert or update or delete on public.custo_linhas for each row execute function registrar_auditoria();

-- Revisão ainda editável?
create or replace function public.revisao_em_rascunho(p_revisao uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from proposta_revisoes where id = p_revisao and status = 'rascunho');
$$;

-- Resumo do item com as fórmulas aprovadas (decisão 30).
create or replace function public.custo_resumo(p_item uuid)
returns table (custos numeric, lucro numeric, negociacao numeric, imposto numeric, preco_unitario numeric, preco_total numeric)
language sql stable security definer set search_path = public as $$
  with i as (select * from custo_itens where id = p_item),
  c as (select coalesce(sum(total), 0) as custos from custo_linhas where item_id = p_item),
  m as (select c.custos, c.custos * i.lucro_pct / 100 as lucro, c.custos * i.negociacao_pct / 100 as negociacao, i.* from c, i),
  p as (select m.*, case when m.imposto_modo = 'dentro'
      then (m.custos + m.lucro + m.negociacao) / (1 - m.imposto_pct / 100)
      else (m.custos + m.lucro + m.negociacao) * (1 + m.imposto_pct / 100) end as pu from m)
  select round(custos, 2), round(lucro, 2), round(negociacao, 2), round(pu - custos - lucro - negociacao, 2), round(pu, 2), round(pu * quantidade, 2) from p
  where tem_permissao('custos','ler');
$$;

-- Copia os custos de uma revisão para outra (usada ao criar nova revisão).
create or replace function public.copiar_custos(p_de uuid, p_para uuid) returns void
language plpgsql security definer set search_path = public as $$
declare it custo_itens; novo uuid;
begin
  for it in select * from custo_itens where revisao_id = p_de order by ordem, letra loop
    insert into custo_itens (revisao_id, letra, descricao, quantidade, lucro_pct, negociacao_pct, imposto_pct, imposto_modo, ordem)
    values (p_para, it.letra, it.descricao, it.quantidade, it.lucro_pct, it.negociacao_pct, it.imposto_pct, it.imposto_modo, it.ordem)
    returning id into novo;
    insert into custo_linhas (item_id, secao, grupo, descricao, detalhe, detalhe2, unidade, quantidade, fator, valor_unitario, ordem)
    select novo, secao, grupo, descricao, detalhe, detalhe2, unidade, quantidade, fator, valor_unitario, ordem
    from custo_linhas where item_id = it.id;
  end loop;
end;
$$;
revoke execute on function public.copiar_custos(uuid, uuid) from public, anon, authenticated;

-- mover_proposta passa a copiar os custos ao criar nova revisão (o resto igual à 0002).
create or replace function public.mover_proposta(p_id uuid, p_para text, p_dados jsonb default '{}')
returns public.propostas language plpgsql security definer set search_path = public as $$
declare
  v propostas; v_de text; v_rev proposta_revisoes; v_novo integer; v_nova_rev uuid; v_dias integer; v_just text := coalesce(p_dados->>'justificativa', '');
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
    insert into proposta_revisoes (proposta_id, numero, motivo) values (v.id, v_novo, v_just) returning id into v_nova_rev;
    perform copiar_custos(v_rev.id, v_nova_rev);
    update propostas set status = 'À enviar', revisao_atual = v_novo, proximo_followup = null where id = v.id returning * into v;
    perform registrar_evento(v.id, 'revisao', v_de, p_para, 'Nova revisão R' || v_novo || ' criada (custos copiados da R' || (v_novo - 1) || ').', jsonb_build_object('motivo', v_just));

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

-- RLS ------------------------------------------------------------------------
alter table public.ref_materiais enable row level security;
alter table public.ref_mao_obra enable row level security;
alter table public.ref_maquinas enable row level security;
alter table public.custo_itens enable row level security;
alter table public.custo_linhas enable row level security;

create policy ref_materiais_ler on public.ref_materiais for select to authenticated using (tem_permissao('custos','ler'));
create policy ref_materiais_admin on public.ref_materiais for all to authenticated using (tem_permissao('admin','editar')) with check (tem_permissao('admin','editar'));
create policy ref_mao_obra_ler on public.ref_mao_obra for select to authenticated using (tem_permissao('custos','ler'));
create policy ref_mao_obra_admin on public.ref_mao_obra for all to authenticated using (tem_permissao('admin','editar')) with check (tem_permissao('admin','editar'));
create policy ref_maquinas_ler on public.ref_maquinas for select to authenticated using (tem_permissao('custos','ler'));
create policy ref_maquinas_admin on public.ref_maquinas for all to authenticated using (tem_permissao('admin','editar')) with check (tem_permissao('admin','editar'));

create policy custo_itens_ler on public.custo_itens for select to authenticated using (tem_permissao('custos','ler'));
create policy custo_itens_escrever on public.custo_itens for all to authenticated
  using (tem_permissao('custos','editar') and revisao_em_rascunho(revisao_id))
  with check (tem_permissao('custos','editar') and revisao_em_rascunho(revisao_id));

create policy custo_linhas_ler on public.custo_linhas for select to authenticated using (tem_permissao('custos','ler'));
create policy custo_linhas_escrever on public.custo_linhas for all to authenticated
  using (tem_permissao('custos','editar') and exists (select 1 from public.custo_itens i where i.id = item_id and public.revisao_em_rascunho(i.revisao_id)))
  with check (tem_permissao('custos','editar') and exists (select 1 from public.custo_itens i where i.id = item_id and public.revisao_em_rascunho(i.revisao_id)));

grant select on public.ref_materiais, public.ref_mao_obra, public.ref_maquinas, public.custo_itens, public.custo_linhas to authenticated;
grant insert, update, delete on public.ref_materiais, public.ref_mao_obra, public.ref_maquinas, public.custo_itens, public.custo_linhas to authenticated;

revoke execute on function public.revisao_em_rascunho(uuid) from public, anon;
revoke execute on function public.custo_resumo(uuid) from public, anon;
grant execute on function public.revisao_em_rascunho(uuid), public.custo_resumo(uuid) to authenticated;
revoke execute on function public.mover_proposta(uuid, text, jsonb) from public, anon;
grant execute on function public.mover_proposta(uuid, text, jsonb) to authenticated;
