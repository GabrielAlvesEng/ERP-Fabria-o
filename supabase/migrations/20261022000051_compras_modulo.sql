-- Decisão 92: módulo Compras entra no ERP (menu, rota e página inicial), sem funcionalidades ainda.
-- Só cria as permissões do módulo. A Administração (acesso total) já passa a ver Compras; para outras
-- pessoas, o RH libera em Ficha → Acesso ao ERP. Perfil "Compras" e tabelas vêm com o planejamento aprovado.
insert into public.permissoes (modulo, acao) values ('compras', 'ler'), ('compras', 'criar'), ('compras', 'editar') on conflict do nothing;
