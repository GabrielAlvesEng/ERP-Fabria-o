-- Custos reorganizados (decisão 50, 20/10/2026): A Materiais (+ Fixadores e Consumíveis), B Acabamentos, C Frete terceirizado,
-- D Mão de obra, E Máquinas (terceirizada → fornecedor; própria → maquinário), F Viagem (veículo próprio, veículo alugado,
-- alimentação, hospedagem). Só os rascunhos são convertidos; revisões enviadas ficam como foram enviadas.

-- 1) Seções novas e ligação com a biblioteca -------------------------------------------------
alter table public.custo_linhas drop constraint custo_linhas_secao_check;
alter table public.custo_linhas add constraint custo_linhas_secao_check check (secao in
  ('materiais','acabamentos','frete','mao_obra','maquinas','viagem',
   'frota','alimentacao','hospedagem','acessorios','deslocamento','fretes'));   -- as do fim só em revisões enviadas
alter table public.custo_linhas add column bib_id uuid;   -- item da Biblioteca de Materiais escolhido (chapa, perfil ou item), para Engenharia e Compras

-- 2) Fórmulas (mesmas de regras.ts) ---------------------------------------------------------
create or replace function public.ajustar_linha_custo() returns trigger
language plpgsql set search_path = public as $$
declare v_comb numeric;
begin
  if new.secao = 'materiais' and new.grupo in ('Comerciais','Fixadores','Consumíveis') then new.fator := 1; end if;
  if new.secao in ('acabamentos','frete') then new.fator := 1; end if;
  if new.secao = 'acabamentos' and new.grupo = 'Acabamento em inox' then new.quantidade := 1; end if;
  if new.secao = 'viagem' and new.grupo = 'Hospedagem' then new.fator := 1; end if;
  -- combustível do trecho: km ÷ km/l × R$/l
  v_comb := case when coalesce(new.consumo, 0) > 0 then new.fator / new.consumo * coalesce(new.combustivel, 0) else 0 end;

  if new.grupo = 'Veículo próprio' and new.secao in ('viagem','frota') then
    -- viagens × (combustível por viagem + pedágio por viagem)
    new.total := round(new.quantidade * (v_comb + new.adicional), 2);
  elsif new.secao = 'viagem' and new.grupo = 'Veículo alugado' then
    -- diárias × valor da diária + combustível do km total + pedágio total
    new.total := round(new.quantidade * new.valor_unitario + v_comb + new.adicional, 2);
  elsif new.secao = 'acabamentos' then
    new.total := round(new.quantidade * new.fator * new.valor_unitario + new.adicional, 2);
  else
    new.total := round(new.quantidade * new.fator * new.valor_unitario, 2);
  end if;
  return new;
end;
$$;

-- 3) Conversão das seções antigas de uma revisão em rascunho (decisões 42 e 50), sem mudar valores.
--    Usada agora nos rascunhos e, daqui em diante, ao copiar custos para uma nova revisão.
create or replace function public.converter_secoes_antigas(p_revisao uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not revisao_em_rascunho(p_revisao) then return; end if;
  -- Acessórios → Comerciais (decisão 42).
  update custo_linhas l set secao = 'materiais', grupo = 'Comerciais' from custo_itens i
    where i.id = l.item_id and i.revisao_id = p_revisao and l.secao = 'acessorios';
  -- Deslocamento e Fretes antigos → Frete terceirizado.
  update custo_linhas l set secao = 'frete', grupo = '', detalhe2 = case when l.secao = 'deslocamento' then l.detalhe else l.detalhe2 end,
      detalhe = case when l.secao = 'deslocamento' then '' else l.detalhe end
    from custo_itens i where i.id = l.item_id and i.revisao_id = p_revisao and l.secao in ('deslocamento','fretes');
  -- Frota e fretes → Viagem (veículo próprio) e Frete terceirizado (o resto).
  update custo_linhas l set secao = 'viagem' from custo_itens i
    where i.id = l.item_id and i.revisao_id = p_revisao and l.secao = 'frota' and l.grupo = 'Veículo próprio';
  update custo_linhas l set secao = 'frete', grupo = '' from custo_itens i
    where i.id = l.item_id and i.revisao_id = p_revisao and l.secao = 'frota';
  -- Alimentação e Hospedagem → Viagem.
  update custo_linhas l set secao = 'viagem', grupo = 'Alimentação' from custo_itens i
    where i.id = l.item_id and i.revisao_id = p_revisao and l.secao = 'alimentacao';
  update custo_linhas l set secao = 'viagem', grupo = 'Hospedagem' from custo_itens i
    where i.id = l.item_id and i.revisao_id = p_revisao and l.secao = 'hospedagem';
  -- Mão de obra em 3 grupos (decisão 42).
  update custo_linhas l set grupo = 'Administrativo' from custo_itens i
    where i.id = l.item_id and i.revisao_id = p_revisao and l.secao = 'mao_obra' and l.grupo in ('Visita Técnica','Visita técnica','Engenharia','Segurança');
  -- Máquina terceirizada sem fornecedor: "A definir" até trocar.
  update custo_linhas l set detalhe2 = 'A definir' from custo_itens i
    where i.id = l.item_id and i.revisao_id = p_revisao and l.secao = 'maquinas' and l.detalhe = 'Sim' and l.detalhe2 = '';
end;
$$;
revoke execute on function public.converter_secoes_antigas(uuid) from public, anon, authenticated;

select public.converter_secoes_antigas(r.id) from public.proposta_revisoes r where r.status = 'rascunho';

-- 4) copiar_custos leva o bib_id e converte as seções antigas na nova revisão (o resto igual à 0017) ---------------------------------------
create or replace function public.copiar_custos(p_de uuid, p_para uuid) returns void
language plpgsql security definer set search_path = public as $$
declare it custo_itens; novo uuid;
begin
  for it in select * from custo_itens where revisao_id = p_de order by ordem, letra loop
    insert into custo_itens (revisao_id, letra, descricao, quantidade, lucro_pct, negociacao_pct, imposto_pct, imposto_modo, ordem)
    values (p_para, it.letra, it.descricao, it.quantidade, it.lucro_pct, it.negociacao_pct, it.imposto_pct, 'dentro', it.ordem)
    returning id into novo;
    insert into custo_linhas (item_id, secao, grupo, descricao, detalhe, detalhe2, unidade, quantidade, fator, valor_unitario, ordem, material, adicional, consumo, combustivel, bib_id)
    select novo, secao, grupo, descricao, detalhe, detalhe2, unidade, quantidade, fator, valor_unitario, ordem, material, adicional, consumo, combustivel, bib_id
    from custo_linhas where item_id = it.id;
  end loop;
  perform converter_secoes_antigas(p_para);
end;
$$;
revoke execute on function public.copiar_custos(uuid, uuid) from public, anon, authenticated;
