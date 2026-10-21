-- Biblioteca de Materiais na Engenharia (decisão 53): a peça aponta para um item da biblioteca (sugerido pelo ERP,
-- confirmado pela Engenharia). Peso e custo estimados e o resumo para compra são calculados na tela (src/modules/engenharia/biblioteca.ts).
alter table public.projeto_pecas
  add column bib_tipo text check (bib_tipo in ('chapa','perfil','item')),
  add column bib_id uuid,                                   -- bib_chapas, bib_perfis ou bib_itens, conforme bib_tipo
  add column bib_confirmado boolean not null default false, -- a Engenharia aceitou o item
  add constraint projeto_pecas_bib_check check ((bib_tipo is null) = (bib_id is null));
-- A leitura da biblioteca pela Engenharia está na migration 0023.
