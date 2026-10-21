-- Frota completa (decisão 55, 21/10/2026): preço de gasolina, etanol e diesel com histórico; ficha completa do veículo
-- (placa, tipo, eixos, combustível, documentos, até 3 fotos); ida e volta na seção Viagem dos custos.
-- Aplicação: a ferramenta de migrations travava neste conteúdo; a parte 1 entrou como "24a_combustiveis" e o resto foi
-- aplicado em blocos pelo SQL (colunas sem as restrições, depois as restrições), com o mesmo resultado deste arquivo.
-- A atualização de "situacao" foi dispensada: os 2 veículos existentes já estavam ativos.

-- 1) Preços dos combustíveis, com histórico (o preço vigente é o mais recente de cada combustível).
create table public.combustivel_precos (
  id uuid primary key default gen_random_uuid(),
  combustivel text not null check (combustivel in ('gasolina','etanol','diesel')),
  preco numeric(10,3) not null check (preco > 0),
  vigente_desde timestamptz not null default now(),
  criado_por uuid default auth.uid()
);
create index combustivel_precos_idx on public.combustivel_precos (combustivel, vigente_desde desc);
-- O preço único que existia vira o da gasolina.
insert into public.combustivel_precos (combustivel, preco, criado_por)
select 'gasolina', (valor)::text::numeric, null from public.configuracoes
where chave = 'combustivel_preco_padrao' and (valor)::text ~ '^[0-9.]+$' and (valor)::text::numeric > 0;

create or replace view public.combustivel_precos_atuais with (security_invoker = true) as
  select distinct on (combustivel) combustivel, preco, vigente_desde from public.combustivel_precos order by combustivel, vigente_desde desc;

alter table public.combustivel_precos enable row level security;
create policy combustivel_precos_ler on public.combustivel_precos for select to authenticated using (tem_permissao('custos','ler') or tem_permissao('admin','editar'));
create policy combustivel_precos_criar on public.combustivel_precos for insert to authenticated with check (tem_permissao('admin','editar'));
grant select, insert on public.combustivel_precos to authenticated;
grant select on public.combustivel_precos_atuais to authenticated;
create trigger combustivel_precos_auditoria after insert or update or delete on public.combustivel_precos for each row execute function registrar_auditoria();

-- 2) Ficha completa do veículo.
alter table public.ref_veiculos
  add column placa text not null default '',
  add column tipo text not null default 'carro' check (tipo in ('carro','utilitario','caminhao','munck','outro')),
  add column marca text not null default '',
  add column modelo text not null default '',
  add column ano integer check (ano is null or ano between 1950 and 2100),
  add column cor text not null default '',
  add column renavam text not null default '',
  add column chassi text not null default '',
  add column eixos integer not null default 2 check (eixos between 2 and 9),
  add column combustivel text not null default 'flex' check (combustivel in ('gasolina','etanol','diesel','flex')),
  add column capacidade_kg numeric(10,1) check (capacidade_kg is null or capacidade_kg >= 0),
  add column passageiros integer check (passageiros is null or passageiros >= 0),
  add column licenciamento_vence date,
  add column seguro_vence date,
  add column revisao_km integer check (revisao_km is null or revisao_km >= 0),
  add column revisao_data date,
  add column situacao text not null default 'ativo' check (situacao in ('ativo','manutencao','vendido')),
  add column observacoes text not null default '';
create unique index ref_veiculos_placa_unica on public.ref_veiculos (upper(placa)) where placa <> '';
-- "ativo" continua sendo o que a proposta usa: só veículo em situação ativo aparece nos custos.
create or replace function public.sincronizar_veiculo_ativo() returns trigger
language plpgsql set search_path = public as $$
begin
  new.ativo := new.situacao = 'ativo';
  new.placa := upper(trim(new.placa));
  return new;
end;
$$;
create trigger ref_veiculos_situacao before insert or update on public.ref_veiculos for each row execute function sincronizar_veiculo_ativo();

-- 3) Fotos dos veículos (no máximo 3 por veículo), no bucket privado "frota": veiculos/{veiculo_id}/{arquivo}.
create table public.veiculo_fotos (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.ref_veiculos(id),
  caminho text not null unique,
  nome text not null default '',
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);
create or replace function public.limitar_fotos_veiculo() returns trigger
language plpgsql set search_path = public as $$
begin
  if (select count(*) from veiculo_fotos where veiculo_id = new.veiculo_id) >= 3 then
    raise exception 'Cada veículo pode ter no máximo 3 fotos.';
  end if;
  return new;
end;
$$;
create trigger veiculo_fotos_limite before insert on public.veiculo_fotos for each row execute function limitar_fotos_veiculo();
alter table public.veiculo_fotos enable row level security;
create policy veiculo_fotos_ler on public.veiculo_fotos for select to authenticated using (tem_permissao('custos','ler') or tem_permissao('admin','editar'));
create policy veiculo_fotos_criar on public.veiculo_fotos for insert to authenticated with check (tem_permissao('admin','editar'));
create policy veiculo_fotos_remover on public.veiculo_fotos for delete to authenticated using (tem_permissao('admin','editar'));
grant select, insert, delete on public.veiculo_fotos to authenticated;
create trigger veiculo_fotos_auditoria after insert or update or delete on public.veiculo_fotos for each row execute function registrar_auditoria();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('frota', 'frota', false, 5242880, array['image/jpeg','image/png','image/webp']) on conflict (id) do nothing;
create policy frota_ler on storage.objects for select to authenticated
  using (bucket_id = 'frota' and (public.tem_permissao('custos','ler') or public.tem_permissao('admin','editar')));
create policy frota_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'frota' and (storage.foldername(name))[1] = 'veiculos' and public.tem_permissao('admin','editar'));
create policy frota_remover on storage.objects for delete to authenticated
  using (bucket_id = 'frota' and public.tem_permissao('admin','editar'));

-- 4) Ida e volta na seção Viagem: km e pedágio contam 2 vezes.
alter table public.custo_linhas add column ida_volta boolean not null default false;

create or replace function public.ajustar_linha_custo() returns trigger
language plpgsql set search_path = public as $$
declare v_comb numeric; v_mult numeric;
begin
  if new.secao = 'materiais' and new.grupo in ('Comerciais','Fixadores','Consumíveis') then new.fator := 1; end if;
  if new.secao in ('acabamentos','frete') then new.fator := 1; end if;
  if new.secao = 'acabamentos' and new.grupo = 'Acabamento em inox' then new.quantidade := 1; end if;
  if new.secao = 'viagem' and new.grupo = 'Hospedagem' then new.fator := 1; end if;
  v_mult := case when new.ida_volta then 2 else 1 end;
  -- combustível do trecho: km ÷ km/l × R$/l
  v_comb := case when coalesce(new.consumo, 0) > 0 then new.fator / new.consumo * coalesce(new.combustivel, 0) else 0 end;

  if new.grupo = 'Veículo próprio' and new.secao in ('viagem','frota') then
    -- viagens × (combustível + pedágio), × 2 na ida e volta
    new.total := round(new.quantidade * (v_comb + new.adicional) * v_mult, 2);
  elsif new.secao = 'viagem' and new.grupo = 'Veículo alugado' then
    -- diárias × diária + (combustível do km + pedágio), × 2 na ida e volta
    new.total := round(new.quantidade * new.valor_unitario + (v_comb + new.adicional) * v_mult, 2);
  elsif new.secao = 'acabamentos' then
    new.total := round(new.quantidade * new.fator * new.valor_unitario + new.adicional, 2);
  else
    new.total := round(new.quantidade * new.fator * new.valor_unitario, 2);
  end if;
  return new;
end;
$$;

-- copiar_custos leva o ida_volta (o resto igual à 0020).
create or replace function public.copiar_custos(p_de uuid, p_para uuid) returns void
language plpgsql security definer set search_path = public as $$
declare it custo_itens; novo uuid;
begin
  for it in select * from custo_itens where revisao_id = p_de order by ordem, letra loop
    insert into custo_itens (revisao_id, letra, descricao, quantidade, lucro_pct, negociacao_pct, imposto_pct, imposto_modo, ordem)
    values (p_para, it.letra, it.descricao, it.quantidade, it.lucro_pct, it.negociacao_pct, it.imposto_pct, 'dentro', it.ordem)
    returning id into novo;
    insert into custo_linhas (item_id, secao, grupo, descricao, detalhe, detalhe2, unidade, quantidade, fator, valor_unitario, ordem, material, adicional, consumo, combustivel, bib_id, ida_volta)
    select novo, secao, grupo, descricao, detalhe, detalhe2, unidade, quantidade, fator, valor_unitario, ordem, material, adicional, consumo, combustivel, bib_id, ida_volta
    from custo_linhas where item_id = it.id;
  end loop;
  perform converter_secoes_antigas(p_para);
end;
$$;
revoke execute on function public.copiar_custos(uuid, uuid) from public, anon, authenticated;
