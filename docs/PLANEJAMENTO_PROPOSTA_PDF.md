# Geração automática de propostas (PDF técnico e comercial)

Versão 1, 21/10/2026. **Estado: planejamento aguardando os modelos atuais e a aprovação do Gabriel.**

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

## O que preciso do Gabriel
1. **Os modelos atuais** (Word ou PDF) da proposta **comercial** e da **técnica**, de preferência 1 ou 2 propostas reais já enviadas. Vou copiar o layout, as seções e os textos padrão.
2. **Dois documentos ou um só?** Hoje há anexo Comercial e Técnico separados por revisão. Recomendo manter os dois, gerados do mesmo lugar.
3. **Valores no PDF:** mostrar preço por item e total (recomendado)? Mostrar o imposto separado ou só o preço final?
4. **Condições comerciais padrão:** pagamento, prazo de entrega, validade, frete, garantia e o que não está incluso. Pode mandar o texto que vocês usam hoje.
5. **Quem pode editar os modelos:** só a Administração (recomendado)?
