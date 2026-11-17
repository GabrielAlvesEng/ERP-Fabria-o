-- Decisão 143 (Gabriel, 17/11/2026): ao finalizar o projeto 26-22-009, o ERP bloqueou porque a Montagem geral não estava
-- Liberada; o Gabriel respondeu "Não precisa disso, pode liberar". Com a árvore pausada (decisão 113), liberar para
-- fabricação e finalizar deixam de exigir os conjuntos Liberados. Continua só o Chefe (engenharia.aprovar) e, para
-- finalizar, a data de término. A função conjuntos_nao_liberados fica no banco, sem uso, para quando a árvore voltar.
create or replace function public.mover_projeto(p_projeto uuid, p_status text, p_justificativa text default '', p_data date default null)
returns public.projetos
language plpgsql security definer set search_path = public as $$
declare v projetos; antes text; chefe boolean := tem_permissao('engenharia', 'aprovar');
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
