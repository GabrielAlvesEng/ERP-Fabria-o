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
- `usuarios.assinatura_html` e `assinatura_atualizada_em` (decisão 66): assinatura importada do Outlook, em HTML com imagens embutidas; RPC `salvar_minha_assinatura_html(html)` grava só a do próprio usuário. A coluna `assinatura` (texto) não é mais usada.
- `propostas.contato_tecnico_id` (decisão 67) → contatos: contato técnico do cliente (a técnica vai A/C dele; entra em C/C no envio). Gatilho `validar_contato_tecnico` exige contato da mesma empresa da proposta.
- `usuarios.telefone`, `nascimento`, `foto_caminho` e `foto_atualizada_em` (decisão 68, Meu perfil): RPCs `salvar_meu_perfil(nome, telefone, nascimento)` e `salvar_minha_foto(caminho)` gravam só o próprio usuário. Bucket privado `perfis` (até 2 MB, JPG/PNG/WEBP): todos os logados leem; cada um só envia e troca em `{id do usuário}/…`.

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

## Frota completa (`20261021000024_frota_completa.sql`)

- `combustivel_precos` (combustivel gasolina/etanol/diesel, preco, vigente_desde, criado_por): histórico, só inserção; a visão `combustivel_precos_atuais` dá o preço mais recente de cada um. Lê quem tem `custos.ler` ou `admin.editar`; grava `admin.editar`.
- `ref_veiculos` ganhou placa (única, maiúscula), tipo, marca, modelo, ano, cor, renavam, chassi, eixos (2 a 9), combustivel (gasolina, etanol, diesel, flex), capacidade_kg, passageiros, licenciamento_vence, seguro_vence, revisao_km, revisao_data, situacao (ativo, manutencao, vendido) e observacoes. O gatilho `sincronizar_veiculo_ativo` mantém `ativo = (situacao = 'ativo')`.
- `veiculo_fotos` (veiculo_id, caminho único, nome, ordem): no máximo 3 por veículo (gatilho `limitar_fotos_veiculo`). Arquivos no bucket privado `frota`, em `veiculos/{veiculo_id}/…` (5 MB, JPG/PNG/WEBP).
- `custo_linhas.ida_volta`: na Viagem, combustível e pedágio contam 2 vezes; `copiar_custos` leva o campo para a nova revisão.

## Segurança (`20261021000025_revoga_truncate.sql`)

- Nenhuma tabela do schema `public` dá TRUNCATE, REFERENCES, TRIGGER ou MAINTAIN para `anon` e `authenticated`; o padrão do schema também não, para tabelas novas.

## Fixadores em pastas (`20261021000026_fixadores_pastas.sql`)

- `bib_fixador_tipos` (nome, rotulo_a, rotulo_b vazio = sem comprimento, ordem, ativo), `bib_fixador_materiais` (nome, ordem, ativo) e `bib_fixador_tipo_materiais` (quais materiais cada tipo tem, com ativo).
- `bib_itens` ganhou `fixador_tipo_id`, `fixador_material_id`, `medida` e `comprimento` (únicos juntos). O gatilho `montar_descricao_fixador` monta descrição e material; renomear tipo ou material atualiza os itens.
- Leitura: custos, engenharia ou admin; gravação: admin.editar.

## Lixeira (`20261021000027_lixeira.sql`, `20261021000028_lixeira_apagar.sql`)

- `projetos.excluido_em`, `excluido_por`, `exclusao_justificativa`. Projeto excluído não aparece pelas políticas de leitura e edição.
- `arquivos_a_remover` (bucket, caminho): arquivos do Storage de propostas apagadas de vez. A tela da Lixeira os remove pela API do Storage (política `vendas_remover_lixeira`) e confirma com `confirmar_arquivos_removidos`.
- Funções:
  - `excluir_projeto`, que pede senha `excluir_projeto` quando há peças ou conjuntos;
  - `projetos_excluidos` e `restaurar_projeto`;
  - `apagar_definitivo`, só para a Administração, com o código digitado e a senha do tipo;
  - as internas `_apagar_projeto`, `_apagar_proposta` e `limpar_lixeira`.
- Agendamento pg_cron `limpar-lixeira`, diário às 06:17 UTC: apaga o que está na Lixeira há mais de 30 dias.
- Nova permissão `engenharia.excluir` (perfil Engenharia) e senha `excluir_projeto`.

## Documentos da proposta (`20261021000029_documentos_proposta.sql`, `20261021000030_documentos_cascata.sql`)

- `documento_padroes` (chave `empresa`, `tecnica` ou `comercial`; conteudo jsonb): dados da Fabriaço e textos padrão. Lê quem tem Vendas; grava a Administração.
- `proposta_documentos` (revisao_id, tipo `tecnica`/`comercial`, conteudo jsonb, único por revisão e tipo). O conteúdo segue `Documento` em `src/modules/vendas/documentos/modelo.ts`. Grava só em revisão de rascunho, com `vendas.editar`.
- O gatilho `copiar_documentos_revisao` copia os documentos da revisão anterior para a nova.
- O PDF gerado vira um `proposta_arquivos` comum (tipo `tecnica`/`comercial`), no bucket `vendas`.

## Vendedores (`20261021000032_vendedores.sql`)

- `vendedores` (usuario_id PK → usuarios, nome, cargo, telefone, observacoes, ativo). Lê quem tem `vendas.ler` ou `rh.ler`; grava quem tem `rh.editar`.
- `propostas.responsavel_id` é o vendedor. O gatilho `validar_vendedor_proposta` aceita só vendedor ativo: na criação, se não for vendedor, deixa a proposta sem vendedor; numa troca, recusa.
- Permissões novas `rh.ler` e `rh.editar`, mais o perfil RH. A Administração tem acesso total.

## RH: cadastro (`20261022000036_rh_cadastro.sql`, decisão 69)

- `setores` (nome único sem diferenciar maiúsculas, ativo) e `funcoes` (setor_id, nome único no setor, descrição, ativo). Todos os logados leem; grava quem tem `rh.editar`. Nada é apagado: fica inativo.
- `funcionarios`: nome completo, CPF (11 dígitos, único), RG, nascimento, telefone, e-mails pessoal e corporativo, endereço (cep, endereço, cidade, UF), contato de emergência, matrícula (única), `funcao_id` → funcoes (o setor vem da função), admissão, vínculo (CLT, PJ, Sócio, Temporário, Estágio ou vazio), situação (ativo, férias, afastado, desligado; desligado exige a data), `usuario_id` → usuarios (único, opcional: o login do ERP) e observações. Sem salário nem dados bancários (Financeiro).
- Lê quem tem `rh.ler` ou o próprio funcionário (`usuario_id = auth.uid()`); grava quem tem `rh.editar`. Auditoria em todas as tabelas.
- Gatilhos: `validar_funcao_funcionario` (função nova ou trocada precisa estar ativa); telefone e nascimento iguais à ficha e a `usuarios` (Meu perfil) nos dois sentidos (`funcionario_puxar_usuario`, `funcionario_para_usuario`, `usuario_para_funcionario`).
- O vendedor (`vendedores.usuario_id`) chega à ficha pelo mesmo `usuario_id`; não há coluna nova em `vendedores`.
- Permissão nova `rh.critica` (logins e perfis, entrega 4), dada ao perfil RH.
- Carga: 7 setores padrão, 4 funções de Engenharia e os 5 funcionários da lista do Gabriel; Gabriel, Guilherme e Pedro ligados aos seus logins.

## RH: documentos e vencimentos (`20261022000037_rh_documentos.sql`, decisão 69)

- `tipos_documento` (nome único, categoria, tem_validade, validade_meses padrão, aviso_dias = 30, descrição, ativo). Carga inicial: ASO, CNH, RG, NR-10, NR-11, NR-12, NR-18, NR-33, NR-35 (validade padrão só onde a norma fixa a periodicidade).
- `funcao_requisitos` (função × tipo) e `funcionario_requisitos` (requisitos individuais). Gravação por inclusão e remoção, com auditoria (`auditar_requisito`).
- `funcionario_documentos` (tipo, número, emissão, validade, arquivo no espaço privado `rh` em `{id do funcionário}/…`, observações, `substituido_em`, `excluido_em`). O gatilho `validar_documento_funcionario` exige validade nos tipos que vencem, confere a pasta do arquivo, manda o anterior do mesmo tipo para o histórico e não deixa mudar um documento lançado (só observações e a exclusão). Excluir o atual reativa o anterior (`reativar_documento_anterior`).
- Visão `situacao_requisitos` (security_invoker): por funcionário não desligado, cada requisito exigido (função + individual) e cada documento atual com validade, com a situação `em_dia`, `vencendo` (dentro do aviso), `vencido` ou `faltando`, na data de hoje em São Paulo.
- Leitura: `rh.ler` ou o próprio funcionário (`eh_meu_funcionario`); gravação: `rh.editar`. Storage `rh`: lê o RH ou o dono da pasta; envia o RH, só em pasta de funcionário existente.

## RH: integrações nos clientes (`20261022000038_rh_integracoes.sql`, decisão 69)

- `empresa_integracao` (empresa_id PK → empresas, validade_meses definida pelo cliente, observações): cliente com linha aqui exige integração. `empresa_documentos_exigidos` (cliente × tipo de documento).
- `funcionario_integracoes` (funcionário, cliente, realizada_em, validade, comprovante no espaço `rh` em `{id do funcionário}/integracoes/…`, observações, `substituido_em`, `excluido_em`), com as mesmas regras dos documentos: a nova manda a anterior do mesmo cliente para o histórico, lançada não muda, excluir a atual reativa a anterior.
- Visão `situacao_integracoes` (security_invoker): integrações atuais com a situação de hoje (aviso 30 dias antes); o nome do cliente vem de `nome_empresa(id)`, para o funcionário ver as próprias sem ler o cadastro de empresas.
- `liberacao_no_cliente(empresa, data)` e `funcionario_liberado(funcionário, empresa, data)` (security definer, só logados): liberado ou não na data e os motivos (férias/afastado, sem integração ou integração vencida, documento exigido pela função, individual ou pelo cliente faltando ou vencido na data). A Agenda vai usar para impedir o agendamento (resposta 8).
- Política nova `empresas_ler_rh`: quem tem `rh.ler` lê o cadastro de empresas (para escolher o cliente).

## RH: logins pelo RH (`20261022000039_rh_acessos.sql`, `20261022000040_rh_desligado_perde_acesso.sql`, `20261022000041_rh_acessos_funcoes.sql`, decisão 69)

- Políticas `usuario_perfis_ler_rh` e `usuario_permissoes_ler_rh`: quem tem `rh.critica` lê perfis e ajustes de todos.
- `conferir_gestao_acesso(usuário)`: exige `rh.critica`; quem não tem acesso total não muda a si mesmo nem quem tem acesso total.
- `definir_perfis_usuario(usuário, perfis[])` e `definir_permissao_usuario(usuário, módulo, ação, concedida|null)` (security definer, com auditoria): trocam perfis e ajustes individuais; não dão acesso total nem permissão que quem chama não tem; não tiram o acesso total do último usuário ativo que o tem. A migration 41 foi aplicada pelo Gabriel no SQL Editor em 22/10/2026 (por isso não aparece no histórico de migrations do Supabase).
- Gatilho `funcionarios_desligado_acesso`: ao mudar a situação para desligado, o usuário ligado fica inativo (protege o último com acesso total).
- Edge Function `rh-acesso` (criar_login, link_senha, desativar, reativar): usa a service_role só no Supabase; o login é bloqueado no Auth (`ban_duration`) além de `usuarios.ativo`. O ERP gera links (`generateLink`), nunca vê senhas.
- Migration 42 (`20261022000042_rh_acessos_rpc.sql`): `vincular_login_funcionario(ficha, usuário)`, `definir_login_ativo(usuário, ativo)` e `registrar_acesso_rh(usuário, dados)`, security definer com `rh.critica`. A Edge Function usa a service_role só no Auth; neste projeto a service_role não tem acesso às tabelas públicas.

## Frete e valor manual (`20261022000043_frete_valor_manual.sql`, decisão 70)

- `propostas.frete`: `CIF` ou `FOB`, padrão `CIF`. O local de entrega não é guardado: é sempre o endereço da empresa cliente.
- `custo_itens.valor_manual`: valor de venda **unitário** digitado à mão (decisão 99: o total do item é ele × `quantidade`; nulo = usa o calculado pelos custos). `copiar_custos` leva o valor para a nova revisão.
- O início do prazo de entrega fica no documento da proposta (`proposta_documentos.conteudo`, seção cronograma, campo `inicio`), sem coluna nova.

## Engenharia: Kanban e lista manual (`20261022000054_engenharia_kanban.sql`, decisão 96)

- `projetos.status`: `nao_iniciado` (padrão), `em_andamento`, `liberado`, `finalizado` ou `cancelado`; `pausado` (selo), `fabricacao_concluida_em` (obrigatória no finalizado) e `exemplo`. Projeto de exemplo pode não ter proposta nem cliente (`projetos_origem`). O gatilho `proteger_status_projeto` só deixa mudar status, pausa e término pelas funções.
- `projeto_eventos` (projeto, tipo criado/status/pausa, de, para, justificativa, dados, usuário, data): histórico; lê quem tem `engenharia.ler`; só as funções gravam.
- Funções: `mover_projeto(projeto, status, justificativa, data)`, `pausar_projeto`, `criar_projeto_exemplo`, `conjuntos_nao_liberados`, `propostas_aguardando_projeto` (sem ler Vendas), `cliente_nome(projetos)` (campo calculado) e gatilho `iniciar_projeto_automatico` (primeiro conjunto ou peça → Em andamento).
- `projeto_pecas.largura` (chapas lançadas à mão); `adicionar_peca` passa a gravar COD_MAT, largura e comprimento.
- Visão `painel_engenharia` (security_invoker): contagens por projeto para o Dashboard.
- Permissão `engenharia.aprovar` = Engenheiro Mecânico Chefe (individual, dada ao Gabriel). Perfil Engenharia sem `vendas.ler`; perfil Comercial sem `engenharia.ler`.

## Comunicação (`20261022000055_comunicacao.sql`, `20261022000056_comunicacao_chaves.sql`, decisão 100)
- `setor_lideres` (setor, funcionário, removido_em): líderes de cada setor, definidos pelo RH com `definir_lideres(setor, funcionarios[])`. Nada é apagado.
- `comunicados` (autor, alcance empresa/setores/pessoas, título, texto, urgente, exige_ciente, enviar_email, fixado_ate, anexo, lembrado_em, cancelado_em) e `comunicado_setores`. Gravados só pelas funções.
- `comunicado_destinatarios` (comunicado, usuário, funcionário, push_enviado_em, email_enviado_em, lido_em, ciente_em): uma linha por pessoa, gerada no envio.
- `push_aparelhos` (usuário, endpoint, chaves, nome, ativo, último envio): inscrições Web Push. Cada um vê só os seus; login desativado desativa os aparelhos.
- `segredos_servidor`: chaves VAPID criadas pela Edge Function; só a service_role lê.
- Funções: `enviar_comunicado`, `anexar_comunicado`, `marcar_comunicado_lido`, `dar_ciente_comunicado`, `cancelar_comunicado`, `comunicacao_meu_papel`, `comunicacao_pessoas` (sem dados pessoais), `comunicado_para_envio` e `registrar_envio_comunicado` (usadas pela Edge Function `comunicacao-envio`, como quem enviou), `registrar_aparelho`, `remover_aparelho`.
- Permissão `comunicacao.critica` = "Comunicado geral". Perfil "Funcionário" sem permissões. Bucket privado `comunicacao` ({comunicado}/{arquivo}). `comunicados` e `comunicado_destinatarios` no Realtime.

## Compras (decisão 101, migration 57)

- `compras_requisicoes` (código RC-AA-NNN, título, projeto com cópia do código e título, setor, precisa em, prioridade, status, cotação escolhida, solicitante). Status: aberta, em_cotacao, aguardando_aprovacao, aprovada, pedido_emitido, entregue, cancelada; só muda pelas funções.
- `compras_requisicao_itens` (grupo, descrição, quantidade, unidade, observação), `compras_cotacoes` (fornecedor, frete, prazo em dias, condição de pagamento, validade; uma por fornecedor), `compras_cotacao_precos` (preço unitário por item).
- `compras_pedidos` (código OC-AA-NNN, cotação, fornecedor, valores, previsão, status aguardando_entrega/entregue_parcial/entregue), `compras_eventos` (histórico), `compras_contadores` (RC e OC por ano).
- `fornecedores` ganhou `cnpj`, `categorias`, `condicao_pagamento`.
- Funções: `compras_enviar_aprovacao`, `compras_decidir` (Financeiro), `compras_emitir_pedido`, `compras_registrar_entrega`, `compras_cancelar`, `compras_total_cotacao`, `compras_projetos`, `compras_pecas_projeto`.

## Almoxarifado (decisão 104, migrations 61 a 63)
- `alm_itens` (produto da Biblioteca por `bib_tipo` + `bib_id`, unidade, saldo, mínimo, local, custo médio, ativo). Só mínimo, local e ativo mudam direto; o saldo muda só pelas funções.
- `alm_movimentos` (entrada, retirada, devolução, ajuste, estorno; quantidade com sinal, saldo depois, custo, retirada, movimento de origem, OC, motivo, quem e quando). Nunca é apagado; um estorno por lançamento.
- `alm_retiradas` (código RT-AA-NNN, funcionário com cópia do nome, destino projeto ou setor, observação), `alm_contadores`.
- `alm_solicitacoes` (item do estoque → requisição de Compras).
- Funções: `alm_estoque`, `alm_produtos`, `alm_adicionar_item`, `alm_ajustar`, `alm_registrar_retirada`, `alm_devolver`, `alm_estornar`, `alm_solicitar_compra` (usa `compras_solicitar` quando existir), `alm_compras_abertas`, `alm_funcionarios`, `alm_projetos`, `alm_setores`.

## Financeiro: contas a pagar (decisão 105, migration 65)

- `fin_contas_pagar` (uma por OC: `pedido_id` único, cópias de código, fornecedor e projeto, valor, `condicao_tipo` + `condicao_dias`, emissão, entrega, status aberta/paga/cancelada). Criada e atualizada só pelos gatilhos `fin_pedido_criado` e `fin_pedido_alterado` em `compras_pedidos` (lêem as colunas do Compras v2 por `to_jsonb`).
- `fin_parcelas` (número, vencimento, valor, pago, pago_em, `ativa`; parcela refeita fica inativa). `fin_pagamentos` (parcela, data, valor, forma, comprovante, quem lançou; estorno marca `estornado_em` e motivo). `fin_anexos` (orçamento no bucket `compras`; boleto, NF e outros no bucket privado `financeiro`, pasta = id da conta). `fin_eventos` (histórico).
- `fornecedores_pagamento` (banco, agência, conta, titular, PIX, prazo após o recebimento), separada de `fornecedores` para só o Financeiro ler.
- Funções: `fin_definir_parcelas`, `fin_alterar_vencimento`, `fin_registrar_pagamento`, `fin_estornar_pagamento` (financeiro.critica), `fin_anexar`, `fin_remover_anexo`, `compras_situacao_pagamento`. A situação pela data (vencida, hoje, em breve) é calculada na tela (`src/modules/financeiro/regras.ts`).

## Engenharia: solicitação de compra (`20261026000059_engenharia_solicita_compra.sql`, decisão 103)
- `compras_requisicoes.engenharia_revisao` (inteiro, R0 = 0): preenchida só nas requisições enviadas pela Engenharia; única por projeto.
- `engenharia_solicitar_compra(projeto, itens jsonb, necessario_em, prioridade, observacoes)`: exige `engenharia.editar`; cria a RC (setor Engenharia), cancela as RCs da Engenharia do projeto ainda abertas ou em cotação (evento em `compras_eventos`) e grava `projeto_eventos` tipo `compra`.
- `engenharia_solicitacoes(projeto)`: revisões enviadas com status e itens, sem valores (exige `engenharia.ler`).
