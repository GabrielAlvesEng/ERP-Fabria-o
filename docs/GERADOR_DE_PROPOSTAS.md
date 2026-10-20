# Gerador de Propostas (Técnica + Comercial)

> Status: **PEDIDO DE PLANEJAMENTO. Nada deve ser implementado antes da aprovação do Gabriel.**
> Módulo: Vendas. Nova aba dentro de cada proposta.
> Referências visuais e de conteúdo (consultar, não copiar o código): `referencia/propostas/Novo_Modelo_de_Proposta_Tecnica.pdf` (11 páginas) e `referencia/propostas/Novo_Modelo_de_Proposta_Comercial.pdf` (6 páginas). Exemplo real: proposta 26-01-019, cliente Symrise Pet Food (Descalvado/SP), "Vedação Pneumática Rosca MP".

## 1. Objetivo

Dentro de cada proposta do ERP, uma aba **"Documentos"** (nome a confirmar) que monta, a partir dos dados já cadastrados, dois PDFs padronizados no visual da nova identidade Fabriaço:

1. **Proposta Técnica** (engenharia)
2. **Proposta Comercial** (condições e valores)

O usuário preenche só o que muda de proposta para proposta. Todo o resto vem automático ou de textos-padrão editáveis. O PDF emitido fica guardado e vinculado à revisão (R0, R1...).

## 2. Regras que já valem (REGRAS_DE_NEGOCIO.md)

- Código da proposta AA-CC-NNN; o mesmo código aparece em capa, cabeçalho de todas as páginas e nome do arquivo.
- Revisões R0/R1/R2 só existem depois de a proposta ser enviada. Documento emitido de uma revisão fica **travado**; mudança gera nova revisão.
- Todos os usuários de Vendas veem todas as propostas.
- Valores monetários e etapa do Kanban continuam sendo regidos pelas funções do banco. O gerador só lê esses dados, nunca os altera.

## 3. Estrutura dos documentos (levantada dos PDFs)

### 3.1 Proposta Técnica (11 páginas no exemplo)

**Capa:** marca; selo "Proposta Técnica · R0"; título em 2 linhas (ex.: "Vedação Pneumática" + "Rosca MP", segunda linha em roxo claro); subtítulo curto; 3 cartões (Cliente, Unidade, Identificação = código · revisão); **imagem de capa** (render do projeto); rodapé com responsável, data de emissão e site.

**Seções numeradas** (cabeçalho de página: "FABRIAÇO / ENGENHARIA INDUSTRIAL" à esquerda e "PROPOSTA TÉCNICA · código / revisão" à direita; rodapé com numeração):

| # | Seção | Origem do conteúdo |
|---|---|---|
| 1 | Sobre nós | Texto-padrão fixo (biblioteca) |
| 2 | Dados da Empresa | **Automático**: Fabriaço (dados fixos da empresa) x Cliente (empresa e contato da proposta): razão social, CNPJ, IE, endereço, bairro, CEP/cidade, responsável técnico, telefone/WhatsApp, e-mail |
| 3 | Objetivo | Texto livre por proposta (com modelo-base) |
| 4 | Aplicação | Texto livre + lista de benefícios |
| 5 | Referência e Normas | Lista marcável a partir de uma biblioteca de normas (NR-12, ISO 12100, ISO 4414, ISO 14120, ASTM A240 etc.) + texto livre |
| 6 | Competências | Tabela Mecânica, Civil, Automação, Elétrica, Pneumática, Instalação, Adequação. Cada uma: Sim / Não / N/A |
| 7 | Responsabilidades | Matriz de itens x (Cliente / Fabriaço), marcada por modelo-padrão e ajustável por proposta |
| 8 | Documentações | Mesma ideia (matriz Cliente / Fabriaço) com lista-padrão (ART, Databook, As built, PIT, PP, EPS/RQPS etc.) |
| 9 | Escopo | Introdução + **etapas numeradas** (título + descrição), reordenáveis; **imagens** com legenda |
| 10 | Fora do Escopo | Lista-padrão editável (mesma da proposta comercial) |
| 11 | Gestão do Projeto | Introdução + etapas com letras A-E (Engenharia, PCP, Fabricação e Qualidade, Instalação, Inspeção e Entrega) |
| 12 | Garantia | Texto-padrão com **prazo em meses** como variável (exemplo: 18) |
| 13 | Prazo de Entrega | Texto-padrão editável |
| 14 | Validade da Proposta | Texto-padrão com **dias** como variável (exemplo: 30) |
| 15 | Termo de Confidencialidade | Texto-padrão fixo, com nome do cliente inserido |
| 16 | Anexo | Lista de anexos ou "Não contém." |

### 3.2 Proposta Comercial (6 páginas no exemplo)

**Capa:** mesma identidade da técnica, com rótulo "Proposta Comercial / Condições de Fornecimento".

**Visão geral:** saudação ao contato ("Olá, Weber Silva."), "Preparado por" (usuário responsável), cartões Emissão / Validade / Revisão / Local, e 3 totais: Fabricação, Instalação, Total com impostos.

| # | Seção | Origem do conteúdo |
|---|---|---|
| 1 | Objetivo | Texto por proposta |
| 2 | Fora do Escopo | Mesma lista da técnica (fonte única) |
| 3 | Frete e Logística | Destino + modalidade (CIF/FOB) + 4 itens A-D (transporte, mobilização, programação/acesso, movimentação) com textos-padrão |
| 4 | Garantia | Mesma variável da técnica |
| 5 | Impostos | Tabela: NCM, ICMS, IPI, PIS, COFINS, CSLL, IRPJ (valor, e "incluso" quando for o caso) |
| 6 | Prazo de Entrega | Mesmo texto da técnica |
| 7 | Valores | Texto + tabela de **itens** (letra, nome, descrição, valor) + total com impostos |
| 8 | Forma de Pagamento | Condição (ex.: 21 DDL), marco (ex.: emissão da NF), forma (depósito/transferência) + texto |
| 9 | Validade da Proposta | Mesma variável |
| 10 | Termo de Confidencialidade | Mesmo texto |
| 11 | Anexo + contato | "Não contém." + bloco de contato comercial e técnico |

**Ideia central: fonte única de dados.** O que aparece nos dois documentos (fora do escopo, garantia, prazo, validade, confidencialidade, valores) é cadastrado uma vez e usado nos dois.

## 4. O que é automático e o que o usuário preenche

**Automático (vem do ERP):** código e revisão; cliente, unidade, CNPJ, endereço (empresa); nome, telefone, e-mail (contato); responsável e data de emissão; valores e total (da proposta); dados fixos da Fabriaço; logo e identidade.

**Preenchido por proposta:** título (2 linhas) e subtítulo; imagem de capa; objetivo, aplicação, benefícios; normas marcadas; competências; ajustes nas matrizes de responsabilidade e documentação; etapas do escopo e da gestão; imagens do escopo; itens de valor; condições de pagamento; impostos; frete (modalidade/destino); anexos.

**Biblioteca de textos-padrão (editável por quem tem permissão, versionada):** Sobre nós, fora do escopo, garantia, prazo, confidencialidade, frete A-D, matrizes-padrão, normas, etapas de gestão A-E. Quando um texto-padrão for alterado, propostas **já emitidas** não mudam (o texto é copiado para a revisão no momento da emissão).

## 5. Fluxo de uso proposto

1. Na proposta, aba "Documentos". Mostra duas abas internas: Técnica e Comercial, cada uma com formulário por seção (com barra de preenchimento: seções completas x pendentes).
2. **Pré-visualização ao vivo** ao lado do formulário, no visual final.
3. **Gerar PDF de rascunho** (marca d'água "Rascunho") quantas vezes quiser.
4. **Emitir** (ação explícita): trava o conteúdo da revisão, gera o PDF final, guarda no Storage, registra quem emitiu e quando. Novo ajuste depois disso cria a próxima revisão (copia o conteúdo anterior como ponto de partida).
5. A proposta no Kanban só vai para "Enviados" com documento emitido (**[DECIDIR]**: obrigar ou só avisar).
6. Histórico de revisões e PDFs na própria aba.

## 6. Modelo de dados (proposta inicial, em português snake_case como o resto)

- `propostas_documentos` (id, proposta_id, revisao, tipo [tecnica|comercial], conteudo jsonb, status [rascunho|emitido], emitido_por, emitido_em, pdf_path, criado_em, atualizado_em). Único por (proposta, revisao, tipo).
- `propostas_documentos_imagens` (id, documento_id, papel [capa|escopo], legenda, ordem, storage_path).
- `textos_padrao` (id, chave, titulo, corpo, versao, ativo): biblioteca.
- `normas` (id, codigo, titulo, descricao, ativo).
- `impostos_config` (NCM e alíquotas padrão, editáveis; ver ponto de atenção sobre ICMS).
- `empresa_dados` (dados fixos da Fabriaço: razão social, CNPJ, IE, endereço, telefone, e-mail, site).
- Regras: RLS como no restante; emissão e travamento por **função RPC**; documento emitido não aceita UPDATE; PDF em bucket privado do Storage; auditoria de emissão.
- Valores: lidos da tabela de valores/itens da proposta (se ainda não existir "itens da proposta", propor).

## 7. Geração do PDF (decisão técnica a validar com um teste curto)

Requisitos: visual idêntico ao modelo (capa escura, cartões, tabelas com cabeçalho escuro, selos Sim/Não/N-A, marcas de verificação), texto selecionável, quebra de página sem cortar tabelas/cartões, numeração "n / total", cabeçalho/rodapé por página, fonte embutida (Geist ou a do modelo), funcionar sem servidor extra.

Opções a comparar em um protótipo (uma página da técnica e uma da comercial):
- **A. HTML + CSS de impressão (@page) renderizado no navegador** — mesma pré-visualização do ERP, controle de quebra de página. Limite: salvar automaticamente no Storage exige um passo de geração; a caixa de impressão do navegador não devolve o arquivo ao sistema.
- **B. @react-pdf/renderer (gera o PDF no navegador como blob e envia ao Storage)** — arquivo exato, texto selecionável, upload automático. Limite: layout é reescrito em componentes próprios; fontes e tabelas longas exigem cuidado.
- **C. Edge Function do Supabase com navegador headless** — fiel ao HTML, mas mais pesado e com custo/limites de execução.
Recomendação inicial: testar **B** (PDF final guardado no sistema) mantendo a pré-visualização em HTML. Claude Code deve fazer o protótipo e recomendar com base no resultado.

## 8. Pontos de atenção encontrados nos PDFs de referência (precisam de resposta do Gabriel)

1. **Numeração divergente:** a capa técnica original registra 26-01-016, enquanto o arquivo e a comercial indicam 26-01-019. O sistema deve usar sempre o código da proposta (fonte única), eliminando esse erro.
2. **Competência "Pneumática: Não"** mas o escopo descreve fornecimento pneumático. O sistema poderia avisar quando houver incoerência (aviso, não bloqueio).
3. **Impostos:** o modelo diz que as alíquotas "reproduzem a proposta original e devem ser confirmadas". Quais valem como padrão? ICMS (8,8% no exemplo) e NCM variam por produto/destino. Proposta: padrões editáveis por proposta, e cálculo de impostos fora do escopo desta fase (só exibir o que o usuário informar).
4. **Selo "Prévia de proposta"** e "Prévia de estilo · não é emissão oficial" nos modelos: no sistema vira marca d'água só em rascunho.
5. Texto "Olá, Weber Silva." usa o primeiro nome? Nome completo? (decidir).
6. A confidencialidade diz "Fabriaço Montagens Industriais e Caldeiraria" e a tabela de dados diz "Fabriaço Montagem Industrial LTDA": confirmar a razão social oficial para `empresa_dados`.

## 9. Decisões pendentes para o Gabriel

- Quem pode editar a biblioteca de textos-padrão e as normas?
- Existem outros tipos de proposta além deste (serviço, manutenção, venda de equipamento), com seções diferentes? Se sim, a estrutura de seções deve ser configurável desde o início ou começamos só com este modelo?
- Documentos em português apenas, ou também inglês (clientes estrangeiros)?
- Enviar o PDF por e-mail pelo ERP (futuro) ou só baixar?
- Assinatura/aceite do cliente dentro do documento: fora desta fase?
- Quais imagens entram (render 3D enviado manualmente)? Limite de tamanho e formato (PNG/JPG).

## 10. Plano de entrega sugerido (cada etapa só começa com aprovação)

- **G0 Protótipo de PDF**: uma página técnica e uma comercial com dados fixos, para escolher a tecnologia (seção 7) e validar o visual com o Gabriel.
- **G1 Base de dados e biblioteca**: tabelas, RLS, textos-padrão e normas carregados; cadastro dos dados da empresa.
- **G2 Proposta Comercial** (menor e com valores): formulário, pré-visualização, rascunho em PDF.
- **G3 Proposta Técnica**: seções, matrizes, imagens.
- **G4 Emissão e revisões**: travamento, histórico, PDF no Storage, ligação com o Kanban.
- **G5 Acabamento**: avisos de incoerência, importar texto de propostas antigas, testes automáticos (código, totais, travamento).
Cada etapa termina com testes, atualização do CHANGELOG/REGRAS_DE_NEGOCIO/MODELO_DE_DADOS e validação do Gabriel.

## 11. Fora de escopo desta fase

Cálculo automático de impostos, assinatura digital, envio por e-mail, orçamento/custos de produção (módulo futuro), qualquer mudança no fluxo do Kanban.
