-- Módulo Compras (docs/PLANEJAMENTO_COMPRAS.md, decisão 101, 22/10/2026): requisições, cotações, aprovação do
-- Financeiro (decisão 3), ordens de compra e acompanhamento da entrega. Status só mudam pelas funções do banco.
set lock_timeout = '10s';

-- 1) Permissões e perfis ------------------------------------------------------------------------------------------
insert into public.permissoes (modulo, acao) values ('compras', 'ler'), ('compras', 'criar'), ('compras', 'editar') on conflict do nothing;
insert into public.perfis (nome, descricao, acesso_total) values ('Compras', 'Requisições, cotações, ordens de compra e fornecedores', false) on conflict (nome) do nothing;
insert into public.perfil_permissoes (perfil_id, permissao_id)
select p.id, pm.id from public.perfis p join public.permissoes pm on
  (p.nome = 'Compras' and pm.modulo = 'compras')
  or (p.nome = 'Financeiro' and pm.modulo = 'compras' and pm.acao = 'ler')
on conflict do nothing;

-- 2) Fornecedores: dados que Compras e o pagamento usam -------------------------------------------------------------
alter table public.fornecedores
  add column cnpj text not null default '',
  add column categorias text not null default '',
  add column condicao_pagamento text not null default 'a_combinar' check (condicao_pagamento in ('antecipado', 'apos_recebimento', 'a_combinar'));
alter policy fornecedores_ler on public.fornecedores using (tem_permissao('custos', 'ler') or tem_permissao('compras', 'ler') or tem_permissao('admin', 'editar'));
alter policy fornecedores_criar on public.fornecedores with check (tem_permissao('admin', 'editar') or tem_permissao('compras', 'editar'));
alter policy fornecedores_editar on public.fornecedores using (tem_permissao('admin', 'editar') or tem_permissao('compras', 'editar')) with check (tem_permissao('admin', 'editar') or tem_permissao('compras', 'editar'));

-- 3) Tabelas -----------------------------------------------------------------------------------------------------
create table public.compras_contadores (
  tipo text not null check (tipo in ('RC', 'OC')),
  ano integer not null,
  ultimo_valor integer not null default 0,
  primary key (tipo, ano)
);

create table public.compras_requisicoes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  titulo text not null check (length(trim(titulo)) >= 2),
  projeto_id uuid references public.projetos(id),
  projeto_codigo text not null default '',   -- cópia para Compras não precisar ler a Engenharia
  projeto_titulo text not null default '',
  setor text not null default 'Engenharia',
  necessario_em date,
  prioridade text not null default 'normal' check (prioridade in ('normal', 'urgente')),
  status text not null default 'aberta' check (status in ('aberta', 'em_cotacao', 'aguardando_aprovacao', 'aprovada', 'pedido_emitido', 'entregue', 'cancelada')),
  cotacao_escolhida_id uuid,
  observacoes text not null default '',
  solicitante_id uuid default auth.uid() references public.usuarios(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index compras_requisicoes_status_idx on public.compras_requisicoes (status, criado_em desc);

create table public.compras_requisicao_itens (
  id uuid primary key default gen_random_uuid(),
  requisicao_id uuid not null references public.compras_requisicoes(id) on delete cascade,
  ordem integer not null default 0,
  grupo text not null default 'Outros' check (grupo in ('Chapas', 'Perfis', 'Comerciais', 'Fixadores', 'Consumíveis', 'Serviços', 'Outros')),
  descricao text not null check (length(trim(descricao)) >= 1),
  quantidade numeric(14,3) not null check (quantidade > 0),
  unidade text not null default 'un' check (length(trim(unidade)) >= 1),
  observacoes text not null default ''
);
create index compras_requisicao_itens_req_idx on public.compras_requisicao_itens (requisicao_id, ordem);

create table public.compras_cotacoes (
  id uuid primary key default gen_random_uuid(),
  requisicao_id uuid not null references public.compras_requisicoes(id) on delete cascade,
  fornecedor_id uuid not null references public.fornecedores(id),
  frete numeric(14,2) not null default 0 check (frete >= 0),
  prazo_dias integer check (prazo_dias >= 0),
  condicao_pagamento text not null default '',
  validade date,
  observacoes text not null default '',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (requisicao_id, fornecedor_id)
);
alter table public.compras_requisicoes add constraint compras_requisicoes_cotacao_fk foreign key (cotacao_escolhida_id) references public.compras_cotacoes(id);

create table public.compras_cotacao_precos (
  cotacao_id uuid not null references public.compras_cotacoes(id) on delete cascade,
  item_id uuid not null references public.compras_requisicao_itens(id) on delete cascade,
  valor_unit numeric(14,4) not null check (valor_unit >= 0),
  primary key (cotacao_id, item_id)
);

create table public.compras_pedidos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  requisicao_id uuid not null unique references public.compras_requisicoes(id),
  cotacao_id uuid not null references public.compras_cotacoes(id),
  fornecedor_id uuid not null references public.fornecedores(id),
  valor_itens numeric(14,2) not null,
  frete numeric(14,2) not null,
  valor_total numeric(14,2) not null,
  previsao_entrega date,
  status text not null default 'aguardando_entrega' check (status in ('aguardando_entrega', 'entregue_parcial', 'entregue')),
  entregue_em date,
  observacoes text not null default '',
  emitido_por uuid default auth.uid() references public.usuarios(id),
  emitido_em timestamptz not null default now()
);

create table public.compras_eventos (
  id uuid primary key default gen_random_uuid(),
  requisicao_id uuid not null references public.compras_requisicoes(id) on delete cascade,
  tipo text not null check (tipo in ('criada', 'status', 'cotacao', 'pedido', 'entrega')),
  de text,
  para text,
  justificativa text not null default '',
  dados jsonb not null default '{}',
  usuario_id uuid default auth.uid() references public.usuarios(id),
  criado_em timestamptz not null default now()
);
create index compras_eventos_req_idx on public.compras_eventos (requisicao_id, criado_em desc);

-- 4) Regras automáticas --------------------------------------------------------------------------------------------
create or replace function public.compras_proximo_codigo(p_tipo text) returns text
language plpgsql security definer set search_path = public as $$
declare v_ano integer := extract(year from ano_atual_data())::integer; v integer;
begin
  insert into compras_contadores (tipo, ano, ultimo_valor) values (p_tipo, v_ano, 1)
  on conflict (tipo, ano) do update set ultimo_valor = compras_contadores.ultimo_valor + 1
  returning ultimo_valor into v;
  return format('%s-%s-%s', p_tipo, lpad((v_ano % 100)::text, 2, '0'), lpad(v::text, 3, '0'));
end;
$$;

-- Código, projeto (cópia do código e título) e status na criação; depois o status só muda pelas funções.
create or replace function public.compras_requisicao_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare pj record;
begin
  if tg_op = 'INSERT' then
    new.codigo := compras_proximo_codigo('RC');
    new.status := 'aberta';
    new.cotacao_escolhida_id := null;
    new.solicitante_id := auth.uid();
  elsif coalesce(current_setting('erp.rpc', true), '') <> 'on' then
    if (new.status, new.cotacao_escolhida_id, new.codigo, new.solicitante_id) is distinct from (old.status, old.cotacao_escolhida_id, old.codigo, old.solicitante_id) then
      raise exception 'A etapa da requisição só muda pelos botões do fluxo.';
    end if;
    if old.status not in ('aberta', 'em_cotacao') then raise exception 'Requisição travada nesta etapa.'; end if;
  end if;
  if tg_op = 'INSERT' or new.projeto_id is distinct from old.projeto_id then
    select codigo, titulo into pj from projetos where id = new.projeto_id and excluido_em is null;
    if new.projeto_id is not null and pj is null then raise exception 'Projeto não encontrado.'; end if;
    new.projeto_codigo := coalesce(pj.codigo, '');
    new.projeto_titulo := coalesce(pj.titulo, '');
  end if;
  return new;
end;
$$;
create trigger compras_requisicoes_antes before insert or update on public.compras_requisicoes for each row execute function compras_requisicao_antes();
create trigger compras_requisicoes_atualizado before update on public.compras_requisicoes for each row execute function tocar_atualizado_em();
create trigger compras_cotacoes_atualizado before update on public.compras_cotacoes for each row execute function tocar_atualizado_em();

create or replace function public.compras_requisicao_criada() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into compras_eventos (requisicao_id, tipo, para) values (new.id, 'criada', new.status);
  return new;
end;
$$;
create trigger compras_requisicoes_criada after insert on public.compras_requisicoes for each row execute function compras_requisicao_criada();

-- Itens, cotações e preços só mudam enquanto a requisição está aberta ou em cotação.
create or replace function public.compras_requisicao_editavel(p_req uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from compras_requisicoes where id = p_req and status in ('aberta', 'em_cotacao'));
$$;
create or replace function public.compras_req_da_cotacao(p_cotacao uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select requisicao_id from compras_cotacoes where id = p_cotacao;
$$;

-- A primeira cotação leva a requisição para "Em cotação".
create or replace function public.compras_cotacao_criada() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  select status into v_status from compras_requisicoes where id = new.requisicao_id;
  insert into compras_eventos (requisicao_id, tipo, dados) values (new.requisicao_id, 'cotacao', jsonb_build_object('fornecedor', (select nome from fornecedores where id = new.fornecedor_id)));
  if v_status = 'aberta' then
    perform set_config('erp.rpc', 'on', true);
    update compras_requisicoes set status = 'em_cotacao' where id = new.requisicao_id;
    perform set_config('erp.rpc', 'off', true);
    insert into compras_eventos (requisicao_id, tipo, de, para) values (new.requisicao_id, 'status', 'aberta', 'em_cotacao');
  end if;
  return new;
end;
$$;
create trigger compras_cotacoes_criada after insert on public.compras_cotacoes for each row execute function compras_cotacao_criada();

-- 5) Fluxo -------------------------------------------------------------------------------------------------------
create or replace function public.compras_total_cotacao(p_cotacao uuid) returns table (itens numeric, frete numeric, total numeric, faltam integer)
language sql stable security definer set search_path = public as $$
  select coalesce(sum(round(i.quantidade * p.valor_unit, 2)), 0),
    c.frete,
    coalesce(sum(round(i.quantidade * p.valor_unit, 2)), 0) + c.frete,
    count(*) filter (where p.item_id is null)::integer
  from compras_cotacoes c
  join compras_requisicao_itens i on i.requisicao_id = c.requisicao_id
  left join compras_cotacao_precos p on p.cotacao_id = c.id and p.item_id = i.id
  where c.id = p_cotacao
  group by c.frete;
$$;

create or replace function public.compras_enviar_aprovacao(p_req uuid, p_cotacao uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v compras_requisicoes; t record;
begin
  if not tem_permissao('compras', 'editar') then raise exception 'Sem permissão para enviar compras para aprovação.'; end if;
  select * into v from compras_requisicoes where id = p_req for update;
  if not found then raise exception 'Requisição não encontrada.'; end if;
  if v.status <> 'em_cotacao' then raise exception 'Só uma requisição em cotação vai para aprovação.'; end if;
  if not exists (select 1 from compras_cotacoes where id = p_cotacao and requisicao_id = p_req) then raise exception 'Cotação não é desta requisição.'; end if;
  if not exists (select 1 from compras_requisicao_itens where requisicao_id = p_req) then raise exception 'A requisição não tem itens.'; end if;
  select * into t from compras_total_cotacao(p_cotacao);
  if t.faltam > 0 then raise exception 'A cotação escolhida está sem preço em % item(ns).', t.faltam; end if;
  perform set_config('erp.rpc', 'on', true);
  update compras_requisicoes set status = 'aguardando_aprovacao', cotacao_escolhida_id = p_cotacao where id = p_req;
  perform set_config('erp.rpc', 'off', true);
  insert into compras_eventos (requisicao_id, tipo, de, para, dados) values (p_req, 'status', v.status, 'aguardando_aprovacao',
    jsonb_build_object('fornecedor', (select f.nome from compras_cotacoes c join fornecedores f on f.id = c.fornecedor_id where c.id = p_cotacao), 'total', t.total));
end;
$$;

-- Decisão 3: quem aprova a compra é o Financeiro.
create or replace function public.compras_decidir(p_req uuid, p_aprovar boolean, p_justificativa text default '') returns void
language plpgsql security definer set search_path = public as $$
declare v compras_requisicoes; v_para text := case when p_aprovar then 'aprovada' else 'em_cotacao' end;
begin
  if not tem_permissao('financeiro', 'editar') then raise exception 'Somente o Financeiro aprova ou reprova compras.'; end if;
  select * into v from compras_requisicoes where id = p_req for update;
  if not found then raise exception 'Requisição não encontrada.'; end if;
  if v.status <> 'aguardando_aprovacao' then raise exception 'A requisição não está aguardando aprovação.'; end if;
  if not p_aprovar and length(trim(coalesce(p_justificativa, ''))) < 3 then raise exception 'Informe o motivo da reprovação.'; end if;
  perform set_config('erp.rpc', 'on', true);
  update compras_requisicoes set status = v_para, cotacao_escolhida_id = case when p_aprovar then cotacao_escolhida_id end where id = p_req;
  perform set_config('erp.rpc', 'off', true);
  insert into compras_eventos (requisicao_id, tipo, de, para, justificativa) values (p_req, 'status', v.status, v_para, coalesce(p_justificativa, ''));
end;
$$;

create or replace function public.compras_emitir_pedido(p_req uuid, p_previsao date, p_observacoes text default '') returns public.compras_pedidos
language plpgsql security definer set search_path = public as $$
declare v compras_requisicoes; t record; c compras_cotacoes; o compras_pedidos;
begin
  if not tem_permissao('compras', 'editar') then raise exception 'Sem permissão para emitir ordem de compra.'; end if;
  select * into v from compras_requisicoes where id = p_req for update;
  if not found then raise exception 'Requisição não encontrada.'; end if;
  if v.status <> 'aprovada' then raise exception 'Só uma compra aprovada pelo Financeiro vira ordem de compra.'; end if;
  select * into c from compras_cotacoes where id = v.cotacao_escolhida_id;
  select * into t from compras_total_cotacao(c.id);
  insert into compras_pedidos (codigo, requisicao_id, cotacao_id, fornecedor_id, valor_itens, frete, valor_total, previsao_entrega, observacoes)
  values (compras_proximo_codigo('OC'), p_req, c.id, c.fornecedor_id, t.itens, t.frete, t.total,
    coalesce(p_previsao, case when c.prazo_dias is not null then ano_atual_data() + c.prazo_dias end), coalesce(p_observacoes, ''))
  returning * into o;
  perform set_config('erp.rpc', 'on', true);
  update compras_requisicoes set status = 'pedido_emitido' where id = p_req;
  perform set_config('erp.rpc', 'off', true);
  insert into compras_eventos (requisicao_id, tipo, de, para, dados) values (p_req, 'pedido', v.status, 'pedido_emitido', jsonb_build_object('codigo', o.codigo, 'total', o.valor_total));
  return o;
end;
$$;

create or replace function public.compras_registrar_entrega(p_pedido uuid, p_total boolean, p_data date, p_observacao text default '') returns void
language plpgsql security definer set search_path = public as $$
declare o compras_pedidos; v_para text := case when p_total then 'entregue' else 'entregue_parcial' end;
begin
  if not tem_permissao('compras', 'editar') then raise exception 'Sem permissão para registrar entrega.'; end if;
  select * into o from compras_pedidos where id = p_pedido for update;
  if not found then raise exception 'Ordem de compra não encontrada.'; end if;
  if o.status = 'entregue' then raise exception 'Esta ordem de compra já foi entregue.'; end if;
  if p_data is null then raise exception 'Informe a data da entrega.'; end if;
  update compras_pedidos set status = v_para, entregue_em = case when p_total then p_data end where id = p_pedido;
  insert into compras_eventos (requisicao_id, tipo, de, para, justificativa, dados)
  values (o.requisicao_id, 'entrega', o.status, v_para, coalesce(p_observacao, ''), jsonb_build_object('data', p_data, 'codigo', o.codigo));
  if p_total then
    perform set_config('erp.rpc', 'on', true);
    update compras_requisicoes set status = 'entregue' where id = o.requisicao_id;
    perform set_config('erp.rpc', 'off', true);
  end if;
end;
$$;

create or replace function public.compras_cancelar(p_req uuid, p_justificativa text) returns void
language plpgsql security definer set search_path = public as $$
declare v compras_requisicoes;
begin
  if not tem_permissao('compras', 'editar') then raise exception 'Sem permissão para cancelar requisições.'; end if;
  if length(trim(coalesce(p_justificativa, ''))) < 3 then raise exception 'Informe o motivo do cancelamento.'; end if;
  select * into v from compras_requisicoes where id = p_req for update;
  if not found then raise exception 'Requisição não encontrada.'; end if;
  if v.status not in ('aberta', 'em_cotacao', 'aguardando_aprovacao', 'aprovada') then raise exception 'Depois da ordem de compra a requisição não é cancelada por aqui.'; end if;
  perform set_config('erp.rpc', 'on', true);
  update compras_requisicoes set status = 'cancelada' where id = p_req;
  perform set_config('erp.rpc', 'off', true);
  insert into compras_eventos (requisicao_id, tipo, de, para, justificativa) values (p_req, 'status', v.status, 'cancelada', p_justificativa);
end;
$$;

-- 6) Projetos e lista de materiais para Compras (sem abrir a Engenharia nem os valores de Vendas) ------------------
create or replace function public.compras_projetos() returns table (id uuid, codigo text, titulo text, cliente text, status text)
language sql stable security definer set search_path = public as $$
  select j.id, j.codigo, j.titulo, cliente_nome(j), j.status from projetos j
  where tem_permissao('compras', 'ler') and j.excluido_em is null and j.status <> 'cancelado'
  order by j.codigo desc;
$$;

-- Peças do projeto com a quantidade total (peça × conjuntos até a montagem geral) e o item da biblioteca, se houver.
create or replace function public.compras_pecas_projeto(p_projeto uuid)
returns table (descricao text, cod_op text[], cod_mat text, material text, espessura numeric, largura numeric, comprimento numeric,
  peso_unit numeric, bib_tipo text, bib_descricao text, bib_grupo text, bib_unidade text, qtd_total numeric)
language sql stable security definer set search_path = public as $$
  with recursive mult as (
    select c.id, c.quantidade::numeric m from projeto_conjuntos c where c.projeto_id = p_projeto and c.pai_id is null
    union all
    select c.id, mult.m * c.quantidade from projeto_conjuntos c join mult on c.pai_id = mult.id where c.projeto_id = p_projeto
  )
  select p.descricao, p.cod_op, p.cod_mat, coalesce(nullif(cm.nome, ''), p.material), p.espessura, p.largura, p.comprimento, p.peso_unit,
    p.bib_tipo,
    case p.bib_tipo when 'chapa' then bc.descricao when 'perfil' then bp.descricao when 'item' then bi.descricao end,
    case when p.bib_tipo = 'item' then bi.grupo end,
    case when p.bib_tipo = 'item' then bi.unidade end,
    p.quantidade * coalesce(mult.m, 1)
  from projeto_pecas p
  left join mult on mult.id = p.conjunto_id
  left join catalogo_materiais cm on cm.cod_mat = p.cod_mat
  left join bib_chapas bc on p.bib_tipo = 'chapa' and bc.id = p.bib_id
  left join bib_perfis bp on p.bib_tipo = 'perfil' and bp.id = p.bib_id
  left join bib_itens bi on p.bib_tipo = 'item' and bi.id = p.bib_id
  where tem_permissao('compras', 'criar') and p.projeto_id = p_projeto and p.excluido_em is null and p.removido_cad_em is null
    and exists (select 1 from projetos j where j.id = p_projeto and j.excluido_em is null)
    and (p.conjunto_id is null or exists (select 1 from projeto_conjuntos c where c.id = p.conjunto_id and c.excluido_em is null and c.removido_cad_em is null));
$$;

-- 7) Segurança ---------------------------------------------------------------------------------------------------
alter table public.compras_contadores enable row level security;
alter table public.compras_requisicoes enable row level security;
alter table public.compras_requisicao_itens enable row level security;
alter table public.compras_cotacoes enable row level security;
alter table public.compras_cotacao_precos enable row level security;
alter table public.compras_pedidos enable row level security;
alter table public.compras_eventos enable row level security;

create policy compras_requisicoes_ler on public.compras_requisicoes for select to authenticated using (tem_permissao('compras', 'ler'));
create policy compras_requisicoes_criar on public.compras_requisicoes for insert to authenticated with check (tem_permissao('compras', 'criar'));
create policy compras_requisicoes_editar on public.compras_requisicoes for update to authenticated
  using (tem_permissao('compras', 'editar') or (tem_permissao('compras', 'criar') and solicitante_id = auth.uid()))
  with check (tem_permissao('compras', 'editar') or (tem_permissao('compras', 'criar') and solicitante_id = auth.uid()));

create policy compras_itens_ler on public.compras_requisicao_itens for select to authenticated using (tem_permissao('compras', 'ler'));
create policy compras_itens_gravar on public.compras_requisicao_itens for all to authenticated
  using ((tem_permissao('compras', 'editar') or tem_permissao('compras', 'criar')) and compras_requisicao_editavel(requisicao_id))
  with check ((tem_permissao('compras', 'editar') or tem_permissao('compras', 'criar')) and compras_requisicao_editavel(requisicao_id));

create policy compras_cotacoes_ler on public.compras_cotacoes for select to authenticated using (tem_permissao('compras', 'ler'));
create policy compras_cotacoes_gravar on public.compras_cotacoes for all to authenticated
  using (tem_permissao('compras', 'editar') and compras_requisicao_editavel(requisicao_id))
  with check (tem_permissao('compras', 'editar') and compras_requisicao_editavel(requisicao_id));

create policy compras_precos_ler on public.compras_cotacao_precos for select to authenticated using (tem_permissao('compras', 'ler'));
create policy compras_precos_gravar on public.compras_cotacao_precos for all to authenticated
  using (tem_permissao('compras', 'editar') and compras_requisicao_editavel(compras_req_da_cotacao(cotacao_id)))
  with check (tem_permissao('compras', 'editar') and compras_requisicao_editavel(compras_req_da_cotacao(cotacao_id)));

create policy compras_pedidos_ler on public.compras_pedidos for select to authenticated using (tem_permissao('compras', 'ler'));
create policy compras_pedidos_editar on public.compras_pedidos for update to authenticated using (tem_permissao('compras', 'editar')) with check (tem_permissao('compras', 'editar'));
create policy compras_eventos_ler on public.compras_eventos for select to authenticated using (tem_permissao('compras', 'ler'));

grant select, insert, update on public.compras_requisicoes to authenticated;
grant select, insert, update, delete on public.compras_requisicao_itens, public.compras_cotacoes, public.compras_cotacao_precos to authenticated;
grant select on public.compras_eventos to authenticated;
grant select on public.compras_pedidos to authenticated;
grant update (previsao_entrega, observacoes) on public.compras_pedidos to authenticated;

do $$
declare t text; f text;
begin
  foreach t in array array['compras_requisicoes', 'compras_requisicao_itens', 'compras_cotacoes', 'compras_cotacao_precos', 'compras_pedidos'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function registrar_auditoria()', t || '_auditoria', t);
  end loop;
  foreach f in array array[
    'public.compras_proximo_codigo(text)', 'public.compras_requisicao_editavel(uuid)', 'public.compras_req_da_cotacao(uuid)',
    'public.compras_total_cotacao(uuid)', 'public.compras_enviar_aprovacao(uuid, uuid)', 'public.compras_decidir(uuid, boolean, text)',
    'public.compras_emitir_pedido(uuid, date, text)', 'public.compras_registrar_entrega(uuid, boolean, date, text)',
    'public.compras_cancelar(uuid, text)', 'public.compras_projetos()', 'public.compras_pecas_projeto(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
-- O código é gerado só pelo gatilho e pelas funções acima.
revoke execute on function public.compras_proximo_codigo(text) from authenticated;
