-- Ajustes de Vendas, entrega 2 (decisão 41): materiais em Chapas, Perfis e Comerciais, coluna Material, kg/m dos perfis.

-- Lista de preços: material (catálogo COD_MAT) e kg/m (para o peso de perfis; preenchido aos poucos).
alter table public.ref_materiais
  add column cod_mat text references public.catalogo_materiais(cod_mat),
  add column kg_m numeric(10,4) check (kg_m is null or kg_m > 0);

-- Preenche o material pelo nome dos itens que já existem (316 antes de 304, para não confundir).
update public.ref_materiais set cod_mat = case
    when descricao ~* '316' then 'IN-004'
    when descricao ~* '304' then 'IN-001'
    when descricao ~* 'SAE ?1020' then 'AC-003'
    when descricao ~* 'A ?36' then 'AC-008'
  end
where cod_mat is null;

-- Linha de custo: material escolhido (texto livre ou "IN-001 — AISI 304" do catálogo).
alter table public.custo_linhas add column material text not null default '';
update public.custo_linhas l set material = r.cod_mat || ' — ' || c.nome
from public.ref_materiais r join public.catalogo_materiais c on c.cod_mat = r.cod_mat
where l.secao = 'materiais' and l.material = '' and r.descricao = l.descricao and (r.tipo = l.grupo or l.grupo = '');

-- Materiais sem tipo vão para Comerciais (os blocos da tela são Chapas, Perfis e Comerciais).
update public.custo_linhas set grupo = 'Comerciais' where secao = 'materiais' and grupo not in ('Chapas','Perfis','Comerciais');

-- Comerciais contam só a quantidade de itens: fator sempre 1.
create or replace function public.ajustar_linha_custo() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.secao = 'materiais' and new.grupo = 'Comerciais' then new.fator := 1; end if;
  return new;
end;
$$;
create trigger custo_linhas_ajustar before insert or update on public.custo_linhas for each row execute function public.ajustar_linha_custo();

-- copiar_custos passa a levar o material (o resto igual à 0005).
create or replace function public.copiar_custos(p_de uuid, p_para uuid) returns void
language plpgsql security definer set search_path = public as $$
declare it custo_itens; novo uuid;
begin
  for it in select * from custo_itens where revisao_id = p_de order by ordem, letra loop
    insert into custo_itens (revisao_id, letra, descricao, quantidade, lucro_pct, negociacao_pct, imposto_pct, imposto_modo, ordem)
    values (p_para, it.letra, it.descricao, it.quantidade, it.lucro_pct, it.negociacao_pct, it.imposto_pct, it.imposto_modo, it.ordem)
    returning id into novo;
    insert into custo_linhas (item_id, secao, grupo, descricao, detalhe, detalhe2, unidade, quantidade, fator, valor_unitario, ordem, material)
    select novo, secao, grupo, descricao, detalhe, detalhe2, unidade, quantidade, fator, valor_unitario, ordem, material
    from custo_linhas where item_id = it.id;
  end loop;
end;
$$;
revoke execute on function public.copiar_custos(uuid, uuid) from public, anon, authenticated;
