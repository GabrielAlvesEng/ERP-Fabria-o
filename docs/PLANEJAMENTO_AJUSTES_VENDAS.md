# Planejamento: ajustes em Vendas (pedido de 20/10/2026)

Versão 1, 20/10/2026. **Estado: aprovado com todas as recomendações (decisões 39 a 44).** Entregas 1, 2 e 3 feitas e testadas em localhost (sem deploy).
Pedido original: `docs/PEDIDO_AJUSTES_VENDAS_20261020.md`. Tudo será feito e testado só em localhost (decisão 37).

Itens marcados **[MUDA REGRA]** alteram uma decisão já aprovada; ao aprovar, a decisão antiga fica registrada como substituída. **[DECIDIR]** são perguntas; cada uma traz a minha recomendação.

---

## A. Kanban e follow-up

**A1. Sai a coluna Follow-up [MUDA REGRA: Documento Mestre 8.4/8.6 e decisão 23 do Kanban].**
- O Kanban fica: À enviar → Enviados → Aprovado / Reprovado → Finalizado → Emitido NF → Pago.
- No card de **Enviados** aparece uma data pequena "Retorno dd/mm". No dia (ou depois) aparece um ícone de **alerta** (triângulo âmbar) no card.
- "Registrar follow-up" (canal, resumo, próxima data) continua no detalhe da proposta e ganha um atalho no próprio card.
- Hoje **nenhuma proposta** está em Follow-up, então não há nada a migrar. O valor "Follow-up" continua aceito no histórico antigo, mas não se move mais para ele.

**A2. Notificação para Vendas.**
- Um **sino** na barra superior para quem tem acesso a Vendas, com o número de retornos vencidos e a lista (clicar abre a proposta).
- **[DECIDIR]** Também mostrar notificação do Windows (a do navegador) uma vez por dia por proposta, enquanto o ERP estiver aberto? Recomendo **sim**, com permissão pedida na primeira vez. E-mail automático fica para depois (precisa de servidor de envio).
- **[DECIDIR]** A notificação vai para **todo o setor de Vendas** ou só para o **responsável** da proposta? Recomendo: o responsável recebe; o sino mostra a todos de Vendas (decisão 13: todos veem todas).

## B. Planilha de custos — Materiais

**B1. Materiais separados em Chapas, Perfis e Comerciais**, sem coluna "Tipo". Cada um é um bloco com seu botão "Adicionar". As linhas de materiais já existentes vão para o bloco do tipo delas.

**B2. Comerciais pedem só a quantidade** (sem Und/Peso/Mts). Total = quantidade × preço unitário.

**B3. Coluna Material antes do perfil/chapa** (Inox 304, Inox 316L, Carbono…).
- **[DECIDIR]** De onde vem a lista? Recomendo usar o **catálogo COD_MAT** que já existe (124 materiais, o mesmo da Engenharia e do SolidWorks), mostrando o nome curto (ex.: "IN-001 — AISI 304"). Assim custo, Engenharia e Compras falam o mesmo código.
- **[DECIDIR]** O preço da lista muda conforme o material? (ex.: tubo 1" em inox 304 tem um preço; em carbono, outro). Recomendo: a lista de preços ganha a coluna Material; ao escolher o material, a lista de perfis/chapas mostra primeiro os daquele material, e itens sem material continuam aparecendo.

**B4. Arrastar para reordenar** linhas de custo (ícone ⋮⋮ à esquerda), em todas as seções. A ordem fica gravada.

**B5. Campos de escolha melhores** (combobox): ao digitar, a lista aparece **logo abaixo da caixa**, filtrando; e aceita **texto livre** que não esteja na lista. Vale para material, perfil/chapa, comercial, função de mão de obra, máquina etc.

## C. Planilha de custos — outras seções

**C1. Sai Acessórios, entra Acabamentos [MUDA REGRA: decisão 30-a].** Tipos e cálculo:

| Tipo | Campos | Total |
|---|---|---|
| Acabamento em inox (escovado, polido…) | consumíveis R$ + mão de obra R$ | soma |
| Pintura por tinta | latas (qtd × R$) + mão de obra R$ | soma |
| Galvanização a fogo | kg × R$/kg | kg × R$/kg |
| Pintura eletrostática | m² × R$/m² | m² × R$/m² |
| Zincagem | kg × R$/kg | kg × R$/kg |

- O kg da galvanização e da zincagem pode vir **automático da soma dos pesos** de chapas e perfis do item (botão "usar peso dos materiais"), e continua editável. **Atenção:** perfis são cobrados por metro; o peso só entra se a lista tiver kg/m do perfil. **[DECIDIR]** Recomendo acrescentar "kg/m" na lista de perfis aos poucos; enquanto não tiver, o kg é digitado.
- **[DECIDIR] As 51 linhas de Acessórios que já existem** nas propostas (de teste e reais): recomendo **mover para Comerciais** (com o mesmo valor), para nenhum custo sumir. Nas revisões já enviadas (congeladas), os valores ficam como estão.

**C2. Mão de obra em 3 grupos:** Administrativo (projetista, desenhista, engenheiro, téc. segurança, compras…), Fabricação (montador, soldador, ajudante…) e Instalação (montador, soldador, ajudante…).
- Linhas atuais: Visita técnica, Engenharia, Segurança e Administrativo → **Administrativo**; Fabricação → Fabricação; Instalação → Instalação.

**C3. Deslocamento + Fretes viram "Frota e fretes"**, no estilo Qualp:
- Cada linha é um **trecho**: origem, destino, km, nº de viagens (ida e volta), veículo (com consumo km/l), preço do combustível, pedágios → custo calculado. Frete terceirizado continua como valor direto.
- **[DECIDIR]** Distância e pedágio automáticos precisam de um serviço de rotas. O Qualp tem API paga; há alternativas gratuitas só para a distância (sem pedágio). Recomendo começar com **km e pedágio digitados**, com um botão **"Abrir rota no Qualp"** (abre o site com origem e destino), e decidir a API depois.
- Cadastro de **veículos** (nome, consumo km/l) e **preço do combustível** padrão em Administração.

**C4. Hospedagem sem o campo Cidade.**

**C5. Imposto sempre por dentro [MUDA REGRA: decisão 30-c].** Sai a opção "por fora". Todos os itens existentes já estão "por dentro", então nenhum valor muda.

**C6. "Lucro" passa a se chamar "Margem".** **[DECIDIR]** Existe também a "margem de negociação". Recomendo os nomes **Margem** e **Negociação**, para não confundir.

## D. Nova proposta

**D1. Código semi-automático [MUDA REGRA: decisões 8 e 18, código sempre automático].**
- O ERP **sugere** o código (ex.: 26-04-003) e deixa editar antes de salvar. Bloqueia se o código já existir (inclusive de proposta excluída) ou se não estiver no formato AA-CC-NNN.
- **[DECIDIR]** Pode editar o código inteiro ou só o NNN? Recomendo **o código inteiro**, com aviso se o CC digitado não for o do contato naquele ano. A sequência do contato continua a partir do maior número já usado (sem buracos automáticos).

**D2. Validade da proposta em dias** (ex.: 15 dias). A tela mostra também a data calculada a partir da emissão. As propostas que já têm data de validade são convertidas para dias.

---

## Ordem de entrega sugerida (cada uma testada em localhost antes da próxima)

1. A (Kanban, alerta no card, sino) + D (código semi-automático, validade em dias)
2. B (materiais em 3 blocos, comerciais só quantidade, coluna Material, arrastar, combobox)
3. C (Acabamentos, mão de obra em 3 grupos, Frota e fretes, hospedagem, imposto, Margem)

## Resumo das decisões pedidas

1. A2: notificação do Windows (recomendo sim) e para quem (recomendo: responsável recebe; sino para todo o setor).
2. B3: lista de materiais = catálogo COD_MAT (recomendo) e preço por material na lista de preços (recomendo).
3. C1: kg/m na lista de perfis para o peso automático (recomendo, aos poucos) e as 51 linhas de Acessórios → Comerciais (recomendo).
4. C3: começar com km/pedágio digitados + botão Qualp (recomendo); API depois.
5. C6: nomes "Margem" e "Negociação" (recomendo).
6. D1: código inteiro editável, com aviso de CC diferente (recomendo).
