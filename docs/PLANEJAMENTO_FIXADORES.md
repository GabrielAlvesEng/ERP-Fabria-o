# Biblioteca de Fixadores em pastas

Versão 1, 21/10/2026. **Estado: planejamento aguardando aprovação do Gabriel.**

Pedido (21/10): separar os fixadores em pastas, como as pastas do computador da empresa:
1. pastas por **tipo** de fixador;
2. dentro de cada tipo, pastas por **material** (Inox 304, Zincado, Bicromatizado, Preto);
3. dentro de cada material, os **tamanhos** (ex.: Parafuso Allen Cabeça Cilíndrica M8 x 20, M8 x 30…).

Hoje a aba Fixadores tem descrição, material, unidade e valor, numa lista só (decisão 48), e **está vazia no banco**, então não há nada a migrar.

## 1. Tipos (pasta 1), na ordem das pastas da empresa
| # | Tipo | Medida |
|---|---|---|
| 1 | Parafuso Sextavado | rosca × comprimento |
| 2 | Parafuso Allen Cab. Cilíndrica | rosca × comprimento |
| 3 | Parafuso Allen Cab. Chata | rosca × comprimento |
| 4 | Parafuso Allen Cab. Abaulada | rosca × comprimento |
| 5 | Porca Sextavada | rosca |
| 6 | Porca Parlock | rosca |
| 7 | Porca Cab. Abaulada | rosca |
| 8 | Porca Rebite | rosca |
| 9 | Cupilha | diâmetro × comprimento |
| 10 | Arruela Lisa | rosca |
| 11 | Arruela de Pressão | rosca |
| 12 | Parabolt PBA | rosca × comprimento |
| 13 | Anel de Trava E | diâmetro do eixo |
| 14 | Anel de Trava I | diâmetro do furo |
| 15 | Grampo Tipo U | rosca × largura (ou tubo) |

A Administração pode criar, renomear, reordenar e desativar tipos, sem apagar nada.

## 2. Materiais (pasta 2)
Inox 304, Zincado, Bicromatizado e Preto, valendo para todos os tipos. A Administração pode acrescentar outros (ex.: Inox 316, Aço mola).

## 3. Tamanhos (dentro da pasta de material)
- Cada tamanho tem **rosca** (M8, M10, 1/4"…), **comprimento** quando o tipo pede, **unidade** (peça) e **valor**.
- A **descrição é montada sozinha**, sempre no mesmo padrão: "Parafuso Allen Cab. Cilíndrica M8 x 20 Inox 304". Isso facilita buscar nos custos e a Engenharia casar com o CAD.
- **Gerar vários de uma vez:** você escolhe as roscas (M6, M8, M10…) e os comprimentos (16, 20, 25, 30…) e o ERP cria a grade toda; depois é só preencher os valores.
- Não pode repetir tipo + material + rosca + comprimento.

## 4. Tela (Administração → Predefinições → Materiais → Fixadores)
- Tela inicial com as **pastas dos tipos** (ícone de pasta e a quantidade de itens). Ao clicar, aparecem as **pastas dos materiais**; ao clicar no material, a **tabela de tamanhos**, com valor editável na linha.
- Caminho no topo para voltar: "Fixadores › Parafuso Allen Cab. Cilíndrica › Inox 304".
- Busca geral no topo, que procura em todas as pastas.

## 5. Uso nos custos e na Engenharia
- Na proposta, a linha de Fixadores continua com a busca por texto, que agora encontra pelo padrão novo ("allen m8 x 20 inox").
- Na Engenharia, a sugestão continua pela descrição.

## 6. Dados (pré-aprovados pela decisão 54)
Tabelas `bib_fixador_tipos` (nome, medida, ordem, ativo) e `bib_fixador_materiais` (nome, ordem, ativo). A tabela `bib_itens` ganha `fixador_tipo_id`, `fixador_material_id`, `rosca` e `comprimento` nos itens do grupo Fixadores. Os custos continuam ligados ao item pelo `bib_id`, sem mudança.

## Perguntas
1. **Tamanhos iniciais:** cadastro a grade métrica comum já pronta, **sem preço**, para você só preencher valores (recomendado)? Por exemplo: parafusos M5 a M20 com comprimentos de 10 a 100; porcas e arruelas M5 a M24. Ou você prefere começar vazio?
2. **Polegada:** vocês usam fixadores em polegada (1/4", 3/8", 1/2")? Se sim, eles entram junto com os métricos na mesma pasta.
3. **Valor:** é por peça (recomendado) ou por cento/caixa?
4. **Materiais:** os 4 servem para todos os tipos? Anel de trava, por exemplo, costuma ser só aço mola.
