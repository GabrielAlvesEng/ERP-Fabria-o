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

## Custos (`20261019000005_custos.sql`)

- `ref_materiais` (tipo Chapas/Perfis/Comerciais, descrição, unidade Kg/Mts/Un, preço), `ref_mao_obra` (etapa, função, valor hora), `ref_maquinas` (máquina, terceirizada, valor hora); `configuracoes.custos_padrao` (lucro 20, negociação 5, imposto 20, por dentro)
- `custo_itens` (revisão, letra A/B…, descrição, quantidade, percentuais, modo do imposto) e `custo_linhas` (seção, grupo, descrição, detalhe, detalhe2, unidade, quantidade × fator × valor_unitario = `total` gerado)
- Funções: `custo_resumo(item)`, `copiar_custos(de, para)` (usada por `mover_proposta` ao criar revisão), `revisao_em_rascunho(revisao)`; escrita só em revisão em rascunho (RLS)

## Assinatura (`20261020000006_assinatura_email.sql`)

- `usuarios.assinatura`; RPC `salvar_minha_assinatura(texto)`

## Engenharia (`20261020000007_engenharia.sql`)

- `projetos` (proposta única, código = código da proposta, status, responsável, prazo)
- `projeto_conjuntos` (pai, tipo geral/submontagem/conjunto, sub 00/0A…, conj, código, nome, quantidade no pai, situação, revisão; exclusão lógica)
- `projeto_pecas` (conjunto, seq, código …-0A-01-001, descrição, quantidade, `cod_op` text[] LC/LP/PO/GU/DO/CL/US/CM, material, espessura, peso unitário; exclusão lógica)
- RPCs: `criar_projeto`, `adicionar_conjunto`, `adicionar_peca`, `excluir_item_eng`; códigos protegidos por gatilho
