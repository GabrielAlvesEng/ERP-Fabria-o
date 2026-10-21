-- Gerador de propostas (decisão 61): ao apagar uma revisão de vez (Lixeira), os documentos dela vão junto.
-- Colar no SQL Editor do Supabase (o conector pede confirmação para comandos com "delete").
alter table public.proposta_documentos drop constraint proposta_documentos_revisao_id_fkey;
alter table public.proposta_documentos add constraint proposta_documentos_revisao_id_fkey
  foreign key (revisao_id) references public.proposta_revisoes(id) on delete cascade;
