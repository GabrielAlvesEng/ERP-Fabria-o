# Predefinições, Biblioteca de Materiais e ajustes de Custos/Kanban

Versão 1, 20/10/2026. **Estado: entregas 0 a 4 feitas e testadas; entrega 5 (redesign etapa 1) feita com marca provisória, aguardando os arquivos da Logo Moderna. Recomendações implementadas (decisões 47 a 51), aguardando confirmação do Gabriel.**

Pedido do Gabriel em 20/10/2026 (segunda rodada de ajustes de Vendas + biblioteca de materiais). Vários itens mudam regras aprovadas (decisões 12, 22, 41, 42); cada mudança vai para `docs/REGRAS_DE_NEGOCIO.md` como decisão nova, sem apagar a antiga.

## Entrega 0 — feita em localhost (sem banco)

- **Bug do campo de escolha:** ao clicar num item da lista, o campo gravava o item e, 150 ms depois, gravava por cima o texto parcial que estava digitado (ex.: escolhia "AISI 316L" e ficava "316"). Corrigido em `CampoEscolha` (`src/shared/ui/index.tsx`). Conferido no navegador com uma página de teste isolada: clique, Enter, texto livre e Esc; o código antigo reproduzia o erro.
- **Material só pelo nome** na aba Custos (ex.: "AISI 304" em vez de "IN-001 — AISI 304"). Linhas antigas que gravaram o código aparecem sem ele. O COD_MAT continua guardado por trás (o filtro da lista de preços usa o código) e continua aparecendo na Engenharia, onde ele é o código do SolidWorks.
- **Rótulos:** Chapas → "Preço por peso"; Perfis → "Preço por metro".

## Entrega 1 — Kanban com 4 colunas

- Colunas: **À enviar, Enviados, Aprovado, Reprovado**.
- Propostas em Finalizado, Emitido NF e Pago (hoje 1, a de Emitido NF) aparecem na coluna **Aprovado** com um selo da etapa ("Finalizado", "NF emitida", "Pago").
- O Financeiro continua sendo quem move essas etapas (decisão 12). **Recomendação:** um campo "Etapa financeira" no detalhe da proposta aprovada, que só aparece para quem tem permissão do Financeiro (o banco já bloqueia o Comercial). Quando existir o módulo Financeiro, isso vai para lá.
- Dashboard continua contando todas as etapas.

## Entrega 2 — Administração → Predefinições

Nova página em Administração com quatro abas. Editar: Administração; ler: Comercial (usado nas propostas). Mudar um valor aqui **não altera propostas já lançadas** (a linha guarda o valor do momento, como hoje).

1. **Materiais** = a Biblioteca de Materiais (entrega 4): Chapas, Perfis, Itens comerciais, Fixadores, Consumíveis.
2. **Fornecedores:** nome, cidade, contato, ativo, e uma lista de **serviços** de cada um: serviço (Galvanização a fogo, Pintura eletrostática, Zincagem, Laser, Dobra, Torno, Usinagem…), unidade de cobrança (**hora, kg, m², metro, peça**) e valor. Um fornecedor pode ter vários serviços.
3. **Mão de obra:** três grupos fixos (Administrativo, Fabricação, Instalação), função e valor-hora. Já existe no banco (`ref_mao_obra`); ganha a tela.
4. **Maquinário (próprio):** nome (Laser, Dobra, Torno, Guilhotina, Calandra…) e valor-hora. Já existe (`ref_maquinas`); as máquinas hoje marcadas como terceirizadas (os dois lasers e a dobradeira) viram **serviços de fornecedor** — o Gabriel informa de qual fornecedor (ou ficam num fornecedor "A definir").

## Entrega 3 — Custos reorganizados

Nova ordem das seções:

| Letra | Seção | Blocos |
|---|---|---|
| A | Materiais | Chapas, Perfis, Comerciais, **Fixadores**, **Consumíveis** (os dois novos vêm da biblioteca) |
| B | Acabamentos | como hoje; galvanização, eletrostática e zincagem podem escolher o fornecedor e puxar o valor |
| C | **Frete terceirizado** | descrição, origem, destino, qtd, preço unitário (as 4 linhas padrão de coleta/entrega vêm para cá) |
| D | Mão de obra | Administrativo, Fabricação, Instalação |
| E | Máquinas | Terceirizada **Sim** → escolhe na tabela de Fornecedores (serviços cobrados por hora); **Não** → escolhe no Maquinário |
| F | **Viagem** | Veículo próprio, **Veículo alugado**, Alimentação, Hospedagem |

- **Veículo alugado (recomendação):** veículo/locadora, diárias, valor da diária, km total, km/l, R$/l, pedágio. Total = diárias × diária + km ÷ km/l × R$/l + pedágio.
- Nos **rascunhos**: as linhas "Frete terceirizado" da Frota vão para C; Veículo próprio, Alimentação e Hospedagem vão para os blocos de Viagem, sem mudar valores (conferido no banco antes e depois, como na entrega 3 anterior). **Revisões enviadas não mudam** (aparecem como foram enviadas).
- Fórmulas continuam no banco (gatilho `ajustar_linha_custo`) e espelhadas em `regras.ts`, com testes.

## Entrega 4 — Biblioteca de Materiais

Uma base única, usada em Vendas (custos) agora e depois em Engenharia e Compras. Substitui a "lista de preços" atual (`ref_materiais`), que fica guardada só para leitura.

### Materiais (aço)
Vem do catálogo COD_MAT que já existe (124 materiais), mostrado **pelo nome**. Falta a **densidade** de cada um; recomendação: inox 8,00 g/cm³ e carbono 7,85 g/cm³ (os mesmos da calculadora atual), alumínio 2,70, os demais preenchidos aos poucos.

### Chapas
| Campo | Regra |
|---|---|
| Material | do catálogo (Inox 304, Inox 316L, ASTM A36…) |
| Tipo | Chapa Lisa, Chapa Xadrez, Tela Moeda, Chapa Expandida, Chapa Perfurada… (lista editável) |
| Espessura | em mm; aceita digitar em polegada (1/4", 3/8"…) e converte, mostrando os dois |
| Largura, Comprimento | mm |
| Peso | **automático** = espessura × largura × comprimento × densidade; pode digitar manual (fica marcado "manual"). Para tipos que não são lisos (xadrez, expandida, perfurada, tela) a recomendação é peso manual, porque o cálculo geométrico não vale |
| Valor/kg | digitado. **Recomendação:** uma tabela de preço por kg por **material + tipo** (ex.: Chapa Lisa Inox 304 = R$ X/kg) que cada chapa herda, podendo sobrescrever; assim, quando o preço do inox muda, atualiza-se uma linha só |
| Valor total | automático = peso × valor/kg |

Descrição gerada: "Chapa Lisa Inox 304 2,00 x 1250 x 3000".

### Perfis
| Campo | Regra |
|---|---|
| Material | do catálogo |
| Tipo | Tubo Quadrado, Tubo Retangular, Tubo Redondo OD, Tubo Redondo SCH, Barra Redonda, Barra Quadrada, Barra Chata, Barra Sextavada, Cantoneira, Viga U, Viga W, Viga I, Perfil H… Cada tipo sabe **o formato do tamanho** (50 x 50; 50 x 30; Ø1"; 150…) e **se tem parede** (maciço não tem) e em que unidade (mm ou SCH) |
| Tamanho | conforme o tipo |
| Parede | mm, SCH (tubo SCH) ou nenhuma (maciço) |
| Peso (kg/m) | **automático**: por fórmula para tubos e barras (geometria × densidade do material); pela **base de pesos** para vigas, cantoneiras, U, W, I e tubos SCH |
| Valor | escolha entre **valor/m** ou **valor/kg** em cada perfil; o outro é calculado pelo kg/m |

**Base de pesos por metro:** tabela nova com tipo, tamanho, parede e kg/m (referência aço carbono; para inox o ERP corrige pela densidade). Carga inicial com as tabelas usuais de mercado: tubos SCH (ASME B36.10/B36.19, 1/8" a 12"), vigas W e H (bitolas Gerdau), U e I (padrão americano), cantoneiras de abas iguais. **O Gabriel confere** os valores antes de usar em proposta; a tabela é editável em Predefinições.

### Itens comerciais
Descrição e valor (mais unidade e material opcional, para filtrar). Os 168 comerciais atuais entram direto.

### Fixadores
Recomendação: descrição (ex.: "Parafuso Allen Cabeça Cilíndrica M12 x 40"), material/acabamento opcional (inox, zincado…), unidade e valor.

### Consumíveis
Descrição (tintas, discos, rodas de lixa…), unidade (un, lata, litro, kg, caixa) e valor.

### Migração da lista de preços atual (525 itens)
- 168 comerciais → Itens comerciais, sem perda.
- 347 perfis: o ERP lê os nomes ("Tubo Quadrado 20 x 2,0 Inox 304(Mts)", "Barra Chata 4" x 3/8"…") e cadastra os que entender, com o preço como valor/m ou valor/kg conforme a unidade; **os que não entender ficam numa lista "a revisar"**, não são inventados.
- 10 chapas são preços por kg por material e tipo, sem medidas → viram a tabela de preço por kg (material + tipo) da recomendação acima.
- Teste em transação desfeita antes de aplicar, com o relatório do que entrou e do que ficou para revisar.

### Na proposta (aba Custos)
- Chapas: Material → Tipo → Chapa da biblioteca (traz peso e valor/kg). Qtd × peso × valor/kg. Continua aceitando texto livre e peso digitado.
- Perfis: Material → Perfil (traz kg/m e valor). Qtd × metros × valor/m (ou × kg/m × valor/kg). O botão "usar peso dos materiais" da galvanização passa a ter o kg/m de todos os perfis da biblioteca.
- Comerciais, Fixadores, Consumíveis: escolher na biblioteca, Qtd × valor.

## Entrega 5 — Redesign, etapa 1 (logo, favicon, estilo)

Segue o `docs/PLANEJAMENTO_REDESIGN.md` (etapa 1: cores, fonte, logo oficial, favicon e ícones do celular, botões, sidebar e topbar). Entendo o "conforme alinhamos" como aprovação da etapa 1.
**Preciso dos arquivos da Logo Moderna** (`1.5.Marketing/1.5.2.Logotipo da Empresa/Logo Moderna/`: símbolo, letreiro, logo colorida e negativa, de preferência SVG). Eles estão no seu OneDrive, que eu não alcanço daqui: anexe-os na conversa. Sem eles consigo adiantar cores, fonte e layout, e a logo entra quando chegar.

## Ordem recomendada
1 (Kanban) → 2 e 4 juntas (Predefinições + Biblioteca, porque Máquinas e Custos dependem delas) → 3 (Custos) → 5 (redesign, quando a logo chegar; pode correr em paralelo).
Cada entrega: migration pequena, teste no banco em transação desfeita, testes automáticos, build, conferência em localhost e registro nos documentos. Sem deploy no Netlify (decisão 37).

## Perguntas para o Gabriel
1. Finalizado / NF emitida / Pago: aprovar a recomendação (ficam na coluna Aprovado com selo; o Financeiro muda pelo detalhe)?
2. Veículo alugado: os campos recomendados servem?
3. Fornecedores com serviços e unidade de cobrança (hora, kg, m², metro, peça): serve? De qual fornecedor são os lasers e a dobradeira terceirizados de hoje?
4. Chapas: preço por kg por material + tipo, herdado pelas chapas? Peso manual para xadrez, expandida, perfurada e tela?
5. Perfis: carga inicial da base de pesos com tabelas de mercado, para você conferir — pode?
6. Fixadores e consumíveis: os campos recomendados servem? Entram como blocos novos em Materiais na proposta?
7. Migração automática da lista de preços atual, com lista "a revisar" do que não for entendido — pode?
8. Arquivos da Logo Moderna.
