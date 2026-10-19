-- Reforço apontado pelo Security Advisor do Supabase após 0001 e 0002.
-- 1) Funções RPC só para usuários logados (cada uma ainda confere tem_permissao).
-- 2) search_path fixo nas funções que não tinham.
-- contadores_contato/contadores_proposta seguem sem política de propósito: só as RPCs mexem.

do $$
declare f text;
begin
  foreach f in array array[
    'public.tem_acesso_total()',
    'public.tem_permissao(text, text)',
    'public.minhas_permissoes()',
    'public.incluir_contato_no_ano(uuid, integer)',
    'public.criar_proposta(jsonb)',
    'public.mover_proposta(uuid, text, jsonb)',
    'public.reordenar_proposta(uuid, double precision)',
    'public.aprovar_proposta(uuid, jsonb)',
    'public.reprovar_proposta(uuid, jsonb)',
    'public.registrar_followup(uuid, jsonb)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

alter function public.tocar_atualizado_em() set search_path = public;
alter function public.proteger_proposta() set search_path = public;
alter function public.proteger_contato_ano() set search_path = public;
alter function public.ano_atual() set search_path = public;
alter function public.ano_atual_data() set search_path = public;
