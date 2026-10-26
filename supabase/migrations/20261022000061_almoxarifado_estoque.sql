-- Almoxarifado, entrega 1 (docs/PLANEJAMENTO_ALMOXARIFADO.md, decisão 104): estoque sobre o cadastro único de produtos
-- (Biblioteca de Materiais: par bib_tipo + bib_id, combinado com Compras v2), retirada com funcionário e destino,
-- devolução, ajuste de inventário e estorno. O saldo só muda pelas funções do banco e nunca fica negativo.
set lock_timeout = '10s';

-- 1) Perfil -------------------------------------------------------------------------------------------------------
insert into public.perfis (nome, descricao, acesso_total) values ('Almoxarifado', 'Estoque, retiradas, recebimentos e pedidos de compra do estoque', false) on conflict (nome) do nothing;
insert into public.perfil_permissoes (perfil_id, permissao_id)
select p.id, pm.id from public.perfis p join public.permissoes pm on
  (p.nome = 'Almoxarifado' and pm.modulo = 'almoxarifado')
  or (p.nome = 'Compras' and pm.modulo = 'almoxarifado' and pm.acao = 'ler')
on conflict do nothing;

-- 2) Tabelas -------------------------------------------------------------------------------------------------------
create table public.alm_contadores (
  tipo text not null check (tipo in ('RT')),
  ano integer not null,
  ultimo_valor integer not null default 0,
  primary key (tipo, ano)
);

-- Produto do cadastro único que o Almoxarifado controla. Descrição e grupo vêm da Biblioteca (alm_estoque()).
create table public.alm_itens (
  id uuid primary key default gen_random_uuid(),
  bib_tipo text not null check (bib_tipo in ('chapa', 'perfil', 'item')),
  bib_id uuid not null,
  unidade text not null default 'un' check (length(trim(unidade)) >= 1),
  saldo numeric(14,3) not null default 0 check (saldo >= 0),
  minimo numeric(14,3) not null default 0 check (minimo >= 0),
  local text not null default '',
  custo_medio numeric(14,4) not null default 0 check (custo_medio >= 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (bib_tipo, bib_id)
);
create trigger alm_itens_atualizado before update on public.alm_itens for each row execute function tocar_atualizado_em();

create table public.alm_retiradas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  funcionario_id uuid not null references public.funcionarios(id),
  funcionario_nome text not null,                    -- cópia: o Almoxarifado não lê o RH
  destino_tipo text not null check (destino_tipo in ('projeto', 'setor')),
  projeto_id uuid references public.projetos(id),
  projeto_codigo text not null default '',
  projeto_titulo text not null default '',
  setor text not null default '',
  observacao text not null default '',
  registrado_por uuid default auth.uid() references public.usuarios(id),
  criado_em timestamptz not null default now(),
  constraint alm_retiradas_destino check ((destino_tipo = 'projeto') = (projeto_id is not null) and (destino_tipo = 'projeto' or length(trim(setor)) >= 2))
);

-- Livro de movimentos. quantidade é com sinal (entrada +, retirada −). Nunca é apagado.
create table public.alm_movimentos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.alm_itens(id),
  tipo text not null check (tipo in ('entrada', 'retirada', 'devolucao', 'ajuste', 'estorno')),
  quantidade numeric(14,3) not null check (quantidade <> 0),
  saldo_depois numeric(14,3) not null check (saldo_depois >= 0),
  custo_unit numeric(14,4) not null default 0,
  retirada_id uuid references public.alm_retiradas(id),
  origem_id uuid references public.alm_movimentos(id),  -- devolução e estorno apontam para o movimento original
  pedido_id uuid references public.compras_pedidos(id),
  justificativa text not null default '',
  usuario_id uuid default auth.uid() references public.usuarios(id),
  criado_em timestamptz not null default now()
);
create index alm_movimentos_item on public.alm_movimentos (item_id, criado_em desc);
create index alm_movimentos_retirada on public.alm_movimentos (retirada_id);
create index alm_movimentos_origem on public.alm_movimentos (origem_id);
create unique index alm_estorno_unico on public.alm_movimentos (origem_id) where tipo = 'estorno';

-- 3) Funções -------------------------------------------------------------------------------------------------------
create or replace function public.alm_proximo_codigo(p_tipo text) returns text
language plpgsql security definer set search_path = public as $$
declare v integer; v_ano integer := extract(year from ano_atual_data())::integer;
begin
  insert into alm_contadores (tipo, ano, ultimo_valor) values (p_tipo, v_ano, 1)
  on conflict (tipo, ano) do update set ultimo_valor = alm_contadores.ultimo_valor + 1
  returning ultimo_valor into v;
  return format('%s-%s-%s', p_tipo, lpad((v_ano % 100)::text, 2, '0'), lpad(v::text, 3, '0'));
end;
$$;

-- Lança um movimento e atualiza saldo e custo médio. Uso interno das funções abaixo.
create or replace function public.alm_movimentar(p_item uuid, p_tipo text, p_qtd numeric, p_custo numeric default null,
  p_retirada uuid default null, p_origem uuid default null, p_pedido uuid default null, p_justificativa text default '')
returns public.alm_movimentos
language plpgsql security definer set search_path = public as $$
declare i alm_itens; m alm_movimentos; v_saldo numeric; v_custo numeric;
begin
  select * into i from alm_itens where id = p_item for update;
  if not found then raise exception 'Item de estoque não encontrado.'; end if;
  v_saldo := i.saldo + p_qtd;
  if v_saldo < 0 then raise exception 'Saldo insuficiente de "%": tem % %, faltam %.', alm_descricao(i.bib_tipo, i.bib_id), i.saldo, i.unidade, -v_saldo; end if;
  v_custo := coalesce(p_custo, i.custo_medio);
  update alm_itens set saldo = v_saldo,
    custo_medio = case when p_tipo = 'entrada' and v_saldo > 0 then round((i.saldo * i.custo_medio + p_qtd * v_custo) / v_saldo, 4) else custo_medio end
  where id = p_item;
  insert into alm_movimentos (item_id, tipo, quantidade, saldo_depois, custo_unit, retirada_id, origem_id, pedido_id, justificativa)
  values (p_item, p_tipo, p_qtd, v_saldo, v_custo, p_retirada, p_origem, p_pedido, coalesce(p_justificativa, ''))
  returning * into m;
  return m;
end;
$$;

create or replace function public.alm_descricao(p_tipo text, p_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select case p_tipo
    when 'chapa' then (select descricao from bib_chapas where id = p_id)
    when 'perfil' then (select descricao from bib_perfis where id = p_id)
    when 'item' then (select descricao from bib_itens where id = p_id) end;
$$;

-- Produtos do cadastro único, para escolher o que entra no estoque.
create or replace function public.alm_produtos()
returns table (bib_tipo text, bib_id uuid, grupo text, descricao text, unidade text, no_estoque boolean)
language sql stable security definer set search_path = public as $$
  select x.bib_tipo, x.bib_id, x.grupo, x.descricao, x.unidade, exists (select 1 from alm_itens a where a.bib_tipo = x.bib_tipo and a.bib_id = x.bib_id)
  from (
    select 'item'::text bib_tipo, id bib_id, grupo, descricao, unidade from bib_itens where ativo
    union all select 'chapa', id, 'Chapas', descricao, 'un' from bib_chapas where ativo
    union all select 'perfil', id, 'Perfis', descricao, 'm' from bib_perfis where ativo
  ) x
  where tem_permissao('almoxarifado', 'ler')
  order by x.grupo, x.descricao;
$$;

-- A lista do estoque, com descrição e grupo vindos da Biblioteca.
create or replace function public.alm_estoque()
returns table (id uuid, bib_tipo text, bib_id uuid, grupo text, descricao text, unidade text, saldo numeric, minimo numeric,
  local text, custo_medio numeric, ativo boolean, ultimo_movimento timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id, a.bib_tipo, a.bib_id,
    case a.bib_tipo when 'chapa' then 'Chapas' when 'perfil' then 'Perfis' else bi.grupo end,
    coalesce(case a.bib_tipo when 'chapa' then bc.descricao when 'perfil' then bp.descricao else bi.descricao end, '(produto removido do cadastro)'),
    a.unidade, a.saldo, a.minimo, a.local, a.custo_medio, a.ativo,
    (select max(m.criado_em) from alm_movimentos m where m.item_id = a.id)
  from alm_itens a
  left join bib_chapas bc on a.bib_tipo = 'chapa' and bc.id = a.bib_id
  left join bib_perfis bp on a.bib_tipo = 'perfil' and bp.id = a.bib_id
  left join bib_itens bi on a.bib_tipo = 'item' and bi.id = a.bib_id
  where tem_permissao('almoxarifado', 'ler');
$$;

create or replace function public.alm_adicionar_item(p_bib_tipo text, p_bib_id uuid, p_unidade text, p_minimo numeric, p_local text,
  p_saldo_inicial numeric default 0) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not tem_permissao('almoxarifado', 'editar') then raise exception 'Sem permissão para incluir itens no estoque.'; end if;
  if alm_descricao(p_bib_tipo, p_bib_id) is null then raise exception 'Produto não encontrado no cadastro.'; end if;
  if exists (select 1 from alm_itens where bib_tipo = p_bib_tipo and bib_id = p_bib_id) then raise exception 'Este produto já está no estoque.'; end if;
  if coalesce(p_saldo_inicial, 0) < 0 then raise exception 'O saldo inicial não pode ser negativo.'; end if;
  insert into alm_itens (bib_tipo, bib_id, unidade, minimo, local)
  values (p_bib_tipo, p_bib_id, coalesce(nullif(trim(p_unidade), ''), 'un'), coalesce(p_minimo, 0), coalesce(trim(p_local), ''))
  returning id into v;
  if coalesce(p_saldo_inicial, 0) > 0 then perform alm_movimentar(v, 'ajuste', p_saldo_inicial, null, null, null, null, 'Estoque inicial'); end if;
  return v;
end;
$$;

-- Contagem física: grava a diferença como ajuste, com motivo.
create or replace function public.alm_ajustar(p_item uuid, p_saldo_contado numeric, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare v_saldo numeric;
begin
  if not tem_permissao('almoxarifado', 'editar') then raise exception 'Sem permissão para ajustar o estoque.'; end if;
  if p_saldo_contado is null or p_saldo_contado < 0 then raise exception 'Informe o saldo contado.'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Informe o motivo do ajuste.'; end if;
  select saldo into v_saldo from alm_itens where id = p_item for update;
  if not found then raise exception 'Item de estoque não encontrado.'; end if;
  if p_saldo_contado = v_saldo then raise exception 'O saldo contado é igual ao do sistema.'; end if;
  perform alm_movimentar(p_item, 'ajuste', p_saldo_contado - v_saldo, null, null, null, null, p_motivo);
end;
$$;

-- Retirada: vários itens para um funcionário, com destino (projeto ou setor). p_itens = [{item_id, quantidade}].
create or replace function public.alm_registrar_retirada(p_funcionario uuid, p_destino_tipo text, p_projeto uuid, p_setor text,
  p_observacao text, p_itens jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare f record; pj record; r alm_retiradas; x jsonb; v_qtd numeric;
begin
  if not tem_permissao('almoxarifado', 'criar') then raise exception 'Sem permissão para registrar retiradas.'; end if;
  select id, nome into f from funcionarios where id = p_funcionario and situacao <> 'desligado';
  if not found then raise exception 'Funcionário não encontrado ou desligado.'; end if;
  if p_destino_tipo = 'projeto' then
    select codigo, titulo into pj from projetos where id = p_projeto and excluido_em is null;
    if not found then raise exception 'Projeto não encontrado.'; end if;
  elsif p_destino_tipo = 'setor' then
    if length(trim(coalesce(p_setor, ''))) < 2 then raise exception 'Informe o setor ou o uso.'; end if;
  else raise exception 'Informe onde o material vai ser usado.';
  end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then raise exception 'Inclua pelo menos um item.'; end if;
  insert into alm_retiradas (codigo, funcionario_id, funcionario_nome, destino_tipo, projeto_id, projeto_codigo, projeto_titulo, setor, observacao)
  values (alm_proximo_codigo('RT'), f.id, f.nome, p_destino_tipo, case when p_destino_tipo = 'projeto' then p_projeto end,
    coalesce(pj.codigo, ''), coalesce(pj.titulo, ''), case when p_destino_tipo = 'setor' then trim(p_setor) else '' end, coalesce(trim(p_observacao), ''))
  returning * into r;
  for x in select * from jsonb_array_elements(p_itens) loop
    v_qtd := (x->>'quantidade')::numeric;
    if v_qtd is null or v_qtd <= 0 then raise exception 'Quantidade inválida.'; end if;
    perform alm_movimentar((x->>'item_id')::uuid, 'retirada', -v_qtd, null, r.id);
  end loop;
  return r.id;
end;
$$;

-- Quanto de uma retirada ainda pode voltar (retirado − devolvido válido).
create or replace function public.alm_pendente_devolucao(p_mov uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select -m.quantidade - coalesce((select sum(d.quantidade) from alm_movimentos d
    where d.origem_id = m.id and d.tipo = 'devolucao' and not exists (select 1 from alm_movimentos e where e.origem_id = d.id and e.tipo = 'estorno')), 0)
  from alm_movimentos m where m.id = p_mov and m.tipo = 'retirada';
$$;

create or replace function public.alm_devolver(p_mov uuid, p_quantidade numeric, p_observacao text default '') returns void
language plpgsql security definer set search_path = public as $$
declare m alm_movimentos;
begin
  if not tem_permissao('almoxarifado', 'criar') then raise exception 'Sem permissão para registrar devoluções.'; end if;
  select * into m from alm_movimentos where id = p_mov for update;
  if not found or m.tipo <> 'retirada' then raise exception 'Só uma retirada pode ser devolvida.'; end if;
  if exists (select 1 from alm_movimentos where origem_id = m.id and tipo = 'estorno') then raise exception 'Esta retirada foi estornada.'; end if;
  if p_quantidade is null or p_quantidade <= 0 then raise exception 'Informe a quantidade devolvida.'; end if;
  if p_quantidade > alm_pendente_devolucao(m.id) then raise exception 'Só % podem ser devolvidos desta retirada.', alm_pendente_devolucao(m.id); end if;
  perform alm_movimentar(m.item_id, 'devolucao', p_quantidade, m.custo_unit, m.retirada_id, m.id, null, coalesce(p_observacao, ''));
end;
$$;

-- Estorno desfaz um lançamento errado (retirada sem devolução, devolução ou ajuste), com motivo. Nada é apagado.
create or replace function public.alm_estornar(p_mov uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare m alm_movimentos;
begin
  if not tem_permissao('almoxarifado', 'editar') then raise exception 'Sem permissão para estornar.'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Informe o motivo do estorno.'; end if;
  select * into m from alm_movimentos where id = p_mov for update;
  if not found then raise exception 'Lançamento não encontrado.'; end if;
  if m.tipo not in ('retirada', 'devolucao', 'ajuste') then raise exception 'Este lançamento não é estornado por aqui.'; end if;
  if exists (select 1 from alm_movimentos where origem_id = m.id and tipo = 'estorno') then raise exception 'Este lançamento já foi estornado.'; end if;
  if m.tipo = 'retirada' and exists (select 1 from alm_movimentos d where d.origem_id = m.id and d.tipo = 'devolucao'
      and not exists (select 1 from alm_movimentos e where e.origem_id = d.id and e.tipo = 'estorno')) then
    raise exception 'Esta retirada tem devolução; estorne a devolução antes.';
  end if;
  perform alm_movimentar(m.item_id, 'estorno', -m.quantidade, m.custo_unit, m.retirada_id, m.id, null, p_motivo);
end;
$$;

-- O que o Almoxarifado precisa do RH, da Engenharia e dos setores, sem abrir esses módulos.
create or replace function public.alm_funcionarios() returns table (id uuid, nome text, funcao text, setor text)
language sql stable security definer set search_path = public as $$
  select f.id, f.nome, coalesce(fn.nome, ''), coalesce(s.nome, '') from funcionarios f
  left join funcoes fn on fn.id = f.funcao_id left join setores s on s.id = fn.setor_id
  where tem_permissao('almoxarifado', 'ler') and f.situacao <> 'desligado' order by f.nome;
$$;

create or replace function public.alm_projetos() returns table (id uuid, codigo text, titulo text, cliente text)
language sql stable security definer set search_path = public as $$
  select j.id, j.codigo, j.titulo, cliente_nome(j) from projetos j
  where tem_permissao('almoxarifado', 'ler') and j.excluido_em is null and j.status <> 'cancelado' order by j.codigo desc;
$$;

create or replace function public.alm_setores() returns table (nome text)
language sql stable security definer set search_path = public as $$
  select s.nome from setores s where tem_permissao('almoxarifado', 'ler') and s.ativo order by s.nome;
$$;

-- 4) Segurança -----------------------------------------------------------------------------------------------------
alter table public.alm_contadores enable row level security;
alter table public.alm_itens enable row level security;
alter table public.alm_retiradas enable row level security;
alter table public.alm_movimentos enable row level security;

create policy alm_itens_ler on public.alm_itens for select to authenticated using (tem_permissao('almoxarifado', 'ler'));
create policy alm_itens_editar on public.alm_itens for update to authenticated using (tem_permissao('almoxarifado', 'editar')) with check (tem_permissao('almoxarifado', 'editar'));
create policy alm_retiradas_ler on public.alm_retiradas for select to authenticated using (tem_permissao('almoxarifado', 'ler'));
create policy alm_movimentos_ler on public.alm_movimentos for select to authenticated using (tem_permissao('almoxarifado', 'ler'));

grant select on public.alm_itens, public.alm_retiradas, public.alm_movimentos to authenticated;
grant update (minimo, local, ativo) on public.alm_itens to authenticated;

do $$
declare t text; f text;
begin
  foreach t in array array['alm_itens', 'alm_retiradas', 'alm_movimentos'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function registrar_auditoria()', t || '_auditoria', t);
  end loop;
  foreach f in array array[
    'public.alm_proximo_codigo(text)', 'public.alm_movimentar(uuid, text, numeric, numeric, uuid, uuid, uuid, text)', 'public.alm_descricao(text, uuid)',
    'public.alm_produtos()', 'public.alm_estoque()', 'public.alm_adicionar_item(text, uuid, text, numeric, text, numeric)',
    'public.alm_ajustar(uuid, numeric, text)', 'public.alm_registrar_retirada(uuid, text, uuid, text, text, jsonb)',
    'public.alm_pendente_devolucao(uuid)', 'public.alm_devolver(uuid, numeric, text)', 'public.alm_estornar(uuid, text)',
    'public.alm_funcionarios()', 'public.alm_projetos()', 'public.alm_setores()'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
-- Saldo e código só pelas funções de cima.
revoke execute on function public.alm_proximo_codigo(text) from authenticated;
revoke execute on function public.alm_movimentar(uuid, text, numeric, numeric, uuid, uuid, uuid, text) from authenticated;
revoke execute on function public.alm_descricao(text, uuid) from authenticated;
