# Exclusão de projetos e Lixeira (propostas e projetos)

Versão 1, 21/10/2026. **Estado: planejamento aguardando confirmação do Gabriel**, porque muda uma regra aprovada (exclusão "sempre lógica", seção "Implementado conforme recomendação") e passa a apagar dados de verdade.

Pedido (21/10): botão para excluir projetos, igual ao das propostas; propostas e projetos excluídos aparecem na Administração, com a opção **excluir definitivamente**; se ninguém fizer nada, eles são **apagados automaticamente em 30 dias**.

## 1. Excluir projeto (igual à proposta)
- Botão **Excluir projeto** no projeto da Engenharia, com justificativa obrigatória.
- Projeto sem peças nem conjuntos além da montagem geral: basta a permissão de excluir da Engenharia.
- Projeto com peças: pede também a **senha administrativa** (proposta: uma senha nova, "Excluir Projeto", em Administração → Senhas, com o mesmo limite de 5 tentativas em 15 minutos).
- A proposta aprovada continua aprovada. O código do projeto não é reaproveitado. Restaurado, o projeto volta como estava.

## 2. Lixeira em Administração (substitui a aba "Propostas excluídas")
- Duas listas, **Propostas** e **Projetos**, cada uma com código, título, cliente, quem excluiu, quando, justificativa e **"apagado definitivamente em N dias"**.
- Botões: **Restaurar** e **Excluir definitivamente**. A exclusão definitiva pede confirmação digitando o código (ex.: 26-01-001) e a senha administrativa.
- Uma proposta que tem projeto (mesmo na lixeira) só pode ser apagada definitivamente depois do projeto.

## 3. Apagar definitivamente (manual ou após 30 dias)
- **Proposta:** revisões, custos, arquivos (PDF, comprovantes, anexos no Storage), eventos, follow-ups, aprovação/reprovação e kick-off.
- **Projeto:** conjuntos, peças e importações do CAD.
- Fica guardado só um **registro mínimo** de que existiu: código, título, cliente, quem excluiu e quem apagou, datas e justificativa. Sem esse registro, um código antigo "sumiria" sem explicação. O código continua sem ser reaproveitado.
- **Automático:** uma rotina diária do banco (pg_cron, disponível no Supabase) apaga o que estiver na lixeira há mais de 30 dias, com o mesmo cuidado do apagamento manual.

## Perguntas
1. **Confirma o apagamento automático em 30 dias?** Depois disso não há como recuperar (o Supabase não tem como restaurar um item só; um backup volta o banco inteiro). Alternativa: em vez de apagar sozinho, o ERP avisa na Administração "N itens com mais de 30 dias na lixeira", e você apaga com um clique.
2. Senha para excluir projeto: uma **senha nova "Excluir Projeto"** (recomendado) ou a mesma "Excluir Proposta"?
3. O **registro mínimo** depois de apagar (código, título, cliente, datas, quem, justificativa) pode ficar? (recomendado)
4. Quem pode apagar definitivamente: **só a Administração** (recomendado)?
