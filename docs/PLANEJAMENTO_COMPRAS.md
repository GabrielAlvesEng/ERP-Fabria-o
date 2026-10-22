# Planejamento do módulo Compras (v1, 22/10/2026)

Pedido do Gabriel (22/10/2026): "vamos executar o plano de compras e liberar agora". Não havia um planejamento de Compras escrito; este documento foi montado com o Documento Mestre (§5.3), o fluxograma (bloco "Compras e Financeiro") e as decisões já aprovadas, e implementado na mesma hora (decisão 101, ver `REGRAS_DE_NEGOCIO.md`). As perguntas do item 7 podem mudar detalhes depois.

## 1. O que o setor faz

Recebe a necessidade de material ou serviço (de um projeto da Engenharia ou de outro setor), pede preço a fornecedores, compara, leva a compra para o Financeiro aprovar (decisão 3: quem aprova e paga é o Financeiro), emite a ordem de compra e acompanha a entrega até o material chegar.

## 2. Fluxo

```
Requisição (aberta) → Em cotação → Aguardando aprovação (Financeiro) → Aprovada → Pedido emitido → Entregue
                           ↑                │ reprovada (com motivo)
                           └────────────────┘
Cancelada: a qualquer momento antes do pedido, com justificativa.
```

- **Requisição** `RC-AA-NNN`: origem (projeto da Engenharia ou setor), título, data em que precisa, prioridade (normal/urgente), itens (descrição, grupo, quantidade, unidade, observação).
- **Importar a lista de materiais do projeto**: Compras escolhe um projeto e o ERP traz a lista da Engenharia já somada (quantidade × quantidade dos conjuntos): chapas em kg por material e espessura, perfis em metros, itens comerciais em unidades. Dá para tirar e ajustar linhas antes de gravar.
- **Cotações**: uma por fornecedor, com preço unitário por item, frete, prazo de entrega (dias), condição de pagamento e validade. A primeira cotação leva a requisição para "Em cotação".
- **Comparação**: tabela item × fornecedor com o menor preço de cada item em verde e o total de cada cotação (itens + frete); a mais barata completa fica marcada.
- **Enviar para aprovação**: Compras escolhe a cotação vencedora (precisa ter preço em todos os itens). Requisição e cotações ficam travadas.
- **Aprovação**: só quem tem `financeiro.editar` (perfil Financeiro e Administração) aprova ou reprova. Reprovar exige motivo e volta para "Em cotação".
- **Ordem de compra** `OC-AA-NNN`: emitida por Compras a partir da aprovada, com previsão de entrega. Imprime em PDF pelo navegador (dados da Fabriaço, fornecedor, itens, valores, frete, condição, prazo, projeto).
- **Entrega**: Compras registra entrega parcial ou total, com data e observação. Pedido com previsão vencida e não entregue aparece como atrasado. O recebimento com conferência (aceito/rejeitado) e o estoque são do Almoxarifado, que vem depois.
- **Histórico**: cada passo (criação, cotação, envio, aprovação, reprovação, pedido, entrega, cancelamento) fica registrado com quem e quando.

## 3. Telas (abas do módulo)

1. **Painel**: indicadores (abertas, em cotação, aguardando aprovação, pedidos em aberto, atrasados, valor em pedidos abertos) e quadro por etapa com os cartões das requisições. Filtro por projeto e busca.
2. **Ordens de compra**: lista com fornecedor, projeto, valor, previsão, situação e atraso.
3. **Fornecedores**: o mesmo cadastro de Administração → Predefinições, agora com CNPJ, categorias e condição de pagamento (antecipado, após o recebimento, a combinar), que o fluxograma pede para o pagamento.
4. **Requisição** (ao abrir um cartão): dados, itens, cotações e comparação, aprovação, ordem de compra, entrega e histórico.

## 4. Permissões

- `compras.ler` abre o módulo; `compras.criar` cria requisições; `compras.editar` cota, envia para aprovação, emite pedido, registra entrega e edita fornecedores.
- Novo perfil **Compras** (ler, criar, editar). O perfil **Financeiro** ganha `compras.ler` para ver e aprovar.
- Compras não lê Vendas nem a Engenharia inteira: o projeto e a lista de materiais chegam por funções do banco só com o necessário (código, título, cliente e materiais, sem valores da proposta).

## 5. Dados

`compras_requisicoes`, `compras_requisicao_itens`, `compras_cotacoes`, `compras_cotacao_precos`, `compras_pedidos`, `compras_eventos`, `compras_contadores`; colunas novas em `fornecedores`. Status só mudam pelas funções do banco; tudo com auditoria e sem exclusão física (cancelamento).

## 6. Fora desta versão

Recebimento com conferência e estoque (Almoxarifado), pagamento (Financeiro), anexos de orçamento do fornecedor, compra dividida entre fornecedores, envio da cotação/pedido por e-mail, outros setores abrindo requisição sem ter acesso a Compras.

## 7. Perguntas para o Gabriel

1. Outros setores (Fabricação, Manutenção...) devem abrir requisições sozinhos, sem entrar em Compras? Hoje só quem tem acesso a Compras cria.
2. Há valor a partir do qual a aprovação muda (ex.: compras pequenas sem aprovação do Financeiro)? Hoje toda compra passa pelo Financeiro.
3. Pode dividir uma requisição entre fornecedores (cada item com o mais barato)? Hoje vai uma cotação inteira.
4. Quantas cotações mínimas antes de enviar para aprovação? Hoje basta uma.
5. Quem deve receber o perfil Compras (nome das pessoas)?
