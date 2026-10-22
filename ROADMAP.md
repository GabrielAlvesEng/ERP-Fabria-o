# Roadmap — ERP Fabriaço

Regra: um módulo por vez. Nenhum módulo começa sem autorização expressa do Gabriel.

## Ciclo de cada módulo

1. Entender o setor
2. Analisar o fluxograma
3. Definir requisitos e regras
4. Planejar telas e funcionalidades
5. Modelar dados e integrações
6. Apresentar o planejamento e aguardar aprovação
7. Implementar
8. Testar e corrigir
9. Validar o módulo
10. Pedir autorização para o próximo

## Ordem prevista

| # | Módulo | Estado |
|---|--------|--------|
| 0 | Base do projeto (estrutura, Supabase novo, login, permissões, tema) | A definir junto com o planejamento de Vendas |
| 1 | **Vendas** (Empresas, Contatos, Propostas, Kanban, Kick-off) | **Em planejamento, aguardando aprovação** |
| 2 | Engenharia (dados técnicos, árvore de montagens, BOM, SolidWorks) | **Em andamento** (decisões 33 e 96): Dashboard, Kanban de projetos e lista de materiais manual feitos em 22/10/2026, aguardando o teste do Gabriel. Planejamento completo em `docs/PLANEJAMENTO_ENGENHARIA.md`; as outras áreas do projeto vêm depois |
| 3 | Compras e Financeiro (aprovação e pagamento) | Compras no menu, em construção (decisão 92); Financeiro no menu, em construção (decisão 93); planejamento não iniciado |
| 4 | Almoxarifado | Módulo criado no menu, vazio (decisão 94, 22/10/2026). Planejamento não iniciado |
| 5 | Preparação (corte a laser, dobra, calandra, usinagem) | Não iniciado |
| 6 | Fabricação e Qualidade | Não iniciado |
| 7 | Expedição, campo e Financeiro (faturamento e recebimento) | Não iniciado |
| 8 | RH, Agenda, Tarefas e Frota | **RH: entregas 1 a 4 feitas e publicadas em 22/10/2026, aguardando validação do Gabriel** (decisão 69: o Gabriel decidiu em 22/10/2026 fazer o RH antes de seguir com a Engenharia; `docs/PLANEJAMENTO_RH.md`). Frota feita (decisão 55). Agenda e Tarefas não iniciadas |
| 9 | Administração (usuários, permissões, senhas, auditoria) | Parte entra já em Vendas (permissões, senhas) |
| 10 | Comunicação (avisos dos líderes por setor e comunicados gerais no celular) | **Em planejamento, aguardando aprovação** (`docs/PLANEJAMENTO_COMUNICACAO.md`) |

A ordem dos módulos 2 a 8 será revista quando o fluxograma completo da empresa estiver validado.

## Próxima etapa autorizada

Vendas (Custos, e-mail, kick-off, exclusão com senha) e o exemplar de Engenharia (árvore, mapa, lista de materiais, COD_MAT) estão publicados. Importação do SolidWorks feita e testada com a Bancada Moedor Aplicalis no projeto de teste 26-27-001. Reimportação por nova revisão do CAD feita e testada em localhost (decisão 38). Sem deploy no Netlify até o Gabriel liberar (decisão 37); GitHub Pages mantido, publica a cada push na `main` (decisão 45). Ajustes de Vendas pedidos em 20/10 feitos em localhost (decisões 39 a 44, três entregas). Segunda rodada de ajustes de Vendas, Biblioteca de Materiais, Predefinições e redesign etapa 1 feitos (decisões 46 a 51, docs/PLANEJAMENTO_PREDEFINICOES_E_BIBLIOTECA.md), publicados pelo GitHub Pages. Redesign etapas 2 a 4 feitas (decisão 52). Biblioteca de Materiais na Engenharia feita (decisão 53, docs/PLANEJAMENTO_BIBLIOTECA_ENGENHARIA.md). Migrations aprovadas de antemão (decisão 54). Frota completa e ida e volta feitas (decisão 55); o botão "Calcular rota" (API QualP) aguarda o contrato e a chave. Logo oficial aplicada (decisão 57). Pendentes: fornecedor real dos serviços "A definir" e confirmação das recomendações. Pendentes: Outlook web (aguarda decisão sobre app no Azure), confirmação das regras implementadas por recomendação (ver REGRAS_DE_NEGOCIO.md) e validação final do Gabriel.
