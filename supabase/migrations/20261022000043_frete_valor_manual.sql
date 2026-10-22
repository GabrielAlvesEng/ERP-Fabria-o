-- Ajustes das propostas (decisão 70, 22/10/2026):
-- 1) Frete na aba Dados da proposta: CIF ou FOB. O local de entrega é sempre o endereço da empresa cliente.
-- 2) Custos: valor de venda do item digitado à mão. Quando preenchido, vale no lugar do preço calculado,
--    aparece na proposta comercial e entra na soma do valor da proposta.
set lock_timeout = '10s';

alter table public.propostas add column frete text not null default 'CIF' check (frete in ('CIF', 'FOB'));
alter table public.custo_itens add column valor_manual numeric(14,2) check (valor_manual is null or valor_manual >= 0);

-- copiar_custos leva o valor_manual para a nova revisão (o resto igual à 0024).
create or replace function public.copiar_custos(p_de uuid, p_para uuid) returns void
language plpgsql security definer set search_path = public as $$
declare it custo_itens; novo uuid;
begin
  for it in select * from custo_itens where revisao_id = p_de order by ordem, letra loop
    insert into custo_itens (revisao_id, letra, descricao, quantidade, lucro_pct, negociacao_pct, imposto_pct, imposto_modo, ordem, valor_manual)
    values (p_para, it.letra, it.descricao, it.quantidade, it.lucro_pct, it.negociacao_pct, it.imposto_pct, 'dentro', it.ordem, it.valor_manual)
    returning id into novo;
    insert into custo_linhas (item_id, secao, grupo, descricao, detalhe, detalhe2, unidade, quantidade, fator, valor_unitario, ordem, material, adicional, consumo, combustivel, bib_id, ida_volta)
    select novo, secao, grupo, descricao, detalhe, detalhe2, unidade, quantidade, fator, valor_unitario, ordem, material, adicional, consumo, combustivel, bib_id, ida_volta
    from custo_linhas where item_id = it.id;
  end loop;
  perform converter_secoes_antigas(p_para);
end;
$$;
revoke execute on function public.copiar_custos(uuid, uuid) from public, anon, authenticated;
