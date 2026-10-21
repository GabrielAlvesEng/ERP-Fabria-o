-- Lixeira, parte 2 (decisão 60): funções que apagam de vez, limpeza diária de 30 dias e permissões de execução.
-- Separada da 0027 porque o conector do Supabase pede confirmação do Gabriel para todo comando com "delete".
-- Nada é apagado ao aplicar: só cria as funções e agenda a limpeza.

create or replace function public.confirmar_arquivos_removidos(p_ids bigint[]) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if not tem_permissao('admin', 'editar') then raise exception 'Somente a Administração.'; end if;
  delete from arquivos_a_remover where id = any (p_ids);
end;
$fn$;

-- 4) Apagar de vez (uso interno: chamadas pela função da Lixeira e pela limpeza diária).
create or replace function public._apagar_projeto(p_id uuid) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  perform set_config('erp.rpc', 'on', true);
  delete from projeto_pecas where projeto_id = p_id;
  delete from projeto_conjuntos where projeto_id = p_id;
  delete from projeto_importacoes_cad where projeto_id = p_id;
  delete from projetos where id = p_id;
  perform set_config('erp.rpc', 'off', true);
end;
$fn$;

create or replace function public._apagar_proposta(p_id uuid) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if exists (select 1 from projetos where proposta_id = p_id) then raise exception 'A proposta tem projeto: apague o projeto antes.'; end if;
  insert into arquivos_a_remover (bucket, caminho)
    select 'vendas', a.caminho from proposta_arquivos a join proposta_revisoes r on r.id = a.revisao_id
    where r.proposta_id = p_id and coalesce(a.caminho, '') <> ''
    union select 'vendas', comprovante_caminho from proposta_aprovacoes where proposta_id = p_id and coalesce(comprovante_caminho, '') <> '';
  perform set_config('erp.rpc', 'on', true);
  delete from kickoffs where proposta_id = p_id;  -- kickoff_itens em cascata
  delete from proposta_followups where proposta_id = p_id;
  delete from proposta_eventos where proposta_id = p_id;
  delete from proposta_aprovacoes where proposta_id = p_id;
  delete from proposta_reprovacoes where proposta_id = p_id;
  delete from proposta_arquivos where revisao_id in (select id from proposta_revisoes where proposta_id = p_id);
  delete from custo_itens where revisao_id in (select id from proposta_revisoes where proposta_id = p_id);  -- custo_linhas em cascata
  delete from proposta_revisoes where proposta_id = p_id;
  delete from propostas where id = p_id;
  perform set_config('erp.rpc', 'off', true);
end;
$fn$;

-- Excluir definitivamente pela Lixeira: Administração, código digitado e a senha do tipo. Retorna 'ok' ou 'senha_incorreta'.
create or replace function public.apagar_definitivo(p_tipo text, p_id uuid, p_codigo text, p_senha text) returns text
language plpgsql security definer set search_path = public as $fn$
declare cod text;
begin
  if not tem_permissao('admin', 'editar') then raise exception 'Somente a Administração exclui definitivamente.'; end if;
  if p_tipo = 'proposta' then select codigo into cod from propostas where id = p_id and excluido_em is not null;
  elsif p_tipo = 'projeto' then select codigo into cod from projetos where id = p_id and excluido_em is not null;
  else raise exception 'Tipo inválido.'; end if;
  if cod is null then raise exception 'Item não está na Lixeira.'; end if;
  if trim(coalesce(p_codigo, '')) <> cod then raise exception 'Digite o código % para confirmar.', cod; end if;
  if not conferir_senha(case when p_tipo = 'proposta' then 'excluir_proposta' else 'excluir_projeto' end, p_senha) then return 'senha_incorreta'; end if;
  if p_tipo = 'proposta' then perform _apagar_proposta(p_id); else perform _apagar_projeto(p_id); end if;
  return 'ok';
end;
$fn$;

-- Limpeza diária: o que está na Lixeira há mais de 30 dias. Projetos antes das propostas.
create or replace function public.limpar_lixeira() returns integer
language plpgsql security definer set search_path = public as $fn$
declare r record; n integer := 0;
begin
  for r in select id from projetos where excluido_em < now() - interval '30 days' loop perform _apagar_projeto(r.id); n := n + 1; end loop;
  for r in select p.id from propostas p where p.excluido_em < now() - interval '30 days' and not exists (select 1 from projetos pj where pj.proposta_id = p.id) loop
    perform _apagar_proposta(r.id); n := n + 1;
  end loop;
  return n;
end;
$fn$;

do $$
declare f text;
begin
  foreach f in array array['public._apagar_projeto(uuid)', 'public._apagar_proposta(uuid)', 'public.limpar_lixeira()'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['public.projeto_exclusao_exige_senha(uuid)', 'public.excluir_projeto(uuid, text, text)', 'public.projetos_excluidos()',
    'public.restaurar_projeto(uuid)', 'public.confirmar_arquivos_removidos(bigint[])', 'public.apagar_definitivo(text, uuid, text, text)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- 5) Agendamento diário (06:17 UTC = 03:17 em Brasília).
create extension if not exists pg_cron;
select cron.schedule('limpar-lixeira', '17 6 * * *', $$select public.limpar_lixeira()$$);
