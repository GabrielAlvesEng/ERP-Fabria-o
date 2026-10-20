-- Ajustes de Vendas, entrega 1 (decisões 39 e 44).
-- 1) Kanban sem coluna Follow-up: não se move mais para "Follow-up" (o valor continua aceito no histórico).
-- 2) Validade da proposta em dias; a data é calculada a partir da emissão.
-- 3) Código semi-automático: o ERP sugere, o usuário pode editar; bloqueia repetido ou fora do formato.

-- 2) Validade em dias ------------------------------------------------------------
alter table public.propostas add column validade_dias integer check (validade_dias is null or validade_dias between 1 and 3650);
update public.propostas set validade_dias = validade - data_emissao where validade is not null and validade > data_emissao;

-- Roda antes de propostas_proteger (ordem alfabética dos gatilhos), para que a proteção de proposta enviada
-- também enxergue a mudança de validade.
create or replace function public.calcular_validade() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.validade_dias is not null then new.validade := new.data_emissao + new.validade_dias;
  elsif tg_op = 'UPDATE' and old.validade_dias is not null then new.validade := null;
  end if;
  return new;
end;
$$;
create trigger propostas_a_validade before insert or update on public.propostas for each row execute function public.calcular_validade();

-- 3) Código sugerido (sem consumir número) ------------------------------------------
create or replace function public.sugerir_codigo_proposta(p_contato uuid, p_ano integer) returns text
language plpgsql stable security definer set search_path = public as $$
declare v_cc integer; v_seq integer;
begin
  if not tem_permissao('vendas','criar') then raise exception 'Sem permissão.'; end if;
  select codigo_comercial into v_cc from contato_anos where contato_id = p_contato and ano = p_ano;
  if v_cc is null then select coalesce(max(ultimo_valor), 0) + 1 into v_cc from contadores_contato where ano = p_ano; end if;
  select coalesce(max(ultimo_valor), 0) + 1 into v_seq from contadores_proposta where ano = p_ano and contato_id = p_contato;
  return right(p_ano::text, 2) || '-' || lpad(v_cc::text, 2, '0') || '-' || lpad(v_seq::text, 3, '0');
end;
$$;
revoke execute on function public.sugerir_codigo_proposta(uuid, integer) from public, anon;
grant execute on function public.sugerir_codigo_proposta(uuid, integer) to authenticated;

-- criar_proposta aceita "codigo" (editado pelo usuário) e "validade_dias". Sem "codigo", segue automático (igual à 0002).
create or replace function public.criar_proposta(p_dados jsonb) returns public.propostas
language plpgsql security definer set search_path = public as $$
declare
  v_ano integer := coalesce((p_dados->>'ano')::integer, ano_atual());
  v_contato contatos;
  v_cc integer; v_seq integer; v_prop propostas;
  v_codigo text := upper(trim(coalesce(p_dados->>'codigo', '')));
begin
  if not tem_permissao('vendas','criar') then raise exception 'Sem permissão para criar propostas.'; end if;
  select * into v_contato from contatos where id = (p_dados->>'contato_id')::uuid and excluido_em is null;
  if not found then raise exception 'Selecione um contato cadastrado.'; end if;
  if v_contato.empresa_id <> (p_dados->>'empresa_id')::uuid then raise exception 'O contato não pertence à empresa escolhida.'; end if;
  v_cc := garantir_contato_ano(v_contato.id, v_ano, 'proposta');

  if v_codigo = '' then
    insert into contadores_proposta (ano, contato_id, ultimo_valor) values (v_ano, v_contato.id, 1)
    on conflict (ano, contato_id) do update set ultimo_valor = contadores_proposta.ultimo_valor + 1
    returning ultimo_valor into v_seq;
    v_codigo := right(v_ano::text, 2) || '-' || lpad(v_cc::text, 2, '0') || '-' || lpad(v_seq::text, 3, '0');
  else
    -- Código editado (decisão 44): formato AA-CC-NNN, ano da proposta, sem repetir (inclusive excluídas).
    if v_codigo !~ '^[0-9]{2}-[0-9]{2,}-[0-9]{3,}$' then raise exception 'Código fora do formato AA-CC-NNN (ex.: 26-04-003).'; end if;
    if split_part(v_codigo, '-', 1) <> right(v_ano::text, 2) then raise exception 'O código deve começar com o ano da proposta (%).', right(v_ano::text, 2); end if;
    if exists (select 1 from propostas where codigo = v_codigo) then raise exception 'Já existe uma proposta com o código %.', v_codigo; end if;
    v_seq := split_part(v_codigo, '-', 3)::integer;
    if v_seq < 1 then raise exception 'O número da proposta (NNN) deve ser maior que zero.'; end if;
    if exists (select 1 from propostas where ano = v_ano and contato_numeracao_id = v_contato.id and sequencial = v_seq) then
      raise exception 'Este contato já tem a proposta número % em %. Use outro número.', lpad(v_seq::text, 3, '0'), v_ano;
    end if;
    -- A sequência do contato continua do maior número usado.
    insert into contadores_proposta (ano, contato_id, ultimo_valor) values (v_ano, v_contato.id, v_seq)
    on conflict (ano, contato_id) do update set ultimo_valor = greatest(contadores_proposta.ultimo_valor, v_seq);
  end if;

  perform set_config('erp.rpc', 'on', true);
  insert into propostas (codigo, ano, contato_numeracao_id, sequencial, empresa_id, contato_id, titulo, descricao,
    responsavel_id, valor, prazo_previsto, validade, validade_dias, condicoes_comerciais, observacoes)
  values (
    v_codigo, v_ano, v_contato.id, v_seq, v_contato.empresa_id, v_contato.id,
    p_dados->>'titulo', coalesce(p_dados->>'descricao', ''),
    coalesce(nullif(p_dados->>'responsavel_id', '')::uuid, auth.uid()),
    coalesce(nullif(p_dados->>'valor', '')::numeric, 0), coalesce(p_dados->>'prazo_previsto', ''),
    nullif(p_dados->>'validade', '')::date, nullif(p_dados->>'validade_dias', '')::integer,
    coalesce(p_dados->>'condicoes_comerciais', ''), coalesce(p_dados->>'observacoes', ''))
  returning * into v_prop;
  insert into proposta_revisoes (proposta_id, numero) values (v_prop.id, 0);
  perform registrar_evento(v_prop.id, 'criacao', null, 'À enviar',
    'Proposta criada (R0)' || case when p_dados->>'codigo' is not null and p_dados->>'codigo' <> '' then ', código definido pelo usuário.' else '.' end);
  perform set_config('erp.rpc', 'off', true);
  return v_prop;
end;
$$;

-- 1) mover_proposta sem destino "Follow-up" (o resto igual à 0005).
create or replace function public.mover_proposta(p_id uuid, p_para text, p_dados jsonb default '{}')
returns public.propostas language plpgsql security definer set search_path = public as $$
declare
  v propostas; v_de text; v_rev proposta_revisoes; v_novo integer; v_nova_rev uuid; v_dias integer; v_just text := coalesce(p_dados->>'justificativa', '');
begin
  select * into v from propostas where id = p_id and excluido_em is null for update;
  if not found then raise exception 'Proposta não encontrada.'; end if;
  v_de := v.status;
  if v_de = p_para then return v; end if;
  if p_para = 'Follow-up' then raise exception 'A coluna Follow-up foi retirada. Registre o follow-up na proposta enviada.'; end if;
  select * into v_rev from proposta_revisoes where proposta_id = v.id and numero = v.revisao_atual;
  perform set_config('erp.rpc', 'on', true);

  if p_para in ('Aprovado','Reprovado') and v_de in ('Enviados','Follow-up') then
    raise exception 'Use o formulário de % para registrar os dados obrigatórios.', lower(p_para);

  elsif v_de = 'À enviar' and p_para = 'Enviados' then
    if not tem_permissao('vendas','editar') then raise exception 'Sem permissão para enviar propostas.'; end if;
    select coalesce((valor)::text::integer, 5) into v_dias from configuracoes where chave = 'followup_prazo_padrao_dias';
    update proposta_revisoes set status = 'enviada', dados = to_jsonb(v), valor = v.valor,
      enviada_em = coalesce(nullif(p_dados->>'data_envio', '')::date, ano_atual_data()), enviada_por = auth.uid()
      where id = v_rev.id;
    update propostas set status = 'Enviados',
      proximo_followup = coalesce(nullif(p_dados->>'proximo_followup', '')::date, ano_atual_data() + coalesce(v_dias, 5))
      where id = v.id returning * into v;

  elsif v_de = 'Follow-up' and p_para = 'Enviados' then
    -- Propostas antigas que ficaram em Follow-up voltam para Enviados.
    if not tem_permissao('vendas','editar') then raise exception 'Sem permissão.'; end if;
    update propostas set status = p_para where id = v.id returning * into v;

  elsif v_de in ('Enviados','Follow-up','Reprovado') and p_para = 'À enviar' then
    if not tem_permissao('vendas','editar') then raise exception 'Sem permissão.'; end if;
    v_novo := v.revisao_atual + 1;
    insert into proposta_revisoes (proposta_id, numero, motivo) values (v.id, v_novo, v_just) returning id into v_nova_rev;
    perform copiar_custos(v_rev.id, v_nova_rev);
    update propostas set status = 'À enviar', revisao_atual = v_novo, proximo_followup = null where id = v.id returning * into v;
    perform registrar_evento(v.id, 'revisao', v_de, p_para, 'Nova revisão R' || v_novo || ' criada (custos copiados da R' || (v_novo - 1) || ').', jsonb_build_object('motivo', v_just));

  elsif (v_de = 'Aprovado' and p_para = 'Finalizado') or (v_de = 'Finalizado' and p_para = 'Emitido NF') or (v_de = 'Emitido NF' and p_para = 'Pago') then
    if not tem_permissao('financeiro','editar') then raise exception 'Somente o Financeiro move para %.', p_para; end if;
    update propostas set status = p_para where id = v.id returning * into v;

  elsif v_de in ('Aprovado','Finalizado','Emitido NF','Pago') then
    if not tem_acesso_total() then raise exception 'Somente a Administração pode voltar uma proposta aprovada.'; end if;
    if length(trim(v_just)) < 5 then raise exception 'Informe a justificativa para voltar a etapa.'; end if;
    if p_para not in ('Aprovado','Finalizado','Emitido NF','Enviados') then raise exception 'Transição não permitida.'; end if;
    update propostas set status = p_para where id = v.id returning * into v;

  else
    raise exception 'Não é permitido mover de "%" para "%".', v_de, p_para;
  end if;

  if not (v_de in ('Enviados','Follow-up','Reprovado') and p_para = 'À enviar') then
    perform registrar_evento(v.id, 'status', v_de, p_para, coalesce(nullif(p_dados->>'observacao', ''), v_de || ' → ' || p_para),
      case when v_just <> '' then jsonb_build_object('justificativa', v_just) else '{}' end);
  end if;
  perform set_config('erp.rpc', 'off', true);
  return v;
end;
$$;
