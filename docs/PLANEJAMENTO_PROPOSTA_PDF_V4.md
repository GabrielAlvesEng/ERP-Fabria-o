# Propostas em PDF — novo design (versão 4)

Versão 1, 22/10/2026. **Estado: aprovado e implementado (decisão 67).** Respostas: responsável técnico = contato técnico do cliente; garantia e prazo da comercial vêm da técnica.
Pedido: arquivo "Pode apagar.pdf" (22/10), com as mudanças na proposta técnica e na comercial. Base: `docs/PLANEJAMENTO_PROPOSTA_PDF.md` (versão 3, decisão 61).

## Proposta técnica

| # | Pedido | Como fica |
|---|--------|-----------|
| 1 | Logo maior e no centro do cabeçalho, logo principal | Na capa, a logo principal no centro do topo: símbolo em cima, "FABRIAÇO" embaixo e a linha "— MONTAGENS INDUSTRIAIS E CALDEIRARIA —", igual à referência. Vale para a capa escura e a clara. |
| 2 | Ícone da marca em todas as páginas, menos na capa | Ícone redondo roxo com o "F" branco (igual à referência) no cabeçalho de todas as páginas internas, à esquerda; à direita continua "PROPOSTA TÉCNICA · código / revisão". |
| 3 | "Sobre nós" como o exemplo | Página "Conheça a Fabriaço": título, subtítulo, mapa de São Paulo com Mococa marcada, 2 parágrafos, faixa "Materiais", 5 serviços com ícone (Tanques e vasos, Estruturas e tubos, Caldeiraria, Instalação, Documentação), "Máquinas e processos", "Setores" e a faixa roxa "Qualidade / Segurança / Confiabilidade". Layout fixo; os textos ficam em Administração → Modelos de proposta. |
| 4 | Responsável técnico mudável e em cópia no e-mail | Ver **pergunta 1**. Recomendação: a proposta ganha o campo **"Contato técnico"** (ex.: o engenheiro do cliente), além do contato atual (o comprador). A técnica vai "A/C" do contato técnico; a comercial, do comprador. No envio, o contato técnico já entra em C/C. |
| 5 | Competências com "Contemplado" no canto direito | Coluna Sim/Não/N/A encostada na margem direita. |
| 6 | Documentações dentro de Responsabilidades, separadas por área | Uma só seção **Responsabilidades**, em blocos: Engenharia, Compras, Fabricação, Instalação, Frete, Segurança e Financeiro, cada linha com Cliente / Fabriaço. Divisão inicial das linhas atuais no anexo A (você ajusta em Modelos). A seção "Documentações" deixa de existir. |
| 7 | Eliminar "Gestão do Projeto" | Sai da proposta técnica (e dos Modelos). |
| 8 | Garantia em cartão; só o tempo editável | Cartão grande "**18 meses** · após a emissão da NF"; ao lado, cartão "O que cobre" (defeitos de fabricação, materiais e mão de obra) e cartão "Não se aplica" (mau uso, alterações não autorizadas, armazenamento/instalação inadequados, desgaste natural). Texto fixo; na proposta só se edita o número de meses. |
| 9 | Prazo de entrega em cronograma | Etapas com **dias após a aprovação da proposta** (padrão: Engenharia e aprovação do projeto 10 · Compra de materiais 15 · Fabricação 30 · Entrega e instalação 10 = **65 dias**). No PDF, uma linha do tempo com barras e o total em destaque. Etapas e dias editáveis em cada proposta. |
| 10 | Validade em cartão | Cartão "**30 dias corridos** a partir da emissão" (vem da proposta) e as condições abaixo, fixas. |
| 11 | Confidencialidade sem o nome do cliente, texto padrão | Texto novo, fixo, sem citar o cliente e sem campo para editar (anexo B). |

As seções que continuam (Dados da empresa, Objetivo, Aplicação, Normas, Escopo com imagens por item, Fora do escopo, Anexo) recebem o mesmo acabamento.

## Proposta comercial — 4 páginas, mesmo visual da técnica

Sai: Objetivo e Fora do escopo (e o quadro "Olá, contato").

1. **Capa** — igual à da técnica (logo principal no centro), com "Proposta comercial".
2. **Visão geral**
   - Tabela de revisões: nº (R0, R1…), descrição (motivo da revisão; R0 = "Emissão inicial") e data de emissão.
   - Cartões: Validade · Frete (ex.: "CIF — incluso") · Garantia · Prazo de entrega total.
   - Tabela de impostos (NCM e percentuais).
   - Forma de pagamento: condição, forma e em qual marco.
3. **Valores** — tabela: item, título, quantidade, valor unitário, valor total, e o **investimento global** em destaque. Itens, quantidades e valores vêm da aba Custos (o unitário é o total dividido pela quantidade).
4. **Última página**
   - Termo de confidencialidade comercial: valores e condições são para uso interno do cliente (anexo C).
   - Anexos (lista editável; padrão: "Proposta técnica {código}").
   - Contato do vendedor responsável pela negociação: nome, cargo, telefone/WhatsApp e e-mail (do cadastro de Vendedores).

Se houver muitos itens, a página de valores continua na seguinte; as outras ficam fixas em uma página.

## O que mais muda
- **Banco:** uma migration pequena: coluna `contato_tecnico_id` em `propostas` (se a pergunta 1 for aprovada).
- **Propostas que já têm documento salvo** são convertidas ao abrir: os textos que você já escreveu (objetivo, aplicação, normas, escopo e imagens, competências, fora do escopo, descrições) são mantidos; as seções que mudaram de formato vêm do novo padrão. Revisões já enviadas ficam como estão (o PDF anexado não muda).
- **IA:** continua preenchendo os mesmos textos; na comercial deixa de gerar objetivo.
- **Modelos de proposta (Administração):** passam a ter "Sobre nós", Responsabilidades por área, cronograma padrão, meses de garantia, anexos e termos novos.

## Perguntas
1. **Responsável técnico:** é o **contato técnico do cliente** (engenheiro), escolhido na proposta, que recebe a técnica e vai em C/C no e-mail (recomendado)? Ou é o **responsável técnico da Fabriaço**, que aparece nos dados da empresa?
2. **Garantia e prazo na comercial:** a comercial usa os meses de garantia e o prazo total da **proposta técnica da mesma revisão** (recomendado: um lugar só para editar)?
3. Aprova o planejamento (com a divisão do anexo A e os textos dos anexos B e C, que você pode ajustar depois em Modelos)?

## Anexo A — Responsabilidades por área (divisão inicial)
- **Engenharia** (Fabriaço): Cronograma detalhado; Projeto técnico; Lista de materiais; Memorial de cálculo; Laudo técnico; ART; Databook; As built; Manual de operação.
- **Compras** (Fabriaço): Materiais; Consumíveis; Certificados dos materiais.
- **Fabricação** (Fabriaço): Mão de obra qualificada; Equipamentos e ferramentas de transformação; PIT; Plano de pintura; Procedimento de soldagem (EPS, RQPS, CQP); Relatório de controle de qualidade; Documentação NR-13.
- **Instalação**: Fabriaço — Plano de rigging; Histograma de instalação; Relatório diário; Limpeza da área. Cliente — Equipamentos de aluguel (gerador, andaime, guindaste, PTA); Liberações e agendamento de parada; Ponto de energia; Água potável; Banheiro.
- **Frete** (Fabriaço): Carregamento; Descarregamento; Transporte / seguro; Refeições, hospedagem e transporte dos profissionais.
- **Segurança**: Fabriaço — EPIs; Ficha de EPI; Sinalização da área; Análise de riscos e APRs; Treinamentos NR-10/12/35; PCMSO e ASO; PT preenchida e assinada. Cliente — Credenciamento e crachás; Permissões e licenças; Abertura e assinaturas das PT.
- **Financeiro**: Cliente — Pedido de compras. Fabriaço — Nota fiscal.

## Anexo B — Termo de confidencialidade (técnica), texto fixo
Este documento e todo o seu conteúdo (informações técnicas, desenhos, modelos, especificações, cálculos, imagens, metodologias e soluções construtivas) são de propriedade da Fabriaço Montagens Industriais e Caldeiraria e constituem informação confidencial.

O material foi preparado exclusivamente para a avaliação técnica do destinatário desta proposta. Não pode ser copiado, reproduzido, divulgado ou repassado a terceiros, nem utilizado para outros fins, sem autorização prévia e por escrito da Fabriaço.

As soluções e os detalhamentos aqui apresentados são propriedade intelectual da Fabriaço e estão protegidos pela legislação de direitos autorais e de propriedade industrial. O uso indevido sujeita o responsável às medidas legais cabíveis.

## Anexo C — Termo de confidencialidade (comercial), texto fixo
Os valores, condições comerciais e prazos desta proposta foram elaborados exclusivamente para o destinatário e são estritamente confidenciais.

Este documento destina-se ao uso interno da empresa destinatária, pelas áreas envolvidas na análise e na aprovação da compra. Não deve ser compartilhado com outros fornecedores, prestadores de serviço ou terceiros, nem utilizado como referência em outras cotações.

Ao receber esta proposta, o destinatário concorda em preservar o sigilo das informações aqui contidas.
