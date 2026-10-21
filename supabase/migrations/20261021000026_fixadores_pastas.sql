set lock_timeout = '10s';
-- Fixadores em pastas (decisão 58, 21/10/2026): tipo → material → tamanhos. Valor por peça.
-- Os itens continuam em bib_itens (grupo Fixadores), então os custos seguem ligados pelo bib_id.
-- A descrição é montada pelo banco: "<tipo> <medida> x <comprimento> <material>".

create table public.bib_fixador_tipos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(trim(nome)) >= 2),
  rotulo_a text not null default 'Rosca',        -- 1ª medida (rosca, diâmetro, eixo, furo)
  rotulo_b text,                                  -- 2ª medida (comprimento); vazio = tipo sem comprimento
  ordem integer not null default 0,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);
create table public.bib_fixador_materiais (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(trim(nome)) >= 2),
  ordem integer not null default 0,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);
-- Pastas de material de cada tipo (nem todo tipo tem os 4 materiais).
create table public.bib_fixador_tipo_materiais (
  tipo_id uuid not null references public.bib_fixador_tipos(id),
  material_id uuid not null references public.bib_fixador_materiais(id),
  ativo boolean not null default true,
  primary key (tipo_id, material_id)
);

alter table public.bib_itens
  add column fixador_tipo_id uuid references public.bib_fixador_tipos(id),
  add column fixador_material_id uuid references public.bib_fixador_materiais(id),
  add column medida text not null default '',
  add column comprimento text not null default '';
alter table public.bib_itens add constraint bib_itens_fixador_completo
  check ((fixador_tipo_id is null) = (fixador_material_id is null) and (fixador_tipo_id is null or (grupo = 'Fixadores' and medida <> '')));
create unique index bib_itens_fixador_unico on public.bib_itens (fixador_tipo_id, fixador_material_id, medida, comprimento) where fixador_tipo_id is not null;

create or replace function public.montar_descricao_fixador() returns trigger
language plpgsql set search_path = public as $fn$
declare t text; m text;
begin
  if new.fixador_tipo_id is null then return new; end if;
  select nome into t from bib_fixador_tipos where id = new.fixador_tipo_id;
  select nome into m from bib_fixador_materiais where id = new.fixador_material_id;
  new.grupo := 'Fixadores';
  new.medida := trim(new.medida);
  new.comprimento := trim(new.comprimento);
  new.material := m;
  new.descricao := t || ' ' || new.medida || case when new.comprimento <> '' then ' x ' || new.comprimento else '' end || ' ' || m;
  return new;
end;
$fn$;
create trigger bib_itens_fixador before insert or update on public.bib_itens for each row execute function montar_descricao_fixador();

-- Renomear tipo ou material atualiza a descrição dos itens.
create or replace function public.renomear_fixadores() returns trigger
language plpgsql set search_path = public as $fn$
begin
  if new.nome is distinct from old.nome then
    if tg_table_name = 'bib_fixador_tipos' then update bib_itens set medida = medida where fixador_tipo_id = new.id;
    else update bib_itens set medida = medida where fixador_material_id = new.id; end if;
  end if;
  return new;
end;
$fn$;
create trigger bib_fixador_tipos_renomear after update on public.bib_fixador_tipos for each row execute function renomear_fixadores();
create trigger bib_fixador_materiais_renomear after update on public.bib_fixador_materiais for each row execute function renomear_fixadores();

do $$
declare t text;
begin
  foreach t in array array['bib_fixador_tipos','bib_fixador_materiais','bib_fixador_tipo_materiais'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (tem_permissao(''custos'',''ler'') or tem_permissao(''engenharia'',''ler'') or tem_permissao(''admin'',''editar''))', t || '_ler', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (tem_permissao(''admin'',''editar''))', t || '_criar', t);
    execute format('create policy %I on public.%I for update to authenticated using (tem_permissao(''admin'',''editar'')) with check (tem_permissao(''admin'',''editar''))', t || '_editar', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function registrar_auditoria()', t || '_auditoria', t);
  end loop;
end $$;
create trigger bib_fixador_tipos_atualizado before update on public.bib_fixador_tipos for each row execute function tocar_atualizado_em();
create trigger bib_fixador_materiais_atualizado before update on public.bib_fixador_materiais for each row execute function tocar_atualizado_em();

-- Carga: tipos na ordem das pastas da empresa, materiais e a grade de tamanhos comum (sem preço).
insert into public.bib_fixador_tipos (nome, rotulo_a, rotulo_b, ordem) values
  ('Parafuso Sextavado', 'Rosca', 'Comprimento', 1),
  ('Parafuso Allen Cab. Cilíndrica', 'Rosca', 'Comprimento', 2),
  ('Parafuso Allen Cab. Chata', 'Rosca', 'Comprimento', 3),
  ('Parafuso Allen Cab. Abaulada', 'Rosca', 'Comprimento', 4),
  ('Porca Sextavada', 'Rosca', null, 5),
  ('Porca Parlock', 'Rosca', null, 6),
  ('Porca Cab. Abaulada', 'Rosca', null, 7),
  ('Porca Rebite', 'Rosca', null, 8),
  ('Cupilha', 'Diâmetro', 'Comprimento', 9),
  ('Arruela Lisa', 'Rosca', null, 10),
  ('Arruela de Pressão', 'Rosca', null, 11),
  ('Parabolt PBA', 'Rosca', 'Comprimento', 12),
  ('Anel de Trava E', 'Eixo', null, 13),
  ('Anel de Trava I', 'Furo', null, 14),
  ('Grampo Tipo U', 'Rosca', 'Tubo / largura', 15);
insert into public.bib_fixador_materiais (nome, ordem) values
  ('Inox 304', 1), ('Zincado', 2), ('Bicromatizado', 3), ('Preto', 4), ('Alumínio', 5), ('Aço mola', 6);

-- Materiais de cada tipo: os 4 para a maioria; recomendação para os demais (editável na tela).
insert into public.bib_fixador_tipo_materiais (tipo_id, material_id)
select t.id, m.id from bib_fixador_tipos t join bib_fixador_materiais m on
  case
    when t.nome like 'Anel de Trava%' then m.nome = 'Aço mola'
    when t.nome = 'Porca Rebite' then m.nome in ('Inox 304', 'Zincado', 'Alumínio')
    when t.nome = 'Cupilha' then m.nome in ('Inox 304', 'Zincado')
    when t.nome = 'Parabolt PBA' then m.nome in ('Inox 304', 'Zincado', 'Bicromatizado')
    else m.nome in ('Inox 304', 'Zincado', 'Bicromatizado', 'Preto')
  end;

-- Grade: (tipos, medida, comprimentos). Métrico e polegada.
create temporary table grade (tipos text[], medida text, comprimentos text[]) on commit drop;
insert into grade values
  (array['Parafuso Sextavado','Parafuso Allen Cab. Cilíndrica','Parafuso Allen Cab. Chata','Parafuso Allen Cab. Abaulada'], 'M5', array['10','12','16','20','25','30','35','40','50']),
  (array['Parafuso Sextavado','Parafuso Allen Cab. Cilíndrica','Parafuso Allen Cab. Chata','Parafuso Allen Cab. Abaulada'], 'M6', array['10','12','16','20','25','30','35','40','45','50','60']),
  (array['Parafuso Sextavado','Parafuso Allen Cab. Cilíndrica','Parafuso Allen Cab. Chata','Parafuso Allen Cab. Abaulada'], 'M8', array['12','16','20','25','30','35','40','45','50','60','70','80']),
  (array['Parafuso Sextavado','Parafuso Allen Cab. Cilíndrica','Parafuso Allen Cab. Chata','Parafuso Allen Cab. Abaulada'], 'M10', array['16','20','25','30','35','40','45','50','60','70','80','90','100']),
  (array['Parafuso Sextavado','Parafuso Allen Cab. Cilíndrica','Parafuso Allen Cab. Chata','Parafuso Allen Cab. Abaulada'], 'M12', array['20','25','30','35','40','45','50','60','70','80','90','100']),
  (array['Parafuso Sextavado','Parafuso Allen Cab. Cilíndrica','Parafuso Allen Cab. Chata'], 'M14', array['25','30','35','40','45','50','60','70','80','90','100']),
  (array['Parafuso Sextavado','Parafuso Allen Cab. Cilíndrica','Parafuso Allen Cab. Chata','Parafuso Allen Cab. Abaulada'], 'M16', array['25','30','35','40','45','50','60','70','80','90','100']),
  (array['Parafuso Sextavado','Parafuso Allen Cab. Cilíndrica','Parafuso Allen Cab. Chata'], 'M20', array['30','35','40','45','50','60','70','80','90','100']),
  (array['Parafuso Sextavado','Parafuso Allen Cab. Cilíndrica'], '1/4"', array['1/2"','3/4"','1"','1.1/4"','1.1/2"','2"']),
  (array['Parafuso Sextavado','Parafuso Allen Cab. Cilíndrica'], '5/16"', array['1/2"','3/4"','1"','1.1/4"','1.1/2"','2"','2.1/2"']),
  (array['Parafuso Sextavado','Parafuso Allen Cab. Cilíndrica'], '3/8"', array['3/4"','1"','1.1/4"','1.1/2"','2"','2.1/2"','3"']),
  (array['Parafuso Sextavado','Parafuso Allen Cab. Cilíndrica'], '1/2"', array['1"','1.1/4"','1.1/2"','2"','2.1/2"','3"','3.1/2"','4"']),
  (array['Parafuso Sextavado','Parafuso Allen Cab. Cilíndrica'], '5/8"', array['1.1/2"','2"','2.1/2"','3"','3.1/2"','4"']),
  (array['Parafuso Sextavado','Parafuso Allen Cab. Cilíndrica'], '3/4"', array['2"','2.1/2"','3"','3.1/2"','4"']),
  (array['Cupilha'], '1,6', array['16','20','25']),
  (array['Cupilha'], '2', array['20','25','32']),
  (array['Cupilha'], '2,5', array['25','32','40']),
  (array['Cupilha'], '3,2', array['32','40','50']),
  (array['Cupilha'], '4', array['40','50','63']),
  (array['Cupilha'], '5', array['50','63','80']),
  (array['Parabolt PBA'], '1/4"', array['2.1/4"']),
  (array['Parabolt PBA'], '5/16"', array['3"']),
  (array['Parabolt PBA'], '3/8"', array['3"','3.3/4"']),
  (array['Parabolt PBA'], '1/2"', array['3.3/4"','5.1/2"']),
  (array['Parabolt PBA'], '5/8"', array['4.1/2"','6"']),
  (array['Parabolt PBA'], '3/4"', array['5.1/2"','7"']);
-- Tipos sem comprimento: uma lista de medidas.
insert into grade select array['Porca Sextavada','Porca Parlock','Arruela Lisa','Arruela de Pressão'], x, array[''] from unnest(array['M5','M6','M8','M10','M12','M14','M16','M20','M24','1/4"','5/16"','3/8"','1/2"','5/8"','3/4"','7/8"','1"']) x;
insert into grade select array['Porca Cab. Abaulada'], x, array[''] from unnest(array['M5','M6','M8','M10','M12','M14','M16','M20','1/4"','5/16"','3/8"','1/2"','5/8"','3/4"']) x;
insert into grade select array['Porca Rebite'], x, array[''] from unnest(array['M3','M4','M5','M6','M8','M10']) x;
insert into grade select array['Anel de Trava E'], x || ' mm', array[''] from unnest(array['3,2','4','5','6','7','8','9','10','12','15','19','24']) x;
insert into grade select array['Anel de Trava I'], x || ' mm', array[''] from unnest(array['10','12','15','16','19','20','22','25','28','30','32','35','40','42','47','52','62']) x;

insert into public.bib_itens (grupo, descricao, unidade, valor, fixador_tipo_id, fixador_material_id, medida, comprimento)
select 'Fixadores', '-', 'pç', 0, tm.tipo_id, tm.material_id, g.medida, c
from grade g
cross join lateral unnest(g.comprimentos) c
join bib_fixador_tipos t on t.nome = any (g.tipos)
join bib_fixador_tipo_materiais tm on tm.tipo_id = t.id
on conflict do nothing;
