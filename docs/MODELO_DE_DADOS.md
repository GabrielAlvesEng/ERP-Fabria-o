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

## Correção (`20261020000008_corrige_protecao_eng.sql`)

- `proteger_codigos_eng` reescrita com um bloco por tabela (a versão da 0007 impedia editar conjuntos e peças).

## Kick-off (`20261020000009_kickoff.sql`)

- `kickoff_modelo_itens` (setor, descrição, ordem), `kickoffs` (proposta, versão, data, participantes, observações, marcos jsonb, status rascunho/finalizado), `kickoff_itens` (setor, descrição, necessário sim/nao/a_definir, responsável, prazo, observação)
- RPCs `iniciar_kickoff` (v1 a partir do modelo ou nova versão copiando a anterior) e `finalizar_kickoff`; finalizado travado por gatilho e RLS

## Exclusão com senha (`20261020000010_exclusao_senha.sql`)

- `senhas_administrativas` (hash bcrypt, sem leitura pela API) e `senha_tentativas`
- RPCs `definir_senha_administrativa`, `situacao_senha`, `exclusao_exige_senha`, `excluir_proposta` (retorna ok / senha_incorreta), `propostas_excluidas`, `restaurar_proposta`

## Catálogo COD_MAT (`20261020000011_catalogo_cod_mat.sql`)

- `catalogo_materiais` (cod_mat AA-000, nome, nome completo, nome no SolidWorks, categoria, densidade a preencher) com 124 materiais; `projeto_pecas.cod_mat` → catálogo

## Biblioteca de Materiais e Predefinições (`20261021000018_biblioteca_predefinicoes.sql`, carga `20261021000019_biblioteca_carga.sql`)

- `catalogo_materiais.densidade` preenchida (g/cm³) e com restrição > 0.
- `bib_tipos` (grupo Chapas/Perfis, nome, formato do cálculo de peso), `bib_pesos_perfil` (kg/m de catálogo por tipo e bitola, aço carbono).
- `bib_chapa_precos` (valor/kg por material + tipo), `bib_chapas` (material, tipo, espessura texto e mm, largura, comprimento, peso e se é manual, valor/kg próprio ou nulo = herdado, descrição única).
- `bib_perfis` (material, tipo, medidas como digitadas e em mm, parede, kg/m e se é manual, modo de preço m/kg, valor, descrição única, `origem_ref` na lista antiga).
- `bib_itens` (Comerciais, Fixadores, Consumíveis: descrição, material, unidade, valor).
- `fornecedores` e `fornecedor_servicos` (serviço, unidade hora/kg/m²/metro/peça, valor).
- `ref_maquinas`: só as próprias ficam ativas; `ref_materiais.migrado` marca o que passou para a biblioteca.
- RLS: leitura para `custos.ler` ou `admin.editar`; inserção e edição só `admin.editar`; sem exclusão física; auditoria em todas.
- Regras de peso e descrição em `src/modules/biblioteca/regras.ts` (com testes); a carga foi gerada por `scripts/gerar_carga_biblioteca.ts` com as mesmas regras.

## Custos: Frete terceirizado e Viagem (`20261021000020_custos_viagem_frete.sql`)

- `custo_linhas.secao` aceita `frete` e `viagem` (as antigas continuam para revisões enviadas); `custo_linhas.bib_id` guarda o item da biblioteca escolhido.
- `ajustar_linha_custo` com as fórmulas de veículo alugado, frete, hospedagem e fixadores/consumíveis.
- `converter_secoes_antigas(revisão)` converte um rascunho para as seções atuais sem mudar valores; `copiar_custos` chama ao criar nova revisão.

## Biblioteca na Engenharia (`20261021000022_biblioteca_engenharia.sql`, `20261021000023_biblioteca_leitura_engenharia.sql`)

- `projeto_pecas.bib_tipo` (chapa, perfil, item), `bib_id` (id em `bib_chapas`, `bib_perfis` ou `bib_itens`) e `bib_confirmado`; os dois primeiros vazios juntos ou preenchidos juntos.
- Políticas de leitura `bib_*_ler` passam a aceitar `engenharia.ler`.
- Peso, custo e resumo para compra são calculados na tela (`src/modules/engenharia/biblioteca.ts`), não gravados.
