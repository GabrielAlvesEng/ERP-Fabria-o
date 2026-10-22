-- Engenharia: Kanban de projetos, histórico, Chefe, projeto de exemplo e lista de materiais manual
-- (docs/PLANEJAMENTO_ENGENHARIA.md, respostas do Gabriel em 22/10/2026, decisão 96).

-- Permissões: Engenheiro Mecânico Chefe (resposta 1); a Engenharia não lê Vendas (resposta 3);
-- só a Engenharia abre a área de Engenharia (resposta 2).
insert into public.permissoes (modulo, acao) values ('engenharia', 'aprovar') on conflict do nothing;
-- O Chefe é a permissão engenharia.aprovar, individual (o perfil Engenharia não ganha).
insert into public.usuario_permissoes (usuario_id, permissao_id, concedida)
select u.id, pm.id, true from public.usuarios u, public.permissoes pm
where lower(u.email) = 'gabriel.alves@fabriacobrasil.com.br' and pm.modulo = 'engenharia' and pm.acao = 'aprovar'
on conflict (usuario_id, permissao_id) do update set concedida = true;

delete from public.perfil_permissoes pp using public.perfis p, public.permissoes pm
where pp.perfil_id = p.id and pp.permissao_id = pm.id
  and ((p.nome = 'Engenharia' and pm.modulo = 'vendas' and pm.acao = 'ler')
    or (p.nome = 'Comercial' and pm.modulo = 'engenharia' and pm.acao = 'ler'));

-- Status do Kanban (seção 2): Não iniciado, Em andamento, Liberado para fabricação, Finalizado; Cancelado fora do quadro
-- e Pausado como selo.
alter table public.projetos drop constraint if exists projetos_status_check;
alter table public.projetos
  add column pausado boolean not null default false,
  add column fabricacao_concluida_em date,
  add column exemplo boolean not null default false;
update public.projetos set pausado = true, status = 'em_andamento' where status = 'pausado';
update public.projetos set status = 'finalizado', fabricacao_concluida_em = atualizado_em::date where status = 'concluido';
alter table public.projetos
  alter column status set default 'nao_iniciado',
  add constraint projetos_status_check check (status in ('nao_iniciado', 'em_andamento', 'liberado', 'finalizado', 'cancelado')),
  add constraint projetos_finalizado_data check (status <> 'finalizado' or fabricacao_concluida_em is not null);

-- Projeto de exemplo (pedido do Gabriel): sem proposta nem cliente, marcado como exemplo.
alter table public.projetos alter column proposta_id drop not null, alter column empresa_id drop not null;
alter table public.projetos add constraint projetos_origem check (exemplo or (proposta_id is not null and empresa_id is not null));

-- Nome do cliente sem ler o cadastro de Vendas (campo calculado: select('*, cliente_nome')).
create or replace function public.cliente_nome(p public.projetos) returns text
language sql stable security definer set search_path = public as $$
  select case when p.exemplo and p.empresa_id is null then 'Cliente exemplo' else (select nome_fantasia from empresas where id = p.empresa_id) end;
$$;
revoke execute on function public.cliente_nome(public.projetos) from public, anon;
grant execute on function public.cliente_nome(public.projetos) to authenticated;

-- Histórico do projeto (seção 3.8). Só as funções do sistema gravam.
create table public.projeto_eventos (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos(id) on delete cascade,
  tipo text not null check (tipo in ('criado', 'status', 'pausa')),
  de text,
  para text,
  justificativa text not null default '',
  dados jsonb not null default '{}',
  usuario_id uuid default auth.uid() references public.usuarios(id),
  criado_em timestamptz not null default now()
);
create index projeto_eventos_proj_idx on public.projeto_eventos (projeto_id, criado_em desc);
alter table public.projeto_eventos enable row level security;
create policy projeto_eventos_ler on public.projeto_eventos for select to authenticated using (tem_permissao('engenharia', 'ler'));

-- Status, pausa e término da fabricação só mudam pelas funções abaixo.
create or replace function public.proteger_status_projeto() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('erp.rpc', true), '') = 'on' then return new; end if;
  if (new.status, new.pausado, new.fabricacao_concluida_em, new.exemplo) is distinct from (old.status, old.pausado, old.fabricacao_concluida_em, old.exemplo) then
    raise exception 'O status do projeto só muda pelo Kanban.';
  end if;
  return new;
end;
$$;
create trigger projetos_proteger_status before update on public.projetos for each row execute function proteger_status_projeto();

create or replace function public.registrar_criacao_projeto() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into projeto_eventos (projeto_id, tipo, para, justificativa) values (new.id, 'criado', new.status, case when new.exemplo then 'Projeto de exemplo' else '' end);
  return new;
end;
$$;
create trigger projetos_evento_criado after insert on public.projetos for each row execute function registrar_criacao_projeto();

create or replace function public.ordem_status_projeto(s text) returns integer
language sql immutable set search_path = public as $$
  select case s when 'nao_iniciado' then 1 when 'em_andamento' then 2 when 'liberado' then 3 when 'finalizado' then 4 end;
$$;

-- Conjuntos que impedem liberar para fabricação: todos os ativos (fora a montagem geral) precisam estar Liberados;
-- sem conjuntos, vale a montagem geral.
create or replace function public.conjuntos_nao_liberados(p_projeto uuid) returns text[]
language sql stable security definer set search_path = public as $$
  with ativos as (
    select codigo, nome, tipo, status from projeto_conjuntos where projeto_id = p_projeto and excluido_em is null and removido_cad_em is null
  ), alvo as (
    select * from ativos where tipo <> 'geral'
    union all
    select * from ativos where tipo = 'geral' and not exists (select 1 from ativos where tipo <> 'geral')
  )
  select coalesce(array_agg(codigo || ' ' || nome order by codigo), '{}') from alvo where status <> 'liberado';
$$;

-- Movimentação no Kanban (seção 2, respostas 4 e 7).
create or replace function public.mover_projeto(p_projeto uuid, p_status text, p_justificativa text default '', p_data date default null)
returns public.projetos
language plpgsql security definer set search_path = public as $$
declare v projetos; antes text; chefe boolean := tem_permissao('engenharia', 'aprovar'); faltam text[];
begin
  if not tem_permissao('engenharia', 'editar') then raise exception 'Sem permissão para mover projetos.'; end if;
  if ordem_status_projeto(p_status) is null then raise exception 'Coluna inválida.'; end if;
  select * into v from projetos where id = p_projeto and excluido_em is null for update;
  if not found then raise exception 'Projeto não encontrado.'; end if;
  if v.status = 'cancelado' then raise exception 'Projeto cancelado não volta ao quadro.'; end if;
  if v.status = p_status then return v; end if;
  antes := v.status;

  if ordem_status_projeto(p_status) < ordem_status_projeto(antes) then
    if not chefe then raise exception 'Só o Engenheiro Mecânico Chefe volta um projeto de coluna.'; end if;
    if length(trim(coalesce(p_justificativa, ''))) < 3 then raise exception 'Informe a justificativa para voltar o projeto.'; end if;
  end if;
  if ordem_status_projeto(p_status) >= 3 and ordem_status_projeto(antes) < 3 then
    if not chefe then raise exception 'Só o Engenheiro Mecânico Chefe libera para fabricação.'; end if;
    faltam := conjuntos_nao_liberados(v.id);
    if cardinality(faltam) > 0 then
      raise exception 'Ainda não liberados: %', array_to_string(faltam[1:5], '; ') || case when cardinality(faltam) > 5 then format(' e mais %s', cardinality(faltam) - 5) else '' end;
    end if;
  end if;
  if p_status = 'finalizado' then
    if not chefe then raise exception 'Só o Engenheiro Mecânico Chefe finaliza o projeto.'; end if;
    if p_data is null then raise exception 'Informe a data de término da fabricação.'; end if;
    if p_data > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'A data de término não pode ser futura.'; end if;
  end if;

  perform set_config('erp.rpc', 'on', true);
  update projetos set status = p_status,
    fabricacao_concluida_em = case when p_status = 'finalizado' then p_data else null end
  where id = v.id returning * into v;
  perform set_config('erp.rpc', 'off', true);
  insert into projeto_eventos (projeto_id, tipo, de, para, justificativa, dados)
  values (v.id, 'status', antes, p_status, trim(coalesce(p_justificativa, '')),
    case when p_status = 'finalizado' then jsonb_build_object('fabricacao_concluida_em', p_data) else '{}'::jsonb end);
  return v;
end;
$$;

create or replace function public.pausar_projeto(p_projeto uuid, p_pausado boolean, p_justificativa text default '')
returns public.projetos
language plpgsql security definer set search_path = public as $$
declare v projetos;
begin
  if not tem_permissao('engenharia', 'aprovar') then raise exception 'Só o Engenheiro Mecânico Chefe pausa ou retoma o projeto.'; end if;
  select * into v from projetos where id = p_projeto and excluido_em is null for update;
  if not found then raise exception 'Projeto não encontrado.'; end if;
  if v.pausado = p_pausado then return v; end if;
  perform set_config('erp.rpc', 'on', true);
  update projetos set pausado = p_pausado where id = v.id returning * into v;
  perform set_config('erp.rpc', 'off', true);
  insert into projeto_eventos (projeto_id, tipo, para, justificativa) values (v.id, 'pausa', case when p_pausado then 'pausado' else 'retomado' end, trim(coalesce(p_justificativa, '')));
  return v;
end;
$$;

-- Primeiro conjunto ou peça leva o projeto de Não iniciado para Em andamento.
create or replace function public.iniciar_projeto_automatico() returns trigger
language plpgsql security definer set search_path = public as $$
declare anterior text := current_setting('erp.rpc', true); n integer;
begin
  if tg_table_name = 'projeto_conjuntos' and to_jsonb(new)->>'tipo' = 'geral' then return new; end if;
  perform set_config('erp.rpc', 'on', true);
  update projetos set status = 'em_andamento' where id = new.projeto_id and status = 'nao_iniciado';
  get diagnostics n = row_count;
  perform set_config('erp.rpc', coalesce(anterior, ''), true);
  if n > 0 then
    insert into projeto_eventos (projeto_id, tipo, de, para, justificativa)
    values (new.projeto_id, 'status', 'nao_iniciado', 'em_andamento', 'Automático: primeiro item cadastrado');
  end if;
  return new;
end;
$$;
create trigger conjuntos_inicia_projeto after insert on public.projeto_conjuntos for each row execute function iniciar_projeto_automatico();
create trigger pecas_inicia_projeto after insert on public.projeto_pecas for each row execute function iniciar_projeto_automatico();

-- Propostas aprovadas aguardando projeto, sem ler Vendas (resposta 3).
create or replace function public.propostas_aguardando_projeto()
returns table (id uuid, codigo text, titulo text, cliente text)
language sql stable security definer set search_path = public as $$
  select p.id, p.codigo, p.titulo, e.nome_fantasia
  from propostas p left join empresas e on e.id = p.empresa_id
  where tem_permissao('engenharia', 'ler') and p.excluido_em is null
    and p.status in ('Aprovado', 'Finalizado', 'Emitido NF', 'Pago')
    and not exists (select 1 from projetos j where j.proposta_id = p.id)
  order by p.codigo desc;
$$;

-- Projeto de exemplo (só o Chefe), com a montagem geral.
create or replace function public.criar_projeto_exemplo(p_titulo text) returns public.projetos
language plpgsql security definer set search_path = public as $$
declare pj projetos; n integer;
begin
  if not tem_permissao('engenharia', 'aprovar') then raise exception 'Só o Engenheiro Mecânico Chefe cria projeto de exemplo.'; end if;
  select coalesce(max(substring(codigo from '^EX-(\d+)$')::int), 0) + 1 into n from projetos where exemplo;
  perform set_config('erp.rpc', 'on', true);
  insert into projetos (codigo, titulo, exemplo, responsavel_id)
  values ('EX-' || lpad(n::text, 3, '0'), coalesce(nullif(trim(p_titulo), ''), 'Projeto de exemplo'), true, auth.uid()) returning * into pj;
  insert into projeto_conjuntos (projeto_id, tipo, sub, conj, codigo, nome)
  values (pj.id, 'geral', '00', 0, pj.codigo || '-00-00-000', 'Montagem geral');
  perform set_config('erp.rpc', 'off', true);
  return pj;
end;
$$;

-- Lista de materiais manual (resposta "podendo ser feita manualmente"): largura das chapas e adicionar_peca com
-- COD_MAT, medidas e item da biblioteca.
alter table public.projeto_pecas add column largura numeric(10,2);

create or replace function public.adicionar_peca(p_conjunto uuid, p_dados jsonb) returns public.projeto_pecas
language plpgsql security definer set search_path = public as $$
declare c projeto_conjuntos; cod text; n integer; nova projeto_pecas; mat text;
begin
  if not tem_permissao('engenharia','editar') then raise exception 'Sem permissão.'; end if;
  select * into c from projeto_conjuntos where id = p_conjunto and excluido_em is null for update;
  if not found then raise exception 'Conjunto não encontrado.'; end if;
  cod := proximo_codigo_peca(c.id);
  n := case when c.tipo = 'soldado' then split_part(cod, '.', 2)::int else right(cod, 3)::int end;
  mat := nullif(p_dados->>'cod_mat', '');
  perform set_config('erp.rpc', 'on', true);
  insert into projeto_pecas (projeto_id, conjunto_id, seq, codigo, descricao, quantidade, cod_op, material, cod_mat, espessura, largura, comprimento, peso_unit, bib_tipo, bib_id, ordem)
  values (c.projeto_id, c.id, n, cod,
    coalesce(p_dados->>'descricao', ''), coalesce(nullif(p_dados->>'quantidade', '')::numeric, 1),
    coalesce((select array_agg(x) from jsonb_array_elements_text(p_dados->'cod_op') x), '{}'),
    coalesce(p_dados->>'material', (select nome from catalogo_materiais where cod_mat = mat), ''), mat,
    nullif(p_dados->>'espessura', '')::numeric, nullif(p_dados->>'largura', '')::numeric, nullif(p_dados->>'comprimento', '')::numeric,
    nullif(p_dados->>'peso_unit', '')::numeric,
    nullif(p_dados->>'bib_tipo', ''), nullif(p_dados->>'bib_id', '')::uuid, n)
  returning * into nova;
  perform set_config('erp.rpc', 'off', true);
  return nova;
end;
$$;

-- Painel da Engenharia (seção 1): contagens por projeto, pelas políticas de quem consulta.
create or replace view public.painel_engenharia with (security_invoker = true) as
select j.id,
  (select count(*) from projeto_conjuntos c where c.projeto_id = j.id and c.excluido_em is null and c.removido_cad_em is null and c.tipo <> 'geral') conjuntos,
  (select count(*) from projeto_conjuntos c where c.projeto_id = j.id and c.excluido_em is null and c.removido_cad_em is null and c.tipo <> 'geral' and c.status <> 'modelando') conjuntos_modelados,
  (select count(*) from projeto_conjuntos c where c.projeto_id = j.id and c.excluido_em is null and c.removido_cad_em is null and c.tipo <> 'geral' and c.status = 'liberado') conjuntos_liberados,
  (select count(*) from projeto_conjuntos c where c.projeto_id = j.id and c.excluido_em is null and c.removido_cad_em is null and c.tipo <> 'geral' and c.status = 'revisao') conjuntos_revisao,
  (select status from projeto_conjuntos c where c.projeto_id = j.id and c.tipo = 'geral' and c.excluido_em is null limit 1) status_geral,
  (select count(*) from projeto_pecas p where p.projeto_id = j.id and p.excluido_em is null and p.removido_cad_em is null) pecas,
  (select count(*) from projeto_pecas p where p.projeto_id = j.id and p.excluido_em is null and p.removido_cad_em is null
     and case when 'CM' = any(p.cod_op) then coalesce(p.bib_confirmado, false) else (p.cod_mat is not null or p.material <> '') end) pecas_material,
  (select count(*) from projeto_pecas p where p.projeto_id = j.id and p.excluido_em is null and p.removido_cad_em is null
     and not 'CM' = any(p.cod_op) and p.cod_mat is null and p.material = '') pecas_sem_material
from projetos j;

do $$
declare f text;
begin
  foreach f in array array[
    'public.mover_projeto(uuid, text, text, date)', 'public.pausar_projeto(uuid, boolean, text)',
    'public.propostas_aguardando_projeto()', 'public.criar_projeto_exemplo(text)', 'public.adicionar_peca(uuid, jsonb)',
    'public.conjuntos_nao_liberados(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
grant select on public.projeto_eventos, public.painel_engenharia to authenticated;
