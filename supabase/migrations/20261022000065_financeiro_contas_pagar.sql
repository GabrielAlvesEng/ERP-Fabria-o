-- Financeiro, entrega 1 (decisão 105, 22/10/2026; docs/PLANEJAMENTO_FINANCEIRO.md): contas a pagar das ordens de compra.
-- A conta nasce sozinha quando Compras emite a OC (gatilho em compras_pedidos) e acompanha a entrega e o cancelamento.
-- O Financeiro ajusta vencimentos, paga (parcial ou total, com comprovante), anexa boleto/NF e estorna (ação crítica, com motivo).
-- Nada é apagado: conta cancelada, parcela substituída, pagamento estornado e anexo removido ficam registrados.
-- As colunas novas de compras_pedidos (condicao_tipo, condicao_dias, orcamento_caminho, status 'cancelada', cancelado_motivo)
-- vêm do Compras v2 (decisão 103); o gatilho lê por to_jsonb para funcionar antes e depois daquela migration.
set lock_timeout = '10s';

insert into public.permissoes (modulo, acao) values ('financeiro', 'critica') on conflict do nothing;
insert into public.perfil_permissoes (perfil_id, permissao_id)
select p.id, pm.id from public.perfis p join public.permissoes pm on pm.modulo = 'financeiro' and pm.acao = 'critica'
where p.nome = 'Financeiro'
on conflict do nothing;

-- 1) Dados de pagamento do fornecedor (só o Financeiro vê) -----------------------------------------------------------
create table public.fornecedores_pagamento (
  fornecedor_id uuid primary key references public.fornecedores(id),
  banco text not null default '',
  agencia text not null default '',
  conta text not null default '',
  titular text not null default '',
  documento_titular text not null default '',
  chave_pix text not null default '',
  prazo_apos_recebimento integer not null default 28 check (prazo_apos_recebimento between 0 and 365),
  observacoes text not null default '',
  atualizado_por uuid default auth.uid() references public.usuarios(id),
  atualizado_em timestamptz not null default now()
);

-- 2) Contas, parcelas, pagamentos, anexos e histórico ----------------------------------------------------------------
create table public.fin_contas_pagar (
  id uuid primary key default gen_random_uuid(),
  origem text not null default 'compra' check (origem in ('compra')),
  pedido_id uuid unique references public.compras_pedidos(id),
  pedido_codigo text not null default '',
  fornecedor_id uuid references public.fornecedores(id),
  fornecedor_nome text not null default '',
  projeto_codigo text not null default '',
  projeto_titulo text not null default '',
  descricao text not null default '',
  valor_total numeric(14,2) not null check (valor_total >= 0),
  condicao_tipo text not null check (condicao_tipo in ('antecipado', 'apos_recebimento', 'parcelado', 'a_combinar')),
  condicao_dias integer[] not null default '{}',
  emitida_em date not null,
  entregue_em date,
  status text not null default 'aberta' check (status in ('aberta', 'paga', 'cancelada')),
  cancelado_motivo text not null default '',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index fin_contas_pagar_status_idx on public.fin_contas_pagar (status, criado_em desc);

create table public.fin_parcelas (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.fin_contas_pagar(id),
  numero integer not null check (numero >= 1),
  vencimento date,                         -- vazio: aguardando a entrega ou "a combinar"
  valor numeric(14,2) not null check (valor >= 0),
  pago numeric(14,2) not null default 0 check (pago >= 0),
  pago_em date,                            -- data do pagamento que quitou a parcela
  ativa boolean not null default true,     -- false: substituída ao refazer as parcelas (fica no histórico)
  unique (conta_id, numero)
);
create index fin_parcelas_venc_idx on public.fin_parcelas (vencimento) where pago_em is null and ativa;

create table public.fin_pagamentos (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.fin_contas_pagar(id),
  parcela_id uuid not null references public.fin_parcelas(id),
  data date not null,
  valor numeric(14,2) not null check (valor > 0),
  forma text not null check (forma in ('pix', 'boleto', 'transferencia', 'cartao', 'dinheiro', 'outro')),
  comprovante_caminho text,
  observacao text not null default '',
  lancado_por uuid default auth.uid() references public.usuarios(id),
  lancado_em timestamptz not null default now(),
  estornado_em timestamptz,
  estornado_por uuid references public.usuarios(id),
  estorno_motivo text not null default ''
);
create index fin_pagamentos_conta_idx on public.fin_pagamentos (conta_id, data);

create table public.fin_anexos (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.fin_contas_pagar(id),
  tipo text not null check (tipo in ('orcamento', 'boleto', 'nf', 'outro')),
  bucket text not null default 'financeiro' check (bucket in ('financeiro', 'compras')),
  caminho text not null,
  nome text not null default '',
  enviado_por uuid default auth.uid() references public.usuarios(id),
  enviado_em timestamptz not null default now(),
  removido_em timestamptz,
  removido_por uuid references public.usuarios(id)
);
create index fin_anexos_conta_idx on public.fin_anexos (conta_id);

create table public.fin_eventos (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.fin_contas_pagar(id),
  tipo text not null check (tipo in ('criada', 'entrega', 'vencimentos', 'pagamento', 'estorno', 'anexo', 'cancelada', 'reaberta')),
  descricao text not null default '',
  dados jsonb not null default '{}',
  usuario_id uuid default auth.uid() references public.usuarios(id),
  criado_em timestamptz not null default now()
);
create index fin_eventos_conta_idx on public.fin_eventos (conta_id, criado_em desc);

create trigger fin_contas_pagar_atualizado before update on public.fin_contas_pagar for each row execute function tocar_atualizado_em();
create trigger fornecedores_pagamento_atualizado before update on public.fornecedores_pagamento for each row execute function tocar_atualizado_em();

-- 3) Parcelas a partir da condição -----------------------------------------------------------------------------------
-- Antecipado: uma parcela na emissão. Parcelado: dias contados da emissão da OC. Após o recebimento: dias contados da
-- entrega (sem entrega, a parcela fica sem data). A combinar: uma parcela sem data. Último centavo vai na última parcela.
create or replace function public.fin_gerar_parcelas(p_conta uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c fin_contas_pagar; v_dias integer[]; n integer; i integer; v_parte numeric(14,2); v_base date;
begin
  select * into c from fin_contas_pagar where id = p_conta;
  v_dias := case c.condicao_tipo
    when 'antecipado' then array[0]
    when 'a_combinar' then array[0]
    else case when cardinality(c.condicao_dias) > 0 then c.condicao_dias else array[0] end end;
  n := cardinality(v_dias);
  v_parte := trunc(c.valor_total / n, 2);
  v_base := case c.condicao_tipo when 'apos_recebimento' then c.entregue_em when 'a_combinar' then null else c.emitida_em end;
  for i in 1..n loop
    insert into fin_parcelas (conta_id, numero, vencimento, valor)
    values (c.id, i, v_base + v_dias[i], case when i = n then c.valor_total - v_parte * (n - 1) else v_parte end)
    on conflict (conta_id, numero) do update set vencimento = excluded.vencimento, valor = excluded.valor, pago = 0, pago_em = null, ativa = true;
  end loop;
  update fin_parcelas set ativa = false where conta_id = c.id and numero > n;
end;
$$;

-- 4) Gatilho na ordem de compra ---------------------------------------------------------------------------------------
create or replace function public.fin_pedido_criado() returns trigger
language plpgsql security definer set search_path = public as $$
declare j jsonb := to_jsonb(new); r compras_requisicoes; f fornecedores; fp fornecedores_pagamento;
  v_tipo text; v_dias integer[]; v_conta uuid; v_orc text;
begin
  select * into r from compras_requisicoes where id = new.requisicao_id;
  select * into f from fornecedores where id = new.fornecedor_id;
  select * into fp from fornecedores_pagamento where fornecedor_id = new.fornecedor_id;
  v_tipo := coalesce(nullif(j->>'condicao_tipo', ''), f.condicao_pagamento, 'a_combinar');
  if v_tipo not in ('antecipado', 'apos_recebimento', 'parcelado', 'a_combinar') then v_tipo := 'a_combinar'; end if;
  select coalesce(array_agg(x::integer order by o), '{}') into v_dias
    from jsonb_array_elements_text(case when jsonb_typeof(j->'condicao_dias') = 'array' then j->'condicao_dias' else '[]'::jsonb end) with ordinality t(x, o);
  if cardinality(v_dias) = 0 and v_tipo = 'apos_recebimento' then v_dias := array[coalesce(fp.prazo_apos_recebimento, 28)]; end if;
  if cardinality(v_dias) = 0 and v_tipo = 'parcelado' then v_dias := array[30]; end if;

  insert into fin_contas_pagar (pedido_id, pedido_codigo, fornecedor_id, fornecedor_nome, projeto_codigo, projeto_titulo, descricao,
    valor_total, condicao_tipo, condicao_dias, emitida_em, entregue_em)
  values (new.id, new.codigo, new.fornecedor_id, coalesce(f.nome, ''), coalesce(r.projeto_codigo, ''), coalesce(r.projeto_titulo, ''),
    coalesce(r.codigo || ' · ' || r.titulo, ''), new.valor_total, v_tipo, v_dias,
    (coalesce(new.emitido_em, now()) at time zone 'America/Sao_Paulo')::date, new.entregue_em)
  returning id into v_conta;
  perform fin_gerar_parcelas(v_conta);

  v_orc := nullif(j->>'orcamento_caminho', '');
  if v_orc is not null then
    insert into fin_anexos (conta_id, tipo, bucket, caminho, nome) values (v_conta, 'orcamento', 'compras', v_orc, 'Orçamento do fornecedor');
  end if;
  insert into fin_eventos (conta_id, tipo, descricao, dados) values (v_conta, 'criada', 'Conta criada pela ordem de compra ' || new.codigo,
    jsonb_build_object('valor', new.valor_total, 'condicao', v_tipo, 'dias', v_dias));
  return new;
end;
$$;
create trigger compras_pedidos_fin_criado after insert on public.compras_pedidos for each row execute function fin_pedido_criado();

-- Entrega (data passa a existir) e cancelamento da OC.
create or replace function public.fin_pedido_alterado() returns trigger
language plpgsql security definer set search_path = public as $$
declare jn jsonb := to_jsonb(new); jo jsonb := to_jsonb(old); c fin_contas_pagar; v_ent date;
begin
  select * into c from fin_contas_pagar where pedido_id = new.id for update;
  if not found then return new; end if;
  v_ent := nullif(jn->>'entregue_em', '')::date;
  if v_ent is distinct from c.entregue_em then
    update fin_contas_pagar set entregue_em = v_ent where id = c.id;
    if c.condicao_tipo = 'apos_recebimento' and v_ent is not null then
      -- Só as parcelas ainda sem data recebem o vencimento; o que o Financeiro já ajustou fica.
      update fin_parcelas p set vencimento = v_ent + coalesce(c.condicao_dias[p.numero], c.condicao_dias[1], 0)
       where p.conta_id = c.id and p.ativa and p.vencimento is null and p.pago_em is null;
    end if;
    insert into fin_eventos (conta_id, tipo, descricao, dados) values (c.id, 'entrega',
      case when v_ent is null then 'Entrega desfeita em Compras' else 'Compras registrou a entrega em ' || to_char(v_ent, 'DD/MM/YYYY') end,
      jsonb_build_object('entregue_em', v_ent));
  end if;
  if jn->>'status' = 'cancelada' and coalesce(jo->>'status', '') <> 'cancelada' and c.status <> 'cancelada' then
    if exists (select 1 from fin_pagamentos where conta_id = c.id and estornado_em is null) then
      insert into fin_eventos (conta_id, tipo, descricao) values (c.id, 'cancelada',
        'Compras cancelou a ordem de compra, mas a conta já tem pagamento: continua aberta até o Financeiro estornar. Motivo: ' || coalesce(jn->>'cancelado_motivo', ''));
    else
      update fin_contas_pagar set status = 'cancelada', cancelado_motivo = coalesce(jn->>'cancelado_motivo', '') where id = c.id;
      insert into fin_eventos (conta_id, tipo, descricao) values (c.id, 'cancelada', 'Ordem de compra cancelada em Compras. Motivo: ' || coalesce(jn->>'cancelado_motivo', ''));
    end if;
  end if;
  if (jn->>'valor_total')::numeric is distinct from c.valor_total and c.status = 'aberta'
     and not exists (select 1 from fin_pagamentos where conta_id = c.id) then
    update fin_contas_pagar set valor_total = (jn->>'valor_total')::numeric where id = c.id;
    perform fin_gerar_parcelas(c.id);  -- sem pagamento: as parcelas são refeitas com o valor novo
    insert into fin_eventos (conta_id, tipo, descricao, dados) values (c.id, 'vencimentos', 'Valor da ordem de compra alterado em Compras; parcelas refeitas',
      jsonb_build_object('de', c.valor_total, 'para', (jn->>'valor_total')::numeric));
  end if;
  return new;
end;
$$;
create trigger compras_pedidos_fin_alterado after update on public.compras_pedidos for each row execute function fin_pedido_alterado();

-- 5) Ações do Financeiro ----------------------------------------------------------------------------------------------
-- Refaz as parcelas (datas e valores) enquanto não há pagamento. p_parcelas = [{vencimento, valor}], soma = valor da conta.
create or replace function public.fin_definir_parcelas(p_conta uuid, p_parcelas jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare c fin_contas_pagar; v_soma numeric; v_n integer; x jsonb; i integer := 0;
begin
  if not tem_permissao('financeiro', 'editar') then raise exception 'Sem permissão para alterar vencimentos.'; end if;
  select * into c from fin_contas_pagar where id = p_conta for update;
  if not found then raise exception 'Conta não encontrada.'; end if;
  if c.status <> 'aberta' then raise exception 'Só uma conta em aberto tem os vencimentos alterados.'; end if;
  if exists (select 1 from fin_pagamentos where conta_id = c.id) then
    raise exception 'A conta já teve pagamento: altere só a data das parcelas em aberto.';
  end if;
  v_n := jsonb_array_length(coalesce(p_parcelas, '[]'));
  if v_n < 1 or v_n > 24 then raise exception 'Informe de 1 a 24 parcelas.'; end if;
  select sum((e->>'valor')::numeric) into v_soma from jsonb_array_elements(p_parcelas) e;
  if exists (select 1 from jsonb_array_elements(p_parcelas) e where coalesce((e->>'valor')::numeric, -1) < 0) then raise exception 'Valor de parcela inválido.'; end if;
  if round(v_soma, 2) <> c.valor_total then raise exception 'A soma das parcelas (%) precisa ser igual ao valor da conta (%).', round(v_soma, 2), c.valor_total; end if;
  for x in select * from jsonb_array_elements(p_parcelas) loop
    i := i + 1;
    insert into fin_parcelas (conta_id, numero, vencimento, valor) values (c.id, i, nullif(x->>'vencimento', '')::date, round((x->>'valor')::numeric, 2))
    on conflict (conta_id, numero) do update set vencimento = excluded.vencimento, valor = excluded.valor, pago = 0, pago_em = null, ativa = true;
  end loop;
  update fin_parcelas set ativa = false where conta_id = c.id and numero > v_n;
  insert into fin_eventos (conta_id, tipo, descricao, dados) values (c.id, 'vencimentos', 'Parcelas redefinidas (' || v_n || ')', jsonb_build_object('parcelas', p_parcelas));
end;
$$;

-- Muda a data de uma parcela ainda não quitada (vale também depois de pagamento parcial).
create or replace function public.fin_alterar_vencimento(p_parcela uuid, p_vencimento date) returns void
language plpgsql security definer set search_path = public as $$
declare p fin_parcelas; c fin_contas_pagar;
begin
  if not tem_permissao('financeiro', 'editar') then raise exception 'Sem permissão para alterar vencimentos.'; end if;
  select * into p from fin_parcelas where id = p_parcela for update;
  if not found then raise exception 'Parcela não encontrada.'; end if;
  select * into c from fin_contas_pagar where id = p.conta_id;
  if c.status <> 'aberta' or p.pago_em is not null or not p.ativa then raise exception 'Parcela já paga ou conta encerrada.'; end if;
  update fin_parcelas set vencimento = p_vencimento where id = p.id;
  insert into fin_eventos (conta_id, tipo, descricao, dados) values (c.id, 'vencimentos',
    'Vencimento da parcela ' || p.numero || ': ' || coalesce(to_char(p.vencimento, 'DD/MM/YYYY'), 'sem data') || ' → ' || coalesce(to_char(p_vencimento, 'DD/MM/YYYY'), 'sem data'),
    jsonb_build_object('parcela', p.numero, 'de', p.vencimento, 'para', p_vencimento));
end;
$$;

-- Recalcula o pago de cada parcela e a situação da conta a partir dos pagamentos não estornados.
create or replace function public.fin_recalcular(p_conta uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update fin_parcelas p set pago = coalesce(s.total, 0),
    pago_em = case when coalesce(s.total, 0) >= p.valor and p.valor > 0 then s.ultima end
  from (select pp.id, sum(g.valor) total, max(g.data) ultima from fin_parcelas pp
          left join fin_pagamentos g on g.parcela_id = pp.id and g.estornado_em is null
         where pp.conta_id = p_conta group by pp.id) s
  where p.id = s.id;
  update fin_contas_pagar c set status = case when not exists (select 1 from fin_parcelas where conta_id = c.id and ativa and pago_em is null and valor > 0)
    then 'paga' else 'aberta' end
  where c.id = p_conta and c.status <> 'cancelada';
end;
$$;

create or replace function public.fin_registrar_pagamento(p_parcela uuid, p_data date, p_valor numeric, p_forma text,
  p_comprovante text default null, p_observacao text default '') returns void
language plpgsql security definer set search_path = public as $$
declare p fin_parcelas; c fin_contas_pagar;
begin
  if not tem_permissao('financeiro', 'editar') then raise exception 'Sem permissão para registrar pagamentos.'; end if;
  select * into p from fin_parcelas where id = p_parcela for update;
  if not found or not p.ativa then raise exception 'Parcela não encontrada.'; end if;
  select * into c from fin_contas_pagar where id = p.conta_id for update;
  if c.status <> 'aberta' then raise exception 'Esta conta não está em aberto.'; end if;
  if p_data is null then raise exception 'Informe a data do pagamento.'; end if;
  if p_data > ano_atual_data() + 1 then raise exception 'A data do pagamento não pode ser no futuro.'; end if;
  if coalesce(p_valor, 0) <= 0 then raise exception 'Informe o valor pago.'; end if;
  if round(p_valor, 2) > p.valor - p.pago then raise exception 'O valor (%) é maior que o saldo da parcela (%).', round(p_valor, 2), p.valor - p.pago; end if;
  if p_comprovante is not null and p_comprovante not like c.id::text || '/%' then raise exception 'Comprovante inválido.'; end if;
  insert into fin_pagamentos (conta_id, parcela_id, data, valor, forma, comprovante_caminho, observacao)
  values (c.id, p.id, p_data, round(p_valor, 2), p_forma, p_comprovante, coalesce(p_observacao, ''));
  perform fin_recalcular(c.id);
  insert into fin_eventos (conta_id, tipo, descricao, dados) values (c.id, 'pagamento',
    'Pagamento da parcela ' || p.numero || ' em ' || to_char(p_data, 'DD/MM/YYYY'), jsonb_build_object('valor', round(p_valor, 2), 'forma', p_forma));
end;
$$;

-- Estorno: ação crítica (financeiro.critica), com motivo.
create or replace function public.fin_estornar_pagamento(p_pagamento uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare g fin_pagamentos; c fin_contas_pagar; j jsonb;
begin
  if not tem_permissao('financeiro', 'critica') then raise exception 'Sem permissão para estornar pagamentos.'; end if;
  select * into g from fin_pagamentos where id = p_pagamento for update;
  if not found or g.estornado_em is not null then raise exception 'Pagamento não encontrado ou já estornado.'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'Informe o motivo do estorno.'; end if;
  select * into c from fin_contas_pagar where id = g.conta_id for update;
  update fin_pagamentos set estornado_em = now(), estornado_por = auth.uid(), estorno_motivo = trim(p_motivo) where id = g.id;
  if c.status = 'paga' then update fin_contas_pagar set status = 'aberta' where id = c.id; end if;
  perform fin_recalcular(c.id);
  insert into fin_eventos (conta_id, tipo, descricao, dados) values (c.id, 'estorno',
    'Pagamento de ' || to_char(g.data, 'DD/MM/YYYY') || ' estornado. Motivo: ' || trim(p_motivo), jsonb_build_object('valor', g.valor));
  -- OC cancelada em Compras enquanto havia pagamento: sem pagamento nenhum, a conta é cancelada agora.
  select to_jsonb(o) into j from compras_pedidos o where o.id = c.pedido_id;
  if j->>'status' = 'cancelada' and not exists (select 1 from fin_pagamentos where conta_id = c.id and estornado_em is null) then
    update fin_contas_pagar set status = 'cancelada', cancelado_motivo = coalesce(j->>'cancelado_motivo', '') where id = c.id;
    insert into fin_eventos (conta_id, tipo, descricao) values (c.id, 'cancelada', 'Conta cancelada: a ordem de compra foi cancelada em Compras e não há mais pagamento.');
  end if;
end;
$$;

create or replace function public.fin_anexar(p_conta uuid, p_tipo text, p_caminho text, p_nome text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('financeiro', 'editar') then raise exception 'Sem permissão para anexar.'; end if;
  if not exists (select 1 from fin_contas_pagar where id = p_conta) then raise exception 'Conta não encontrada.'; end if;
  if p_caminho not like p_conta::text || '/%' then raise exception 'Arquivo inválido.'; end if;
  insert into fin_anexos (conta_id, tipo, caminho, nome) values (p_conta, p_tipo, p_caminho, coalesce(nullif(trim(p_nome), ''), 'Arquivo'));
  insert into fin_eventos (conta_id, tipo, descricao) values (p_conta, 'anexo', 'Anexo: ' || coalesce(nullif(trim(p_nome), ''), 'Arquivo'));
end;
$$;

create or replace function public.fin_remover_anexo(p_anexo uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a fin_anexos;
begin
  if not tem_permissao('financeiro', 'editar') then raise exception 'Sem permissão para remover anexos.'; end if;
  select * into a from fin_anexos where id = p_anexo and removido_em is null for update;
  if not found then raise exception 'Anexo não encontrado.'; end if;
  if a.bucket <> 'financeiro' then raise exception 'O orçamento vem de Compras e não é removido por aqui.'; end if;
  update fin_anexos set removido_em = now(), removido_por = auth.uid() where id = a.id;
  insert into fin_eventos (conta_id, tipo, descricao) values (a.conta_id, 'anexo', 'Anexo removido: ' || a.nome);
end;
$$;

-- Para Compras mostrar na OC se já foi paga, sem ver valores nem dados bancários.
create or replace function public.compras_situacao_pagamento(p_pedido uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when c.status = 'cancelada' then 'cancelada' when c.status = 'paga' then 'paga'
    when exists (select 1 from fin_pagamentos g where g.conta_id = c.id and g.estornado_em is null) then 'paga_parcial'
    else 'a_pagar' end
  from fin_contas_pagar c where c.pedido_id = p_pedido and (tem_permissao('compras', 'ler') or tem_permissao('financeiro', 'ler'));
$$;

-- 6) Segurança --------------------------------------------------------------------------------------------------------
alter table public.fornecedores_pagamento enable row level security;
alter table public.fin_contas_pagar enable row level security;
alter table public.fin_parcelas enable row level security;
alter table public.fin_pagamentos enable row level security;
alter table public.fin_anexos enable row level security;
alter table public.fin_eventos enable row level security;

create policy fornecedores_pagamento_ler on public.fornecedores_pagamento for select to authenticated using (tem_permissao('financeiro', 'ler'));
create policy fornecedores_pagamento_criar on public.fornecedores_pagamento for insert to authenticated with check (tem_permissao('financeiro', 'editar'));
create policy fornecedores_pagamento_editar on public.fornecedores_pagamento for update to authenticated
  using (tem_permissao('financeiro', 'editar')) with check (tem_permissao('financeiro', 'editar'));
create policy fin_contas_ler on public.fin_contas_pagar for select to authenticated using (tem_permissao('financeiro', 'ler'));
create policy fin_parcelas_ler on public.fin_parcelas for select to authenticated using (tem_permissao('financeiro', 'ler'));
create policy fin_pagamentos_ler on public.fin_pagamentos for select to authenticated using (tem_permissao('financeiro', 'ler'));
create policy fin_anexos_ler on public.fin_anexos for select to authenticated using (tem_permissao('financeiro', 'ler'));
create policy fin_eventos_ler on public.fin_eventos for select to authenticated using (tem_permissao('financeiro', 'ler'));

grant select, insert, update on public.fornecedores_pagamento to authenticated;
grant select on public.fin_contas_pagar, public.fin_parcelas, public.fin_pagamentos, public.fin_anexos, public.fin_eventos to authenticated;

-- Arquivos do Financeiro (boletos, NF, comprovantes): pasta = id da conta.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('financeiro', 'financeiro', false, 20971520, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
create policy financeiro_ler on storage.objects for select to authenticated
  using (bucket_id = 'financeiro' and tem_permissao('financeiro', 'ler'));
create policy financeiro_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'financeiro' and tem_permissao('financeiro', 'editar')
    and exists (select 1 from public.fin_contas_pagar c where c.id::text = (storage.foldername(name))[1]));

do $$
declare t text; f text;
begin
  foreach t in array array['fornecedores_pagamento', 'fin_contas_pagar', 'fin_parcelas', 'fin_pagamentos', 'fin_anexos'] loop
    execute format('create trigger %I after insert or update on public.%I for each row execute function registrar_auditoria()', t || '_auditoria', t);
  end loop;
  foreach f in array array[
    'public.fin_definir_parcelas(uuid, jsonb)', 'public.fin_alterar_vencimento(uuid, date)',
    'public.fin_registrar_pagamento(uuid, date, numeric, text, text, text)', 'public.fin_estornar_pagamento(uuid, text)',
    'public.fin_anexar(uuid, text, text, text)', 'public.fin_remover_anexo(uuid)', 'public.compras_situacao_pagamento(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array['public.fin_gerar_parcelas(uuid)', 'public.fin_recalcular(uuid)', 'public.fin_pedido_criado()', 'public.fin_pedido_alterado()'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;
