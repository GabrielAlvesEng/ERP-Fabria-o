-- Gerador de propostas, entrega 4 (decisão 61): imagens da capa e do escopo ficam como arquivos da revisão
-- (tipo imagem_documento), no mesmo espaço privado das propostas. Assim a Lixeira também as apaga ao excluir de vez.
set lock_timeout = '10s';
alter table public.proposta_arquivos drop constraint proposta_arquivos_tipo_check;
alter table public.proposta_arquivos add constraint proposta_arquivos_tipo_check
  check (tipo in ('tecnica', 'comercial', 'anexo', 'documento_tecnico', 'imagem_documento'));
