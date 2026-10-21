# Biblioteca de Materiais na Engenharia

Versão 1, 21/10/2026. **Estado: planejamento aguardando aprovação do Gabriel. Nada implementado.**

Pedido de origem (20/10): "quero criar uma biblioteca padrão de todos os materiais que usamos para usar em várias áreas da ERP". A biblioteca já existe e é usada nos Custos das propostas (decisões 48 a 50). Este plano liga a biblioteca às **peças da Engenharia** (exemplar autorizado, decisão 33). Não começa Compras: só deixa a lista de materiais pronta para Compras usar depois.

## Como está hoje

- Cada peça tem descrição, quantidade, COD_OP, material (COD_MAT), espessura, peso unitário e comprimento. Esses dados vêm do SolidWorks ou são digitados.
- A lista de materiais soma o peso (peso unitário × quantidade total na árvore).
- Não há ligação com a biblioteca: o ERP não sabe que "CHAPA 2,00 / AISI 304" é a Chapa Lisa AISI 304 2,00, nem que "TUBO REDONDO Ø1.1/4" X 1,5" é o Tubo Redondo OD Ø 1-1/4" x 1,5 mm da biblioteca.

## O que muda (proposta)

### 1. Cada peça pode apontar para um item da biblioteca
- Campo novo na peça: **item da biblioteca** (chapa, perfil, comercial, fixador ou consumível), opcional.
- **Sugestão automática**, que a Engenharia confirma:
  - peça com COD_OP de laser/chapa (LC, DO, CL…) e espessura → chapa do mesmo material e espessura;
  - peça com comprimento (perfil cortado, LP/GU) → perfil lido da descrição do CAD, com as mesmas regras da carga inicial (`lerDescricaoAntiga`);
  - peça CM (comercial) → item comercial ou fixador com descrição parecida.
- Se não houver item igual, a peça fica "sem item da biblioteca" e a Engenharia pode escolher na lista ou cadastrar (quem tem permissão de Administração).

### 2. Peso e custo estimados pela biblioteca
- **Perfis:** peso = kg/m da biblioteca × comprimento.
- **Chapas:** o CAD já dá o peso real da peça cortada, que continua valendo.
- **Custo estimado da peça:**
  - chapas: peso × valor/kg;
  - perfis: comprimento × valor/m, ou peso × valor/kg;
  - comerciais: quantidade × valor.
- O peso que vem do CAD continua guardado. O ERP mostra os dois e avisa quando diferem mais de 5% (por exemplo, material errado no SolidWorks).

### 3. Lista de materiais com resumo de compra
Nova visão "Resumo para compra" na aba Lista de materiais:
- **Chapas por material e espessura:** kg total e número de chapas inteiras. O número de chapas é uma estimativa por peso: kg total ÷ peso da chapa, arredondado para cima.
- **Perfis por bitola e material:** metros totais e barras de 6 m, arredondadas para cima.
- **Comerciais e fixadores:** quantidade total.
- Custo estimado do projeto pela biblioteca.
- Exportação em planilha (CSV), como já existe hoje para a lista de materiais.

### 4. Comparar com a proposta
Ao lado do custo estimado da Engenharia, mostrar o custo de materiais da proposta aprovada (aba Custos, seção A). Assim se vê cedo se o projeto ficou mais caro que o orçado. Isso é só leitura; a proposta não muda.

## Dados

- `projeto_pecas`: colunas novas `bib_tipo` (chapa, perfil ou item) e `bib_id`, mais `bib_confirmado` (a Engenharia aceitou a sugestão). Migration pequena e sem perda: as colunas novas começam vazias.
- Sem tabela nova. O resumo de compra é calculado, não gravado; quando o módulo Compras existir, ele lê daqui.
- RLS: as mesmas permissões da Engenharia (ler e editar). A biblioteca continua sendo editada só pela Administração.

## Perguntas para o Gabriel

1. **Chapa inteira:** o resumo usa por padrão a chapa do mesmo material e espessura mais comum na biblioteca (por exemplo, 1250 × 3000). Serve, ou cada projeto escolhe o tamanho da chapa?
2. **Barra padrão dos perfis:** 6 m para todos ou varia por tipo (por exemplo, tubo 6 m, viga 12 m)?
3. **Diferença CAD × biblioteca:** o aviso a partir de 5% de diferença no peso serve?
4. **Sugestão automática:** pode sugerir e esperar a confirmação da Engenharia (recomendado), ou prefere que ligue sozinho quando a correspondência for exata?
5. **Comparar com a proposta:** quer ver o custo de materiais da proposta ao lado do custo estimado do projeto?

## Entregas (depois da aprovação)

1. Migration das colunas + sugestão automática + escolha manual na tabela de peças, com testes das regras de correspondência.
2. Peso e custo pela biblioteca, com o aviso de diferença.
3. Resumo para compra com exportação.
4. Comparação com a proposta (se aprovada).

Cada entrega: teste no banco em transação desfeita, testes automáticos, build, conferência no navegador e registro nos documentos.
