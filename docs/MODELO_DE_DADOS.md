# Modelo de dados — ERP Fabriaço

Fonte de verdade: `supabase/migrations/`. Este resumo acompanha as migrations.

## Base (`20261019000001_base.sql`)

- `usuarios` (espelho de `auth.users`; criado por gatilho; o primeiro usuário recebe Administração)
- `perfis` (Administração com acesso total, Comercial, Financeiro, Consulta), `permissoes` (módulo + ação), `perfil_permissoes`, `usuario_perfis`, `usuario_permissoes` (ajuste individual)
- `configuracoes` (ex.: `followup_prazo_padrao_dias` = 5), `auditoria` (gatilho genérico com antes/depois)
- Funções: `tem_permissao(modulo, acao)`, `tem_acesso_total()`, `minhas_permissoes()`

## Vendas (`20261019000002_vendas.sql`)

- `empresas` (CNPJ único quando informado), `segmentos`
- `contatos` (a pessoa, uma vez; `classificacao` lead/cliente)
- `contato_anos` (contato + ano + **CC do ano**, único por ano, imutável) e `contadores_contato` (por ano)
- `propostas` (código `AA-CC-NNN` gerado em `criar_proposta`; status só muda por RPC; campos travados após envio) e `contadores_proposta` (por ano e contato)
- `proposta_revisoes` (R0, R1…; `enviada` = congelada com foto dos dados), `proposta_arquivos` (por revisão; só em rascunho)
- `proposta_eventos` (linha do tempo), `proposta_followups`, `proposta_aprovacoes` (comprovante obrigatório), `proposta_reprovacoes`
- Storage: bucket privado `vendas` (`propostas/{proposta}/{revisao}/…`, `aprovacoes/{proposta}/…`)
- RPCs: `criar_proposta`, `mover_proposta` (tabela de transições), `aprovar_proposta`, `reprovar_proposta`, `registrar_followup`, `incluir_contato_no_ano`, `reordenar_proposta`
