-- Decisão 80 (22/10/2026, pedido do Gabriel): códigos dos contatos de 2026 iguais à pasta de clientes dele (01 a 54).
-- Exceção autorizada à regra "o código do cliente no ano é permanente": o gatilho de proteção é desligado só dentro
-- desta migration. Nenhuma linha é apagada:
--   * os 29 contatos que não estão na lista vão para a lixeira (excluido_em) e o código deles vira 900 + o antigo;
--   * os 22 contatos da lista que tinham outro número são renumerados;
--   * os 15 contatos da lista que não existiam são criados (com as empresas que faltavam);
--   * o contador de 2026 passa a 54 (o próximo contato novo é o 55).
-- (Roda numa transação só: se a conferência do fim falhar, nada fica gravado.)
-- As propostas 26-04-022 (André Marcolino, 04) e 26-07-007 (Daniel Campos, 07) não mudam.


alter table public.contato_anos disable trigger contato_anos_proteger;

-- 1. Contatos fora da lista: lixeira (exclusão lógica) e código fora da faixa 01-99.
create temporary table _fora (cc int primary key) on commit drop;
insert into _fora values (19),(20),(26),(31),(32),(34),(35),(36),(37),(39),(41),(43),(44),(45),(46),(47),(48),(49),(50),(52),(53),(54),(56),(57),(58),(59),(60),(61),(62);

update public.contatos c set excluido_em = now(), excluido_por = '5e556bb6-6823-48b0-8056-0f00f8f037bb'
  from public.contato_anos ca
 where ca.contato_id = c.id and ca.ano = 2026 and ca.codigo_comercial in (select cc from _fora) and c.excluido_em is null;

update public.contato_anos set codigo_comercial = 900 + codigo_comercial
 where ano = 2026 and codigo_comercial in (select cc from _fora);

-- 2. Renumeração (antigo -> novo), em duas etapas para não bater na unicidade (ano, código).
create temporary table _mapa (antigo int primary key, novo int unique not null) on commit drop;
insert into _mapa values
  (51,18),(27,19),(63,20),(64,21),(30,22),(21,23),(29,24),(23,25),(28,29),(38,30),(22,31),(40,32),(55,33),
  (33,35),(65,36),(24,39),(25,40),(67,43),(66,44),(18,45),(42,46),(68,54);

update public.contato_anos ca set codigo_comercial = 500 + m.novo
  from _mapa m where ca.ano = 2026 and ca.codigo_comercial = m.antigo;
update public.contato_anos set codigo_comercial = codigo_comercial - 500
 where ano = 2026 and codigo_comercial between 501 and 599;

-- Empresa da unidade certa: Nicolas Santos (43) na Symrise Sorocaba e Rafael Trivelato (45) na Symrise Chapecó.
update public.contatos c set empresa_id = 'b9fb77df-d004-460e-b2fa-a0340dad1174'
  from public.contato_anos ca where ca.contato_id = c.id and ca.ano = 2026 and ca.codigo_comercial = 43;
update public.contatos c set empresa_id = 'c60732e7-3f5e-4910-a6a1-5062b0eb3107'
  from public.contato_anos ca where ca.contato_id = c.id and ca.ano = 2026 and ca.codigo_comercial = 45;

-- 3. Empresas que faltavam (só nome, cidade e UF; o resto o Comercial completa pela tela ou pelo CNPJ).
insert into public.empresas (nome_fantasia, razao_social, cidade, uf) values
  ('PLUSNR', 'PLUSNR', '', 'PA'),
  ('Titan', 'Titan', 'Tambaú', 'SP'),
  ('Igreja Católica', 'Igreja Católica', 'Mococa', 'SP'),
  ('INB - Indústrias Nucleares do Brasil', 'Indústrias Nucleares do Brasil', 'Caldas', 'MG'),
  ('Tortella Engenharia', 'Tortella Engenharia', 'Rio Pardo', 'SP'),
  ('Concrepool', 'Concrepool', '', ''),
  ('Gelita - Cotia', 'Gelita', 'Cotia', 'SP');

-- 4. Contatos novos da lista, com o código de 2026.
create temporary table _novos (cc int primary key, nome text not null, empresa text not null) on commit drop;
insert into _novos values
  (26, 'Kenny Nunes', 'Gelita'),
  (27, 'Raiana Voiola', 'PLUSNR'),
  (28, 'Lorena Silva', 'Gencau'),
  (34, 'Diego Souza', 'Symrise Pet Food - Chapecó'),
  (37, 'Victor Pinheiro', 'Titan'),
  (38, 'Claudio', 'Igreja Católica'),
  (41, 'Cristian Neves', 'Verallia'),
  (42, 'Vagner Silva', 'Verallia'),
  (47, 'João Batista', 'INB - Indústrias Nucleares do Brasil'),
  (48, 'Guilherme Tortella', 'Tortella Engenharia'),
  (49, 'Wilton Oliveira', 'Gelita - Cotia'),
  (50, 'Pedro', 'SEM EMPRESA (a definir)'),
  (51, 'Renato Miachon', 'Concrepool'),
  (52, 'Maicon Gabriel', 'Husqvarna'),
  (53, 'Diego', 'SEM EMPRESA (a definir)');

do $$
declare r record; v_emp uuid; v_id uuid;
begin
  for r in select * from _novos order by cc loop
    select id into strict v_emp from public.empresas where nome_fantasia = r.empresa and excluido_em is null;
    insert into public.contatos (empresa_id, nome, observacoes)
      values (v_emp, r.nome, case when r.cc in (50, 53) then 'Mococa-SP (empresa a definir).' else '' end)
      returning id into v_id;
    insert into public.contato_anos (contato_id, ano, codigo_comercial, origem) values (v_id, 2026, r.cc, 'importacao');
  end loop;
end $$;

-- 5. Próximo contato novo de 2026 é o 55.
update public.contadores_contato set ultimo_valor = 54 where ano = 2026;

alter table public.contato_anos enable trigger contato_anos_proteger;

-- Conferência: 01 a 54 sem buraco, todos com contato ativo.
do $$
declare n int;
begin
  select count(*) into n from public.contato_anos ca join public.contatos c on c.id = ca.contato_id
   where ca.ano = 2026 and ca.codigo_comercial between 1 and 99 and c.excluido_em is null;
  if n <> 54 or exists (select 1 from generate_series(1, 54) g where not exists (
       select 1 from public.contato_anos where ano = 2026 and codigo_comercial = g)) then
    raise exception 'Conferência falhou: % contatos ativos com código em 2026', n;
  end if;
end $$;

