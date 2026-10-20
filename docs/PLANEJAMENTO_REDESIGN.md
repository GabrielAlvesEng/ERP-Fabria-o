# Redesign visual do ERP (estilo Stripe)

Versão 1, 20/10/2026. **Estado: etapa 1 feita em 20/10/2026 (decisão 51), com marca provisória até chegarem os SVGs da Logo Moderna. Etapas 2 a 4 aguardam autorização.**

Regra geral (do pedido): só aparência e animação. Nada muda em dados, textos, regras, rotas, banco, nomes de campos ou códigos. Uma etapa por vez; depois de cada uma, testes + build + resumo do que mudou.

Referência visual: as telas do Stripe enviadas (o link do mockup citado no pedido não chegou; se houver, ele passa a valer).

## Etapas

1. **Base:** tokens de cor e tema, fonte, logo oficial, ícones do atalho do celular, componente `Button`, layout (sidebar, topbar, sub-abas fixas).
2. Dashboard (rosca por etapa, cartões com contagem animada, "Tudo em dia").
3. Empresas, Contatos, Propostas (tabelas, formulários, Kanban).
4. Engenharia (árvore, mapa, lista de materiais, kick-off) e Administração.

## Plano da etapa 1

### 1.1 Tokens (um lugar só)
- `src/index.css`: variáveis CSS para claro e escuro: `--primaria` #410FA0 (escuro: #9672E9), `--aco` #0E0E10, fundo da página (cinza muito claro / quase preto), superfície (branco / grafite), borda, texto, texto suave, foco, sucesso, alerta, perigo, sombra leve, raio 12px (cartões) e 8px (botões e campos).
- `tailwind.config.js`: cores semânticas apontando para essas variáveis (`bg-pagina`, `bg-superficie`, `border-borda`, `text-texto`, `text-suave`, `bg-primaria`…). As classes antigas (`roxo-*`, `marinho-*`) passam a usar a paleta nova, para nada quebrar; as telas migram para os nomes semânticos nas etapas 2 a 4.
- Escuro: mesmos tokens, outros valores. O botão sol/lua continua igual.

### 1.2 Tipografia
- **Geist** (pacote `@fontsource/geist-sans` e `geist-mono`, servido pelo próprio site, sem depender de Google).
- Números tabulares em valores, tabelas e códigos; códigos de proposta e projeto em Geist Mono.

### 1.3 Logo e ícones
- Copiar os SVGs oficiais de `1.5.Marketing/1.5.2.Logotipo da Empresa/Logo Moderna/` para `public/marca/` (símbolo, letreiro, logo cor, logo negativa). Observação: o pedido cita `referencia/marca/`, mas `referencia/` fica fora do Git; em `public/marca/` eles vão junto com o site.
- Sidebar e tela de login com a logo oficial (claro: logo cor; escuro: versão com letreiro claro, gerada a partir dos mesmos caminhos).
- Favicon SVG e ícones do atalho do celular gerados a partir de `fabriaco-simbolo.svg`: `apple-touch-icon` 180, 192, 512 e maskable 512, mais `manifest.webmanifest`. Hoje o ERP ainda não tem esses ícones, então eles são criados (não há ícones antigos para substituir neste projeto). Gerados por script com uma biblioteca de conversão SVG→PNG instalada só para desenvolvimento.

### 1.4 Componente `Button`
- Um componente com variantes **primary** (roxo), **secondary** (branco com borda), **ghost** e **danger**; tamanhos **md** (36px) e **sm** (30px); raio 8px; anel de foco roxo; estados hover/disabled com transição de 150ms.
- O atual `Botao` passa a ser esse componente (mesmo nome de import, para não mexer em regra nenhuma) e ganha `tamanho`. Todos os usos existentes herdam o visual novo já nesta etapa; os botões "soltos" (`<button>` com classe própria) são trocados tela a tela nas etapas 2 a 4.

### 1.5 Layout
- **Sidebar branca** com borda fina à direita: logo no topo, seção "Módulos" com ícone + nome, item ativo com fundo roxo bem claro e texto roxo (como o Stripe), usuário e "Sair" no rodapé. No escuro, superfície grafite.
- **Topbar** branca, fina, com borda inferior: seletor de ano comercial à esquerda, tema e sair à direita (mesmos elementos e textos de hoje).
- Fundo da página cinza muito claro; conteúdo em largura máxima confortável.
- **Sub-abas fixas** (Vendas, Engenharia, Administração e as abas internas do projeto e da proposta): sem rolagem horizontal ou vertical; se faltar espaço, quebram de linha; aba ativa com linha inferior roxa (sai o estilo "aba de navegador").
- Celular: sidebar vira barra superior compacta com os ícones, como hoje.
- Animação: só transições de 150–200ms em hover nesta etapa; `prefers-reduced-motion` desliga tudo.

### 1.6 Verificação da etapa 1
- `npm test` (24 testes) e build.
- Conferência no navegador, claro e escuro, desktop e celular: login, sidebar, topbar, abas de Vendas e Engenharia.
- Commit e, com seu OK, publicação.

## Fora da etapa 1
- Rosca, contagem animada e Recharts (etapa 2).
- Tabelas, formulários e Kanban (etapa 3); árvore e lista de materiais (etapa 4).
- **Importação do SolidWorks:** o JSON da 26-059-BMA foi recebido (7 definições, 10 ocorrências, 5 avisos, 124 materiais). A análise e o importador ficam para depois do redesign, ou antes, se você preferir.
