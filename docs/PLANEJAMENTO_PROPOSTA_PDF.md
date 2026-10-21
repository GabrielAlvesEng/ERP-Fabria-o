# Geração automática de propostas (PDF técnico e comercial, textos por IA)

Versão 3, 21/10/2026. **Estado: planejamento aguardando aprovação do Gabriel.**

Pedido (21/10): "quero fazer a parte de gerar propostas automáticas também" (item 8.11 do Documento Mestre). Respostas do Gabriel:
- IA: **OpenAI (ChatGPT)**.
- Modelos: "Novo Modelo de Proposta Técnica" (11 páginas) e "Novo Modelo de Proposta Comercial" (6 páginas), da proposta 26-01-019 da Symrise.
- Como pedem hoje ao ChatGPT, por exemplo: "preciso desenvolver uma proposta técnica para a SYMRISE de Descalvado-SP, essa proposta consiste no desenvolvimento de um sistema de vedação pneumática por meio de um perfil de borracha com geometria em 'H', associado a um ponto de conexão para alimentação de ar comprimido, visando vedar e evitar vazamentos."

## 1. Como fica para quem usa
1. Na proposta, nova aba **Documentos**, com duas subabas: **Técnica** e **Comercial**.
2. Campo **"Explique a proposta"**: você escreve como faz hoje no ChatGPT. Botão **Gerar textos com IA**.
3. A IA preenche as seções de texto. O ERP preenche sozinho tudo o que já está cadastrado: cliente, unidade, contato, código, revisão, datas, validade, itens e valores dos Custos, e os dados das duas empresas.
4. Você revisa e edita cada seção ao lado de uma **prévia em folha A4**, igual ao PDF. Dá para ligar ou desligar seções e marcar as tabelas (Sim/Não/N/A, cliente/Fabriaço).
5. **Gerar PDF**: o arquivo entra como anexo da revisão (Técnica ou Comercial), com o nome `Proposta 26-01-019-R0 FABRIAÇO - Vedação Pneumática Rosca MP.pdf`, e vai junto no e-mail de envio.
6. Revisão enviada fica **congelada**: uma nova revisão (R1) copia os textos para ajustar, e o PDF antigo nunca é sobrescrito (regra já aprovada).
7. Como o código e os dados vêm do ERP, some o tipo de erro que o próprio modelo aponta, como 26-01-016 na capa e 26-01-019 no arquivo.

## 2. Seções (fiéis aos modelos)
Visual dos modelos: capa escura com o título em duas cores e a imagem do equipamento; seções numeradas com selo roxo; cartões A/B/C; tabelas com cabeçalho grafite; rodapé com paginação.

**Proposta técnica**
| # | Seção | Quem preenche |
|---|---|---|
| Capa | título (2 linhas), subtítulo, cliente, unidade, identificação, imagem | ERP + IA (título e subtítulo) + imagem enviada |
| — | Visão do documento: objeto, solução, unidade | IA + ERP |
| 01 | Sobre nós | texto padrão da Fabriaço |
| 02 | Dados da empresa (Fabriaço × cliente) | ERP (cadastro de Empresas e Contatos) |
| 03 | Objetivo | IA |
| 04 | Aplicação (com lista de benefícios) | IA |
| 05 | Referência e normas | IA, a partir de uma lista padrão de normas |
| 06 | Competências (Mecânica, Civil, Automação, Elétrica, Pneumática, Instalação, Adequação: Sim/Não/N/A) | IA sugere, você confere |
| 07 | Responsabilidades (cliente × Fabriaço) | lista padrão, marcada por proposta |
| 08 | Documentações (cliente × Fabriaço) | lista padrão, marcada por proposta |
| 09 | Escopo (etapas numeradas + imagens) | IA + imagens enviadas |
| 10 | Fora do escopo | IA, a partir da lista padrão |
| 11 | Gestão do projeto (A a E) | texto padrão, ajustado pela IA |
| 12 | Garantia | texto padrão (18 meses) |
| 13 | Prazo de entrega | IA / texto padrão |
| 14 | Validade | ERP (validade da proposta) + texto padrão |
| 15 | Termo de confidencialidade | texto padrão com o nome do cliente |
| 16 | Anexo | "Não contém" ou lista de anexos |

**Proposta comercial**
| # | Seção | Quem preenche |
|---|---|---|
| Capa | igual à técnica, com "Proposta comercial · R0" | ERP + IA |
| — | Visão geral: "Olá, {contato}", preparado por, emissão, validade, revisão, local, cartões com o valor de cada item e o total | ERP + IA (parágrafo de abertura) |
| 01 | Objetivo | IA |
| 02 | Fora do escopo | o mesmo da técnica |
| 03 | Frete e logística (A a D) | IA / texto padrão (CIF ou FOB) |
| 04 | Garantia | texto padrão |
| 05 | Impostos (NCM, ICMS, IPI, PIS, COFINS, CSLL, IRPJ) | valores padrão, editáveis por proposta |
| 06 | Prazo de entrega | o mesmo da técnica |
| 07 | Valores: tabela de itens (A, B…) com descrição e valor, e "Investimento global" | **sempre dos Custos**; a IA só escreve a descrição de cada item |
| 08 | Forma de pagamento (condição, marco, forma) | padrão (ex.: 21 DDL, emissão da NF, transferência), editável |
| 09 | Validade | ERP |
| 10 | Termo de confidencialidade | texto padrão |
| 11 | Anexo | como na técnica |
| — | Contato comercial e técnico | ERP (usuário responsável) |

## 3. IA (OpenAI)
- Uma **função do Supabase** (Edge Function `gerar-textos-proposta`) chama a OpenAI. A chave fica guardada como segredo no Supabase (`IA_API_KEY`) e nunca vai para o site nem para o chat. Só usuário logado com permissão de Vendas usa.
- O que vai para a OpenAI: a sua explicação, o nome do cliente e da unidade, os itens (descrição e quantidade) e os textos-modelo da Fabriaço, para a IA escrever no mesmo estilo. **Não vão** CNPJ, telefones, e-mails nem preços. Pela política da OpenAI, o que passa pela API não é usado para treinar os modelos dela.
- A IA devolve as seções num formato fixo. O ERP encaixa cada uma no lugar certo, e você revisa.
- **Preço nunca é escrito pela IA**: vem sempre dos Custos.
- Custo estimado: alguns centavos de dólar por proposta, pagos à OpenAI pelo uso da API. A conta da API é separada da assinatura do ChatGPT.

## 4. Dados
- `documento_padroes`: textos padrão (Sobre nós, Garantia, Confidencialidade, Gestão do projeto, Frete…), listas padrão (Responsabilidades, Documentações, Fora do escopo, Normas, Competências), impostos e forma de pagamento padrão, e os dados da Fabriaço (razão social, CNPJ, IE, endereço). Editados em Administração → **Modelos de proposta**.
- `proposta_documentos`: por revisão e tipo (técnica/comercial), as seções com os textos usados, as marcações das tabelas, as imagens e o PDF gerado. Revisão enviada fica só leitura.
- Imagens da capa e do escopo no Storage privado de Vendas.

## 5. Entregas
1. **Modelos e editor:** Administração → Modelos de proposta com os textos padrão (já preenchidos com os dos modelos enviados); aba Documentos com as seções editáveis e a prévia A4. Textos digitados à mão.
2. **PDF:** gerar o PDF de verdade (texto selecionável, layout dos modelos), guardar na revisão e anexar no e-mail.
3. **IA:** Edge Function da OpenAI e o botão "Gerar textos com IA". Depende da chave cadastrada.
4. **Imagens:** capa e figuras do escopo, com legenda.

## 6. Perguntas
1. Aprova o plano e a ordem das entregas?
2. **Dados da Fabriaço** do modelo (Fabriaço Montagem Industrial LTDA, CNPJ 39.433.848/0001-40, IE 453.114.885.111, R. Paraná, 731, Vila Santa Rosa, 13731-160, Mococa-SP): estão certos para usar como padrão?
3. **Impostos (seção 05):** usar como padrão os do modelo (ICMS 8,8%, IPI 0%, PIS 0,65%, COFINS 3%, CSLL 1,08%, IRPJ 1,2%) e o NCM digitado por proposta?
4. **Título em duas cores da capa** ("Vedação Pneumática" / "Rosca MP"): a primeira linha é o assunto e a segunda o equipamento ou local? A IA sugere, e você ajusta.
5. **Chave da OpenAI:** quando quiser a entrega 3, crie a chave em platform.openai.com → API keys (precisa de créditos na conta da API) e cadastre no Supabase, projeto "ERP Fabriaço" → Edge Functions → Secrets, com o nome `IA_API_KEY`. **Não cole a chave no chat.**
