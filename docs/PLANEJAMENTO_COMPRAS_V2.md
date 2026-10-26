# Compras v2: o que muda com a explicação do Gabriel (22/10/2026)

Base: a explicação do Gabriel de 22/10/2026 (Engenharia, Compras, Almoxarifado e Financeiro) comparada com a versão 1 (decisão 101). **Aprovado pelo Gabriel com "Pode executar" (recomendações das 4 perguntas) e implementado como decisão 107.** Na pergunta 4, valeu o envio por revisão já feito pela Engenharia (decisão 103).

## 1. O que já está certo e continua

- Cadastro de fornecedores (aba Fornecedores).
- Cotações por fornecedor, com preço por item, frete, prazo, pagamento e validade.
- Planilha de comparação item × fornecedor, com o menor preço em verde.
- Ordem de compra com número `OC-AA-NNN` e PDF, entrega parcial ou total, histórico.

## 2. O que muda

### 2.1 Quem pede a compra

- **Engenharia:** na Lista de materiais do projeto entra o botão **"Solicitar compra"**. Ele manda a lista somada (chapas em kg, perfis em m, comerciais em un) para Compras como uma solicitação ligada ao pedido. Hoje é Compras quem puxa a lista; passa a ser a Engenharia quem envia.
- **Almoxarifado:** pede itens de estoque (consumíveis, sem ligação com pedido) quando vê o estoque baixo. Compras deixa pronta a função que recebe esse pedido; a tela fica com a conversa do Almoxarifado.
- Compras continua podendo abrir uma solicitação à mão.
- Cada solicitação mostra a origem: Engenharia (com o pedido) ou Almoxarifado (estoque).

### 2.2 Cadastro de produtos (novo)

- Aba **Produtos**: tudo que é comprado, com descrição, grupo, unidade, especificação, código, fornecedores que já venderam e o **histórico de compras** (data, fornecedor, quantidade, preço, OC). Na ficha aparecem a última compra, onde comprou e o último preço.
- Recomendação: usar a **Biblioteca de Materiais** que já existe (chapas, perfis, comerciais, fixadores e consumíveis, decisão 48) como o cadastro de produtos, para não ter dois cadastros do mesmo item. Compras ganha permissão para cadastrar e editar itens nela.
- Cada linha da solicitação aponta para um produto. Ao fechar uma OC, o histórico do produto é atualizado sozinho.

### 2.3 Orçamentos e escolha por item

- Cada orçamento recebido do fornecedor pode ter o **arquivo anexado** (PDF ou imagem).
- Na planilha de comparação, o comprador **escolhe o fornecedor de cada item** (não mais um fornecedor para a requisição inteira). O ERP sugere o menor preço.
- "Gerar ordens de compra" cria **uma OC por fornecedor** com os itens escolhidos dele.

### 2.4 Ordem de compra vai para o Financeiro pagar

- A OC sai de Compras com o orçamento anexado, os valores, a condição e a **data de pagamento** (calculada pela condição: antecipado = na emissão; após o recebimento = na entrega + prazo).
- Ela entra na fila **"A pagar"** do Financeiro, que mostra aviso quando o vencimento está perto. A tela de pagamento é da conversa do Financeiro; Compras entrega os dados prontos.
- Ver pergunta 1 sobre a aprovação.
- Combinado com o Financeiro (docs/PLANEJAMENTO_FINANCEIRO.md): a OC leva a condição de pagamento estruturada (antecipado, após o recebimento, parcelado ou a combinar, mais os dias, ex.: 28 ou 30/60/90), o arquivo do orçamento (num local que o Financeiro consegue ler), a data de entrega e a situação "cancelada" com motivo. O Financeiro cria a conta a pagar sozinho quando a OC é emitida, e Compras mostra na OC se ela já foi paga.

### 2.5 Quadro (Kanban)

Colunas por item, para ver o que falta comprar mesmo quando uma solicitação foi dividida entre fornecedores:

**À comprar → Em cotação → Comprado (OC emitida) → Recebido**

O cartão mostra o item, a solicitação, o pedido (ou "Estoque"), a quantidade e o fornecedor escolhido. Também dá para ver o quadro por solicitação.

## 3. O que sai

- A etapa "Aguardando aprovação" e o botão "Escolher e enviar" de uma cotação inteira (substituídos pela escolha por item e pela geração das OCs).

## 4. Entregas sugeridas

1. Produtos (Biblioteca como cadastro, ficha com histórico) e solicitações com origem.
2. Botão "Solicitar compra" na Lista de materiais da Engenharia.
3. Anexo do orçamento, escolha do fornecedor por item e geração de várias OCs.
4. Kanban por item e a fila "A pagar" entregue ao Financeiro (dados e avisos de vencimento).

## 5. Perguntas

1. **Aprovação:** antes, a regra (decisão 3) era o Financeiro aprovar a compra e depois pagar. Pela sua explicação, a OC vai direto para o Financeiro pagar. Tiro a aprovação? Recomendo tirar: a OC vai direto para "A pagar".
2. **Produtos:** uso a Biblioteca de Materiais como cadastro de produtos (recomendado) ou faço um cadastro separado só de Compras?
3. **Recebimento:** quem marca "Recebido": Compras ou o Almoxarifado ao conferir a entrega? Recomendo o Almoxarifado, quando o módulo dele estiver liberado; até lá, Compras.
4. **Engenharia:** a lista enviada pela Engenharia trava (nova revisão para mudar), como no planejamento da Engenharia, ou pode ser enviada mais de uma vez livremente? Recomendo travar e enviar diferenças como nova solicitação.

## 6. Respostas do Gabriel (26/10/2026)

1. Pode ir direto para o Financeiro pagar.
2. Compras é a única que cadastra e organiza a biblioteca; ela sai da Administração e vira a biblioteca geral de onde todos puxam.
3. Quem marca recebido é o Almoxarifado.
4. Depois de enviada pela Engenharia a lista trava, mas pode haver revisão; na nova revisão fica descrito quanto era e quanto é agora.

Sobre o planejamento v1: Fabricação ainda não tem acesso; sem aprovação por enquanto; o comprador escolhe os itens de cada fornecedor e gera a OC, e o item sai da cotação; um orçamento basta; por enquanto só o Gabriel tem o perfil Compras.
