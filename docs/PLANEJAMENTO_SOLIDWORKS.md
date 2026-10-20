# Importação do SolidWorks (JSON da macro) → árvore do projeto

Versão 1, 20/10/2026. **Estado: aprovado (decisões 34 a 36) e implementado em 20/10/2026** (primeira importação; reimportação de revisão fica para a segunda etapa).

Arquivo analisado: `26-059-BMA-00-00-000_Fabriaco_20261020_090024.json` (Bancada Moedor Aplicalis, SYMRISE), macro V2.0.0, esquema `fabriaco.solidworks.tree` v2.

## O que o arquivo traz

| Item | Tipo no CAD | Código CAD | Qtd | COD_OP | COD_MAT | Dados úteis |
|---|---|---|---|---|---|---|
| Montagem geral | assembly | 26-059-BMA-00-00-000 | 1 | — | — | peso 17,17 kg, área de pintura 2,67 m², projetado/desenhado por Guilherme Santos, aprovado por Gabriel Alves, rev 0 |
| Rodízio Ajax Ø2" (pasta CM) | part | (sem código: nome do arquivo) | 4 (4 ocorrências) | **vazio** | IN-001 | peso 0,52 kg |
| Bancada | **weldment** (conjunto soldado) | 26-059-BMA-00-00-001 | 1 | — | — | peso 15,11 kg, pintura 2,52 m² |
| ↳ Tubo redondo Ø1.1/4" × 1,5 | corpo da lista de corte | (sem código) | 4 | LP | IN-001 | comprimento 880,5 mm (total 3.522), 1,00 kg |
| ↳ Chapa 2,00 | corpo | (sem código) | 4 | LC | IN-001 | 71 × 51 mm, esp. 2, 0,05 kg, 4 recortes |
| ↳ Chapa 1,50 | corpo | (sem código) | 1 | LC/DO | IN-001 | 735 × 685 mm, esp. 1,5, 6,02 kg, 4 dobras |
| ↳ Chapa 1,50 | corpo | (sem código) | 1 | LC/DO | IN-001 | 665 × 615 mm, esp. 1,5, 4,86 kg, 4 dobras |

Avisos da própria macro: o rodízio está sem COD_OP; os 4 corpos da lista de corte não têm código próprio.

## Conflitos com as regras do ERP

1. **Prefixo do código.** O CAD usa o padrão antigo `26-059-BMA`; pelas decisões 11 e 16, o projeto no ERP usa o código da proposta (ex.: `26-27-001`). Além disso, **ainda não existe no ERP a proposta/projeto da Bancada Moedor Aplicalis**.
2. **Conjunto soldado.** A bancada é um *weldment*: um arquivo de peça com vários corpos (tubos e chapas). O código dela (`00-00-001`) está na posição de peça, mas ela tem "filhos" (os corpos). Hoje a árvore do ERP só tem montagem geral → submontagem → conjunto, e as peças não têm filhos.
3. **Corpos sem código.** Os tubos e chapas da lista de corte não têm código; o ERP precisa identificá-los de alguma forma.

## Proposta de mapeamento (recomendação)

- **Código:** o ERP mantém o prefixo do projeto e aproveita o final do código CAD quando existir: `26-059-BMA-00-00-001` → `<projeto>-00-00-001`. O código CAD original e o caminho do arquivo ficam guardados na peça/conjunto. **Nenhum arquivo CAD é renomeado.**
- **Conjunto soldado:** novo tipo de nó na árvore, **"Conjunto soldado"**, com ícone próprio, ficando no nível onde está no CAD (aqui, direto na montagem geral) e com o código do CAD (`…-00-00-001`). Os corpos da lista de corte viram as peças dele, com código `…-00-00-001.01`, `.02`, `.03`, `.04`, na ordem da lista de corte.
- **Itens sem COD_OP** (o rodízio): entram como estão, com COD_OP vazio e aviso "pendente de classificação". O ERP não adivinha que é CM.
- **Quantidades:** ocorrências iguais no mesmo pai são somadas (4 rodízios = quantidade 4). Corpos usam a quantidade da lista de corte.
- **Dados guardados por peça:** descrição (DENOMINAÇÃO ou nome), COD_OP, COD_MAT (ligado ao catálogo), espessura, peso, comprimento (perfis), dimensões da chapa, dobras e recortes. O que não tiver coluna própria fica num campo "dados do CAD".
- **Dados do projeto:** peso total, área de pintura, projetado/desenhado/aprovado e revisão aparecem na aba Dados do projeto.
- **Fluxo na tela:** no projeto, botão **"Importar do SolidWorks"** → escolher o JSON → **prévia** (árvore que será criada, códigos, avisos da macro, diferenças de prefixo) → confirmar. Nada é gravado antes da confirmação.
- **Reimportação** (nova revisão do CAD): primeira versão só importa em projeto sem itens vindos do CAD; a conciliação de revisões (atualizar, acrescentar e marcar removidos) vem numa segunda etapa.

## Decisões pedidas

1. **Onde importar este arquivo?** (a) no projeto de teste 26-27-001, só para validar; ou (b) criar agora a proposta/projeto real da Bancada Moedor Aplicalis (SYMRISE) e importar nele.
2. **Conjunto soldado** como nó próprio da árvore, com os corpos como peças `….01`, `….02`: ok?
3. **Os próximos modelos** já serão nomeados com o código da proposta (ex.: `26-26-005-00-00-000`), ou o CAD vai continuar com `AA-NNN-SIGLA`? Isso define se o ERP mostra os dois códigos sempre ou só nesta transição.

---

# Etapa 2 — Reimportação de nova revisão do CAD

Versão 1, 20/10/2026. **Estado: aprovado (decisão 38) e implementado em 20/10/2026**, testado em localhost.

## Como funciona

1. No projeto já importado, o botão vira **"Atualizar do SolidWorks"**. Escolhe-se o JSON novo da mesma montagem.
2. O ERP compara o JSON com a árvore atual e mostra uma **prévia de diferenças**, com cores:
   - **Novo** (verde): existe no CAD e não no ERP. Recebe o próximo código livre.
   - **Alterado** (âmbar): mostra campo a campo o antes → depois (nome/descrição, quantidade, COD_OP, COD_MAT, espessura, peso, comprimento).
   - **Removido do CAD** (vermelho): estava no ERP e não está mais no CAD.
   - **Sem mudança** (cinza, recolhido).
3. Confirmar aplica tudo de uma vez, numa transação. Se algo falhar, nada é gravado.
4. Cada importação fica num **histórico** do projeto (data, usuário, arquivo, versão da macro, resumo: X novos, Y alterados, Z removidos). A primeira importação também entra nele.

## Como o ERP reconhece "o mesmo item"

- Pela **chave do CAD** guardada na primeira importação (arquivo + configuração; nos corpos de conjunto soldado, a referência persistente do corpo na lista de corte) **dentro do mesmo pai**.
- Se a chave não bater (arquivo renomeado ou movido de pasta), tenta pelo **código CAD** (ex.: 26-059-BMA-00-00-001) no mesmo pai.
- Sem chave e sem código iguais, é tratado como novo + removido.

## Regras propostas (recomendação)

| # | Situação | Recomendação |
|---|---|---|
| R1 | Item **removido do CAD** | Não apagar. Fica marcado "Removido do CAD (data)", riscado na árvore, **fora da lista de materiais** (com filtro para mostrar). Quem tem permissão pode excluir de vez (exclusão lógica) ou restaurar. |
| R2 | Campo editado no ERP e diferente no CAD | **O CAD vence** quando traz valor. Se o CAD vier **vazio** e o ERP tiver valor (ex.: COD_OP do rodízio classificado no ERP), **mantém o do ERP** e mostra aviso. |
| R3 | Códigos | Itens existentes **mantêm o código do ERP** sempre. Novos recebem o próximo livre. Códigos de removidos **nunca são reaproveitados** (o banco já garante). |
| R4 | Item que **mudou de pai** no CAD (ex.: peça passou de um conjunto para outro) | Tratado como **removido no pai antigo + novo no pai novo**, com novo código, porque o código do ERP indica onde a peça está. A prévia avisa "provável mudança de lugar". |
| R5 | Conjunto **Liberado** que recebeu mudanças | Volta para **"Em revisão"** e a revisão sobe (R0 → R1). Conjuntos sem mudança não são tocados. |
| R6 | Itens **criados à mão** no ERP (sem chave do CAD) | Não são tocados pela reimportação. |
| R7 | JSON de outra montagem (código CAD da raiz diferente) | Recusado, com mensagem. |
| R8 | Avisos da macro (sem COD_OP, sem código próprio) | Mostrados na prévia, como na primeira importação. |

## O que muda no banco (migration nova, pequena)

- Colunas `removido_cad_em` em conjuntos e peças.
- Tabela `projeto_importacoes_cad` (histórico).
- Função `atualizar_solidworks(projeto, plano)` que aplica novos, alterados e removidos, sobe a revisão dos liberados alterados e grava o histórico. A função atual `importar_solidworks` continua só para a primeira importação.

## Teste

Gerar uma 2ª versão do JSON da bancada **inventada a partir do original** (ex.: rodízio 4 → 6, uma chapa com espessura nova, um corpo removido, um corpo novo) e aplicar no 26-27-001, conferindo prévia, árvore, lista de materiais e histórico. Se você tiver uma revisão real exportada pela macro, uso ela.

## Limite que continua

Quando o módulo de Compras existir, mudanças em itens que já foram para requisição de compra precisarão de um fluxo próprio. Isso fica para Compras.
