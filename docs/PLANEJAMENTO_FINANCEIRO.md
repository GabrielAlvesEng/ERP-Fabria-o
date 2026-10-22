# Planejamento do módulo Financeiro (v1, 22/10/2026)

Pedido do Gabriel (22/10/2026): o Financeiro "recebe os itens que têm que ser pagos, com o anexo do orçamento, informações, data para pagamento (deve ter avisos que está próximo do vencimento)". O módulo continua bloqueado (decisão 95) até este planejamento ser aprovado. Este documento parte do que já existe: Compras liberado (decisão 101), o fluxograma (blocos "Compras e Financeiro" e "Faturamento e recebimento"), o Documento Mestre §5.7 e as decisões 2, 3, 4, 12 e 22.

## 1. O que o setor faz

1. **Paga** o que a empresa compra: cada ordem de compra de Compras vira uma conta a pagar, com o orçamento do fornecedor anexado, e o Financeiro paga na data certa (decisão 4: antecipado ou após o recebimento, conforme o fornecedor).
2. **Aprova** as compras antes do pedido (decisão 3). Isso existe hoje dentro de Compras (etapa "Aguardando aprovação"), mas o plano v2 de Compras propõe tirar essa etapa (pergunta 1).
3. **Recebe** dos clientes: emite NF na finalização ou por marcos de medição (decisão 2, marcos do kick-off) e acompanha o recebimento. Hoje isso é só mover o cartão para "Emitido NF" e "Pago" no Kanban de Vendas (decisão 12).
4. Depois: despesas que não passam por Compras, fluxo de caixa, resultado por projeto e indicadores (Documento Mestre §5.7).

Proposta: fazer em **três entregas**, começando pelo que o Gabriel pediu (contas a pagar). Esta aprovação é para a entrega 1; as entregas 2 e 3 estão aqui só para mostrar o caminho e serão detalhadas antes de começar.

## 2. Entrega 1: Contas a pagar das compras (o que foi pedido)

### 2.1 Fluxo

```
Compras: solicitação → orçamentos → escolha por item → Compras emite a OC (uma por fornecedor)
                                                         │
                                                         ▼  (automático)
Financeiro: conta a pagar criada → A pagar → Vence em breve → Vencida
                                        │
                                        └──► Paga (com comprovante)   (ou Parcialmente paga, se houver parcelas)
```

- **A conta nasce sozinha** quando Compras emite a ordem de compra `OC-AA-NNN`. Ninguém digita nada de novo: fornecedor, projeto, itens, valor (itens + frete), condição de pagamento, previsão de entrega e o **orçamento anexado** vêm da OC e da cotação escolhida.
- **Data de pagamento (vencimento):** vem calculada da OC pela condição de pagamento (Compras v2, item 2.4); a partir daí a data é do Financeiro, que confirma ou ajusta:
  - Antecipado: vence na data da emissão da OC.
  - Após o recebimento: fica "aguardando entrega" até Compras registrar a entrega; aí vence em N dias depois da entrega (N do cadastro do fornecedor, ex.: 28 dias).
  - Parcelado (ex.: 30/60/90): o ERP cria as parcelas, cada uma com data e valor; o Financeiro pode mudar.
  - A combinar: fica sem data e aparece em destaque ("definir vencimento") até o Financeiro preencher.
- **Pagar:** o Financeiro registra data, valor pago, forma (PIX, boleto, transferência, cartão, dinheiro) e anexa o comprovante. Pode pagar parcial. Quando tudo está pago, a conta fica "Paga" e Compras vê na OC que ela foi paga.
- **Boleto/NF do fornecedor:** o Financeiro (ou Compras) anexa o boleto e a NF do fornecedor na conta, junto do orçamento.
- **Cancelar:** se Compras cancelar a OC antes de pagar, a conta é cancelada com motivo. Conta paga não se cancela; estornar um pagamento lançado errado é ação crítica (pede senha, como nas exclusões).
- **Histórico:** cada passo (criada, vencimento alterado, pagamento, anexo, cancelamento) fica registrado com quem e quando.

### 2.2 Avisos de vencimento

- **Sino no topo** (igual ao sino de Vencimentos do RH): quem tem acesso ao Financeiro vê a contagem de contas vencidas, que vencem hoje e nos próximos 7 dias; clicar leva à lista já filtrada.
- **Cores na lista:** vermelho vencida, laranja vence hoje, amarelo vence em até 7 dias, verde paga.
- **Aviso no celular e e-mail** (pelo módulo Comunicação, decisão 100): todo dia de manhã, um resumo para as pessoas do Financeiro com o que vence hoje e o que venceu sem pagamento. *(Recomendado; ver pergunta 3.)*

### 2.3 Telas (abas do módulo)

1. **Painel:** cartões com "Vencidas", "Vencem hoje", "Próximos 7 dias", "Total a pagar nos próximos 30 dias" e "Pago no mês"; gráfico de linha do que vence por semana; lista curta das próximas 10 contas.
2. **Contas a pagar:** lista (com filtro por situação, fornecedor, projeto e período) e um quadro estilo Kanban com as colunas **Aguardando entrega · A pagar · Vence em breve · Vencida · Paga**. As colunas de prazo mudam sozinhas pela data; arrastar para "Paga" abre a tela de pagamento.
3. **Conta (ao abrir um cartão):** dados da OC e do fornecedor (com dados bancários / chave PIX), itens, **orçamento anexado** (abre o PDF ou imagem), boleto e NF, parcelas com vencimento, pagamentos com comprovante, e histórico.
4. **Fornecedores (dados de pagamento):** o mesmo cadastro de Compras, com uma parte que só o Financeiro vê e edita: banco, agência, conta, chave PIX, prazo padrão após o recebimento.

### 2.4 O que vem de Compras (combinado com a conversa de Compras)

O plano v2 de Compras (`/mnt/project-files/compras/PLANEJAMENTO_COMPRAS_V2.md`) já prevê o que o Financeiro precisa: orçamento anexado em cada cotação, escolha do fornecedor por item com uma OC por fornecedor (o Financeiro recebe uma conta por OC) e a OC saindo com a data de pagamento calculada. Para o Financeiro funcionar, a OC precisa levar:

- **Condição de pagamento escolhida, não texto livre:** antecipado, após o recebimento em N dias, parcelado (ex.: 30/60/90 dias) ou a combinar.
- **Data de pagamento** (ou as datas das parcelas) calculada pela condição.
- **O arquivo do orçamento** da cotação escolhida, que o Financeiro consegue abrir.
- **A data de entrega** registrada (para as compras "após o recebimento") e o **cancelamento** da OC, se houver.

A conta a pagar é criada pelo banco no momento em que a OC é emitida, e atualizada quando a entrega é registrada ou a OC é cancelada. Compras não precisa fazer nada além de emitir a OC.

### 2.5 Permissões

- `financeiro.ler`: abre o módulo e vê as contas (perfil Financeiro já tem).
- `financeiro.editar`: define vencimentos, registra pagamentos, anexa documentos, edita dados bancários do fornecedor (perfil Financeiro já tem; também é a permissão que aprova compras).
- `financeiro.critica` (nova): estornar pagamento. Perfil Financeiro e Administração.
- Compras não vê valores pagos nem dados bancários, só se a OC está "a pagar", "paga" ou "cancelada" (por função do banco, como já é feito com a Engenharia).

### 2.6 Dados

- `fin_contas_pagar`: origem (por enquanto só "compra"), pedido de compra, fornecedor, projeto, descrição, valor total, condição, situação, motivo de cancelamento.
- `fin_parcelas`: conta, número, vencimento, valor, situação.
- `fin_pagamentos`: parcela, data, valor, forma, comprovante, quem lançou; estorno com motivo (nada é apagado).
- `fin_anexos`: conta, tipo (orçamento, boleto, NF, outro), arquivo no bucket privado `financeiro`.
- `fin_eventos`: histórico.
- `fornecedores_bancarios`: dados bancários separados do cadastro, só para o Financeiro (RLS).
- Situação calculada pela data no banco (vencida, vence hoje, em breve); mudança só pelas funções do banco, com auditoria.

## 3. Entrega 2: Contas a receber e faturamento (depois)

- Proposta aprovada vira um **contrato a receber** com o valor aprovado; os marcos do kick-off (descrição e %) viram as parcelas a faturar. Sem marcos: uma parcela única na finalização (decisão 2).
- O Financeiro emite a NF (número, data, valor, arquivo), lança o recebimento (data, valor, comprovante) e o ERP move o cartão em Vendas para "Emitido NF" e "Pago" sozinho (decisões 12 e 22). Avisos de NF a emitir e de recebimento atrasado.
- Encerramento financeiro do projeto quando a entrega estiver concluída e tudo recebido (fluxograma).

## 4. Entrega 3: Visão da empresa (depois)

Despesas que não passam por Compras (aluguel, energia, impostos, combustível da Frota, folha, com recorrência mensal), **fluxo de caixa** (previsto × realizado, por semana e mês), **resultado por projeto** (recebido − pago nas compras do projeto, comparado com o custo da proposta), indicadores e relatórios. Salário e dados bancários dos funcionários ficam aqui, não no RH (decisão 69).

## 5. Fora da entrega 1

Contas a receber, despesas avulsas, fluxo de caixa, conciliação bancária e integração com banco, emissão de NF pelo ERP (a NF continua sendo emitida no sistema da prefeitura/contador; o ERP só guarda o arquivo), impostos.

## 6. Perguntas para o Gabriel

1. **Aprovação antes do pedido** (a mesma pergunta da conversa de Compras, uma resposta vale para as duas): hoje o Financeiro aprova a cotação antes de Compras emitir a OC (decisão 3). Na sua descrição, a OC vai direto para o Financeiro pagar. Recomendo seguir a sua descrição e tirar a aprovação: o Financeiro continua vendo tudo antes de pagar e pode segurar o pagamento com um motivo. Se quiser manter um controle, uma alternativa é exigir aprovação só acima de um valor.
2. **Quantos dias antes** o aviso de "vence em breve" deve aparecer? Recomendo 7 dias no painel e no sino, e um aviso no dia.
3. **Aviso no celular/e-mail:** quer o resumo diário pelo módulo Comunicação, além do sino? Para quem (nomes)?
4. **Parcelas:** os fornecedores costumam parcelar (30/60/90)? Se raramente, posso deixar só vencimento único na entrega 1.
5. **Quem paga:** quais pessoas recebem o perfil Financeiro?
6. **Ordem das entregas:** confirma começar pelas contas a pagar e depois contas a receber (entrega 2)?
