-- Ajustes de Vendas, entrega 3 (decisões 42 e 43): Acabamentos no lugar de Acessórios, Frota e fretes no lugar de
-- Deslocamento + Fretes, mão de obra em Administrativo/Fabricação/Instalação, imposto sempre por dentro, cadastro de veículos.
-- Só os rascunhos são convertidos; revisões enviadas ficam como foram enviadas (as seções antigas continuam aceitas).

-- 1) Novas seções e campos ------------------------------------------------------------
alter table public.custo_linhas drop constraint custo_linhas_secao_check;
alter table public.custo_linhas add constraint custo_linhas_secao_check check (secao in
  ('materiais','acabamentos','mao_obra','maquinas','frota','alimentacao','hospedagem','acessorios','deslocamento','fretes'));
alter table public.custo_linhas
  add column adicional numeric(14,2) not null default 0,   -- acabamentos: mão de obra R$; frota: pedágio por viagem
  add column consumo numeric(10,3),                        -- frota: km/l do veículo
  add column combustivel numeric(10,3);                    -- frota: R$/l

-- 2) Total calculado por gatilho (as fórmulas agora variam por seção) -----------------------
alter table public.custo_linhas disable trigger custo_linhas_auditoria;
alter table public.custo_linhas drop column total;
alter table public.custo_linhas add column total numeric(18,2) not null default 0;

create or replace function public.ajustar_linha_custo() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.secao = 'materiais' and new.grupo = 'Comerciais' then new.fator := 1; end if;
  if new.secao = 'acabamentos' then
    new.fator := 1;
    if new.grupo = 'Acabamento em inox' then new.quantidade := 1; end if;
  end if;
  if new.secao = 'frota' and new.grupo = 'Veículo próprio' then
    -- viagens × (km por viagem ÷ km/l × R$/l + pedágio por viagem)
    new.total := round(new.quantidade * (case when coalesce(new.consumo, 0) > 0 then new.fator / new.consumo * coalesce(new.combustivel, 0) else 0 end + new.adicional), 2);
  elsif new.secao = 'acabamentos' then
    new.total := round(new.quantidade * new.fator * new.valor_unitario + new.adicional, 2);
  else
    new.total := round(new.quantidade * new.fator * new.valor_unitario, 2);
  end if;
  return new;
end;
$$;
update public.custo_linhas set quantidade = quantidade; -- recalcula o total de todas as linhas (mesmo valor de antes)

-- 3) Conversão dos rascunhos ---------------------------------------------------------------
create temporary table _rasc on commit drop as
  select l.id from public.custo_linhas l join public.custo_itens i on i.id = l.item_id where public.revisao_em_rascunho(i.revisao_id);

-- Acessórios → Comerciais, com o mesmo valor (decisão 42).
update public.custo_linhas set secao = 'materiais', grupo = 'Comerciais', ordem = ordem + 1000
  where secao = 'acessorios' and id in (select id from _rasc);
-- Deslocamento e Fretes → Frota e fretes, como frete/custo terceirizado (total igual: qtd × preço).
update public.custo_linhas set secao = 'frota', grupo = 'Frete terceirizado', detalhe2 = detalhe, detalhe = ''
  where secao = 'deslocamento' and id in (select id from _rasc);
update public.custo_linhas set secao = 'frota', grupo = 'Frete terceirizado', ordem = ordem + 1000
  where secao = 'fretes' and id in (select id from _rasc);
-- Mão de obra em 3 grupos.
update public.custo_linhas set grupo = 'Administrativo'
  where secao = 'mao_obra' and grupo in ('Visita Técnica','Visita técnica','Engenharia','Segurança') and id in (select id from _rasc);
alter table public.custo_linhas enable trigger custo_linhas_auditoria;

-- Referências de mão de obra nos 3 grupos (funções repetidas ficam inativas no grupo antigo).
update public.ref_mao_obra r set etapa = 'Administrativo'
  where r.etapa in ('Engenharia','Segurança','Visita Técnica','Visita técnica')
    and not exists (select 1 from public.ref_mao_obra x where x.etapa = 'Administrativo' and x.funcao = r.funcao)
    and r.id = (select min(y.id::text)::uuid from public.ref_mao_obra y where y.funcao = r.funcao and y.etapa in ('Engenharia','Segurança','Visita Técnica','Visita técnica'));
update public.ref_mao_obra set ativo = false where etapa in ('Engenharia','Segurança','Visita Técnica','Visita técnica');

-- 4) Imposto sempre por dentro (decisão 43) -------------------------------------------------
update public.custo_itens set imposto_modo = 'dentro' where imposto_modo <> 'dentro';
alter table public.custo_itens drop constraint custo_itens_imposto_modo_check;
alter table public.custo_itens add constraint custo_itens_imposto_modo_check check (imposto_modo = 'dentro');

-- 5) Veículos e preço do combustível (Administração) ------------------------------------------
create table public.ref_veiculos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(trim(nome)) >= 2),
  consumo_km_l numeric(10,3) not null check (consumo_km_l > 0),
  ativo boolean not null default true,
  ordem integer not null default 0,
  atualizado_em timestamptz not null default now()
);
alter table public.ref_veiculos enable row level security;
create policy ref_veiculos_ler on public.ref_veiculos for select to authenticated using (tem_permissao('custos','ler') or tem_permissao('admin','editar'));
create policy ref_veiculos_admin on public.ref_veiculos for all to authenticated using (tem_permissao('admin','editar')) with check (tem_permissao('admin','editar'));
grant select, insert, update on public.ref_veiculos to authenticated;
create trigger ref_veiculos_atualizado before update on public.ref_veiculos for each row execute function tocar_atualizado_em();
create trigger ref_veiculos_auditoria after insert or update or delete on public.ref_veiculos for each row execute function registrar_auditoria();
-- O preço padrão do combustível fica em configuracoes ('combustivel_preco_padrao'), definido pela Administração.

-- 6) copiar_custos leva os campos novos (o resto igual à 0016).
create or replace function public.copiar_custos(p_de uuid, p_para uuid) returns void
language plpgsql security definer set search_path = public as $$
declare it custo_itens; novo uuid;
begin
  for it in select * from custo_itens where revisao_id = p_de order by ordem, letra loop
    insert into custo_itens (revisao_id, letra, descricao, quantidade, lucro_pct, negociacao_pct, imposto_pct, imposto_modo, ordem)
    values (p_para, it.letra, it.descricao, it.quantidade, it.lucro_pct, it.negociacao_pct, it.imposto_pct, 'dentro', it.ordem)
    returning id into novo;
    insert into custo_linhas (item_id, secao, grupo, descricao, detalhe, detalhe2, unidade, quantidade, fator, valor_unitario, ordem, material, adicional, consumo, combustivel)
    select novo, secao, grupo, descricao, detalhe, detalhe2, unidade, quantidade, fator, valor_unitario, ordem, material, adicional, consumo, combustivel
    from custo_linhas where item_id = it.id;
  end loop;
end;
$$;
revoke execute on function public.copiar_custos(uuid, uuid) from public, anon, authenticated;
