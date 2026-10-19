# Changelog

## 2026-10-19
- Início do projeto do zero. Criados CLAUDE.md, ROADMAP, regras de negócio e fluxograma v3.
- Decisões registradas em `docs/REGRAS_DE_NEGOCIO.md`: pintura antes da inspeção, faturamento por finalização ou por marcos, Financeiro aprova e paga compras, PCP e Preparação unificados, retrabalho por erro de fabricação volta ao início da Fabricação.
- Planejamento do módulo Vendas (com a Base do projeto) apresentado em `docs/PLANEJAMENTO_VENDAS.md`, com os nove itens do Documento Mestre. Aguardando aprovação. Nenhum código escrito.
- ZIP de `referencia/` consultado só para leitura. Divergências registradas no item 9.2 do planejamento (o guia do ZIP manda continuar o sistema antigo no mesmo Supabase/Netlify, o que contraria a decisão nº 7).
- Respostas do Gabriel ao planejamento registradas como decisões 8 a 17 em `docs/REGRAS_DE_NEGOCIO.md`: código `AA-CC-NNN` por ano e por contato, com CC e NNN reiniciando a cada ano; importação dos códigos de 2026; projeto com o mesmo código da proposta e montagens com o mesmo prefixo (substitui `AA-NNN-SIGLA` do Documento Mestre); Financeiro move Finalizado, Emitido NF e Pago; Vendas vê todas as propostas; empresa única; Git; Supabase novo e vazio. As decisões 16 e 17 vieram da edição do Gabriel no `CLAUDE.md`.
- `docs/PLANEJAMENTO_VENDAS.md` passou para a versão 2 (CC guardado em `contato_anos`, perfil Financeiro, entrega V3a de importação de 2026). `CLAUDE.md` ganhou a regra de reinício anual dos códigos.
- Decisões 18 a 23 registradas (CC pela ordem do contato, um único Supabase, GitHub pessoal, todo Comercial aprova, um usuário geral no início, Finalizado = execução concluída, exemplar autorizado).
- **Exemplar de Vendas implementado (não aplicado no Supabase ainda):** projeto Vite/React/TS/Tailwind; migrations `20261019000001_base.sql` (usuários, perfis, permissões, auditoria) e `20261019000002_vendas.sql` (empresas, contatos, contato_anos com CC por ano, propostas com código AA-CC-NNN gerado no banco, revisões, arquivos, eventos, follow-ups, aprovação com comprovante, reprovação, RLS e bucket privado `vendas`); telas de login, Dashboard Comercial, Empresas, Contatos por ano, Propostas com Kanban (arrastar e soltar) e detalhe. Typecheck, 6 testes de regras e build passaram localmente.
- Script de importação de 2026 gerado em `importacao/` (fora do Git, contém dados pessoais): 67 contatos, 18 empresas, CC pela ordem da planilha.
- Repositório Git local criado (branch `main`, primeiro commit). `referencia/` e `importacao/` fora do Git.
