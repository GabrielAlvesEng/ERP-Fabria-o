-- Almoxarifado, entrega 3 (decisão 107): recebimento das ordens de compra com conferência (aceito/rejeitado, em partes).
-- Quem marca "Recebido" é o Almoxarifado (resposta 3 do Gabriel ao Compras v2). O aceito vai para o estoque (pedido sem
-- projeto, produto do cadastro) ou fica reservado para o projeto até a entrega à Preparação/Fabricação; o resto fica só
-- registrado como entregue ao setor que pediu. A entrega na OC é gravada por compras_registrar_entrega (Compras v2).
-- As funções checam se o Compras v2 já está no banco (compras_pedido_itens) antes de usar as tabelas dele.
set lock_timeout = '10s';

create table public.alm_recebimentos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.compras_pedidos(id),
  pedido_codigo text not null,
  fornecedor_nome text not null default '',
  data date not null,
  observacao text not null default '',
  usuario_id uuid default auth.uid() references public.usuarios(id),
  criado_em timestamptz not null default now()
);
create index alm_recebimentos_pedido on public.alm_recebimentos (pedido_id);

create table public.alm_reservas (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid references public.projetos(id),
  projeto_codigo text not null default '',
  projeto_titulo text not null default '',
  descricao text not null,
  unidade text not null default 'un',
  quantidade numeric(14,3) not null check (quantidade > 0),
  bib_tipo text,
  bib_id uuid,
  pedido_codigo text not null default '',
  status text not null default 'reservado' check (status in ('reservado', 'entregue')),
  entregue_para text not null default '',
  entregue_em timestamptz,
  entregue_por uuid references public.usuarios(id),
  criado_em timestamptz not null default now()
);
create index alm_reservas_projeto on public.alm_reservas (projeto_id, status);

create table public.alm_recebimento_itens (
  id uuid primary key default gen_random_uuid(),
  recebimento_id uuid not null references public.alm_recebimentos(id),
  compra_item_id uuid not null references public.compras_requisicao_itens(id),
  descricao text not null,
  unidade text not null default 'un',
  aceita numeric(14,3) not null default 0 check (aceita >= 0),
  rejeitada numeric(14,3) not null default 0 check (rejeitada >= 0),
  motivo text not null default '',
  destino text not null check (destino in ('estoque', 'projeto', 'setor')),
  alm_item_id uuid references public.alm_itens(id),
  reserva_id uuid references public.alm_reservas(id),
  check (aceita + rejeitada > 0),
  check (rejeitada = 0 or length(trim(motivo)) >= 3)
);
create index alm_recebimento_itens_rec on public.alm_recebimento_itens (recebimento_id);

-- Compras v2 no banco?
create or replace function public.alm_recebimento_disponivel() returns boolean
language sql stable security definer set search_path = public as $$
  select to_regclass('public.compras_pedido_itens') is not null and to_regprocedure('public.compras_registrar_entrega(uuid,date,jsonb,text)') is not null;
$$;

-- OCs a receber, com os itens, o que falta e o destino de cada um.
create or replace function public.alm_ocs_a_receber() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not tem_permissao('almoxarifado', 'ler') then return '[]'; end if;
  if not alm_recebimento_disponivel() then return '[]'; end if;
  execute $q$
    select coalesce(jsonb_agg(o order by o->>'previsao' nulls last, o->>'codigo'), '[]') from (
      select jsonb_build_object(
        'id', p.id, 'codigo', p.codigo, 'status', p.status, 'previsao', p.previsao_entrega, 'emitido_em', p.emitido_em,
        'fornecedor', f.nome, 'requisicao_codigo', r.codigo, 'requisicao_titulo', r.titulo, 'origem', r.origem, 'setor', r.setor,
        'projeto_codigo', r.projeto_codigo, 'projeto_titulo', r.projeto_titulo,
        'itens', (select jsonb_agg(jsonb_build_object(
            'item_id', ri.id, 'descricao', ri.descricao, 'unidade', ri.unidade, 'grupo', ri.grupo,
            'quantidade', pi.quantidade, 'recebida', pi.quantidade_recebida, 'valor_unit', pi.valor_unit,
            'destino', case when r.projeto_id is not null then 'projeto' when ri.bib_id is not null then 'estoque' else 'setor' end)
            order by ri.ordem)
          from compras_pedido_itens pi join compras_requisicao_itens ri on ri.id = pi.item_id where pi.pedido_id = p.id)) o
      from compras_pedidos p
      join compras_requisicoes r on r.id = p.requisicao_id
      left join fornecedores f on f.id = p.fornecedor_id
      where p.status in ('aguardando_entrega', 'entregue_parcial')
    ) x(o)
  $q$ into v;
  return v;
end;
$$;

-- Conferência de uma entrega. p_itens = [{item_id (item da requisição), aceita, rejeitada, motivo}].
create or replace function public.alm_receber_oc(p_pedido uuid, p_data date, p_itens jsonb, p_observacao text default '') returns uuid
language plpgsql security definer set search_path = public as $$
declare o record; x jsonb; it record; v_rec uuid; v_ac numeric; v_rj numeric; v_dest text; v_alm uuid; v_res uuid;
  v_entrega jsonb := '[]'; v_mov alm_movimentos;
begin
  if not tem_permissao('almoxarifado', 'editar') then raise exception 'Só o Almoxarifado registra o recebimento.'; end if;
  if not alm_recebimento_disponivel() then raise exception 'O recebimento depende da nova versão de Compras, que ainda não está no banco.'; end if;
  if p_data is null then raise exception 'Informe a data da entrega.'; end if;
  if p_data > current_date then raise exception 'A data da entrega não pode ser futura.'; end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then raise exception 'Informe o que chegou.'; end if;
  select p.id, p.codigo, p.status, f.nome fornecedor into o from compras_pedidos p left join fornecedores f on f.id = p.fornecedor_id where p.id = p_pedido for update of p;
  if not found then raise exception 'Ordem de compra não encontrada.'; end if;
  if o.status not in ('aguardando_entrega', 'entregue_parcial') then raise exception 'Esta ordem de compra não está aguardando entrega.'; end if;

  insert into alm_recebimentos (pedido_id, pedido_codigo, fornecedor_nome, data, observacao)
  values (o.id, o.codigo, coalesce(o.fornecedor, ''), p_data, coalesce(trim(p_observacao), '')) returning id into v_rec;

  for x in select * from jsonb_array_elements(p_itens) loop
    v_ac := coalesce(nullif(x->>'aceita', '')::numeric, 0);
    v_rj := coalesce(nullif(x->>'rejeitada', '')::numeric, 0);
    if v_ac < 0 or v_rj < 0 then raise exception 'Quantidade inválida.'; end if;
    continue when v_ac + v_rj = 0;
    execute $q$
      select ri.id, ri.descricao, ri.unidade, ri.bib_tipo, ri.bib_id, pi.quantidade - pi.quantidade_recebida falta, pi.valor_unit,
        r.projeto_id, r.projeto_codigo, r.projeto_titulo
      from compras_pedido_itens pi join compras_requisicao_itens ri on ri.id = pi.item_id join compras_requisicoes r on r.id = ri.requisicao_id
      where pi.pedido_id = $1 and pi.item_id = $2
    $q$ into it using p_pedido, (x->>'item_id')::uuid;
    if it.id is null then raise exception 'Item não pertence a esta ordem de compra.'; end if;
    if v_ac + v_rj > it.falta then raise exception 'Em "%" faltam só % %.', it.descricao, trim_scale(it.falta), it.unidade; end if;
    v_dest := case when it.projeto_id is not null then 'projeto' when it.bib_id is not null then 'estoque' else 'setor' end;
    v_alm := null; v_res := null;
    if v_ac > 0 then
      v_entrega := v_entrega || jsonb_build_array(jsonb_build_object('item_id', it.id, 'quantidade', v_ac));
      if v_dest = 'estoque' then
        select id into v_alm from alm_itens where bib_tipo = it.bib_tipo and bib_id = it.bib_id;
        if v_alm is null then
          insert into alm_itens (bib_tipo, bib_id, unidade) values (it.bib_tipo, it.bib_id, coalesce(nullif(trim(it.unidade), ''), 'un')) returning id into v_alm;
        end if;
        v_mov := alm_movimentar(v_alm, 'entrada', v_ac, it.valor_unit, null, null, p_pedido, 'Recebimento ' || o.codigo);
      elsif v_dest = 'projeto' then
        insert into alm_reservas (projeto_id, projeto_codigo, projeto_titulo, descricao, unidade, quantidade, bib_tipo, bib_id, pedido_codigo)
        values (it.projeto_id, it.projeto_codigo, it.projeto_titulo, it.descricao, it.unidade, v_ac, it.bib_tipo, it.bib_id, o.codigo)
        returning id into v_res;
      end if;
    end if;
    insert into alm_recebimento_itens (recebimento_id, compra_item_id, descricao, unidade, aceita, rejeitada, motivo, destino, alm_item_id, reserva_id)
    values (v_rec, it.id, it.descricao, it.unidade, v_ac, v_rj, coalesce(trim(x->>'motivo'), ''), v_dest, v_alm, v_res);
  end loop;

  if not exists (select 1 from alm_recebimento_itens where recebimento_id = v_rec) then raise exception 'Informe a quantidade aceita ou rejeitada de pelo menos um item.'; end if;
  -- Só o aceito conta como entregue na OC; o rejeitado continua faltando (o fornecedor troca ou Compras resolve).
  if jsonb_array_length(v_entrega) > 0 then
    execute 'select public.compras_registrar_entrega($1, $2, $3, $4)' using p_pedido, p_data, v_entrega, 'Recebido pelo Almoxarifado' || coalesce(nullif(' · ' || trim(p_observacao), ' · '), '');
  end if;
  return v_rec;
end;
$$;

-- Entrega do material reservado ao projeto (para a Preparação/Fabricação).
create or replace function public.alm_entregar_reserva(p_reserva uuid, p_para text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('almoxarifado', 'editar') then raise exception 'Sem permissão para entregar reservas.'; end if;
  if length(trim(coalesce(p_para, ''))) < 2 then raise exception 'Informe para quem foi entregue.'; end if;
  update alm_reservas set status = 'entregue', entregue_para = trim(p_para), entregue_em = now(), entregue_por = auth.uid()
  where id = p_reserva and status = 'reservado';
  if not found then raise exception 'Reserva não encontrada ou já entregue.'; end if;
end;
$$;

alter table public.alm_recebimentos enable row level security;
alter table public.alm_recebimento_itens enable row level security;
alter table public.alm_reservas enable row level security;
create policy alm_recebimentos_ler on public.alm_recebimentos for select to authenticated using (tem_permissao('almoxarifado', 'ler'));
create policy alm_recebimento_itens_ler on public.alm_recebimento_itens for select to authenticated using (tem_permissao('almoxarifado', 'ler'));
create policy alm_reservas_ler on public.alm_reservas for select to authenticated using (tem_permissao('almoxarifado', 'ler'));
grant select on public.alm_recebimentos, public.alm_recebimento_itens, public.alm_reservas to authenticated;

do $$
declare t text; f text;
begin
  foreach t in array array['alm_recebimentos', 'alm_recebimento_itens', 'alm_reservas'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function registrar_auditoria()', t || '_auditoria', t);
  end loop;
  foreach f in array array['public.alm_recebimento_disponivel()', 'public.alm_ocs_a_receber()', 'public.alm_receber_oc(uuid, date, jsonb, text)',
    'public.alm_entregar_reserva(uuid, text)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
