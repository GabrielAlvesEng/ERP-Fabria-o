# Planejamento: aba Custos da proposta e e-mail de envio

Versão 1, 19/10/2026. **Estado: aguardando aprovação do Gabriel.** Nada foi implementado.

Base: pedido do Gabriel na conversa e a planilha de exemplo
`1.3.Vendas/1.3.1.Orçamentos/2026/26-Kenny Nunes-GELITA-Mococa-SP/26-26-003_Plataforma Superior Lavadoras/Custo/Item A - Plataforma.xlsx`
(abas "Planilha", "Valores de Material", "Cálculo Peso" e "Configuração").

---

## 1. Aba "Custos" da proposta

Fica entre **Dados** e **Revisões e arquivos** no detalhe da proposta.

### 1.1 O que a planilha faz hoje (resumo)

| Seção | Campos | Total da linha |
|---|---|---|
| Materiais | tipo (Chapas, Perfis, Comerciais), descrição (lista de preços), qtd, preço unitário, und/peso/mts | qtd × und × preço |
| Acessórios | descrição (Fixação, Conexões, Transmissão, Controle de fluxo, Componentes mecânicos, Tintas) | valor digitado |
| Mão de obra | etapa (Visita técnica, Engenharia, Fabricação, Instalação, Segurança, Administrativo), função, valor hora, horas | horas × valor hora |
| Máquinas | máquina, terceirizada (sim/não), valor hora, horas | horas × valor hora |
| Deslocamento | qtd, tipo (combustível, pedágio, aluguel de veículo), destino, preço unitário | qtd × preço |
| Alimentação | colaboradores, dias, valor da refeição | colab. × dias × valor |
| Hospedagem | diárias, valor do hotel, cidade | diárias × valor |
| Fretes | qtd, tipo (coleta de chapas, perfis, comerciais, entrega), partida, destino, preço | qtd × preço |
| Margem | lucro %, margem de negociação % | % sobre os custos |
| Imposto | % | % sobre custos + margem |
| Orçamento | resumo A a J, quantidade | (soma) × quantidade = **preço de venda** |

Tabelas de apoio: lista de preços de chapas (por kg), perfis (por metro) e comerciais (por unidade), e uma calculadora de peso de chapa (espessura × largura × comprimento × densidade).

### 1.2 Pontos da planilha que precisam da sua confirmação

Encontrei estas diferenças nas fórmulas. Não vou copiar nenhuma delas sem você confirmar:

1. **Total de Acessórios soma só as 2 primeiras linhas** (`=SUM(K33:L34)`). Conexões em diante (Transmissão, Controle de fluxo, Componentes, Tintas) ficam fora do total. Parece erro. **Proposta:** somar todas.
2. **Lucro e margem de negociação não incluem Acessórios** (somam Materiais, Mão de obra, Máquinas, Deslocamento, Alimentação, Hospedagem e Fretes), mas o **Imposto inclui**. É proposital? **Proposta:** lucro e margem sobre todos os custos.
3. **Imposto "por fora":** hoje é 20% sobre (custos + margem). Assim, o imposto embutido no preço final fica menor que 20% do preço (no exemplo, R$ 53.847 sobre R$ 323.082 = 16,7%). Se o imposto incide sobre a nota, o cálculo correto é "por dentro": preço = (custos + margem) ÷ (1 − 20%). **Proposta:** perguntar ao seu contador; o sistema terá as duas opções, com padrão "por dentro".

### 1.3 Proposta de funcionamento

- **Itens da proposta:** uma proposta pode ter vários itens (Item A, Item B…), como o nome do arquivo "Item A - Plataforma" sugere. Cada item tem sua planilha de custos e sua quantidade. O preço total da proposta é a soma dos itens. **[DECIDIR]** Confirma que uma proposta pode ter vários itens?
- **Custos por revisão:** os custos pertencem à revisão. Em "À enviar" você edita à vontade. Ao enviar, os custos daquela revisão ficam congelados. Na nova revisão (R1), os custos são copiados e podem ser ajustados. Assim dá para comparar R0 × R1.
- **Tela:** cada seção é um bloco recolhível com tabela editável (adicionar e remover linhas), total da seção sempre visível e um resumo fixo no fim (A a J, quantidade e preço de venda). Os cálculos são automáticos, como na planilha.
- **Listas de preço e valores-hora no sistema:** a lista de preços (chapas, perfis, comerciais), os valores-hora de mão de obra e de máquinas e os percentuais padrão (lucro, negociação, imposto) ficam em tabelas de referência editáveis pela Administração. Ao escolher um material, o preço vem da lista, mas fica **gravado na proposta**. Se a lista mudar depois, propostas antigas não mudam.
  - A lista atual da aba "Valores de Material" (10 chapas, 348 perfis, 168 comerciais) pode ser importada.
  - Essa lista será a semente do catálogo de materiais (COD_MAT) que Engenharia e Compras vão usar depois.
- **Calculadora de peso:** em linhas de chapa, um botão abre a calculadora (espessura, largura, comprimento, inox ou carbono) e preenche o peso.
- **Valor da proposta:** botão "Usar preço de venda como valor da proposta", para você decidir quando atualizar o valor. Não acontece sozinho.
- **Quem vê custos:** custos e margens são informação sensível. **[DECIDIR]** Quem pode ver a aba Custos: todo o Comercial, ou só Administração e quem você liberar? Proposta: nova permissão "ver custos", dada a Administração e Comercial, e não dada a Financeiro e Consulta.
- **Exportar:** botão para gerar a planilha de custos em Excel, no mesmo formato de hoje, para guardar na pasta do orçamento. **[DECIDIR]** Precisa?

### 1.4 Dados (resumo)

- `custo_itens` (revisão, letra A/B/C, descrição, quantidade, lucro %, negociação %, imposto %, modo do imposto)
- `custo_linhas` (item, seção, campos da linha, total calculado)
- Referências: `ref_materiais` (tipo, descrição, unidade, preço), `ref_mao_obra` (etapa, função, valor hora), `ref_maquinas` (máquina, terceirizada, valor hora), `ref_custos_padrao` (percentuais)
- Cálculos feitos no banco também (para o total não depender da tela) e auditoria em tudo.

---

## 2. "Enviar ao cliente" com e-mail pronto

### 2.1 Como fica o fluxo

1. Na proposta em "À enviar", você clica **Enviar ao cliente**.
2. Abre uma janela de envio com:
   - **Para:** e-mail do contato da proposta (editável).
   - **CC:** escolha de outros contatos da mesma empresa, ou de qualquer contato, mais e-mails digitados livremente.
   - **Assunto:** `Proposta 26-26-005 FABRIAÇO - Tanques Diversos Inox`, ou seja, `Proposta {código} FABRIAÇO - {título}`.
   - **Texto:** o seu modelo, com {CONTATO} e {nome da proposta} preenchidos (editável antes de enviar).
   - **Anexos:** a proposta **comercial** e a **técnica** da revisão atual. Se faltar alguma, o sistema avisa antes.
   - **Assinatura:** a sua assinatura no fim.
3. Ao confirmar, a proposta vai para **Enviados** (revisão congelada, follow-up agendado) e o e-mail abre pronto, com os anexos.

### 2.2 A decisão principal: como "abrir o e-mail com anexos"

Um site não consegue, sozinho, abrir o programa de e-mail **com anexos**. O link "mailto:" abre o e-mail com destinatário, CC, assunto e texto, mas **nunca com anexos**. Por isso a escolha depende do e-mail que vocês usam:

| Opção | Como funciona | Anexos | Assinatura | Serve para |
|---|---|---|---|---|
| **A. Rascunho .eml** (recomendada se usam Outlook no computador) | O ERP gera um arquivo de e-mail pronto (para, CC, assunto, texto, assinatura e os 2 PDFs). Você clica e ele abre no Outlook como **mensagem nova**, é só conferir e clicar Enviar | Sim | Guardada no ERP (cada usuário cadastra a sua, com logo) | Outlook para Windows, Thunderbird, Apple Mail |
| B. Rascunho direto na caixa do Microsoft 365 | O ERP cria o rascunho na sua caixa do Outlook (via Microsoft Graph) e abre o Outlook Web nele | Sim | Guardada no ERP | Só se o e-mail for Microsoft 365. Exige registrar um app no Azure da empresa |
| C. Rascunho no Gmail / Google Workspace | Igual à B, pela API do Gmail | Sim | Guardada no ERP | Só se o e-mail for Google |
| D. mailto | Abre o e-mail sem anexos; você anexa os PDFs à mão | Não | A do seu programa | Qualquer um |

Observação sobre a assinatura: nas opções A, B e C o Outlook ou Gmail **não** insere a assinatura sozinho em rascunhos criados por outro sistema. Por isso a proposta é cadastrar a assinatura de cada usuário no ERP (texto e imagem), e ela entra no fim do e-mail.

**[DECIDIR]**
1. Qual e-mail e programa vocês usam no dia a dia? (Outlook instalado no Windows? Outlook Web / Microsoft 365? Gmail / Google Workspace? Outro provedor, como Locaweb ou HostGator?)
2. Em revisões (R1, R2…), o assunto deve indicar a revisão? Proposta: `Proposta 26-26-005 R1 FABRIAÇO - Tanques Diversos Inox`.
3. {nome da proposta} no texto = código + título (`26-26-005 - Tanques Diversos Inox`)?
4. Enviar sem a técnica ou sem a comercial deve ser permitido (com aviso) ou bloqueado?
5. O sistema deve registrar no histórico da proposta para quem foi enviado (Para e CC)? Proposta: sim.

---

## 3. Ordem de entrega proposta

1. **Custos, parte 1:** tabelas de referência e importação da lista de preços; aba Custos com Materiais, Acessórios, Mão de obra e Máquinas; resumo e preço de venda.
2. **Custos, parte 2:** Deslocamento, Alimentação, Hospedagem, Fretes; calculadora de peso; vários itens; cópia na nova revisão; botão "usar como valor".
3. **Envio por e-mail:** janela de envio, modelo, CC, assinatura por usuário, anexos e a opção escolhida em 2.2.

Cada parte: migration nova, testes, verificação no navegador, publicação e sua validação.
