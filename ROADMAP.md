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
| 2 | Engenharia (dados técnicos, árvore de montagens, BOM, SolidWorks) | **Exemplar em andamento** (autorizado pelo Gabriel em 20/10/2026, decisão 33): projetos, árvore, peças, lista de materiais e importação do SolidWorks (inicial e por nova revisão do CAD) |
| 3 | Compras e Financeiro (aprovação e pagamento) | Não iniciado |
| 4 | Almoxarifado | Não iniciado |
| 5 | Preparação (corte a laser, dobra, calandra, usinagem) | Não iniciado |
| 6 | Fabricação e Qualidade | Não iniciado |
| 7 | Expedição, campo e Financeiro (faturamento e recebimento) | Não iniciado |
| 8 | RH, Agenda, Tarefas e Frota | Não iniciado |
| 9 | Administração (usuários, permissões, senhas, auditoria) | Parte entra já em Vendas (permissões, senhas) |

A ordem dos módulos 2 a 8 será revista quando o fluxograma completo da empresa estiver validado.

## Próxima etapa autorizada

Vendas (Custos, e-mail, kick-off, exclusão com senha) e o exemplar de Engenharia (árvore, mapa, lista de materiais, COD_MAT) estão publicados. Importação do SolidWorks feita e testada com a Bancada Moedor Aplicalis no projeto de teste 26-27-001. Reimportação por nova revisão do CAD feita e testada em localhost (decisão 38). Sem deploy no Netlify até o Gabriel liberar (decisão 37); GitHub Pages mantido, publica a cada push na `main` (decisão 45). Ajustes de Vendas pedidos em 20/10 feitos em localhost (decisões 39 a 44, três entregas). Segunda rodada de ajustes de Vendas, Biblioteca de Materiais, Predefinições e redesign etapa 1 feitos (decisões 46 a 51, docs/PLANEJAMENTO_PREDEFINICOES_E_BIBLIOTECA.md), publicados pelo GitHub Pages. Redesign etapas 2 a 4 feitas (decisão 52). Próximo proposto: Biblioteca de Materiais na Engenharia (docs/PLANEJAMENTO_BIBLIOTECA_ENGENHARIA.md), aguardando aprovação. Pendentes: arquivos da Logo Moderna, fornecedor real dos serviços "A definir" e confirmação das recomendações. Pendentes: Outlook web (aguarda decisão sobre app no Azure), confirmação das regras implementadas por recomendação (ver REGRAS_DE_NEGOCIO.md) e validação final do Gabriel.
