# Planejamento do módulo Almoxarifado (v1, 22/10/2026)

**Estado: aprovado ("Pode executar", seguindo as recomendações das perguntas). Entregas 1, 2 e 4 feitas e liberadas em 26/10/2026 (decisão 104); a entrega 3 (recebimento) vem com o Compras v2.**

Base: a explicação do Gabriel de 22/10/2026, o Documento Mestre (§5.4), o fluxograma (bloco "Almoxarifado": recebimento parcial aceito ou rejeitado, estoque ou destino direto no projeto) e o planejamento v2 de Compras (`/mnt/project-files/compras/PLANEJAMENTO_COMPRAS_V2.md`), com quem este plano foi combinado.

O que o Gabriel pediu:
- ter a **lista do que está no estoque**, com quantidade etc.;
- ter um lugar para **solicitar a compra** de um item quando o estoque estiver baixo;
- ter a **retirada de itens**: quando o almoxarife entrega um item a um funcionário (ex.: um disco de corte para o montador Kleber), dá baixa no produto e anota **para onde foi usado**.

## Hoje

- O Almoxarifado está no menu, bloqueado, só com a página "em construção" (decisões 94 e 95). As permissões `almoxarifado` ler, criar e editar já existem no banco, sem perfil.
- Compras (decisão 101) tem requisições, cotações, ordens de compra (OC) e entrega parcial ou total, mas o item da requisição é texto livre (não aponta para um produto).
- A **Biblioteca de Materiais** (decisão 48) já cadastra chapas, perfis e itens (Comerciais, Fixadores, Consumíveis), e a Engenharia já aponta as peças para ela. O plano v2 de Compras recomenda usar a Biblioteca como o **cadastro único de produtos** (pergunta 2 de Compras).
- O RH tem o cadastro de funcionários (decisão 69), que serve para saber para quem foi a retirada.

## 1. O que o setor faz

Guarda o que é de estoque (consumíveis como discos de corte e de desbaste, eletrodos, arame, EPIs, parafusos, tintas), confere o que chega das compras, entrega os itens aos funcionários com baixa e registro de onde foram usados, e avisa quando um item está acabando para Compras comprar.

## 2. Fluxo

```
                 ┌──────────── Solicitar compra (estoque baixo) ──────────────┐
                 │                                                            ▼
Estoque ── Retirada (funcionário + onde foi usado) ── baixa no saldo     Compras: cotação → OC
   ▲                                                                          │
   └──── Recebimento da OC (conferido: aceito / rejeitado, parcial) ◄─────────┘
```

### 2.1 Estoque (a lista)
- Um item de estoque é um **produto do cadastro único** (Biblioteca/Compras) que o Almoxarifado decide controlar. O Almoxarifado **não cria produto**: se faltar, pede a Compras (ou a quem edita a Biblioteca) para cadastrar.
- Para cada item: código e descrição (do cadastro), unidade, **saldo**, **estoque mínimo**, local (prateleira/armário), último custo e data da última compra (de Compras), situação: **OK**, **Baixo** (saldo no mínimo ou abaixo), **Zerado**.
- Busca, filtro por grupo (Consumíveis, Fixadores, Comerciais, Chapas, Perfis), por situação e por local.
- O saldo **só muda por movimento** (entrada, retirada, devolução, ajuste). Ninguém digita o saldo direto, e o saldo nunca fica negativo.

### 2.2 Solicitar compra
- Na lista, cada item Baixo ou Zerado tem **"Solicitar compra"**; também dá para marcar vários e solicitar de uma vez.
- O ERP sugere a quantidade (o que falta para chegar a duas vezes o mínimo; o almoxarife muda).
- Vira uma **solicitação em Compras com origem "Almoxarifado"**, sem projeto, com os itens já ligados ao produto (função que Compras deixa pronta, plano v2 item 2.1).
- Enquanto há solicitação em aberto para o item, ele mostra "Compra solicitada em DD/MM/AAAA (RC-26-012)", para não pedir duas vezes.

### 2.3 Retirada (baixa)
- Tela simples, pensada também para o **celular** no balcão: produto (busca por nome ou código), quantidade, **funcionário que recebeu** (lista do RH, só ativos) e **onde vai ser usado**:
  - **Projeto** (código e nome, ex.: 26-01-001 Plataforma), ou
  - **Setor/uso interno** (Fabricação, Manutenção, Pintura, Obra em campo…), com uma observação livre (ex.: "lixadeira da cabine 2").
- Data e hora e quem registrou (o almoxarife logado) entram sozinhos.
- Dá para lançar vários itens na mesma retirada (ex.: 2 discos e 1 par de luvas para o Kleber).
- **Devolução**: item que voltou sem uso entra de novo no saldo, ligado à retirada original.
- Corrigir uma retirada errada é por **estorno** (com motivo), nunca apagando.

### 2.4 Recebimento das compras
- Lista das OCs a receber (de Compras), com fornecedor, previsão e atraso.
- O almoxarife confere item a item: quantidade recebida, **aceita** ou **rejeitada** (com motivo), e pode receber em partes.
- Item de estoque aceito **entra no saldo** com o custo da OC.
- Item de **projeto** (chapas, perfis e comerciais da lista da Engenharia) não se mistura ao estoque: fica **reservado para o projeto** ("destino direto no projeto" do fluxograma) até ser entregue à Preparação/Fabricação. Sobra de projeto pode virar estoque (pergunta 3).
- O recebimento marca a entrega da OC em Compras (parcial ou total), conforme a pergunta 3 do plano de Compras.

### 2.5 Ajuste de inventário
- Contagem física: o almoxarife informa o saldo contado e o ERP lança a diferença como **ajuste**, com motivo obrigatório (perda, quebra, contagem). Só quem tem `almoxarifado.editar`.
- Na primeira vez, é assim que se carrega o **estoque inicial** (ou por planilha, pergunta 7).

### 2.6 Avisos
- Item que ficou Baixo ou Zerado aparece no sino do topo para quem tem o Almoxarifado (mesmo padrão dos vencimentos do RH).

## 3. Telas (abas do módulo)

1. **Painel**: itens Baixos e Zerados (com "Solicitar compra"), OCs a receber e atrasadas, retiradas do mês, os itens mais retirados e o consumo por projeto e por funcionário no mês.
2. **Estoque**: a lista do item 2.1. Ao abrir um item: dados, mínimo e local (editáveis), e o **histórico de movimentos** (entradas, retiradas, devoluções, ajustes), com quem, quando, para quem e onde.
3. **Retiradas**: botão "Nova retirada" e a lista com filtros por período, funcionário, projeto e setor. Daqui sai o "quanto o Kleber retirou no mês" ou "quanto de disco foi para o 26-01-001".
4. **Recebimentos**: OCs a receber e as já recebidas, com a conferência do item 2.4.

## 4. Integrações com os outros módulos

- **Compras**: cadastro único de produtos; solicitação com origem Almoxarifado; recebimento da OC. Compras vê o saldo dos itens (só leitura).
- **RH**: funcionários ativos na retirada.
- **Engenharia**: projetos para o destino da retirada e para a reserva dos materiais recebidos. O Almoxarifado vê só código, nome e cliente do projeto (como Compras faz hoje), por funções do banco.
- **Custos do projeto (depois)**: as retiradas por projeto já ficam gravadas com custo, para um dia somarem no custo real do projeto.

## 5. Permissões

- `almoxarifado.ler`: vê estoque, retiradas e recebimentos.
- `almoxarifado.criar`: registra retirada e devolução e solicita compra.
- `almoxarifado.editar`: recebe OCs, faz ajuste de inventário, estorno, e muda mínimo e local.
- Novo perfil **Almoxarifado** (ler, criar, editar). O perfil **Compras** ganha `almoxarifado.ler`.
- Tudo é garantido no banco (RLS e funções), não só na tela.

## 6. Dados (resumo)

- `alm_itens`: o produto controlado (o par `bib_tipo` + `bib_id` do cadastro único), saldo, mínimo, local, custo médio.
- `alm_movimentos`: entrada (recebimento), retirada, devolução, ajuste e estorno; quantidade, saldo depois, custo, funcionário, projeto ou setor, observação, OC de origem, quem registrou e quando. Só entra por funções do banco, nunca é apagado.
- `alm_retiradas`: o cabeçalho da retirada com vários itens (funcionário, destino, data).
- `alm_recebimentos` e `alm_recebimento_itens`: conferência da OC (recebido, aceito, rejeitado e motivo).
- `alm_reservas`: material recebido para um projeto, até a entrega à Preparação/Fabricação.

## 7. Entregas sugeridas

1. **Estoque e retirada**: itens de estoque em cima do cadastro de produtos, estoque inicial (ajuste ou planilha), mínimo e local, retirada com funcionário e destino, devolução, estorno e histórico. Já resolve o dia a dia do almoxarife.
2. **Solicitar compra** para Compras (depende da entrega 1 do plano v2 de Compras: produtos e origem).
3. **Recebimento das OCs** com conferência, entrada no estoque e reserva para projeto.
4. **Painel e aviso no sino**.

## 8. Perguntas para o Gabriel

1. **Cadastro de produtos:** o Almoxarifado usa o mesmo cadastro de produtos de Compras (a Biblioteca de Materiais, pergunta 2 de Compras) e não cria produto sozinho? Recomendo que sim, para não ter dois nomes para o mesmo disco.
2. **Recebimento:** quem confere e dá "Recebido" na compra é o Almoxarifado? Recomendo que sim (igual à recomendação da pergunta 3 de Compras).
3. **Material de projeto** (chapas, perfis, comerciais da lista da Engenharia): fica reservado para o projeto, fora do estoque comum, e a sobra pode voltar ao estoque? Recomendo que sim.
4. **Retirada:** basta registrar quem recebeu e quem entregou, ou o funcionário precisa confirmar (ex.: com a senha dele no celular)? Recomendo só registrar nesta versão.
5. **Onde foi usado:** projeto ou setor/uso interno com observação é suficiente? Há outro destino que vocês usam (veículo, obra em campo de um cliente, ferramenta)?
6. **EPIs** (luvas, óculos, protetor auricular) entram no Almoxarifado? Se sim, precisa da **ficha de entrega de EPI** por funcionário (NR-6), que poderia aparecer também na ficha do RH?
7. **Estoque inicial:** existe uma planilha com o que tem hoje (produto, quantidade, local)? Se sim, eu importo; se não, o almoxarife lança por contagem.
8. **Mínimo:** cada item tem um estoque mínimo definido pelo almoxarife? Quer também um máximo?
9. **Locais:** é um almoxarifado só (na fábrica) ou há estoque em obra/caminhão que precisa saldo separado? Recomendo um só nesta versão.
10. **Pessoas:** quem recebe o perfil Almoxarifado (nomes)?
