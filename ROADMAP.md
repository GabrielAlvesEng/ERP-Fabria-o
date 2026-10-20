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
| 2 | Engenharia (dados técnicos, árvore de montagens, BOM, SolidWorks) | **Exemplar em andamento** (autorizado pelo Gabriel em 20/10/2026, decisão 33): projetos, árvore, peças, lista de materiais e importação do SolidWorks (primeira importação; reimportação de revisão ainda não) |
| 3 | Compras e Financeiro (aprovação e pagamento) | Não iniciado |
| 4 | Almoxarifado | Não iniciado |
| 5 | Preparação (corte a laser, dobra, calandra, usinagem) | Não iniciado |
| 6 | Fabricação e Qualidade | Não iniciado |
| 7 | Expedição, campo e Financeiro (faturamento e recebimento) | Não iniciado |
| 8 | RH, Agenda, Tarefas e Frota | Não iniciado |
| 9 | Administração (usuários, permissões, senhas, auditoria) | Parte entra já em Vendas (permissões, senhas) |

A ordem dos módulos 2 a 8 será revista quando o fluxograma completo da empresa estiver validado.

## Próxima etapa autorizada

Vendas (Custos, e-mail, kick-off, exclusão com senha) e o exemplar de Engenharia (árvore, mapa, lista de materiais, COD_MAT) estão publicados. Importação do SolidWorks feita e testada com a Bancada Moedor Aplicalis no projeto de teste 26-27-001. Pendentes: reimportação de nova revisão do CAD, Outlook web (aguarda decisão sobre app no Azure), confirmação das regras implementadas por recomendação (ver REGRAS_DE_NEGOCIO.md) e validação final do Gabriel.
