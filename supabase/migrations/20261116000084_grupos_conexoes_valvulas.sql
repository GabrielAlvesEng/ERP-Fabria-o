-- Decisão 130 (pedido do Gabriel, 16/11/2026): "Adiciona também CONEXÕES e VÁLVULAS nos tipos de grupo".
-- Vale na lista de materiais da Engenharia e nos itens das solicitações de Compras (para onde a lista vai).
-- O cadastro de produtos (bib_itens) não muda.
alter table public.eng_lista_itens drop constraint eng_lista_itens_grupo_check;
alter table public.eng_lista_itens add constraint eng_lista_itens_grupo_check
  check (grupo in ('Chapas', 'Perfis', 'Barras', 'Comerciais', 'Conexões', 'Válvulas', 'Fixadores', 'Consumíveis', 'Serviços', 'Outros'));
alter table public.compras_requisicao_itens drop constraint compras_requisicao_itens_grupo_check;
alter table public.compras_requisicao_itens add constraint compras_requisicao_itens_grupo_check
  check (grupo in ('Chapas', 'Perfis', 'Barras', 'Comerciais', 'Conexões', 'Válvulas', 'Fixadores', 'Consumíveis', 'Serviços', 'Outros'));
