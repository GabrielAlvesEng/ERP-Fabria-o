# Geração automática de propostas (PDF técnico e comercial)

Versão 2, 21/10/2026. **Estado: planejamento aguardando os modelos atuais, a escolha da IA e a aprovação do Gabriel.**

Pedido (21/10): "quero fazer a parte de gerar propostas automáticas também". É o item 8.11 do Documento Mestre, que estava reservado para depois, com autorização.

## 1. Como funcionaria
1. Na proposta, nova aba **Documento**, com uma prévia em folha A4 do jeito que vai sair no PDF.
2. O ERP **preenche sozinho** a partir do que já está cadastrado:
   - capa: logo, código (26-01-001-R1), título, cliente, contato, data e validade;
   - itens A, B, C, cada um com descrição, quantidade e **preço de venda** vindos da aba Custos;
   - total da proposta e dados da Fabriaço (CNPJ, endereço, telefones).
3. Os **textos** (escopo de cada item, condições de pagamento, prazo, frete, garantia, exclusões) vêm de **modelos editáveis** em Administração. Na proposta, você ajusta o que precisar.
4. **Seções:** você reorganiza, liga ou desliga cada seção e insere imagens e desenhos (do computador ou dos arquivos do projeto).
5. Botão **Gerar PDF**: o arquivo entra como anexo da revisão (Comercial ou Técnica), com o nome no padrão `Proposta 26-01-001-R1 FABRIAÇO - Título.pdf`.
6. O PDF de uma revisão enviada fica **congelado**: uma nova revisão gera um novo PDF e o antigo nunca é sobrescrito (regra já aprovada).
7. O e-mail de envio, que já existe, passa a anexar esses PDFs sozinho.

## 2. Dados (resumo)
- **Modelos:** tabela de modelos de documento (comercial e técnico), com seções, textos padrão e ordem.
- **Proposta:** cada revisão guarda as seções e textos usados, para o PDF poder ser refeito igual.
- Os valores continuam vindo dos Custos (nada digitado duas vezes).

## 3. Entregas
1. Modelos em Administração e a aba Documento com prévia A4 e textos editáveis.
2. Gerar PDF, guardar na revisão e anexar no e-mail.
3. Imagens e desenhos nas seções.

## 4. Textos gerados por IA (pedido do Gabriel, 21/10)
Hoje os textos da proposta são escritos pelo ChatGPT: vocês explicam a proposta e ele preenche tudo. **Dá para fazer isso dentro do ERP:**
1. Na aba Documento, um campo **"Explique a proposta"**: você escreve (ou cola) a explicação, do jeito que faz hoje no ChatGPT.
2. O botão **Gerar textos com IA** manda a explicação junto com o que o ERP já sabe: cliente, itens A/B/C com quantidades e preços dos Custos, materiais e prazos. Manda também os **modelos e exemplos** da Fabriaço, para a IA escrever no padrão de vocês.
3. A IA devolve **cada seção preenchida** (escopo de cada item, premissas, exclusões, condições). Você revisa, edita o que quiser e gera o PDF.
4. **Os preços nunca são escritos pela IA:** vêm sempre dos Custos, para não haver valor inventado.
5. **Segurança:** a chamada passa por uma função do Supabase (Edge Function). A chave da IA fica guardada como segredo no Supabase, nunca no site nem no chat, e só usuário logado com permissão de Vendas usa.
6. **Custo:** paga-se por uso à empresa da IA, alguns centavos por proposta. Serve OpenAI (a mesma do ChatGPT) ou Anthropic (Claude); a função é a mesma para as duas.

## O que preciso do Gabriel
1. **Os modelos atuais** (Word ou PDF) da proposta **comercial** e da **técnica**, de preferência 1 ou 2 propostas reais já enviadas. Vou copiar o layout, as seções e os textos padrão.
2. **Dois documentos ou um só?** Hoje há anexo Comercial e Técnico separados por revisão. Recomendo manter os dois, gerados do mesmo lugar.
3. **Valores no PDF:** mostrar preço por item e total (recomendado)? Mostrar o imposto separado ou só o preço final?
4. **Condições comerciais padrão:** pagamento, prazo de entrega, validade, frete, garantia e o que não está incluso. Pode mandar o texto que vocês usam hoje.
5. **Quem pode editar os modelos:** só a Administração (recomendado)?
6. **IA:** qual usar, OpenAI (ChatGPT) ou Anthropic (Claude)? Precisa criar uma conta de API na empresa escolhida e gerar a chave. A chave é cadastrada por você no Supabase (Edge Functions → Secrets, nome `IA_API_KEY`), nunca colada no chat.
7. **O texto (prompt) que vocês usam hoje no ChatGPT**, se tiverem um padrão, e 1 ou 2 conversas de exemplo. Servem de base para a IA do ERP escrever igual.
