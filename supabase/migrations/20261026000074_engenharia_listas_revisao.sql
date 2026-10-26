-- Lista de materiais da Engenharia por revisão (pedido do Gabriel de 26/10/2026, decisão 113):
-- o engenheiro cria uma revisão em rascunho, lança os materiais (do cadastro de Compras ou digitados), com link ou imagem
-- de referência para o comprador, e envia a lista inteira para Compras. Pode abrir nova revisão no mesmo projeto.
-- A lista não sai mais da árvore (árvore pausada). Cada revisão enviada vira uma solicitação de Compras (RC) com
-- engenharia_revisao = número da revisão; as regras de substituição e complemento são as da decisão 107.

create table public.eng_listas (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos(id),
  revisao integer not null check (revisao >= 0),
  status text not null default 'rascunho' check (status in ('rascunho', 'enviada', 'descartada')),
  requisicao_id uuid references public.compras_requisicoes(id),
  criado_por uuid default auth.uid() references public.usuarios(id),
  criado_em timestamptz not null default now(),
  enviada_por uuid references public.usuarios(id),
  enviada_em timestamptz,
  unique (projeto_id, revisao)
);
create unique index eng_listas_um_rascunho on public.eng_listas (projeto_id) where status = 'rascunho';

create table public.eng_lista_itens (
  id uuid primary key default gen_random_uuid(),
  lista_id uuid not null references public.eng_listas(id),
  ordem integer not null default 0,
  grupo text not null default 'Outros' check (grupo in ('Chapas', 'Perfis', 'Comerciais', 'Fixadores', 'Consumíveis', 'Serviços', 'Outros')),
  descricao text not null check (length(trim(descricao)) > 0),
  quantidade numeric not null check (quantidade > 0),
  unidade text not null default 'un',
  bib_tipo text check (bib_tipo in ('chapa', 'perfil', 'item')),
  bib_id uuid,
  observacoes text not null default '',
  link text not null default '' check (link = '' or link ~* '^https?://'),
  imagem text,
  excluido_em timestamptz,
  criado_em timestamptz not null default now(),
  check ((bib_tipo is null) = (bib_id is null))
);
create index eng_lista_itens_lista on public.eng_lista_itens (lista_id) where excluido_em is null;

-- Referência para o comprador também na solicitação de Compras.
alter table public.compras_requisicao_itens add column referencia_link text not null default '';
alter table public.compras_requisicao_itens add column referencia_imagem text;

create trigger eng_listas_auditoria after insert or update or delete on public.eng_listas for each row execute function registrar_auditoria();
create trigger eng_lista_itens_auditoria after insert or update or delete on public.eng_lista_itens for each row execute function registrar_auditoria();

create or replace function public.eng_lista_rascunho(p_lista uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from eng_listas where id = p_lista and status = 'rascunho');
$$;

-- Item só muda enquanto a revisão é rascunho, e não troca de lista.
create or replace function public.eng_item_antes() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.lista_id <> old.lista_id then raise exception 'O item não muda de revisão.'; end if;
  if not eng_lista_rascunho(new.lista_id) and coalesce(current_setting('erp.rpc', true), '') <> 'on' then
    raise exception 'Esta revisão já foi enviada para Compras e está travada. Abra uma nova revisão.';
  end if;
  return new;
end;
$$;
create trigger eng_lista_itens_antes before insert or update on public.eng_lista_itens for each row execute function eng_item_antes();

alter table public.eng_listas enable row level security;
alter table public.eng_lista_itens enable row level security;
create policy eng_listas_ler on public.eng_listas for select to authenticated using (tem_permissao('engenharia', 'ler'));
create policy eng_itens_ler on public.eng_lista_itens for select to authenticated using (tem_permissao('engenharia', 'ler'));
create policy eng_itens_incluir on public.eng_lista_itens for insert to authenticated
  with check (tem_permissao('engenharia', 'editar') and eng_lista_rascunho(lista_id));
create policy eng_itens_editar on public.eng_lista_itens for update to authenticated
  using (tem_permissao('engenharia', 'editar') and eng_lista_rascunho(lista_id))
  with check (tem_permissao('engenharia', 'editar') and eng_lista_rascunho(lista_id));
grant select on public.eng_listas to authenticated;
grant select, insert, update on public.eng_lista_itens to authenticated;

-- Nova revisão em rascunho. Número seguinte ao maior já usado (listas ou solicitações antigas da Engenharia).
-- p_copiar: começa com os itens da última revisão enviada.
create or replace function public.eng_nova_revisao(p_projeto uuid, p_copiar boolean default true)
returns uuid language plpgsql security definer set search_path = public as $$
declare pj projetos; rev integer; nova uuid; anterior uuid;
begin
  if not tem_permissao('engenharia', 'editar') then raise exception 'Sem permissão para editar a lista de materiais.'; end if;
  select * into pj from projetos where id = p_projeto and excluido_em is null for update;
  if not found then raise exception 'Projeto não encontrado.'; end if;
  if pj.status = 'cancelado' then raise exception 'Projeto cancelado.'; end if;
  if exists (select 1 from eng_listas where projeto_id = pj.id and status = 'rascunho') then
    raise exception 'Já existe uma revisão em rascunho neste projeto.';
  end if;
  select greatest(coalesce((select max(revisao) from eng_listas where projeto_id = pj.id), -1),
                  coalesce((select max(engenharia_revisao) from compras_requisicoes where projeto_id = pj.id), -1)) + 1 into rev;
  insert into eng_listas (projeto_id, revisao) values (pj.id, rev) returning id into nova;
  if p_copiar then
    select id into anterior from eng_listas where projeto_id = pj.id and status = 'enviada' order by revisao desc limit 1;
    insert into eng_lista_itens (lista_id, ordem, grupo, descricao, quantidade, unidade, bib_tipo, bib_id, observacoes, link, imagem)
    select nova, ordem, grupo, descricao, quantidade, unidade, bib_tipo, bib_id, observacoes, link, imagem
    from eng_lista_itens where lista_id = anterior and excluido_em is null;
  end if;
  return nova;
end;
$$;

-- Descartar o rascunho (exclusão lógica: a revisão fica como "descartada", sem itens enviados).
create or replace function public.eng_descartar_rascunho(p_lista uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('engenharia', 'editar') then raise exception 'Sem permissão para editar a lista de materiais.'; end if;
  update eng_listas set status = 'descartada' where id = p_lista and status = 'rascunho';
  if not found then raise exception 'Só um rascunho pode ser descartado.'; end if;
end;
$$;

-- Envio: p_itens já calculado na tela (lista inteira; com algo já comprado, só o complemento, com "era × agora").
-- Cada item: grupo, descricao, quantidade, unidade, observacoes, bib_tipo, bib_id, link, imagem.
create or replace function public.eng_enviar_lista(p_lista uuid, p_itens jsonb, p_necessario_em date default null,
  p_prioridade text default 'normal', p_observacoes text default '')
returns table (id uuid, codigo text, revisao integer, substituidas text[])
language plpgsql security definer set search_path = public as $$
declare l eng_listas; pj projetos; nova compras_requisicoes; antigas text[] := '{}'; r record; n integer := 0; it jsonb;
begin
  if not tem_permissao('engenharia', 'editar') then raise exception 'Sem permissão para solicitar compras do projeto.'; end if;
  select * into l from eng_listas where eng_listas.id = p_lista for update;
  if not found or l.status <> 'rascunho' then raise exception 'Esta revisão já foi enviada ou descartada.'; end if;
  select * into pj from projetos where projetos.id = l.projeto_id and excluido_em is null for update;
  if not found then raise exception 'Projeto não encontrado.'; end if;
  if pj.status = 'cancelado' then raise exception 'Projeto cancelado.'; end if;
  if not exists (select 1 from eng_lista_itens where lista_id = l.id and excluido_em is null) then raise exception 'A lista está vazia.'; end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then raise exception 'Nada a solicitar: tudo o que está na lista já foi comprado.'; end if;
  if p_prioridade not in ('normal', 'urgente') then raise exception 'Prioridade inválida.'; end if;
  if exists (select 1 from compras_requisicoes q where q.projeto_id = pj.id and q.engenharia_revisao = l.revisao) then
    raise exception 'A revisão R% já tem solicitação em Compras.', l.revisao;
  end if;

  perform set_config('erp.rpc', 'on', true);
  insert into compras_requisicoes (titulo, projeto_id, setor, necessario_em, prioridade, observacoes, engenharia_revisao, origem)
  values (format('Lista de materiais %s · R%s', pj.codigo, l.revisao), pj.id, 'Engenharia', p_necessario_em, p_prioridade,
    trim(coalesce(p_observacoes, '')), l.revisao, 'engenharia')
  returning * into nova;

  for it in select * from jsonb_array_elements(p_itens) loop
    n := n + 1;
    insert into compras_requisicao_itens (requisicao_id, ordem, grupo, descricao, quantidade, unidade, observacoes, bib_tipo, bib_id, referencia_link, referencia_imagem)
    values (nova.id, n, coalesce(nullif(it->>'grupo', ''), 'Outros'), it->>'descricao', (it->>'quantidade')::numeric,
      coalesce(nullif(it->>'unidade', ''), 'un'), coalesce(it->>'observacoes', ''),
      case when nullif(it->>'bib_id', '') is not null then nullif(it->>'bib_tipo', '') end, nullif(it->>'bib_id', '')::uuid,
      coalesce(it->>'link', ''), nullif(it->>'imagem', ''));
  end loop;

  -- Mesma regra da decisão 107: a revisão anterior sem nada comprado é substituída.
  for r in select q.id, q.codigo, q.status from compras_requisicoes q
    where q.projeto_id = pj.id and q.engenharia_revisao is not null and q.id <> nova.id and q.status = 'aberta'
      and not exists (select 1 from compras_requisicao_itens i where i.requisicao_id = q.id and i.status in ('comprado', 'recebido'))
    for update
  loop
    update compras_requisicao_itens set status = 'cancelado', pacote_id = null where requisicao_id = r.id and status = 'a_comprar';
    update compras_requisicoes set status = 'cancelada' where compras_requisicoes.id = r.id;
    insert into compras_eventos (requisicao_id, tipo, de, para, justificativa)
    values (r.id, 'status', r.status, 'cancelada', format('Substituída pela revisão R%s da lista da Engenharia (%s)', l.revisao, nova.codigo));
    antigas := antigas || r.codigo;
  end loop;
  update eng_listas set status = 'enviada', requisicao_id = nova.id, enviada_por = auth.uid(), enviada_em = now() where eng_listas.id = l.id;
  perform set_config('erp.rpc', 'off', true);
  insert into compras_eventos (requisicao_id, tipo, dados) values (nova.id, 'status', jsonb_build_object('origem', 'engenharia', 'itens', n));

  insert into projeto_eventos (projeto_id, tipo, para, justificativa, dados)
  values (pj.id, 'compra', nova.codigo, format('Lista R%s enviada para Compras', l.revisao),
    jsonb_build_object('requisicao_id', nova.id, 'revisao', l.revisao, 'itens', n, 'substituidas', to_jsonb(antigas)));
  return query select nova.id, nova.codigo, l.revisao, antigas;
end;
$$;

-- Revisões já enviadas pelo fluxo anterior (lista da árvore) viram revisões enviadas com os itens da solicitação.
do $$
declare q record; nova uuid;
begin
  for q in select * from compras_requisicoes where engenharia_revisao is not null and projeto_id is not null order by criado_em loop
    if exists (select 1 from eng_listas where projeto_id = q.projeto_id and revisao = q.engenharia_revisao) then continue; end if;
    insert into eng_listas (projeto_id, revisao, status, requisicao_id, criado_por, criado_em, enviada_por, enviada_em)
    values (q.projeto_id, q.engenharia_revisao, 'enviada', q.id, q.solicitante_id, q.criado_em, q.solicitante_id, q.criado_em)
    returning id into nova;
    perform set_config('erp.rpc', 'on', true);
    insert into eng_lista_itens (lista_id, ordem, grupo, descricao, quantidade, unidade, bib_tipo, bib_id, observacoes)
    select nova, i.ordem, i.grupo, i.descricao, i.quantidade, i.unidade, i.bib_tipo, i.bib_id, ''
    from compras_requisicao_itens i where i.requisicao_id = q.id;
    perform set_config('erp.rpc', 'off', true);
  end loop;
end $$;

-- Imagens de referência: pasta = id da revisão. Engenharia envia; Engenharia e Compras veem.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('engenharia', 'engenharia', false, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;
create policy engenharia_ler on storage.objects for select to authenticated
  using (bucket_id = 'engenharia' and (tem_permissao('engenharia', 'ler') or tem_permissao('compras', 'ler')));
create policy engenharia_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'engenharia' and tem_permissao('engenharia', 'editar')
    and exists (select 1 from public.eng_listas l where l.id::text = (storage.foldername(name))[1] and l.status = 'rascunho'));

do $$
declare f text;
begin
  foreach f in array array['public.eng_nova_revisao(uuid, boolean)', 'public.eng_descartar_rascunho(uuid)',
    'public.eng_enviar_lista(uuid, jsonb, date, text, text)', 'public.eng_lista_rascunho(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
