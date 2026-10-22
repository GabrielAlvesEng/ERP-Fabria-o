-- Decisão 102: cadastro de fornecedor preenchido pelo CNPJ, como o de empresas. Guarda razão social e endereço
-- (usados também no PDF da ordem de compra).
set lock_timeout = '10s';
alter table public.fornecedores
  add column razao_social text not null default '',
  add column endereco text not null default '';
