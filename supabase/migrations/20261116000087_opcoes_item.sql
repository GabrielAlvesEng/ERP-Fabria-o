-- Opções dentro do mesmo item da proposta (decisão 134, 16/11/2026).
-- Um item de custo pode ter alternativas (ex.: Inox 304 ou Inox 316L), cada uma com a sua planilha de custo.
-- A alternativa é uma linha de custo_itens com opcao_de = item principal e a mesma letra; o principal é a opção 1.
-- O total da proposta usa só os itens principais. Na aprovação fica registrado qual opção o cliente escolheu.
set lock_timeout = '10s';

alter table public.custo_itens
  add column opcao_de uuid references public.custo_itens(id) on delete cascade,
  add column opcao_nome text not null default '' check (length(opcao_nome) <= 120);
alter table public.custo_itens add constraint custo_itens_opcao_nao_aninhada check (opcao_de is null or opcao_de <> id);
create index custo_itens_opcao_de_idx on public.custo_itens (opcao_de);

-- A letra continua única entre os itens principais; as alternativas repetem a letra do principal.
alter table public.custo_itens drop constraint custo_itens_revisao_id_letra_key;
create unique index custo_itens_revisao_letra_principal on public.custo_itens (revisao_id, letra) where opcao_de is null;

-- Alternativa: o principal é da mesma revisão, tem a mesma letra e não é alternativa de outro.
create or replace function public.validar_opcao_item() returns trigger
language plpgsql security definer set search_path = public as $$
declare p custo_itens;
begin
  if new.opcao_de is null then return new; end if;
  select * into p from custo_itens where id = new.opcao_de;
  if not found or p.revisao_id <> new.revisao_id or p.opcao_de is not null then
    raise exception 'Opção inválida: o item principal precisa ser da mesma revisão.';
  end if;
  new.letra := p.letra;
  return new;
end;
$$;
create trigger custo_itens_validar_opcao before insert or update of opcao_de, letra, revisao_id on public.custo_itens
  for each row execute function public.validar_opcao_item();

-- Mudou a letra do principal: as alternativas acompanham.
create or replace function public.opcoes_seguem_letra() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.opcao_de is null and new.letra <> old.letra then
    update custo_itens set letra = new.letra where opcao_de = new.id;
  end if;
  return null;
end;
$$;
create trigger custo_itens_opcoes_letra after update of letra on public.custo_itens
  for each row execute function public.opcoes_seguem_letra();

-- copiar_custos leva as opções para a nova revisão (o resto igual à 0043).
create or replace function public.copiar_custos(p_de uuid, p_para uuid) returns void
language plpgsql security definer set search_path = public as $$
declare it custo_itens; novo uuid; mapa jsonb := '{}';
begin
  for it in select * from custo_itens where revisao_id = p_de order by (opcao_de is not null), ordem, letra, criado_em loop
    insert into custo_itens (revisao_id, letra, descricao, quantidade, lucro_pct, negociacao_pct, imposto_pct, imposto_modo, ordem, valor_manual, opcao_de, opcao_nome)
    values (p_para, it.letra, it.descricao, it.quantidade, it.lucro_pct, it.negociacao_pct, it.imposto_pct, 'dentro', it.ordem, it.valor_manual,
      (mapa->>(it.opcao_de::text))::uuid, it.opcao_nome)
    returning id into novo;
    mapa := mapa || jsonb_build_object(it.id::text, novo::text);
    insert into custo_linhas (item_id, secao, grupo, descricao, detalhe, detalhe2, unidade, quantidade, fator, valor_unitario, ordem, material, adicional, consumo, combustivel, bib_id, ida_volta)
    select novo, secao, grupo, descricao, detalhe, detalhe2, unidade, quantidade, fator, valor_unitario, ordem, material, adicional, consumo, combustivel, bib_id, ida_volta
    from custo_linhas where item_id = it.id;
  end loop;
  perform converter_secoes_antigas(p_para);
end;
$$;
revoke execute on function public.copiar_custos(uuid, uuid) from public, anon, authenticated;

-- Opção escolhida pelo cliente em cada item com alternativas: [{letra, opcao_id, opcao, valor}].
alter table public.proposta_aprovacoes add column opcoes jsonb not null default '[]' check (jsonb_typeof(opcoes) = 'array');

create or replace function public.aprovar_proposta(p_id uuid, p_dados jsonb) returns public.propostas
language plpgsql security definer set search_path = public as $$
declare v propostas; v_rev proposta_revisoes; v_de text; v_opcoes jsonb := coalesce(p_dados->'opcoes', '[]'); v_faltam text;
begin
  if not tem_permissao('vendas','aprovar') then raise exception 'Sem permissão para aprovar propostas.'; end if;
  select * into v from propostas where id = p_id and excluido_em is null for update;
  if not found then raise exception 'Proposta não encontrada.'; end if;
  if v.status not in ('Enviados','Follow-up') then raise exception 'Só propostas enviadas podem ser aprovadas.'; end if;
  if coalesce(p_dados->>'forma', '') = '' then raise exception 'Informe a forma de aprovação.'; end if;
  if coalesce(p_dados->>'comprovante_caminho', '') = '' then raise exception 'Anexe o comprovante da aprovação.'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'vendas' and name = p_dados->>'comprovante_caminho') then
    raise exception 'Comprovante não encontrado no armazenamento.';
  end if;
  select * into v_rev from proposta_revisoes where proposta_id = v.id and numero = v.revisao_atual;
  -- Decisão 134: item com opções precisa da opção escolhida (uma das opções daquele item nesta revisão).
  if jsonb_typeof(v_opcoes) <> 'array' then raise exception 'Opções inválidas.'; end if;
  select string_agg(p.letra, ', ' order by p.letra) into v_faltam
    from custo_itens p
   where p.revisao_id = v_rev.id and p.opcao_de is null and exists (select 1 from custo_itens a where a.opcao_de = p.id)
     and not exists (select 1 from jsonb_array_elements(v_opcoes) e join custo_itens o on o.id = (e->>'opcao_id')::uuid
                      where o.id = p.id or o.opcao_de = p.id);
  if v_faltam is not null then raise exception 'Escolha a opção aprovada do item %.', v_faltam; end if;
  v_de := v.status;
  insert into proposta_aprovacoes (proposta_id, revisao_id, forma, numero_documento, data_aprovacao, valor_aprovado, comprovante_caminho, comprovante_nome, observacoes, opcoes)
  values (v.id, v_rev.id, p_dados->>'forma', coalesce(p_dados->>'numero_documento', ''),
    coalesce(nullif(p_dados->>'data_aprovacao', '')::date, ano_atual_data()),
    coalesce(nullif(p_dados->>'valor_aprovado', '')::numeric, v.valor), p_dados->>'comprovante_caminho',
    coalesce(p_dados->>'comprovante_nome', ''), coalesce(p_dados->>'observacoes', ''), v_opcoes);
  perform set_config('erp.rpc', 'on', true);
  update propostas set status = 'Aprovado', proximo_followup = null where id = v.id returning * into v;
  update contatos set classificacao = 'cliente', cliente_desde = coalesce(cliente_desde, ano_atual_data())
    where id = v.contato_id and classificacao = 'lead';
  perform registrar_evento(v.id, 'aprovacao', v_de, 'Aprovado', 'Aprovada por ' || (p_dados->>'forma') || '.');
  perform set_config('erp.rpc', 'off', true);
  return v;
end;
$$;
