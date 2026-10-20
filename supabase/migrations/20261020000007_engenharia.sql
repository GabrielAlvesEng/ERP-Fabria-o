-- Engenharia (decisão 33): projetos com o mesmo código da proposta (decisão 11),
-- árvore de montagens com códigos 26-01-001-00-00-000 / 0A-00-000 / 0A-01-000 (decisão 16) e peças por conjunto.

insert into public.permissoes (modulo, acao) values ('engenharia','ler'), ('engenharia','criar'), ('engenharia','editar') on conflict do nothing;
insert into public.perfis (nome, descricao) values ('Engenharia', 'Projetos, árvore de montagens, peças e lista de materiais') on conflict (nome) do nothing;
insert into public.perfil_permissoes (perfil_id, permissao_id)
select p.id, pm.id from public.perfis p join public.permissoes pm on
  (p.nome = 'Engenharia' and (pm.modulo = 'engenharia' or (pm.modulo = 'vendas' and pm.acao = 'ler')))
  or (p.nome = 'Comercial' and pm.modulo = 'engenharia' and pm.acao = 'ler')
on conflict do nothing;

create table public.projetos (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null unique references public.propostas(id),
  codigo text not null unique,
  titulo text not null,
  empresa_id uuid not null references public.empresas(id),
  status text not null default 'em_andamento' check (status in ('em_andamento','pausado','concluido','cancelado')),
  responsavel_id uuid references public.usuarios(id),
  prazo date,
  observacoes text not null default '',
  criado_por uuid default auth.uid() references public.usuarios(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.projeto_conjuntos (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos(id),
  pai_id uuid references public.projeto_conjuntos(id),
  tipo text not null check (tipo in ('geral','submontagem','conjunto')),
  sub text not null,           -- 00, 0A, 0B ...
  conj integer not null,       -- 0 para geral e submontagem; 1, 2, 3 ... para conjunto
  codigo text not null,
  nome text not null check (length(trim(nome)) >= 1),
  descricao text not null default '',
  quantidade numeric(12,3) not null default 1 check (quantidade > 0),
  status text not null default 'modelando' check (status in ('modelando','detalhando','revisao','liberado')),
  revisao text not null default 'R0',
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz,
  unique (projeto_id, codigo)
);
create index projeto_conjuntos_proj_idx on public.projeto_conjuntos (projeto_id, pai_id);

create table public.projeto_pecas (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos(id),
  conjunto_id uuid not null references public.projeto_conjuntos(id),
  seq integer not null,
  codigo text not null,
  descricao text not null default '',
  quantidade numeric(12,3) not null default 1 check (quantidade > 0),
  cod_op text[] not null default '{}' check (cod_op <@ array['LC','LP','PO','GU','DO','CL','US','CM']::text[]),
  material text not null default '',     -- COD_MAT virá do catálogo de materiais
  espessura numeric(10,2),
  peso_unit numeric(12,3),
  observacoes text not null default '',
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz,
  unique (projeto_id, codigo)
);
create index projeto_pecas_conj_idx on public.projeto_pecas (conjunto_id);

create trigger projetos_atualizado before update on public.projetos for each row execute function tocar_atualizado_em();
create trigger projeto_conjuntos_atualizado before update on public.projeto_conjuntos for each row execute function tocar_atualizado_em();
create trigger projeto_pecas_atualizado before update on public.projeto_pecas for each row execute function tocar_atualizado_em();
create trigger projetos_auditoria after insert or update or delete on public.projetos for each row execute function registrar_auditoria();
create trigger projeto_conjuntos_auditoria after insert or update or delete on public.projeto_conjuntos for each row execute function registrar_auditoria();
create trigger projeto_pecas_auditoria after insert or update or delete on public.projeto_pecas for each row execute function registrar_auditoria();

-- Códigos e hierarquia só mudam pelas RPCs.
create or replace function public.proteger_codigos_eng() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('erp.rpc', true), '') = 'on' then return new; end if;
  if tg_table_name = 'projetos' and (new.codigo, new.proposta_id) is distinct from (old.codigo, old.proposta_id) then
    raise exception 'O código do projeto é o da proposta e não muda.';
  elsif tg_table_name = 'projeto_conjuntos' and (new.codigo, new.pai_id, new.tipo, new.sub, new.conj, new.projeto_id, new.excluido_em) is distinct from (old.codigo, old.pai_id, old.tipo, old.sub, old.conj, old.projeto_id, old.excluido_em) then
    raise exception 'Código e posição do conjunto só mudam pelas ações do sistema.';
  elsif tg_table_name = 'projeto_pecas' and (new.codigo, new.seq, new.conjunto_id, new.projeto_id, new.excluido_em) is distinct from (old.codigo, old.seq, old.conjunto_id, old.projeto_id, old.excluido_em) then
    raise exception 'Código da peça só muda pelas ações do sistema.';
  end if;
  return new;
end;
$$;
create trigger projetos_proteger before update on public.projetos for each row execute function proteger_codigos_eng();
create trigger projeto_conjuntos_proteger before update on public.projeto_conjuntos for each row execute function proteger_codigos_eng();
create trigger projeto_pecas_proteger before update on public.projeto_pecas for each row execute function proteger_codigos_eng();

-- 0A, 0B ... 0Z, 1A ... 9Z
create or replace function public.codigo_sub(n integer) returns text
language sql immutable set search_path = public as $$ select ((n - 1) / 26)::text || chr(65 + ((n - 1) % 26)) $$;

-- Abre o projeto a partir de uma proposta aprovada, com a montagem geral.
create or replace function public.criar_projeto(p_proposta uuid) returns public.projetos
language plpgsql security definer set search_path = public as $$
declare v propostas; pj projetos;
begin
  if not tem_permissao('engenharia','criar') then raise exception 'Sem permissão para abrir projetos.'; end if;
  select * into v from propostas where id = p_proposta and excluido_em is null;
  if not found then raise exception 'Proposta não encontrada.'; end if;
  if v.status not in ('Aprovado','Finalizado','Emitido NF','Pago') then raise exception 'Só propostas aprovadas viram projeto.'; end if;
  if exists (select 1 from projetos where proposta_id = v.id) then raise exception 'Esta proposta já tem projeto.'; end if;
  perform set_config('erp.rpc', 'on', true);
  insert into projetos (proposta_id, codigo, titulo, empresa_id, responsavel_id)
  values (v.id, v.codigo, v.titulo, v.empresa_id, auth.uid()) returning * into pj;
  insert into projeto_conjuntos (projeto_id, tipo, sub, conj, codigo, nome)
  values (pj.id, 'geral', '00', 0, pj.codigo || '-00-00-000', 'Montagem geral');
  perform set_config('erp.rpc', 'off', true);
  return pj;
end;
$$;

-- Novo filho: geral → submontagem (0A-00-000); submontagem → conjunto (0A-01-000).
create or replace function public.adicionar_conjunto(p_pai uuid, p_nome text, p_quantidade numeric default 1) returns public.projeto_conjuntos
language plpgsql security definer set search_path = public as $$
declare pai projeto_conjuntos; pj projetos; n integer; novo projeto_conjuntos;
begin
  if not tem_permissao('engenharia','editar') then raise exception 'Sem permissão.'; end if;
  select * into pai from projeto_conjuntos where id = p_pai and excluido_em is null for update;
  if not found then raise exception 'Conjunto pai não encontrado.'; end if;
  select * into pj from projetos where id = pai.projeto_id;
  perform set_config('erp.rpc', 'on', true);
  if pai.tipo = 'geral' then
    select coalesce(max(case when sub ~ '^[0-9][A-Z]$' then (substr(sub,1,1)::int * 26 + ascii(substr(sub,2,1)) - 64) end), 0) + 1 into n
      from projeto_conjuntos where projeto_id = pai.projeto_id and tipo = 'submontagem';
    if n > 260 then raise exception 'Limite de submontagens atingido.'; end if;
    insert into projeto_conjuntos (projeto_id, pai_id, tipo, sub, conj, codigo, nome, quantidade, ordem)
    values (pai.projeto_id, pai.id, 'submontagem', codigo_sub(n), 0, pj.codigo || '-' || codigo_sub(n) || '-00-000', p_nome, coalesce(p_quantidade, 1), n)
    returning * into novo;
  elsif pai.tipo = 'submontagem' then
    select coalesce(max(conj), 0) + 1 into n from projeto_conjuntos where projeto_id = pai.projeto_id and pai_id = pai.id;
    if n > 99 then raise exception 'Limite de conjuntos nesta submontagem atingido.'; end if;
    insert into projeto_conjuntos (projeto_id, pai_id, tipo, sub, conj, codigo, nome, quantidade, ordem)
    values (pai.projeto_id, pai.id, 'conjunto', pai.sub, n, pj.codigo || '-' || pai.sub || '-' || lpad(n::text, 2, '0') || '-000', p_nome, coalesce(p_quantidade, 1), n)
    returning * into novo;
  else
    raise exception 'Conjuntos secundários não têm subníveis. Adicione peças a ele.';
  end if;
  perform set_config('erp.rpc', 'off', true);
  return novo;
end;
$$;

-- Nova peça no conjunto: mesmo prefixo, último bloco sequencial (…-0A-01-001).
create or replace function public.adicionar_peca(p_conjunto uuid, p_dados jsonb) returns public.projeto_pecas
language plpgsql security definer set search_path = public as $$
declare c projeto_conjuntos; n integer; nova projeto_pecas;
begin
  if not tem_permissao('engenharia','editar') then raise exception 'Sem permissão.'; end if;
  select * into c from projeto_conjuntos where id = p_conjunto and excluido_em is null for update;
  if not found then raise exception 'Conjunto não encontrado.'; end if;
  select coalesce(max(seq), 0) + 1 into n from projeto_pecas where conjunto_id = c.id;
  if n > 999 then raise exception 'Limite de peças neste conjunto atingido.'; end if;
  perform set_config('erp.rpc', 'on', true);
  insert into projeto_pecas (projeto_id, conjunto_id, seq, codigo, descricao, quantidade, cod_op, material, espessura, peso_unit, ordem)
  values (c.projeto_id, c.id, n, left(c.codigo, length(c.codigo) - 3) || lpad(n::text, 3, '0'),
    coalesce(p_dados->>'descricao', ''), coalesce(nullif(p_dados->>'quantidade', '')::numeric, 1),
    coalesce((select array_agg(x) from jsonb_array_elements_text(p_dados->'cod_op') x), '{}'),
    coalesce(p_dados->>'material', ''), nullif(p_dados->>'espessura', '')::numeric, nullif(p_dados->>'peso_unit', '')::numeric, n)
  returning * into nova;
  perform set_config('erp.rpc', 'off', true);
  return nova;
end;
$$;

-- Exclusão lógica: conjunto só se estiver vazio; peça sempre (código não é reaproveitado).
create or replace function public.excluir_item_eng(p_tabela text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('engenharia','editar') then raise exception 'Sem permissão.'; end if;
  perform set_config('erp.rpc', 'on', true);
  if p_tabela = 'conjunto' then
    if exists (select 1 from projeto_conjuntos where id = p_id and tipo = 'geral') then raise exception 'A montagem geral não pode ser excluída.'; end if;
    if exists (select 1 from projeto_conjuntos where pai_id = p_id and excluido_em is null)
       or exists (select 1 from projeto_pecas where conjunto_id = p_id and excluido_em is null) then
      raise exception 'Esvazie o conjunto (subconjuntos e peças) antes de excluí-lo.';
    end if;
    update projeto_conjuntos set excluido_em = now() where id = p_id;
  elsif p_tabela = 'peca' then
    update projeto_pecas set excluido_em = now() where id = p_id;
  else
    raise exception 'Tipo inválido.';
  end if;
  perform set_config('erp.rpc', 'off', true);
end;
$$;

-- RLS ------------------------------------------------------------------------
alter table public.projetos enable row level security;
alter table public.projeto_conjuntos enable row level security;
alter table public.projeto_pecas enable row level security;

create policy projetos_ler on public.projetos for select to authenticated using (tem_permissao('engenharia','ler'));
create policy projetos_editar on public.projetos for update to authenticated using (tem_permissao('engenharia','editar')) with check (tem_permissao('engenharia','editar'));
create policy conjuntos_ler on public.projeto_conjuntos for select to authenticated using (tem_permissao('engenharia','ler') and excluido_em is null);
create policy conjuntos_editar on public.projeto_conjuntos for update to authenticated using (tem_permissao('engenharia','editar')) with check (tem_permissao('engenharia','editar'));
create policy pecas_ler on public.projeto_pecas for select to authenticated using (tem_permissao('engenharia','ler') and excluido_em is null);
create policy pecas_editar on public.projeto_pecas for update to authenticated using (tem_permissao('engenharia','editar')) with check (tem_permissao('engenharia','editar'));

grant select, update on public.projetos, public.projeto_conjuntos, public.projeto_pecas to authenticated;

do $$
declare f text;
begin
  foreach f in array array['public.criar_projeto(uuid)', 'public.adicionar_conjunto(uuid, text, numeric)', 'public.adicionar_peca(uuid, jsonb)', 'public.excluir_item_eng(text, uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
