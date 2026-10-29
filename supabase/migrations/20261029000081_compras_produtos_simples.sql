-- Decisão 121: cadastro simplificado de produtos, histórico de preços e leitura do orçamento do fornecedor.
-- O produto passa a ser só: tipo, descrição (com o material entre parênteses), unidade, valor unitário, IPI (%),
-- fornecedor e data do último preço. Tudo em bib_itens, a tabela que Engenharia, Almoxarifado e Compras já usam
-- pelo par bib_tipo = 'item' + bib_id. Chapas e perfis com medidas (bib_chapas/bib_perfis) e as tabelas de apoio ficam
-- guardadas, sem uso no cadastro. Os produtos antigos são desativados (exclusão lógica), a pedido do Gabriel (29/10).

-- 1) Tipos novos e preço atual no próprio produto.
alter table public.bib_itens drop constraint bib_itens_grupo_check;
alter table public.bib_itens add constraint bib_itens_grupo_check
  check (grupo in ('Chapas', 'Perfis', 'Barras', 'Comerciais', 'Fixadores', 'Consumíveis'));
alter table public.bib_itens
  add column ipi numeric(5,2) not null default 0 check (ipi >= 0 and ipi <= 100),
  add column fornecedor_id uuid references public.fornecedores(id),
  add column preco_data date,
  add column preco_origem text check (preco_origem in ('estimado', 'cotado', 'comprado'));

-- "Barras" também vale nos itens das solicitações e nas listas da Engenharia (mesmos grupos de Compras).
alter table public.compras_requisicao_itens drop constraint compras_requisicao_itens_grupo_check;
alter table public.compras_requisicao_itens add constraint compras_requisicao_itens_grupo_check
  check (grupo in ('Chapas', 'Perfis', 'Barras', 'Comerciais', 'Fixadores', 'Consumíveis', 'Serviços', 'Outros'));
alter table public.eng_lista_itens drop constraint eng_lista_itens_grupo_check;
alter table public.eng_lista_itens add constraint eng_lista_itens_grupo_check
  check (grupo in ('Chapas', 'Perfis', 'Barras', 'Comerciais', 'Fixadores', 'Consumíveis', 'Serviços', 'Outros'));

-- 2) Limpeza pedida pelo Gabriel (29/10): todos os produtos antigos desativados, para começar do zero.
-- Nada é apagado: as 2 linhas de custo de proposta que usam um item antigo mantêm descrição e valor.
update public.bib_chapas set ativo = false where ativo;
update public.bib_perfis set ativo = false where ativo;
update public.bib_itens set ativo = false where ativo;

-- A descrição não repete entre os produtos ativos do mesmo tipo (os desativados não travam um cadastro novo).
alter table public.bib_itens drop constraint bib_itens_grupo_descricao_key;
create unique index bib_itens_descricao_ativa on public.bib_itens (grupo, lower(trim(descricao))) where ativo;

-- 3) Histórico de preços: estimado (internet), cotado (orçamento) e comprado (OC). Só se acrescenta; corrigir = lançar outro.
create table public.bib_item_precos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.bib_itens(id),
  origem text not null check (origem in ('estimado', 'cotado', 'comprado')),
  fornecedor_id uuid references public.fornecedores(id),
  valor_unit numeric(14,4) not null check (valor_unit >= 0),
  ipi numeric(5,2) not null default 0 check (ipi >= 0 and ipi <= 100),
  data date not null default current_date,
  documento text not null default '',           -- PDF do orçamento no espaço privado 'compras'
  cotacao_id uuid references public.compras_cotacoes(id),
  pedido_id uuid references public.compras_pedidos(id),
  observacoes text not null default '',
  criado_por uuid default auth.uid() references public.usuarios(id),
  criado_em timestamptz not null default now(),
  check (origem = 'estimado' or fornecedor_id is not null)
);
create index bib_item_precos_item on public.bib_item_precos (item_id, data desc, criado_em desc);
create unique index bib_item_precos_cotacao on public.bib_item_precos (cotacao_id, item_id) where cotacao_id is not null;
create unique index bib_item_precos_pedido on public.bib_item_precos (pedido_id, item_id) where pedido_id is not null;

alter table public.bib_item_precos enable row level security;
create policy bib_item_precos_ler on public.bib_item_precos for select to authenticated
  using (tem_permissao('compras', 'ler') or tem_permissao('custos', 'ler') or tem_permissao('engenharia', 'ler') or tem_permissao('almoxarifado', 'ler'));
-- A tela só lança estimado ou cotado manual; os ligados a cotação e OC vêm das funções abaixo.
create policy bib_item_precos_criar on public.bib_item_precos for insert to authenticated
  with check (tem_permissao('compras', 'editar') and origem in ('estimado', 'cotado') and cotacao_id is null and pedido_id is null);
grant select, insert on public.bib_item_precos to authenticated;
create trigger bib_item_precos_auditoria after insert or update or delete on public.bib_item_precos
  for each row execute function registrar_auditoria();

-- 4) O valor do produto é o do preço real (cotado ou comprado) mais recente; o estimado só vale enquanto não há preço real.
create or replace function public.bib_item_preco_atual(p_item uuid) returns void
language plpgsql security definer set search_path = public as $$
declare u bib_item_precos;
begin
  select * into u from bib_item_precos where item_id = p_item order by origem <> 'estimado' desc, data desc, criado_em desc limit 1;
  if not found then
    update bib_itens set preco_origem = null, fornecedor_id = null, preco_data = null where id = p_item and preco_origem is not null;
    return;
  end if;
  update bib_itens set valor = u.valor_unit, ipi = u.ipi, fornecedor_id = u.fornecedor_id, preco_data = u.data, preco_origem = u.origem
  where id = p_item;
end;
$$;
revoke execute on function public.bib_item_preco_atual(uuid) from public, anon, authenticated;

create or replace function public.bib_item_precos_depois() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op <> 'INSERT' then perform bib_item_preco_atual(old.item_id); end if;
  if tg_op <> 'DELETE' then perform bib_item_preco_atual(new.item_id); end if;
  return null;
end;
$$;
create trigger bib_item_precos_atual after insert or update or delete on public.bib_item_precos
  for each row execute function bib_item_precos_depois();

-- 5) Preço lançado numa cotação de item ligado a produto entra como "cotado"; tirar o preço tira a linha.
create or replace function public.compras_preco_para_produto() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_bib uuid; k compras_cotacoes;
begin
  if tg_op <> 'INSERT' then
    delete from bib_item_precos where cotacao_id = old.cotacao_id
      and item_id = (select bib_id from compras_requisicao_itens where id = old.item_id and bib_tipo = 'item');
  end if;
  if tg_op = 'DELETE' then return null; end if;
  select bib_id into v_bib from compras_requisicao_itens where id = new.item_id and bib_tipo = 'item';
  if v_bib is null or new.valor_unit <= 0 then return null; end if;
  select * into k from compras_cotacoes where id = new.cotacao_id;
  insert into bib_item_precos (item_id, origem, fornecedor_id, valor_unit, ipi, data, documento, cotacao_id)
  values (v_bib, 'cotado', k.fornecedor_id, new.valor_unit, new.ipi, (k.criado_em at time zone 'America/Sao_Paulo')::date, coalesce(k.orcamento_caminho, ''), k.id)
  on conflict (cotacao_id, item_id) where cotacao_id is not null
  do update set valor_unit = excluded.valor_unit, ipi = excluded.ipi, fornecedor_id = excluded.fornecedor_id, documento = excluded.documento;
  return null;
end;
$$;
create trigger compras_cotacao_precos_produto after insert or update or delete on public.compras_cotacao_precos
  for each row execute function compras_preco_para_produto();

-- 6) Item de OC ligado a produto entra como "comprado"; OC cancelada sai do histórico.
create or replace function public.compras_pedido_para_produto() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_bib uuid; o compras_pedidos;
begin
  select bib_id into v_bib from compras_requisicao_itens where id = new.item_id and bib_tipo = 'item';
  if v_bib is null then return null; end if;
  select * into o from compras_pedidos where id = new.pedido_id;
  insert into bib_item_precos (item_id, origem, fornecedor_id, valor_unit, ipi, data, documento, pedido_id)
  values (v_bib, 'comprado', o.fornecedor_id, new.valor_unit, new.ipi, (o.emitido_em at time zone 'America/Sao_Paulo')::date, coalesce(o.orcamento_caminho, ''), o.id)
  on conflict (pedido_id, item_id) where pedido_id is not null do nothing;
  return null;
end;
$$;
create trigger compras_pedido_itens_produto after insert on public.compras_pedido_itens
  for each row execute function compras_pedido_para_produto();

create or replace function public.compras_pedido_cancelado_produto() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cancelada' and old.status <> 'cancelada' then
    delete from bib_item_precos where pedido_id = new.id;
  end if;
  return null;
end;
$$;
create trigger compras_pedidos_cancelada_produto after update of status on public.compras_pedidos
  for each row execute function compras_pedido_cancelado_produto();

-- 7) Cadastrar ou editar produto. Preço mudou (valor, IPI, fornecedor ou data) = nova linha no histórico.
-- p_dados: grupo, descricao, unidade, valor, ipi, fornecedor_id (vazio = estimado), data.
create or replace function public.compras_salvar_produto(p_id uuid, p_dados jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := p_id; atual bib_itens;
  v_grupo text := p_dados->>'grupo';
  v_desc text := trim(coalesce(p_dados->>'descricao', ''));
  v_un text := coalesce(nullif(trim(p_dados->>'unidade'), ''), 'un');
  v_valor numeric := coalesce((p_dados->>'valor')::numeric, 0);
  v_ipi numeric := coalesce((p_dados->>'ipi')::numeric, 0);
  v_forn uuid := nullif(p_dados->>'fornecedor_id', '')::uuid;
  v_data date := coalesce(nullif(p_dados->>'data', '')::date, current_date);
begin
  if not tem_permissao('compras', 'editar') then raise exception 'Sem permissão para cadastrar produtos.'; end if;
  if length(v_desc) < 2 then raise exception 'Informe a descrição.'; end if;
  if exists (select 1 from bib_itens where ativo and grupo = v_grupo and lower(trim(descricao)) = lower(v_desc) and id is distinct from v_id) then
    raise exception 'Já existe um produto ativo com a descrição "%".', v_desc;
  end if;

  if v_id is null then
    insert into bib_itens (grupo, descricao, unidade, valor, ipi) values (v_grupo, v_desc, v_un, 0, 0) returning id into v_id;
  else
    select * into atual from bib_itens where id = v_id for update;
    if not found then raise exception 'Produto não encontrado.'; end if;
    -- Fixador antigo (tipo + material + medida) vira descrição livre ao ser editado.
    update bib_itens set grupo = v_grupo, descricao = v_desc, unidade = v_un,
      fixador_tipo_id = null, fixador_material_id = null, medida = '', comprimento = ''
    where id = v_id;
  end if;

  if v_valor = 0 and v_forn is null and (p_id is null or atual.preco_origem is null) then return v_id; end if;   -- sem preço
  if p_id is null or atual.valor is distinct from v_valor or atual.ipi is distinct from v_ipi
     or atual.fornecedor_id is distinct from v_forn or atual.preco_data is distinct from v_data then
    insert into bib_item_precos (item_id, origem, fornecedor_id, valor_unit, ipi, data)
    values (v_id, case when v_forn is null then 'estimado' else 'cotado' end, v_forn, v_valor, v_ipi, v_data);
  end if;
  return v_id;
end;
$$;
revoke execute on function public.compras_salvar_produto(uuid, jsonb) from public, anon;
grant execute on function public.compras_salvar_produto(uuid, jsonb) to authenticated;

-- 8) Gravar o rascunho do orçamento lido: cada linha atualiza o preço de um produto (ou cria o produto) como "cotado".
-- p_linhas: [{produto_id?, grupo, descricao, unidade, valor_unit, ipi}]
create or replace function public.compras_gravar_orcamento(p_fornecedor uuid, p_data date, p_documento text, p_linhas jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare l jsonb; v_id uuid; n integer := 0; v_desc text;
begin
  if not tem_permissao('compras', 'editar') then raise exception 'Sem permissão para gravar orçamentos.'; end if;
  if p_fornecedor is null then raise exception 'Escolha o fornecedor do orçamento.'; end if;
  for l in select * from jsonb_array_elements(coalesce(p_linhas, '[]'::jsonb)) loop
    v_id := nullif(l->>'produto_id', '')::uuid;
    v_desc := trim(coalesce(l->>'descricao', ''));
    if v_id is null then
      if length(v_desc) < 2 then raise exception 'Há uma linha sem descrição.'; end if;
      select id into v_id from bib_itens where ativo and grupo = l->>'grupo' and lower(trim(descricao)) = lower(v_desc);
      if v_id is null then
        insert into bib_itens (grupo, descricao, unidade) values (l->>'grupo', v_desc, coalesce(nullif(trim(l->>'unidade'), ''), 'un'))
        returning id into v_id;
      end if;
    elsif not exists (select 1 from bib_itens where id = v_id and ativo) then
      raise exception 'Um dos produtos escolhidos não está mais ativo.';
    end if;
    insert into bib_item_precos (item_id, origem, fornecedor_id, valor_unit, ipi, data, documento)
    values (v_id, 'cotado', p_fornecedor, coalesce((l->>'valor_unit')::numeric, 0), coalesce((l->>'ipi')::numeric, 0),
      coalesce(p_data, current_date), coalesce(p_documento, ''));
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'Nenhuma linha marcada para gravar.'; end if;
  return n;
end;
$$;
revoke execute on function public.compras_gravar_orcamento(uuid, date, text, jsonb) from public, anon;
grant execute on function public.compras_gravar_orcamento(uuid, date, text, jsonb) to authenticated;
