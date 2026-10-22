-- Módulo Financeiro no menu (decisão 93, 22/10/2026). Só a permissão de abrir o módulo:
-- financeiro.ler para o perfil Financeiro (que já tinha financeiro.editar desde a base).
-- Administração já vê tudo (acesso_total). As tabelas do módulo vêm depois do planejamento aprovado.
set lock_timeout = '10s';

insert into public.permissoes (modulo, acao) values ('financeiro', 'ler') on conflict do nothing;
insert into public.perfil_permissoes (perfil_id, permissao_id)
select p.id, pm.id from public.perfis p join public.permissoes pm on pm.modulo = 'financeiro' and pm.acao = 'ler'
where p.nome = 'Financeiro'
on conflict do nothing;
