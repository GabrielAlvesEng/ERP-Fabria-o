# PROJETO ERP FABRIAÇO BRASIL
## Documento Mestre — Apresentação, Arquitetura e Planejamento de Desenvolvimento

### 1. APRESENTAÇÃO DO PROJETO

Quero desenvolver do zero um sistema ERP completo para minha empresa, **Fabriaço Brasil — Montagens Industriais e Caldeiraria**, localizada em Mococa, São Paulo.

Nossa empresa atua com engenharia mecânica, projetos industriais, caldeiraria, fabricação de equipamentos, estruturas metálicas, tubulações industriais, montagens e instalações em plantas industriais.

O sistema será utilizado internamente por diversos setores da empresa e deverá integrar as informações desde o primeiro contato comercial até a entrega final do projeto e seu encerramento financeiro.

O objetivo principal é eliminar informações descentralizadas, planilhas independentes, documentos desconectados e controles manuais.

Queremos uma plataforma única para administrar todo o fluxo operacional da empresa.

**O projeto será chamado ERP FABRIAÇO.**

---

# 2. REGRA MAIS IMPORTANTE DO DESENVOLVIMENTO

**NÃO QUERO QUE VOCÊ DESENVOLVA TODO O ERP DE UMA VEZ.**

O sistema será desenvolvido por etapas, começando pelo módulo de Vendas.

Somente depois de concluir, testar e aprovar esse módulo avançaremos para Engenharia.

Posteriormente, desenvolveremos os demais módulos conforme as dependências do fluxo operacional.

Quero que você entenda o projeto completo antes de começar, mas execute somente aquilo que for expressamente autorizado.

Para cada módulo, seguiremos este processo:

1. Entendimento do funcionamento do setor.
2. Análise do fluxograma operacional correspondente.
3. Definição dos requisitos e das regras de negócio.
4. Planejamento das telas e funcionalidades.
5. Modelagem das informações e integrações.
6. Apresentação do planejamento para minha aprovação.
7. Implementação das funcionalidades aprovadas.
8. Testes e correções.
9. Validação final do módulo.
10. Autorização para iniciar a etapa seguinte.

**Nunca avance automaticamente para outro módulo sem minha autorização.**

Também não quero que você implemente funcionalidades com base em suposições quando elas puderem comprometer o funcionamento dos demais setores.

---

# 3. ARQUITETURA TECNOLÓGICA

Minha preferência é utilizar:

- React para o frontend.
- TypeScript.
- Tailwind CSS.
- Componentes modernos, reutilizáveis e responsivos.
- Supabase como backend e banco de dados PostgreSQL.
- Supabase Auth para autenticação.
- Supabase Storage para documentos.
- Netlify para publicação do frontend.

Podemos utilizar bibliotecas especializadas para Kanbans, gráficos, fluxogramas, formulários, tabelas e outros componentes.

Entretanto, quero uma arquitetura organizada, escalável e de fácil manutenção.

### Regras técnicas

- Código modular.
- Componentes reutilizáveis.
- Separação entre interface, regras de negócio e acesso aos dados.
- Banco de dados relacional bem estruturado.
- Permissões individuais.
- Segurança com políticas RLS.
- Validação de dados.
- Registro de alterações importantes.
- Tratamento de erros.
- Controle de versões do código.
- Migrations SQL pequenas e organizadas.
- Ambiente de desenvolvimento separado da produção.

Evite soluções improvisadas que dificultem a integração futura de outros módulos.

---

# 4. IDENTIDADE VISUAL

Quero um ERP industrial moderno, com aparência profissional semelhante a plataformas SaaS corporativas.

Prefiro:

- Sidebar moderna.
- Cards arredondados.
- Ícones elegantes.
- Botões com boa aparência.
- Formulários organizados.
- Tabelas modernas.
- Dashboards com gráficos interativos.
- Kanbans com Drag and Drop.
- Temas claro e escuro.
- Interface responsiva.

A identidade visual utilizará principalmente:

- Azul-marinho.
- Roxo.
- Branco.
- Tons de cinza.
- Verde-petróleo para determinados indicadores.

Tenho um protótipo visual desenvolvido anteriormente que será enviado como referência em outra etapa.

**Neste primeiro momento, priorize o funcionamento e a organização do sistema.**

A reformulação estética completa será realizada posteriormente.

---

# 5. VISÃO GERAL DOS MÓDULOS

O ERP completo deverá contemplar os seguintes setores.

## 5.1. VENDAS

Será o primeiro módulo desenvolvido.

Deverá controlar:

- Empresas.
- Contatos.
- Clientes e leads.
- Propostas técnicas.
- Propostas comerciais.
- Histórico de revisões.
- Kanban comercial.
- Follow-up.
- Aprovação das propostas.
- Comprovações da aprovação.
- Reuniões de kick-off.
- Transferência do projeto para Engenharia.

## 5.2. ENGENHARIA

Responsável pelo desenvolvimento técnico dos projetos aprovados.

Deverá contemplar:

- Dados técnicos do projeto.
- Documentos e referências.
- Modelamento 3D.
- Integração com SolidWorks.
- Árvore de montagens e conjuntos soldados.
- Lista de materiais — BOM.
- Catálogo COD_MAT.
- Códigos de operação COD_OP.
- Detalhamento técnico.
- Planos de corte.
- Requisições de materiais.
- Controle do desenvolvimento de Engenharia.

## 5.3. COMPRAS

Deverá contemplar:

- Requisições de compra.
- Solicitações dos setores.
- Cadastro de fornecedores.
- Cotações.
- Comparação de propostas.
- Aprovação de compras.
- Ordens de compra.
- Acompanhamento das entregas.

## 5.4. ALMOXARIFADO

Deverá contemplar:

- Cadastro de materiais.
- Chapas, perfis e componentes comerciais.
- Estoques.
- Reservas por projeto.
- Entradas e saídas.
- Rastreamento de materiais.
- Separação de materiais para fabricação.
- Integração com Compras e Engenharia.

## 5.5. PCP

Responsável pelo Planejamento e Controle da Produção.

Deverá contemplar:

- Planejamento das ordens de fabricação.
- Sequenciamento de atividades.
- Lotes de produção.
- Prazos.
- Preparação de materiais.
- Distribuição das atividades.
- Acompanhamento dos gargalos.
- Integração com Engenharia e Fabricação.

## 5.6. FABRICAÇÃO

Deverá contemplar:

- Ordens de fabricação.
- Atividades por colaborador.
- Controle de etapas produtivas.
- Corte, dobra, calandra, usinagem, soldagem e montagem.
- Apontamentos de produção.
- Controle de progresso.
- Documentação de fabricação.
- Inspeções e controle de qualidade.

## 5.7. FINANCEIRO

Deverá contemplar:

- Contas a pagar.
- Contas a receber.
- Controle financeiro por projeto.
- Recebimentos de clientes.
- Despesas operacionais.
- Fluxo de caixa.
- Indicadores financeiros.
- Relatórios gerenciais.

## 5.8. RECURSOS HUMANOS

Deverá contemplar:

- Colaboradores.
- Usuários do ERP.
- Setores e funções.
- Permissões individuais.
- Documentações.
- Integrações de segurança por cliente.
- Validade de documentos e treinamentos.
- Holerites e informações funcionais.

## 5.9. AGENDA, TAREFAS E FROTA

Deverá contemplar:

- Agenda operacional.
- Tarefas individuais e por setor.
- Compromissos.
- Veículos e equipamentos.
- Controle de utilização.
- Programação de serviços de campo.
- Movimentação e içamento.

## 5.10. ADMINISTRAÇÃO

Responsável por:

- Gestão de usuários.
- Perfis e permissões.
- Configurações.
- Senhas administrativas para ações críticas.
- Parâmetros do sistema.
- Auditoria.
- Cadastros gerais.

---

# 6. FLUXO OPERACIONAL DA FABRIAÇO

O sistema será construído em torno do seguinte fluxo geral:

**CONTATO COMERCIAL**

↓

**CADASTRO DA EMPRESA E CONTATO**

↓

**ELABORAÇÃO DA PROPOSTA**

↓

**ENVIO AO CLIENTE / FOLLOW-UP**

↓

**APROVAÇÃO DA PROPOSTA**

↓

**REUNIÃO DE KICK-OFF**

↓

**ENGENHARIA**

↓

**REQUISIÇÕES DE MATERIAIS / COMPRAS / ALMOXARIFADO**

↓

**PCP E PREPARAÇÃO DE MATERIAIS**

↓

**FABRICAÇÃO**

↓

**CONTROLE DE QUALIDADE**

↓

**EXPEDIÇÃO E INSTALAÇÃO**

↓

**ENTREGA DO PROJETO**

↓

**FATURAMENTO E ENCERRAMENTO FINANCEIRO**

Esse fluxo é uma visão geral e não representa necessariamente uma sequência estritamente linear.

Diversos processos poderão ocorrer em paralelo. Por exemplo, Compras poderá iniciar determinadas aquisições enquanto Engenharia continua o detalhamento autorizado.

Estamos desenvolvendo um **fluxograma operacional mais completo**, que será enviado posteriormente.

Quando esse fluxograma for disponibilizado, ele deverá ser utilizado como referência principal para compreender:

- Quais setores participam de cada etapa.
- Quais documentos são gerados.
- Quais informações passam de um setor para outro.
- Quais aprovações são obrigatórias.
- Quais atividades podem ocorrer paralelamente.
- Quais condições permitem avançar ou retornar uma etapa.

Não considere o fluxo textual acima uma especificação definitiva de todos os processos.

---

# 7. PADRONIZAÇÃO DOS CÓDIGOS

O ERP terá numeração centralizada e padronizada.

## Propostas comerciais

Padrão:

**AA-CC-NNN**

Exemplo:

26-01-001

Onde:

- AA = Ano.
- CC = Código comercial do contato.
- NNN = Número sequencial.

Os critérios exatos de geração e unicidade serão definidos durante o desenvolvimento de Vendas.

## Projetos de fabricação

Padrão:

**AA-NNN-SIGLA**

Exemplo:

26-038-SPP

Onde:

- AA = Ano.
- NNN = Número sequencial do projeto.
- SIGLA = Identificação do projeto.

## Montagens e conjuntos soldados

Exemplos:

Montagem geral:

26-038-SPP-00-00-000

Submontagens:

26-038-SPP-0A-00-000

26-038-SPP-0B-00-000

Conjuntos secundários:

26-038-SPP-0A-01-000

26-038-SPP-0A-02-000

Esses códigos serão importantes quando chegarmos ao módulo de Engenharia.

---

# 8. PRIMEIRA ETAPA — MÓDULO DE VENDAS

**ESTE É O ÚNICO MÓDULO QUE QUERO PLANEJAR E DESENVOLVER AGORA.**

O módulo de Vendas será a porta de entrada dos projetos da Fabriaço.

Quero que seja organizado em uma área principal chamada:

**VENDAS**

Dentro dela teremos inicialmente:

- Dashboard Comercial.
- Empresas.
- Contatos.
- Propostas.

As demais funcionalidades comerciais deverão estar integradas a essas áreas.

## 8.1. EMPRESAS

Quero cadastrar todas as empresas com as quais temos relacionamento comercial.

Exemplos de informações:

- Razão social.
- Nome fantasia.
- CNPJ.
- Inscrição estadual, quando aplicável.
- Endereço.
- CEP.
- Cidade e estado.
- Telefones.
- E-mails.
- Site.
- Segmento industrial.
- Informações complementares.

Uma empresa poderá possuir diversos contatos.

Evite duplicação de empresas.

## 8.2. CONTATOS

Cada contato deverá estar vinculado a uma empresa.

Informações:

- Nome.
- Cargo.
- Departamento.
- E-mail.
- Telefone.
- WhatsApp.
- Empresa vinculada.
- Situação comercial.
- Observações.

### Organização anual

Quero acompanhar comercialmente os contatos por ano.

Por exemplo, um contato pode ter solicitado propostas em 2026, mas não ter realizado nenhuma solicitação em 2027.

Nesse caso, ele não deve aparecer automaticamente como um contato comercial ativo de 2027.

Entretanto, seus dados e históricos dos anos anteriores devem continuar preservados.

Proponha uma estrutura que permita essa organização anual sem duplicar desnecessariamente os dados da pessoa.

### Lead e cliente

Os contatos poderão possuir classificação comercial:

- Lead.
- Cliente.

Quando uma proposta vinculada ao contato for aprovada, ele deverá ser classificado automaticamente como Cliente, respeitando as regras de negócio que definirmos.

## 8.3. PROPOSTAS

Cada proposta deverá conter:

- Código automático.
- Empresa.
- Contato responsável.
- Título do fornecimento.
- Descrição.
- Data de emissão.
- Responsável comercial.
- Valor.
- Status.
- Revisão.
- Histórico.
- Anexos.
- Documentos técnicos.
- Condições comerciais.
- Prazo previsto.
- Data de follow-up.

As propostas deverão estar vinculadas aos cadastros de Empresas e Contatos.

## 8.4. KANBAN DE PROPOSTAS

Quero utilizar um Kanban moderno com movimentação por Drag and Drop.

As colunas principais deverão representar:

1. À enviar.
2. Enviados.
3. Aprovado.
4. Finalizado.
5. Emitido NF.
6. Pago.

Também teremos:

- Follow-up.
- Reprovado.

Essas duas situações deverão ser incorporadas ao fluxo, com regras de retorno e acompanhamento.

Os cards deverão ser movidos ao clicar e arrastar em qualquer área livre da superfície, mantendo os botões e campos internos funcionais.

O Kanban deverá permitir filtrar por ano, responsável, cliente e demais critérios relevantes.

## 8.5. REVISÕES DE PROPOSTAS

Não quero que toda edição de dados gere uma nova revisão.

Enquanto a proposta estiver em **À enviar**, poderá ser modificada sem criar revisão automaticamente.

Quando a proposta já tiver sido enviada ao cliente e precisar retornar para edição, deverá ser criada uma nova revisão conforme a regra definida para o processo.

Exemplo:

R0 — Emissão inicial.

R1 — Revisão após envio.

R2 — Nova revisão comercial.

Cada revisão deverá preservar seu histórico e os documentos emitidos.

Não sobrescrever PDFs de revisões anteriores.

## 8.6. FOLLOW-UP

Quero poder colocar propostas em acompanhamento comercial.

O follow-up poderá ser:

- Manual.
- Programado para uma data.
- Gerado a partir de prazos comerciais configurados.

O sistema deverá indicar quais propostas precisam de retorno ao cliente.

O vendedor poderá movimentar o card para a coluna Follow-up.

Não quero obrigatoriamente um botão específico para marcar follow-up, pois a própria movimentação no Kanban poderá realizar essa ação.

## 8.7. APROVAÇÃO DA PROPOSTA

Quando uma proposta for movimentada para o status **Aprovado**, o sistema deverá exigir informações sobre a aprovação.

Exemplos:

- Pedido de compra.
- Aprovação por e-mail.
- Aprovação pelo WhatsApp.
- Contrato.
- Outra forma de aprovação.

Deverá permitir anexar uma comprovação.

Essa comprovação será importante para autorizar as etapas seguintes.

O registro de aprovação deverá ficar armazenado e vinculado à proposta.

## 8.8. REPROVAÇÃO

Ao classificar uma proposta como Reprovado, quero registrar o motivo da perda quando disponível.

Exemplos:

- Preço.
- Prazo.
- Concorrência.
- Projeto cancelado.
- Cliente desistiu.
- Outro motivo.

Propostas reprovadas deverão manter todo seu histórico e poderão retornar ao fluxo comercial quando necessário.

## 8.9. EXCLUSÃO DE PROPOSTAS

Quero permitir a exclusão de propostas conforme permissões específicas.

Para etapas críticas, deverá ser exigida senha administrativa configurável em:

**Administração → Senhas → Excluir Proposta**

A política exata de exclusão, inclusive a exclusão direta de propostas ainda não enviadas, deverá ser documentada antes da implementação.

Nunca utilizar exclusão irreversível sem as verificações adequadas.

## 8.10. REUNIÃO DE KICK-OFF

Depois que uma proposta for aprovada, haverá a etapa de alinhamento para execução.

Quero prever o registro de informações como:

- Necessidade de levantamento de medidas em campo.
- Desenvolvimento de projeto.
- Fabricação.
- Montagem em campo.
- Necessidade de compra de materiais.
- Compra de suprimentos.
- Locação de equipamentos.
- Aquisição de ferramentas.
- Contratação de terceiros.
- Requisitos de segurança.
- Logística e transporte.
- Documentações necessárias.
- Prazos e responsáveis.

Essas informações deverão futuramente alimentar os setores correspondentes.

Não implemente ainda toda a integração com Engenharia, Compras ou PCP.

Neste primeiro momento, prepare apenas a estrutura necessária para preservar as informações do kick-off e permitir sua utilização futura.

## 8.11. PROPOSTAS TÉCNICAS E COMERCIAIS EM PDF

Futuramente, quero implementar um editor de propostas técnicas e comerciais dentro do ERP.

Ele deverá permitir:

- Preenchimento automático com informações cadastradas.
- Edição de textos técnicos e comerciais.
- Organização das seções.
- Inserção de imagens e desenhos.
- Tabelas de valores.
- Condições de fornecimento.
- Histórico de revisões.
- Visualização A4.
- Geração de PDFs profissionais.
- Armazenamento das versões emitidas.

Já possuímos modelos de propostas e referências visuais aprovados, que serão fornecidos posteriormente.

**Neste primeiro módulo, prepare os vínculos e campos fundamentais. Não desenvolva ainda o editor completo de PDF sem minha autorização.**

---

# 9. ENGENHARIA — CONTEXTO FUTURO

Depois que Vendas estiver concluído e aprovado, iniciaremos Engenharia.

Quero deixar claro desde agora que Engenharia será um módulo complexo.

Ele terá integração com o SolidWorks e utilizará:

- Estrutura de montagens.
- Conjuntos soldados.
- Listas de peças.
- BOM.
- Materiais.
- Operações de fabricação.
- Desenhos técnicos.
- Listas e requisições de materiais.
- Planos de corte.
- Preparação de materiais.

Alguns códigos de operações utilizados são:

LC — Corte a Laser de Chapas.

LP — Corte a Laser de Perfis.

PO — Corte em Policorte.

GU — Corte em Guilhotina.

DO — Dobra.

CL — Calandragem.

US — Usinagem.

CM — Item Comercial.

Os materiais também serão identificados por códigos COD_MAT.

A estrutura de modelamento deverá mostrar os conjuntos de montagem, enquanto peças e itens comerciais ficarão associados internamente aos conjuntos correspondentes.

**Essas informações são apenas para contextualização futura. Não desenvolva Engenharia agora.**

---

# 10. PERMISSÕES E SEGURANÇA

Cada colaborador deverá possuir um login individual.

Não quero que todos os usuários consigam visualizar ou modificar todas as informações.

O ERP deverá permitir configurar permissões por módulo e, quando necessário, por funcionalidade.

Exemplos:

- Vendedor acessa funções comerciais autorizadas.
- Engenharia acessa atividades técnicas.
- Compras gerencia cotações e pedidos.
- PCP acompanha a programação.
- Fabricação acompanha atividades produtivas.
- RH gerencia funcionários e permissões administrativas.
- Administração geral controla o sistema.

Quero que a arquitetura seja preparada para permissões detalhadas, incluindo leitura, criação, edição, aprovação e ações críticas.

O frontend deverá refletir essas permissões, mas a segurança efetiva deverá ser garantida no backend.

---

# 11. FLUXOGRAMA OPERACIONAL

Estamos desenvolvendo um fluxograma detalhado do funcionamento da empresa.

Esse fluxograma será enviado quando estiver concluído.

Ele deverá servir para:

- Validar o fluxo entre setores.
- Identificar dependências.
- Definir responsáveis.
- Determinar pontos de aprovação.
- Identificar entradas e saídas de cada processo.
- Planejar o desenvolvimento dos próximos módulos.

Quando receber o fluxograma, analise-o e apresente possíveis inconsistências ou pontos que precisem ser esclarecidos.

Não faça alterações automáticas nas regras já aprovadas sem me consultar.

---

# 12. CONTROLE DE DESENVOLVIMENTO

Quero que você mantenha uma documentação organizada do projeto.

Ela deverá registrar:

- Estrutura geral do ERP.
- Módulos planejados.
- Módulos concluídos.
- Decisões de arquitetura.
- Regras de negócio aprovadas.
- Estrutura do banco de dados.
- Integrações.
- Pendências.
- Correções.
- Próxima etapa autorizada.

Sugiro manter documentos como:

- README.md
- DOCUMENTACAO_ERP.md
- REGRAS_DE_NEGOCIO.md
- MODELO_DE_DADOS.md
- ROADMAP.md
- CHANGELOG.md

Esses documentos deverão ser atualizados conforme o projeto evoluir, sem substituir decisões anteriores silenciosamente.

O objetivo é permitir que o desenvolvimento continue com consistência, mesmo quando a conversa ficar muito extensa.

---

# 13. COMO QUERO QUE VOCÊ COMECE

**NÃO COMECE ESCREVENDO TODO O CÓDIGO DO ERP.**

Primeiro, faça o seguinte:

1. Apresente um resumo do seu entendimento do ERP Fabriaço.
2. Explique como pretende organizar a arquitetura geral do sistema.
3. Apresente a divisão do desenvolvimento por módulos e dependências.
4. Identifique os requisitos de Vendas que precisam ser definidos antes da implementação.
5. Proponha a estrutura de dados inicial do módulo de Vendas.
6. Apresente as principais telas e funcionalidades do módulo comercial.
7. Explique como Vendas ficará preparado para integrar futuramente com Engenharia.
8. Apresente um plano de implementação do módulo de Vendas em pequenas entregas testáveis.
9. Identifique os riscos técnicos e as principais decisões pendentes.

Depois disso, aguarde minha aprovação.

**Somente após eu aprovar o planejamento, iniciaremos a implementação de Vendas, etapa por etapa.**

O objetivo não é apenas criar telas bonitas, mas desenvolver um ERP industrial robusto, consistente e realmente utilizável no dia a dia da Fabriaço Brasil.