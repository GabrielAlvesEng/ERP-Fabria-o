-- Engenharia solicita a compra da lista de materiais do projeto (escopo do Gabriel de 23/10/2026, decisão 103;
-- resposta 5 do docs/PLANEJAMENTO_ENGENHARIA.md: sempre a lista inteira).
-- Cada envio é uma revisão da lista (R0, R1…) e vira uma requisição de Compras (RC-AA-NNN). A revisão enviada fica
-- congelada em Compras; mudar a lista depois exige um novo envio (nova revisão).

alter table public.compras_requisicoes add column engenharia_revisao integer check (engenharia_revisao >= 0);
create unique index compras_requisicoes_eng_rev on public.compras_requisicoes (projeto_id, engenharia_revisao) where engenharia_revisao is not null;

-- Envio: p_itens = [{grupo, descricao, quantidade, unidade, observacoes}] já somados na tela (mesma soma da importação de Compras).
-- Requisição anterior da Engenharia ainda aberta ou em cotação é cancelada e substituída por esta revisão;
-- as que já foram para aprovação ou compra continuam, e a tela manda só o que falta comprar.
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

  insert into compras_requisicoes (titulo, projeto_id, setor, necessario_em, prioridade, observacoes, engenharia_revisao)
  values (format('Lista de materiais %s · R%s', pj.codigo, rev), pj.id, 'Engenharia', p_necessario_em, p_prioridade,
    trim(coalesce(p_observacoes, '')), rev)
  returning * into nova;

  for it in select * from jsonb_array_elements(p_itens) loop
    n := n + 1;
    insert into compras_requisicao_itens (requisicao_id, ordem, grupo, descricao, quantidade, unidade, observacoes)
    values (nova.id, n, coalesce(nullif(it->>'grupo', ''), 'Outros'), it->>'descricao', (it->>'quantidade')::numeric,
      coalesce(nullif(it->>'unidade', ''), 'un'), coalesce(it->>'observacoes', ''));
  end loop;

  for r in select q.id, q.codigo, q.status, q.engenharia_revisao from compras_requisicoes q
    where q.projeto_id = pj.id and q.engenharia_revisao is not null and q.id <> nova.id and q.status in ('aberta', 'em_cotacao')
    for update
  loop
    perform set_config('erp.rpc', 'on', true);
    update compras_requisicoes set status = 'cancelada' where compras_requisicoes.id = r.id;
    perform set_config('erp.rpc', 'off', true);
    insert into compras_eventos (requisicao_id, tipo, de, para, justificativa)
    values (r.id, 'status', r.status, 'cancelada', format('Substituída pela revisão R%s da lista da Engenharia (%s)', rev, nova.codigo));
    antigas := antigas || r.codigo;
  end loop;

  insert into projeto_eventos (projeto_id, tipo, para, justificativa, dados)
  values (pj.id, 'compra', nova.codigo, format('Lista R%s enviada para Compras', rev),
    jsonb_build_object('requisicao_id', nova.id, 'revisao', rev, 'itens', n, 'substituidas', to_jsonb(antigas)));
  return query select nova.id, nova.codigo, rev, antigas;
end;
$$;

-- O que a Engenharia já pediu para o projeto, sem valores (Compras guarda preços e fornecedores).
create or replace function public.engenharia_solicitacoes(p_projeto uuid)
returns table (id uuid, codigo text, revisao integer, status text, necessario_em date, prioridade text, criado_em timestamptz, solicitante text, itens jsonb)
language sql stable security definer set search_path = public as $$
  select q.id, q.codigo, q.engenharia_revisao, q.status, q.necessario_em, q.prioridade, q.criado_em, u.nome,
    coalesce((select jsonb_agg(jsonb_build_object('grupo', i.grupo, 'descricao', i.descricao, 'quantidade', i.quantidade, 'unidade', i.unidade) order by i.ordem)
      from compras_requisicao_itens i where i.requisicao_id = q.id), '[]'::jsonb)
  from compras_requisicoes q left join usuarios u on u.id = q.solicitante_id
  where tem_permissao('engenharia', 'ler') and q.projeto_id = p_projeto and q.engenharia_revisao is not null
  order by q.engenharia_revisao desc;
$$;

alter table public.projeto_eventos drop constraint projeto_eventos_tipo_check;
alter table public.projeto_eventos add constraint projeto_eventos_tipo_check check (tipo in ('criado', 'status', 'pausa', 'compra'));

do $$
declare f text;
begin
  foreach f in array array['public.engenharia_solicitar_compra(uuid, jsonb, date, text, text)', 'public.engenharia_solicitacoes(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
