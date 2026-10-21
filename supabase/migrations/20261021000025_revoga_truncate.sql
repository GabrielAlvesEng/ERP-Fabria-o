-- Segurança (21/10/2026): as tabelas criadas depois da 0004 herdaram do padrão do schema os privilégios TRUNCATE,
-- REFERENCES, TRIGGER e MAINTAIN para anon e authenticated. TRUNCATE ignora o RLS: com a chave pública seria possível
-- esvaziar uma tabela sem login. Nenhuma tela usa esses privilégios. Nenhum dado é alterado.
revoke truncate, references, trigger, maintain on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke truncate, references, trigger, maintain on tables from anon, authenticated;
