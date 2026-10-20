-- Correção da 0007: proteger_codigos_eng lia campos de outras tabelas (ex.: new.proposta_id em projeto_conjuntos),
-- o que fazia toda edição manual de conjuntos e peças falhar com erro 42703. Agora cada tabela é tratada separadamente.
create or replace function public.proteger_codigos_eng() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('erp.rpc', true), '') = 'on' then return new; end if;
  if tg_table_name = 'projetos' then
    if (new.codigo, new.proposta_id) is distinct from (old.codigo, old.proposta_id) then
      raise exception 'O código do projeto é o da proposta e não muda.';
    end if;
  elsif tg_table_name = 'projeto_conjuntos' then
    if (new.codigo, new.pai_id, new.tipo, new.sub, new.conj, new.projeto_id, new.excluido_em)
       is distinct from (old.codigo, old.pai_id, old.tipo, old.sub, old.conj, old.projeto_id, old.excluido_em) then
      raise exception 'Código e posição do conjunto só mudam pelas ações do sistema.';
    end if;
  elsif tg_table_name = 'projeto_pecas' then
    if (new.codigo, new.seq, new.conjunto_id, new.projeto_id, new.excluido_em)
       is distinct from (old.codigo, old.seq, old.conjunto_id, old.projeto_id, old.excluido_em) then
      raise exception 'Código da peça só muda pelas ações do sistema.';
    end if;
  end if;
  return new;
end;
$$;
