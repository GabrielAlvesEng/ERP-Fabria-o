-- Biblioteca de Materiais e Predefinições (decisões 48 e 49, 20/10/2026).
-- Biblioteca: chapas, perfis, comerciais, fixadores e consumíveis, com material do catálogo COD_MAT.
-- Predefinições: fornecedores com serviços, mão de obra e maquinário próprio.
-- Propostas guardam o valor do momento: mudar a biblioteca não altera custos já lançados.

-- 1) Densidade dos materiais (g/cm³ = kg/dm³). Só preenche o que está vazio; inox austenítico 8,00 e carbono 7,85
--    como a calculadora de peso atual. Conferir em Predefinições → Materiais.
update public.catalogo_materiais c set densidade = v.d from (values
  ('IN-001',8.00),('IN-002',8.00),('IN-003',8.00),('IN-004',8.00),('IN-005',8.00),('IN-006',8.00),('IN-007',7.80),
  ('IN-008',7.75),('IN-009',7.75),('IN-010',7.75),('IN-011',7.75),('IN-012',8.00),('IN-013',8.00),('IN-014',7.80),
  ('IN-015',7.80),('IN-016',7.80),('IN-017',8.00),('IN-018',8.00),('IN-019',7.75),('IN-020',8.00),
  ('AC-001',7.85),('AC-002',7.85),('AC-003',7.85),('AC-004',7.85),('AC-005',7.85),('AC-006',7.85),('AC-007',7.85),
  ('AC-008',7.85),('AC-009',7.85),('AC-010',7.85),('AC-011',7.85),('AC-012',7.85),('AC-013',7.85),('AC-014',7.85),
  ('AC-015',7.85),('AC-016',7.85),('AC-017',7.85),('AC-018',7.85),('AC-019',7.85),('AC-020',7.85),('AC-021',7.85),
  ('AL-001',2.70),('AL-002',2.73),('AL-003',2.68),('AL-004',2.66),('AL-005',2.70),('AL-006',2.70),('AL-007',2.70),('AL-008',2.81),
  ('CU-001',8.94),('CU-002',8.94),('CU-003',8.94),('LT-001',8.53),('LT-002',8.50),('LT-003',8.39),
  ('BZ-001',8.93),('BZ-002',7.45),('BZ-003',8.86),('FF-001',7.20),('FF-002',7.10),('FF-003',7.10),
  ('ME-001',4.51),('ME-002',4.43),('ME-003',8.44),('ME-004',8.19),
  ('PC-001',1.20),('PC-002',1.20),('PC-003',1.20),('PC-004',1.20),('PC-005',1.43),('PC-006',1.20),('PT-001',2.17),
  ('NY-001',1.14),('NY-002',1.15),('NY-003',1.14),('NY-004',1.15),('NY-005',1.36),('NY-006',1.36),('NY-007',1.01),('NY-008',1.15),('NY-009',1.04),
  ('PL-001',1.41),('PL-002',1.42),('PL-003',0.95),('PL-004',0.93),('PL-005',0.92),('PL-006',0.91),('PL-007',0.90),('PL-008',1.40),
  ('PL-010',1.38),('PL-011',1.30),('PL-012',1.05),('PL-013',1.19),('PL-014',1.78),('PL-015',1.35),('PL-016',1.27),('PL-017',1.55),('PL-018',1.27),
  ('VD-001',2.50),('VD-002',2.50),('VD-003',2.50),('VD-004',2.23),('VD-005',2.20)
) as v(cod, d) where c.cod_mat = v.cod and c.densidade is null;
alter table public.catalogo_materiais add constraint catalogo_materiais_densidade_check check (densidade is null or densidade > 0);

-- 2) Tipos de chapa e de perfil (lista editável). O formato diz como o peso é calculado.
create table public.bib_tipos (
  id uuid primary key default gen_random_uuid(),
  grupo text not null check (grupo in ('Chapas','Perfis')),
  nome text not null check (length(trim(nome)) >= 2),
  formato text not null check (formato in ('chapa_lisa','chapa_manual','tubo_quadrado','tubo_retangular','tubo_od','tubo_sch',
    'barra_redonda','barra_quadrada','barra_chata','barra_sextavada','cantoneira','perfil_u','perfil_h','tabela')),
  ordem integer not null default 0,
  ativo boolean not null default true,
  unique (grupo, nome),
  check ((grupo = 'Chapas') = (formato in ('chapa_lisa','chapa_manual')))
);
insert into public.bib_tipos (grupo, nome, formato, ordem) values
  ('Chapas','Chapa Lisa','chapa_lisa',1), ('Chapas','Chapa Xadrez','chapa_manual',2), ('Chapas','Tela Moeda','chapa_manual',3),
  ('Chapas','Chapa Expandida','chapa_manual',4), ('Chapas','Chapa Perfurada','chapa_manual',5),
  ('Perfis','Tubo Quadrado','tubo_quadrado',1), ('Perfis','Tubo Retangular','tubo_retangular',2), ('Perfis','Tubo Redondo OD','tubo_od',3),
  ('Perfis','Tubo Redondo SCH','tubo_sch',4), ('Perfis','Barra Redonda','barra_redonda',5), ('Perfis','Barra Quadrada','barra_quadrada',6),
  ('Perfis','Barra Chata','barra_chata',7), ('Perfis','Barra Sextavada','barra_sextavada',8), ('Perfis','Cantoneira','cantoneira',9),
  ('Perfis','Perfil U','perfil_u',10), ('Perfis','Perfil UDC','perfil_u',11), ('Perfis','Perfil H','perfil_h',12), ('Perfis','Perfil HP','perfil_h',13),
  ('Perfis','Perfil W','tabela',14), ('Perfis','Viga I','tabela',15), ('Perfis','Viga U','tabela',16);

-- 3) Base de pesos por metro dos perfis de catálogo (kg/m em aço carbono; para outro material o ERP corrige pela densidade).
create table public.bib_pesos_perfil (
  id uuid primary key default gen_random_uuid(),
  tipo_id uuid not null references public.bib_tipos(id),
  bitola text not null check (length(trim(bitola)) >= 1),
  kg_m numeric(10,3) not null check (kg_m > 0),
  fonte text not null default '',
  ativo boolean not null default true,
  unique (tipo_id, bitola)
);
-- W (Gerdau): o kg/m é o segundo número da bitola. I e U laminados (padrão americano): tabela de mercado, conferir.
insert into public.bib_pesos_perfil (tipo_id, bitola, kg_m, fonte)
select t.id, v.bitola, v.kg, v.fonte from public.bib_tipos t join (values
  ('Perfil W','W 150 x 13,0',13.0,'Gerdau (kg/m na bitola)'),('Perfil W','W 150 x 18,0',18.0,'Gerdau (kg/m na bitola)'),('Perfil W','W 150 x 22,5 (H)',22.5,'Gerdau (kg/m na bitola)'),
  ('Perfil W','W 150 x 24,0',24.0,'Gerdau (kg/m na bitola)'),('Perfil W','W 150 x 29,8 (H)',29.8,'Gerdau (kg/m na bitola)'),('Perfil W','W 150 x 37,1 (H)',37.1,'Gerdau (kg/m na bitola)'),
  ('Perfil W','W 200 x 15,0',15.0,'Gerdau (kg/m na bitola)'),('Perfil W','W 200 x 19,3',19.3,'Gerdau (kg/m na bitola)'),('Perfil W','W 200 x 22,5',22.5,'Gerdau (kg/m na bitola)'),
  ('Perfil W','W 200 x 26,6',26.6,'Gerdau (kg/m na bitola)'),('Perfil W','W 200 x 31,3',31.3,'Gerdau (kg/m na bitola)'),('Perfil W','W 200 x 35,9 (H)',35.9,'Gerdau (kg/m na bitola)'),
  ('Perfil W','W 200 x 41,7 (H)',41.7,'Gerdau (kg/m na bitola)'),('Perfil W','W 200 x 46,1 (H)',46.1,'Gerdau (kg/m na bitola)'),('Perfil W','W 200 x 52,0 (H)',52.0,'Gerdau (kg/m na bitola)'),
  ('Perfil W','W 250 x 17,9',17.9,'Gerdau (kg/m na bitola)'),('Perfil W','W 250 x 22,3',22.3,'Gerdau (kg/m na bitola)'),('Perfil W','W 250 x 25,3',25.3,'Gerdau (kg/m na bitola)'),
  ('Perfil W','W 250 x 28,4',28.4,'Gerdau (kg/m na bitola)'),('Perfil W','W 250 x 32,7',32.7,'Gerdau (kg/m na bitola)'),('Perfil W','W 250 x 38,5',38.5,'Gerdau (kg/m na bitola)'),
  ('Perfil W','W 250 x 44,8',44.8,'Gerdau (kg/m na bitola)'),('Perfil W','W 250 x 62,0 (H)',62.0,'Gerdau (kg/m na bitola)'),('Perfil W','W 250 x 73,0 (H)',73.0,'Gerdau (kg/m na bitola)'),
  ('Perfil W','W 310 x 21,0',21.0,'Gerdau (kg/m na bitola)'),('Perfil W','W 310 x 23,8',23.8,'Gerdau (kg/m na bitola)'),('Perfil W','W 310 x 28,3',28.3,'Gerdau (kg/m na bitola)'),
  ('Perfil W','W 310 x 32,7',32.7,'Gerdau (kg/m na bitola)'),('Perfil W','W 310 x 38,7',38.7,'Gerdau (kg/m na bitola)'),('Perfil W','W 310 x 44,5',44.5,'Gerdau (kg/m na bitola)'),
  ('Perfil W','W 310 x 52,0',52.0,'Gerdau (kg/m na bitola)'),('Perfil W','W 310 x 79,0 (H)',79.0,'Gerdau (kg/m na bitola)'),('Perfil W','W 310 x 97,0 (H)',97.0,'Gerdau (kg/m na bitola)'),
  ('Perfil W','W 360 x 32,9',32.9,'Gerdau (kg/m na bitola)'),('Perfil W','W 360 x 39,0',39.0,'Gerdau (kg/m na bitola)'),('Perfil W','W 360 x 44,0',44.0,'Gerdau (kg/m na bitola)'),
  ('Perfil W','W 360 x 51,0',51.0,'Gerdau (kg/m na bitola)'),('Perfil W','W 360 x 57,8',57.8,'Gerdau (kg/m na bitola)'),('Perfil W','W 360 x 64,0',64.0,'Gerdau (kg/m na bitola)'),
  ('Perfil W','W 410 x 38,8',38.8,'Gerdau (kg/m na bitola)'),('Perfil W','W 410 x 46,1',46.1,'Gerdau (kg/m na bitola)'),('Perfil W','W 410 x 53,0',53.0,'Gerdau (kg/m na bitola)'),
  ('Perfil W','W 410 x 60,0',60.0,'Gerdau (kg/m na bitola)'),('Perfil W','W 460 x 52,0',52.0,'Gerdau (kg/m na bitola)'),('Perfil W','W 460 x 60,0',60.0,'Gerdau (kg/m na bitola)'),
  ('Perfil W','W 460 x 68,0',68.0,'Gerdau (kg/m na bitola)'),('Perfil W','W 530 x 66,0',66.0,'Gerdau (kg/m na bitola)'),('Perfil W','W 530 x 72,0',72.0,'Gerdau (kg/m na bitola)'),
  ('Perfil W','W 610 x 101,0',101.0,'Gerdau (kg/m na bitola)'),('Perfil W','W 610 x 125,0',125.0,'Gerdau (kg/m na bitola)'),
  ('Viga I','I 3" (1ª alma)',8.45,'Padrão americano (conferir)'),('Viga I','I 4" (1ª alma)',11.46,'Padrão americano (conferir)'),('Viga I','I 5" (1ª alma)',14.88,'Padrão americano (conferir)'),
  ('Viga I','I 6" (1ª alma)',18.60,'Padrão americano (conferir)'),('Viga I','I 8" (1ª alma)',27.38,'Padrão americano (conferir)'),('Viga I','I 10" (1ª alma)',37.70,'Padrão americano (conferir)'),
  ('Viga I','I 12" (1ª alma)',60.60,'Padrão americano (conferir)'),
  ('Viga U','U 3" (1ª alma)',6.10,'Padrão americano (conferir)'),('Viga U','U 4" (1ª alma)',8.04,'Padrão americano (conferir)'),('Viga U','U 6" (1ª alma)',12.20,'Padrão americano (conferir)'),
  ('Viga U','U 8" (1ª alma)',17.11,'Padrão americano (conferir)'),('Viga U','U 10" (1ª alma)',22.77,'Padrão americano (conferir)'),('Viga U','U 12" (1ª alma)',30.80,'Padrão americano (conferir)')
) as v(tipo, bitola, kg, fonte) on v.tipo = t.nome and t.grupo = 'Perfis';

-- 4) Preço por kg das chapas por material + tipo (cada chapa herda, podendo ter o seu).
create table public.bib_chapa_precos (
  id uuid primary key default gen_random_uuid(),
  cod_mat text not null references public.catalogo_materiais(cod_mat),
  tipo_id uuid not null references public.bib_tipos(id),
  valor_kg numeric(14,4) not null default 0 check (valor_kg >= 0),
  atualizado_em timestamptz not null default now(),
  unique (cod_mat, tipo_id)
);

-- 5) Chapas cadastradas.
create table public.bib_chapas (
  id uuid primary key default gen_random_uuid(),
  cod_mat text not null references public.catalogo_materiais(cod_mat),
  tipo_id uuid not null references public.bib_tipos(id),
  espessura_txt text not null,                       -- como digitado: "2,00" ou "1/4\""
  espessura_mm numeric(10,3) not null check (espessura_mm > 0),
  largura_mm numeric(10,1) not null check (largura_mm > 0),
  comprimento_mm numeric(10,1) not null check (comprimento_mm > 0),
  peso_kg numeric(12,3) not null default 0 check (peso_kg >= 0),
  peso_manual boolean not null default false,
  valor_kg numeric(14,4) check (valor_kg is null or valor_kg >= 0),   -- vazio = herda de bib_chapa_precos
  descricao text not null,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now(),
  unique (descricao)
);

-- 6) Perfis cadastrados.
create table public.bib_perfis (
  id uuid primary key default gen_random_uuid(),
  cod_mat text references public.catalogo_materiais(cod_mat),
  tipo_id uuid not null references public.bib_tipos(id),
  a_txt text not null default '', b_txt text not null default '', c_txt text not null default '', parede_txt text not null default '',
  a_mm numeric(10,3), b_mm numeric(10,3), c_mm numeric(10,3), parede_mm numeric(10,3),
  kg_m numeric(10,4) check (kg_m is null or kg_m > 0),
  kg_m_manual boolean not null default false,
  preco_modo text not null default 'm' check (preco_modo in ('m','kg')),
  valor numeric(14,4) not null default 0 check (valor >= 0),
  descricao text not null,
  origem_ref uuid references public.ref_materiais(id),
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now(),
  unique (descricao)
);

-- 7) Itens comerciais, fixadores e consumíveis.
create table public.bib_itens (
  id uuid primary key default gen_random_uuid(),
  grupo text not null check (grupo in ('Comerciais','Fixadores','Consumíveis')),
  descricao text not null check (length(trim(descricao)) >= 2),
  material text not null default '',
  unidade text not null default 'un',
  valor numeric(14,4) not null default 0 check (valor >= 0),
  origem_ref uuid references public.ref_materiais(id),
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now(),
  unique (grupo, descricao)
);

-- 8) Fornecedores e serviços (Galvanização a fogo, Pintura eletrostática, Laser, Dobra, Torno…).
create table public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(trim(nome)) >= 2),
  cidade text not null default '',
  contato text not null default '',
  telefone text not null default '',
  email text not null default '',
  observacoes text not null default '',
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);
create table public.fornecedor_servicos (
  id uuid primary key default gen_random_uuid(),
  fornecedor_id uuid not null references public.fornecedores(id),
  servico text not null check (length(trim(servico)) >= 2),
  unidade text not null check (unidade in ('hora','kg','m²','metro','peça')),
  valor numeric(14,4) not null default 0 check (valor >= 0),
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now(),
  unique (fornecedor_id, servico, unidade)
);

-- Máquinas terceirizadas de hoje viram serviços (por hora) de um fornecedor "A definir"; o Maquinário fica só com as próprias.
insert into public.fornecedores (nome, observacoes) values ('A definir', 'Serviços que estavam em Máquinas como terceirizados. Trocar pelo fornecedor real.');
insert into public.fornecedor_servicos (fornecedor_id, servico, unidade, valor)
select f.id, m.nome, 'hora', m.valor_hora from public.ref_maquinas m, public.fornecedores f
where m.terceirizada and m.ativo and f.nome = 'A definir';
update public.ref_maquinas set ativo = false where terceirizada;

-- Lista de preços antiga: marcada quando passa para a biblioteca; o que sobra fica "a revisar".
alter table public.ref_materiais add column migrado boolean not null default false;

-- 9) Segurança: Comercial lê (usa nas propostas); Administração edita. Sem exclusão física (ativo = false).
do $$
declare t text;
begin
  foreach t in array array['bib_tipos','bib_pesos_perfil','bib_chapa_precos','bib_chapas','bib_perfis','bib_itens','fornecedores','fornecedor_servicos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (tem_permissao(''custos'',''ler'') or tem_permissao(''admin'',''editar''))', t || '_ler', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (tem_permissao(''admin'',''editar''))', t || '_criar', t);
    execute format('create policy %I on public.%I for update to authenticated using (tem_permissao(''admin'',''editar'')) with check (tem_permissao(''admin'',''editar''))', t || '_editar', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function registrar_auditoria()', t || '_auditoria', t);
  end loop;
  foreach t in array array['bib_chapa_precos','bib_chapas','bib_perfis','bib_itens','fornecedores','fornecedor_servicos'] loop
    execute format('create trigger %I before update on public.%I for each row execute function tocar_atualizado_em()', t || '_atualizado', t);
  end loop;
end $$;
-- Catálogo COD_MAT: a Administração já edita (densidade inclusive) pela política da migration 0011.
