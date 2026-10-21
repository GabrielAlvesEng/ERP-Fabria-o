-- Alerta de segurança do Supabase: public.rls_auto_enable() (função de gatilho de evento que liga o RLS em toda tabela
-- nova do schema public) aparecia como executável por anon e authenticated. Como é de gatilho, não pode ser chamada
-- pela API; mesmo assim a execução pública é retirada. O gatilho de evento continua funcionando (roda como o dono).
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
