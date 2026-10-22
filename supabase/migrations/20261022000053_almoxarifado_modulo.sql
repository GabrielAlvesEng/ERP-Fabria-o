-- Módulo Almoxarifado (decisão 94): só as permissões do módulo, para ele aparecer no menu e na gestão de acesso do RH.
-- Nenhum perfil recebe o módulo ainda (só quem tem acesso total o vê); tabelas e perfis vêm com o planejamento aprovado.
insert into public.permissoes (modulo, acao) values
  ('almoxarifado','ler'), ('almoxarifado','criar'), ('almoxarifado','editar')
on conflict do nothing;
