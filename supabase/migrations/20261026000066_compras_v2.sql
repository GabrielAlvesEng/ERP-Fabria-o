-- Numerada 66 (era 59) e com data 26/10: roda depois do Almoxarifado (61 a 64), do Financeiro (65) e da Engenharia (20261026000059), cujas funções de solicitação ajusta.
-- Compras v2 (decisão 103, 22/10/2026; /mnt/project-files/compras/PLANEJAMENTO_COMPRAS_V2.md aprovado pelo Gabriel):
-- solicitações da Engenharia, do Almoxarifado e de Compras; produtos = Biblioteca de Materiais com histórico de compras;
-- orçamento anexado; fornecedor escolhido por item e uma OC por fornecedor; sem aprovação antes da OC (a OC vai para o
-- Financeiro pagar; *altera* a decisão 3 na parte da aprovação); Kanban por item.
set lock_timeout = '10s';

-- 1) Biblioteca = cadastro de produtos: Compras edita; Compras e Almoxarifado leem. ---------------------------------
do $$
declare t text;
begin
  foreach t in array array['bib_tipos','bib_pesos_perfil','bib_chapa_precos','bib_chapas','bib_perfis','bib_itens','bib_fixador_tipos','bib_fixador_materiais','bib_fixador_tipo_materiais'] loop
    execute format('alter policy %I on public.%I using (tem_permissao(''custos'',''ler'') or tem_permissao(''engenharia'',''ler'') or tem_permissao(''compras'',''ler'') or tem_permissao(''almoxarifado'',''ler'') or tem_permissao(''admin'',''editar''))', t || '_ler', t);
    execute format('alter policy %I on public.%I with check (tem_permissao(''admin'',''editar'') or tem_permissao(''compras'',''editar''))', t || '_criar', t);
    execute format('alter policy %I on public.%I using (tem_permissao(''admin'',''editar'') or tem_permissao(''compras'',''editar'')) with check (tem_permissao(''admin'',''editar'') or tem_permissao(''compras'',''editar''))', t || '_editar', t);
  end loop;
end $$;

-- 2) Fluxo antigo (aprovação e uma OC por requisição) sai. As tabelas estavam vazias. ------------------------------
drop function if exists public.compras_enviar_aprovacao(uuid, uuid);
drop function if exists public.compras_decidir(uuid, boolean, text);
drop function if exists public.compras_emitir_pedido(uuid, date, text);
drop function if exists public.compras_registrar_entrega(uuid, boolean, date, text);
drop function if exists public.compras_cancelar(uuid, text);
drop function if exists public.compras_total_cotacao(uuid);

alter table public.compras_requisicoes drop constraint compras_requisicoes_cotacao_fk;
alter table public.compras_requisicoes drop column cotacao_escolhida_id;
alter table public.compras_requisicoes drop constraint compras_requisicoes_status_check;
alter table public.compras_requisicoes
  add column origem text not null default 'compras' check (origem in ('engenharia', 'almoxarifado', 'compras')),
  add constraint compras_requisicoes_status_check check (status in ('aberta', 'concluida', 'cancelada'));

alter table public.compras_requisicao_itens
  add column bib_tipo text check (bib_tipo in ('chapa', 'perfil', 'item')),
  add column bib_id uuid,
  add column status text not null default 'a_comprar' check (status in ('a_comprar', 'comprado', 'recebido', 'cancelado')),
  add column cotacao_escolhida_id uuid references public.compras_cotacoes(id) on delete set null,
  add constraint compras_itens_bib_check check ((bib_tipo is null) = (bib_id is null));

alter table public.compras_cotacoes
  add column condicao_tipo text not null default 'a_combinar' check (condicao_tipo in ('antecipado', 'apos_recebimento', 'parcelado', 'a_combinar')),
  add column condicao_dias integer[] not null default '{}',
  add column orcamento_caminho text;

alter table public.compras_pedidos drop constraint compras_pedidos_requisicao_id_key;
alter table public.compras_pedidos drop constraint compras_pedidos_status_check;
alter table public.compras_pedidos
  add column condicao_tipo text not null default 'a_combinar' check (condicao_tipo in ('antecipado', 'apos_recebimento', 'parcelado', 'a_combinar')),
  add column condicao_dias integer[] not null default '{}',
  add column condicao_texto text not null default '',
  add column orcamento_caminho text,
  add column cancelado_motivo text not null default '',
  add column cancelado_em timestamptz,
  add constraint compras_pedidos_status_check check (status in ('aguardando_entrega', 'entregue_parcial', 'entregue', 'cancelada'));
create index compras_pedidos_req_idx on public.compras_pedidos (requisicao_id);

create table public.compras_pedido_itens (
  pedido_id uuid not null references public.compras_pedidos(id),
  item_id uuid not null references public.compras_requisicao_itens(id),
  quantidade numeric(14,3) not null check (quantidade > 0),
  valor_unit numeric(14,4) not null check (valor_unit >= 0),
  quantidade_recebida numeric(14,3) not null default 0 check (quantidade_recebida >= 0),
  primary key (pedido_id, item_id)
);
create index compras_pedido_itens_item_idx on public.compras_pedido_itens (item_id);

alter table public.compras_eventos drop constraint compras_eventos_tipo_check;
alter table public.compras_eventos add constraint compras_eventos_tipo_check check (tipo in ('criada', 'status', 'cotacao', 'pedido', 'entrega', 'cancelamento'));

-- 3) Regras automáticas ---------------------------------------------------------------------------------------------
create or replace function public.compras_requisicao_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare pj record;
begin
  if tg_op = 'INSERT' then
    new.codigo := compras_proximo_codigo('RC');
    new.status := 'aberta';
    new.solicitante_id := auth.uid();
    if coalesce(current_setting('erp.rpc', true), '') <> 'on' then new.origem := 'compras'; end if;
  elsif coalesce(current_setting('erp.rpc', true), '') <> 'on' then
    if (new.status, new.codigo, new.solicitante_id, new.origem) is distinct from (old.status, old.codigo, old.solicitante_id, old.origem) then
      raise exception 'A situação da requisição só muda pelos botões do fluxo.';
    end if;
    if old.status <> 'aberta' then raise exception 'Requisição concluída ou cancelada não muda.'; end if;
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

-- Situação do item só muda pelas funções; a escolha do fornecedor e os dados, só enquanto está "à comprar".
create or replace function public.compras_item_antes() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('erp.rpc', true), '') = 'on' then return new; end if;
  if tg_op = 'INSERT' then new.status := 'a_comprar'; return new; end if;
  if new.status is distinct from old.status then raise exception 'A situação do item só muda pelo fluxo de Compras.'; end if;
  if old.status <> 'a_comprar' then raise exception 'Item já comprado não muda.'; end if;
  return new;
end;
$$;
create trigger compras_itens_antes before insert or update on public.compras_requisicao_itens for each row execute function compras_item_antes();

create or replace function public.compras_requisicao_aberta(p_req uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from compras_requisicoes where id = p_req and status = 'aberta');
$$;
create or replace function public.compras_item_a_comprar(p_item uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from compras_requisicao_itens where id = p_item and status = 'a_comprar');
$$;

-- A primeira cotação não muda mais a situação da requisição (o "em cotação" é do item: à comprar com preço).
create or replace function public.compras_cotacao_criada() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into compras_eventos (requisicao_id, tipo, dados) values (new.requisicao_id, 'cotacao', jsonb_build_object('fornecedor', (select nome from fornecedores where id = new.fornecedor_id)));
  return new;
end;
$$;

-- Requisição concluída quando todos os itens foram recebidos ou cancelados.
create or replace function public.compras_atualizar_requisicao(p_req uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  select status into v_status from compras_requisicoes where id = p_req;
  if v_status = 'cancelada' then return; end if;
  perform set_config('erp.rpc', 'on', true);
  if exists (select 1 from compras_requisicao_itens where requisicao_id = p_req)
     and not exists (select 1 from compras_requisicao_itens where requisicao_id = p_req and status in ('a_comprar', 'comprado')) then
    update compras_requisicoes set status = 'concluida' where id = p_req and status <> 'concluida';
  else
    update compras_requisicoes set status = 'aberta' where id = p_req and status <> 'aberta';
  end if;
  perform set_config('erp.rpc', 'off', true);
end;
$$;

-- 4) Fluxo -------------------------------------------------------------------------------------------------------
-- Solicitação de compra: Engenharia (lista do pedido), Almoxarifado (estoque) ou o próprio Compras.
create or replace function public.compras_solicitar(p_origem text, p_dados jsonb, p_itens jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; i jsonb; n integer := 0; v_projeto uuid := nullif(p_dados->>'projeto_id', '')::uuid;
begin
  if p_origem = 'engenharia' then
    if not tem_permissao('engenharia', 'editar') then raise exception 'Sem permissão para solicitar compra pela Engenharia.'; end if;
    if v_projeto is null then raise exception 'Informe o projeto.'; end if;
  elsif p_origem = 'almoxarifado' then
    if not (tem_permissao('almoxarifado', 'criar') or tem_permissao('almoxarifado', 'editar')) then raise exception 'Sem permissão para solicitar compra pelo Almoxarifado.'; end if;
    v_projeto := null;
  elsif p_origem = 'compras' then
    if not tem_permissao('compras', 'criar') then raise exception 'Sem permissão para criar requisição.'; end if;
  else raise exception 'Origem inválida.';
  end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    if p_origem <> 'compras' then raise exception 'A solicitação não tem itens.'; end if;
  end if;

  perform set_config('erp.rpc', 'on', true);
  insert into compras_requisicoes (titulo, projeto_id, setor, necessario_em, prioridade, observacoes, origem)
  values (
    coalesce(nullif(trim(p_dados->>'titulo'), ''), 'Solicitação de compra'), v_projeto,
    coalesce(nullif(p_dados->>'setor', ''), case p_origem when 'engenharia' then 'Engenharia' when 'almoxarifado' then 'Almoxarifado' else 'Compras' end),
    nullif(p_dados->>'necessario_em', '')::date, coalesce(nullif(p_dados->>'prioridade', ''), 'normal'), coalesce(p_dados->>'observacoes', ''), p_origem)
  returning id into v_id;
  for i in select * from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) loop
    insert into compras_requisicao_itens (requisicao_id, ordem, grupo, descricao, quantidade, unidade, observacoes, bib_tipo, bib_id)
    values (v_id, n, coalesce(nullif(i->>'grupo', ''), 'Outros'), i->>'descricao', (i->>'quantidade')::numeric, coalesce(nullif(i->>'unidade', ''), 'un'),
      coalesce(i->>'observacoes', ''), nullif(i->>'bib_tipo', ''), nullif(i->>'bib_id', '')::uuid);
    n := n + 1;
  end loop;
  perform set_config('erp.rpc', 'off', true);
  if p_origem <> 'compras' then
    insert into compras_eventos (requisicao_id, tipo, dados) values (v_id, 'status', jsonb_build_object('origem', p_origem, 'itens', n));
  end if;
  return v_id;
end;
$$;

-- Gera uma OC por fornecedor com os itens "à comprar" que têm fornecedor escolhido (decisão 103).
create or replace function public.compras_gerar_pedidos(p_req uuid, p_observacoes text default '') returns text[]
language plpgsql security definer set search_path = public as $$
declare v compras_requisicoes; c record; o compras_pedidos; codigos text[] := '{}'; v_itens numeric; sem_preco integer;
begin
  if not tem_permissao('compras', 'editar') then raise exception 'Sem permissão para gerar ordens de compra.'; end if;
  select * into v from compras_requisicoes where id = p_req for update;
  if not found then raise exception 'Requisição não encontrada.'; end if;
  if v.status <> 'aberta' then raise exception 'Requisição concluída ou cancelada.'; end if;

  select count(*) into sem_preco from compras_requisicao_itens i
  where i.requisicao_id = p_req and i.status = 'a_comprar' and i.cotacao_escolhida_id is not null
    and not exists (select 1 from compras_cotacao_precos p where p.cotacao_id = i.cotacao_escolhida_id and p.item_id = i.id);
  if sem_preco > 0 then raise exception '% item(ns) escolhido(s) sem preço no fornecedor.', sem_preco; end if;

  for c in
    select distinct k.* from compras_cotacoes k join compras_requisicao_itens i on i.cotacao_escolhida_id = k.id
    where i.requisicao_id = p_req and i.status = 'a_comprar'
  loop
    select coalesce(sum(round(i.quantidade * p.valor_unit, 2)), 0) into v_itens
    from compras_requisicao_itens i join compras_cotacao_precos p on p.cotacao_id = c.id and p.item_id = i.id
    where i.requisicao_id = p_req and i.status = 'a_comprar' and i.cotacao_escolhida_id = c.id;
    insert into compras_pedidos (codigo, requisicao_id, cotacao_id, fornecedor_id, valor_itens, frete, valor_total, previsao_entrega,
      condicao_tipo, condicao_dias, condicao_texto, orcamento_caminho, observacoes)
    values (compras_proximo_codigo('OC'), p_req, c.id, c.fornecedor_id, v_itens, c.frete, v_itens + c.frete,
      case when c.prazo_dias is not null then ano_atual_data() + c.prazo_dias end,
      c.condicao_tipo, c.condicao_dias, c.condicao_pagamento, c.orcamento_caminho, coalesce(p_observacoes, ''))
    returning * into o;
    insert into compras_pedido_itens (pedido_id, item_id, quantidade, valor_unit)
    select o.id, i.id, i.quantidade, p.valor_unit from compras_requisicao_itens i join compras_cotacao_precos p on p.cotacao_id = c.id and p.item_id = i.id
    where i.requisicao_id = p_req and i.status = 'a_comprar' and i.cotacao_escolhida_id = c.id;
    perform set_config('erp.rpc', 'on', true);
    update compras_requisicao_itens set status = 'comprado' where id in (select item_id from compras_pedido_itens where pedido_id = o.id);
    perform set_config('erp.rpc', 'off', true);
    insert into compras_eventos (requisicao_id, tipo, dados) values (p_req, 'pedido', jsonb_build_object('codigo', o.codigo, 'total', o.valor_total, 'fornecedor', (select nome from fornecedores where id = o.fornecedor_id)));
    codigos := codigos || o.codigo;
  end loop;
  if cardinality(codigos) = 0 then raise exception 'Escolha o fornecedor de pelo menos um item.'; end if;
  return codigos;
end;
$$;

-- Entrega (Compras ou o recebimento do Almoxarifado): p_itens = [{item_id, quantidade}] do que chegou; vazio = tudo o que falta.
create or replace function public.compras_registrar_entrega(p_pedido uuid, p_data date, p_itens jsonb default null, p_observacao text default '') returns void
language plpgsql security definer set search_path = public as $$
declare o compras_pedidos; i jsonb; v_status text;
begin
  if not (tem_permissao('compras', 'editar') or tem_permissao('almoxarifado', 'editar')) then raise exception 'Sem permissão para registrar entrega.'; end if;
  select * into o from compras_pedidos where id = p_pedido for update;
  if not found then raise exception 'Ordem de compra não encontrada.'; end if;
  if o.status in ('entregue', 'cancelada') then raise exception 'Esta ordem de compra já foi %.', case o.status when 'entregue' then 'entregue' else 'cancelada' end; end if;
  if p_data is null then raise exception 'Informe a data da entrega.'; end if;

  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    update compras_pedido_itens set quantidade_recebida = quantidade where pedido_id = p_pedido;
  else
    for i in select * from jsonb_array_elements(p_itens) loop
      if (i->>'quantidade')::numeric < 0 then raise exception 'Quantidade inválida.'; end if;
      update compras_pedido_itens set quantidade_recebida = quantidade_recebida + (i->>'quantidade')::numeric
      where pedido_id = p_pedido and item_id = (i->>'item_id')::uuid;
      if not found then raise exception 'Item não pertence a esta ordem de compra.'; end if;
    end loop;
  end if;

  perform set_config('erp.rpc', 'on', true);
  update compras_requisicao_itens r set status = 'recebido'
  from compras_pedido_itens pi where pi.pedido_id = p_pedido and pi.item_id = r.id and pi.quantidade_recebida >= pi.quantidade and r.status = 'comprado';
  perform set_config('erp.rpc', 'off', true);

  v_status := case when not exists (select 1 from compras_pedido_itens where pedido_id = p_pedido and quantidade_recebida < quantidade) then 'entregue' else 'entregue_parcial' end;
  update compras_pedidos set status = v_status, entregue_em = case when v_status = 'entregue' then p_data else entregue_em end where id = p_pedido;
  insert into compras_eventos (requisicao_id, tipo, de, para, justificativa, dados)
  values (o.requisicao_id, 'entrega', o.status, v_status, coalesce(p_observacao, ''), jsonb_build_object('data', p_data, 'codigo', o.codigo));
  perform compras_atualizar_requisicao(o.requisicao_id);
end;
$$;

-- Cancelar uma OC (antes de qualquer entrega): os itens voltam para "à comprar".
create or replace function public.compras_cancelar_pedido(p_pedido uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare o compras_pedidos;
begin
  if not tem_permissao('compras', 'editar') then raise exception 'Sem permissão para cancelar ordem de compra.'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Informe o motivo do cancelamento.'; end if;
  select * into o from compras_pedidos where id = p_pedido for update;
  if not found then raise exception 'Ordem de compra não encontrada.'; end if;
  if o.status <> 'aguardando_entrega' then raise exception 'Só uma ordem sem entrega pode ser cancelada.'; end if;
  update compras_pedidos set status = 'cancelada', cancelado_motivo = trim(p_motivo), cancelado_em = now() where id = p_pedido;
  perform set_config('erp.rpc', 'on', true);
  update compras_requisicao_itens set status = 'a_comprar' where id in (select item_id from compras_pedido_itens where pedido_id = p_pedido) and status = 'comprado';
  perform set_config('erp.rpc', 'off', true);
  insert into compras_eventos (requisicao_id, tipo, de, para, justificativa, dados) values (o.requisicao_id, 'cancelamento', o.status, 'cancelada', trim(p_motivo), jsonb_build_object('codigo', o.codigo));
  perform compras_atualizar_requisicao(o.requisicao_id);
end;
$$;

-- Cancelar a requisição: só sem ordem de compra ativa; os itens à comprar viram cancelados.
create or replace function public.compras_cancelar(p_req uuid, p_justificativa text) returns void
language plpgsql security definer set search_path = public as $$
declare v compras_requisicoes;
begin
  if not tem_permissao('compras', 'editar') then raise exception 'Sem permissão para cancelar requisições.'; end if;
  if length(trim(coalesce(p_justificativa, ''))) < 3 then raise exception 'Informe o motivo do cancelamento.'; end if;
  select * into v from compras_requisicoes where id = p_req for update;
  if not found then raise exception 'Requisição não encontrada.'; end if;
  if v.status <> 'aberta' then raise exception 'Requisição já concluída ou cancelada.'; end if;
  if exists (select 1 from compras_pedidos where requisicao_id = p_req and status <> 'cancelada') then raise exception 'Cancele antes as ordens de compra desta requisição.'; end if;
  perform set_config('erp.rpc', 'on', true);
  update compras_requisicao_itens set status = 'cancelado' where requisicao_id = p_req and status = 'a_comprar';
  update compras_requisicoes set status = 'cancelada' where id = p_req;
  perform set_config('erp.rpc', 'off', true);
  insert into compras_eventos (requisicao_id, tipo, de, para, justificativa) values (p_req, 'status', 'aberta', 'cancelada', trim(p_justificativa));
end;
$$;

-- 5) Engenharia: lista do projeto (com o produto de cada peça) e o envio da Engenharia -------------------------------
drop function if exists public.compras_pecas_projeto(uuid);
create or replace function public.compras_pecas_projeto_v2(p_projeto uuid)
returns table (descricao text, cod_op text[], cod_mat text, material text, espessura numeric, largura numeric, comprimento numeric,
  peso_unit numeric, bib_tipo text, bib_id uuid, bib_descricao text, bib_grupo text, bib_unidade text, qtd_total numeric)
language sql stable security definer set search_path = public as $$
  with recursive mult as (
    select c.id, c.quantidade::numeric m from projeto_conjuntos c where c.projeto_id = p_projeto and c.pai_id is null
    union all
    select c.id, mult.m * c.quantidade from projeto_conjuntos c join mult on c.pai_id = mult.id where c.projeto_id = p_projeto
  )
  select p.descricao, p.cod_op, p.cod_mat, coalesce(nullif(cm.nome, ''), p.material), p.espessura, p.largura, p.comprimento, p.peso_unit,
    p.bib_tipo, p.bib_id,
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
    and exists (select 1 from projeto_conjuntos c where c.id = p.conjunto_id and c.excluido_em is null and c.removido_cad_em is null);
$$;

-- "Solicitar compra" da Engenharia (migration 20261026000059, mesma decisão 103) no fluxo v2: a requisição sai com
-- origem 'engenharia' e o produto de cada item; só é substituída a revisão aberta sem nenhum item comprado.
create or replace function public.engenharia_solicitar_compra(p_projeto uuid, p_itens jsonb, p_necessario_em date default null,
  p_prioridade text default 'normal', p_observacoes text default '')
returns table (id uuid, codigo text, revisao integer, substituidas text[])
language plpgsql security definer set search_path = public as $$
declare pj projetos; rev integer; nova compras_requisicoes; antigas text[] := '{}'; r record; n integer := 0; it jsonb;
begin
  if not tem_permissao('engenharia', 'editar') then raise exception 'Sem permissão para solicitar compras do projeto.'; end if;
  select * into pj from projetos where projetos.id = p_projeto and excluido_em is null for update;
  if not found then raise exception 'Projeto não encontrado.'; end if;
  if pj.status = 'cancelado' then raise exception 'Projeto cancelado.'; end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then raise exception 'Nada a solicitar: a lista está vazia ou já foi toda solicitada.'; end if;
  if p_prioridade not in ('normal', 'urgente') then raise exception 'Prioridade inválida.'; end if;

  select coalesce(max(engenharia_revisao), -1) + 1 into rev from compras_requisicoes where projeto_id = pj.id and engenharia_revisao is not null;

  perform set_config('erp.rpc', 'on', true);
  insert into compras_requisicoes (titulo, projeto_id, setor, necessario_em, prioridade, observacoes, engenharia_revisao, origem)
  values (format('Lista de materiais %s · R%s', pj.codigo, rev), pj.id, 'Engenharia', p_necessario_em, p_prioridade,
    trim(coalesce(p_observacoes, '')), rev, 'engenharia')
  returning * into nova;

  for it in select * from jsonb_array_elements(p_itens) loop
    n := n + 1;
    insert into compras_requisicao_itens (requisicao_id, ordem, grupo, descricao, quantidade, unidade, observacoes, bib_tipo, bib_id)
    values (nova.id, n, coalesce(nullif(it->>'grupo', ''), 'Outros'), it->>'descricao', (it->>'quantidade')::numeric,
      coalesce(nullif(it->>'unidade', ''), 'un'), coalesce(it->>'observacoes', ''),
      case when nullif(it->>'bib_id', '') is not null then nullif(it->>'bib_tipo', '') end, nullif(it->>'bib_id', '')::uuid);
  end loop;

  for r in select q.id, q.codigo, q.status from compras_requisicoes q
    where q.projeto_id = pj.id and q.engenharia_revisao is not null and q.id <> nova.id and q.status = 'aberta'
      and not exists (select 1 from compras_requisicao_itens i where i.requisicao_id = q.id and i.status in ('comprado', 'recebido'))
    for update
  loop
    update compras_requisicao_itens set status = 'cancelado' where requisicao_id = r.id and status = 'a_comprar';
    update compras_requisicoes set status = 'cancelada' where compras_requisicoes.id = r.id;
    insert into compras_eventos (requisicao_id, tipo, de, para, justificativa)
    values (r.id, 'status', r.status, 'cancelada', format('Substituída pela revisão R%s da lista da Engenharia (%s)', rev, nova.codigo));
    antigas := antigas || r.codigo;
  end loop;
  perform set_config('erp.rpc', 'off', true);
  insert into compras_eventos (requisicao_id, tipo, dados) values (nova.id, 'status', jsonb_build_object('origem', 'engenharia', 'itens', n));

  insert into projeto_eventos (projeto_id, tipo, para, justificativa, dados)
  values (pj.id, 'compra', nova.codigo, format('Lista R%s enviada para Compras', rev),
    jsonb_build_object('requisicao_id', nova.id, 'revisao', rev, 'itens', n, 'substituidas', to_jsonb(antigas)));
  return query select nova.id, nova.codigo, rev, antigas;
end;
$$;

-- Situação para a Engenharia: aberta (ainda substituível), em_compra (aberta com item comprado), concluida ou cancelada.
create or replace function public.engenharia_solicitacoes(p_projeto uuid)
returns table (id uuid, codigo text, revisao integer, status text, necessario_em date, prioridade text, criado_em timestamptz, solicitante text, itens jsonb)
language sql stable security definer set search_path = public as $$
  select q.id, q.codigo, q.engenharia_revisao,
    case when q.status = 'aberta' and exists (select 1 from compras_requisicao_itens i where i.requisicao_id = q.id and i.status in ('comprado', 'recebido'))
      then 'em_compra' else q.status end,
    q.necessario_em, q.prioridade, q.criado_em, u.nome,
    coalesce((select jsonb_agg(jsonb_build_object('grupo', i.grupo, 'descricao', i.descricao, 'quantidade', i.quantidade, 'unidade', i.unidade) order by i.ordem)
      from compras_requisicao_itens i where i.requisicao_id = q.id and i.status <> 'cancelado'), '[]'::jsonb)
  from compras_requisicoes q left join usuarios u on u.id = q.solicitante_id
  where tem_permissao('engenharia', 'ler') and q.projeto_id = p_projeto and q.engenharia_revisao is not null
  order by q.engenharia_revisao desc;
$$;

-- 6) Histórico de compras por produto (ficha do produto e "última compra") ----------------------------------------
create view public.compras_historico with (security_invoker = true) as
select pi.pedido_id, pi.item_id, i.bib_tipo, i.bib_id, i.grupo, i.descricao, i.unidade, pi.quantidade, pi.valor_unit,
  pi.quantidade_recebida, o.codigo as pedido_codigo, o.emitido_em, o.status as pedido_status, o.fornecedor_id, f.nome as fornecedor_nome,
  r.codigo as requisicao_codigo, r.projeto_codigo, r.origem
from compras_pedido_itens pi
join compras_pedidos o on o.id = pi.pedido_id
join compras_requisicao_itens i on i.id = pi.item_id
join compras_requisicoes r on r.id = i.requisicao_id
join fornecedores f on f.id = o.fornecedor_id
where o.status <> 'cancelada';

-- 7) Orçamento anexado: espaço privado "compras" ({cotação}/{arquivo}); Compras grava, Compras e Financeiro leem. ----
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('compras', 'compras', false, 15728640, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy compras_arquivos_ler on storage.objects for select to authenticated
  using (bucket_id = 'compras' and (public.tem_permissao('compras', 'ler') or public.tem_permissao('financeiro', 'ler')));
create policy compras_arquivos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'compras' and public.tem_permissao('compras', 'editar'));
create policy compras_arquivos_trocar on storage.objects for update to authenticated
  using (bucket_id = 'compras' and public.tem_permissao('compras', 'editar')) with check (bucket_id = 'compras' and public.tem_permissao('compras', 'editar'));

-- 8) Segurança ---------------------------------------------------------------------------------------------------
drop policy compras_itens_gravar on public.compras_requisicao_itens;
create policy compras_itens_gravar on public.compras_requisicao_itens for all to authenticated
  using ((tem_permissao('compras', 'editar') or tem_permissao('compras', 'criar')) and compras_requisicao_aberta(requisicao_id) and status = 'a_comprar')
  with check ((tem_permissao('compras', 'editar') or tem_permissao('compras', 'criar')) and compras_requisicao_aberta(requisicao_id));
drop policy compras_cotacoes_gravar on public.compras_cotacoes;
create policy compras_cotacoes_gravar on public.compras_cotacoes for all to authenticated
  using (tem_permissao('compras', 'editar') and compras_requisicao_aberta(requisicao_id))
  with check (tem_permissao('compras', 'editar') and compras_requisicao_aberta(requisicao_id));
drop policy compras_precos_gravar on public.compras_cotacao_precos;
create policy compras_precos_gravar on public.compras_cotacao_precos for all to authenticated
  using (tem_permissao('compras', 'editar') and compras_item_a_comprar(item_id))
  with check (tem_permissao('compras', 'editar') and compras_item_a_comprar(item_id));
alter policy compras_pedidos_ler on public.compras_pedidos using (tem_permissao('compras', 'ler') or tem_permissao('financeiro', 'ler'));

alter table public.compras_pedido_itens enable row level security;
create policy compras_pedido_itens_ler on public.compras_pedido_itens for select to authenticated using (tem_permissao('compras', 'ler') or tem_permissao('financeiro', 'ler'));
grant select on public.compras_pedido_itens, public.compras_historico to authenticated;
create trigger compras_pedido_itens_auditoria after insert or update or delete on public.compras_pedido_itens for each row execute function registrar_auditoria();

drop function if exists public.compras_requisicao_editavel(uuid);
drop function if exists public.compras_req_da_cotacao(uuid);

do $$
declare f text;
begin
  foreach f in array array[
    'public.compras_requisicao_aberta(uuid)', 'public.compras_item_a_comprar(uuid)', 'public.compras_atualizar_requisicao(uuid)',
    'public.compras_solicitar(text, jsonb, jsonb)', 'public.compras_gerar_pedidos(uuid, text)',
    'public.compras_registrar_entrega(uuid, date, jsonb, text)', 'public.compras_cancelar_pedido(uuid, text)', 'public.compras_cancelar(uuid, text)',
    'public.compras_pecas_projeto_v2(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.compras_atualizar_requisicao(uuid) from authenticated;
