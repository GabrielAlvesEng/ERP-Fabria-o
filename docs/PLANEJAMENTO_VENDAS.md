# Planejamento do módulo Vendas (e da Base do projeto)

Versão 2, 19/10/2026. **Estado: aguardando aprovação do Gabriel.** Nada foi implementado.

Versão 2 incorpora as respostas do Gabriel (decisões 8 a 17 em `REGRAS_DE_NEGOCIO.md`): código por ano e por contato com reinício anual, projeto com o mesmo código da proposta, Financeiro move Finalizado/Emitido NF/Pago, Vendas vê todas as propostas, empresa única, Git. Itens já respondidos estão marcados **[DECIDIDO]**.

Fontes usadas: `CLAUDE.md`, `ROADMAP.md`, `docs/REGRAS_DE_NEGOCIO.md`, `docs/DOCUMENTO_MESTRE.md` (seções 7, 8 e 10), `docs/FLUXOGRAMA.md`. O ZIP de `referencia/` foi aberto só para consulta (migrations e documentos de Vendas e Kick-off). Onde ele diverge, está indicado no item 9.

Itens marcados com **[DECIDIR]** são perguntas para o Gabriel. Itens marcados com **[PROPOSTA]** são minha recomendação, que vale se você aprovar sem mudar.

---

## 1. Resumo do entendimento

A Fabriaço faz engenharia, caldeiraria, fabricação e montagem industrial sob encomenda. Todo trabalho nasce de uma **proposta comercial** e termina no **encerramento financeiro do projeto**. Hoje as informações estão espalhadas em planilhas e pastas. O ERP vai concentrar tudo em uma plataforma, setor por setor.

Vendas é a porta de entrada:

1. Chega um contato comercial. A empresa e a pessoa são cadastradas uma única vez.
2. O comercial elabora a proposta (técnica e comercial), que recebe código `AA-CC-NNN` e nasce como **R0**.
3. A proposta é enviada. A partir daí, o que foi enviado fica congelado. Ajustes pedidos pelo cliente geram **R1, R2...**, sem apagar os PDFs anteriores.
4. Sem retorno, a proposta vai para **Follow-up**. O sistema mostra quem precisa de contato.
5. **Reprovada:** registra-se o motivo da perda. Ela pode voltar ao fluxo depois.
6. **Aprovada:** exige forma de aprovação (PC, e-mail, WhatsApp, contrato, outra) e comprovante anexado. O contato passa de Lead para Cliente.
7. **Kick-off:** reunião com checklist por setor (medição em campo, projeto, compras, locação, terceiros, segurança, logística, prazos e responsáveis). Em Vendas só guardamos essas informações. Elas vão alimentar Engenharia, Compras e os demais setores quando esses módulos existirem.
8. Depois vêm Finalizado, Emitido NF e Pago, que no futuro serão ligados ao Financeiro.

Contatos são acompanhados **por ano**: quem pediu proposta em 2026 e nada em 2027 não aparece como ativo em 2027, mas o histórico continua lá.

Segurança fica no banco (RLS e permissões por módulo e ação). Exclusão é sempre lógica, e excluir proposta exige permissão e, nas etapas críticas, senha administrativa.

---

## 2. Arquitetura geral

### 2.1 Visão

```
Navegador (React + TS + Tailwind)  ──►  Supabase
  Interface (páginas, componentes)        Auth (login individual)
  Regras de negócio no cliente (UX)       PostgreSQL (tabelas, RLS, funções RPC, auditoria)
  Acesso a dados (services)               Storage (PDFs, comprovantes, anexos) com políticas
Netlify publica só o frontend estático.
```

Regra central: **toda regra que protege dados mora no banco**. A interface valida para dar boa experiência, mas mudanças sensíveis (mudar status, aprovar, gerar código, criar revisão, excluir) passam por **funções RPC no PostgreSQL**, que conferem permissão e regras antes de gravar. Assim ninguém burla a regra mexendo na tabela direto.

### 2.2 Bibliotecas [PROPOSTA]

| Necessidade | Escolha | Motivo |
|---|---|---|
| Build | Vite | Rápido, simples de publicar no Netlify |
| Rotas | React Router | Padrão de mercado |
| Dados do servidor | TanStack Query | Cache, recarga e estados de carregamento sem código repetido |
| Formulários e validação | React Hook Form + Zod | Mesmo esquema valida tela e tipos |
| Kanban | dnd-kit | Arrastar pela área livre do card sem travar botões internos (requisito 8.4) |
| Gráficos | Recharts | Dashboard comercial |
| Componentes base | shadcn/ui (Radix + Tailwind) | Acessíveis, personalizáveis com nossas cores, tema claro/escuro |
| Testes | Vitest (regras) e testes SQL no Supabase de desenvolvimento | Regras testadas onde elas vivem |

### 2.3 Organização do código [PROPOSTA]

```
src/
  app/            casca do sistema: layout, sidebar, rotas, tema, sessão
  shared/
    ui/           Botão, Tabela, Modal, Select com busca, DateInput DD/MM/AAAA, FileUpload, Badge...
    lib/          cliente Supabase, datas, moeda, CNPJ, erros
    auth/         login, permissões no cliente (usePermissao)
  modules/
    vendas/
      empresas/   pages/, components/, services/, domain/, types.ts
      contatos/
      propostas/  (inclui kanban/, revisoes/, followup/, aprovacao/)
      kickoff/
      dashboard/
    admin/        usuários, perfis, senhas administrativas (o mínimo que Vendas precisa)
supabase/
  migrations/     uma migration pequena por entrega, nunca editada depois de aplicada
  tests/          testes SQL de RLS e regras
```

Cada pasta de módulo separa **interface** (`pages`, `components`), **regras** (`domain`) e **acesso a dados** (`services`). Os próximos módulos (Engenharia etc.) entram como novas pastas em `modules/` sem mexer em Vendas.

### 2.4 Ambientes [PROPOSTA]

- **Dois projetos Supabase novos e vazios:** `fabriaco-erp-dev` e `fabriaco-erp-prod`. Desenvolvimento e testes só no dev. Produção recebe migrations já testadas.
- **Um site Netlify novo** para o ERP, com publicação de produção e prévias para teste.
- Antes de qualquer operação em banco ou site, confirmo com você o identificador (Project Ref, nome do site). Não toco em outros projetos da sua conta.
- Chave `service_role` nunca entra no frontend nem em arquivo versionado. `.env` fora do controle de versão, com `.env.example` vazio.
- **[DECIDIDO]** Código em repositório Git (decisão 15). **[DECIDIR]** Qual conta do GitHub usar (repositório privado ligado ao Netlify) e onde fica a pasta (ver item 9.1).

### 2.5 Banco: convenções [PROPOSTA]

- Nomes de tabelas e colunas **em português**, `snake_case` (`empresas`, `contatos`, `propostas`). Facilita você ler o banco.
- Chaves `uuid`, datas em ISO (`date`/`timestamptz`), exibidas como DD/MM/AAAA. Fuso `America/Sao_Paulo` para regras de ano.
- Toda tabela tem `criado_em`, `criado_por`, `atualizado_em`, e as de cadastro têm `excluido_em` / `excluido_por` (exclusão lógica).
- **Uma empresa só (sem multiempresa).** **[DECIDIDO]** (decisão 14). Nenhuma tabela terá `organization_id`.

### 2.6 Permissões [PROPOSTA]

- `perfis` (ex.: Administração, Comercial, Engenharia, Financeiro, Consulta).
- `permissoes`: par **módulo + ação**. Ações: `ler`, `criar`, `editar`, `aprovar`, `excluir`, `critica`.
- `perfil_permissoes` (o que cada perfil pode) e `usuario_permissoes` (ajuste individual, concedendo ou negando, pois o Documento Mestre pede permissões individuais).
- Função no banco `tem_permissao('vendas.propostas', 'editar')`, usada nas políticas RLS e nas funções RPC.
- No frontend, o mesmo cálculo esconde ou desabilita botões, só por conveniência.

### 2.7 Auditoria [PROPOSTA]

Tabela `auditoria` alimentada por gatilho genérico: tabela, registro, ação, dados antes e depois, usuário, data e hora. Ligada em todas as tabelas de Vendas. Além disso, cada proposta tem uma linha do tempo legível (`proposta_eventos`) para a tela.

---

## 3. Divisão por módulos e dependências

| # | Módulo | Depende de | Entrega para |
|---|---|---|---|
| 0 | **Base** (projeto, Supabase, login, perfis e permissões, auditoria, layout, tema, componentes) | nada | todos |
| 1 | **Vendas** | Base | Engenharia (proposta aprovada + kick-off), Financeiro (faturamento), Compras (demandas do kick-off) |
| 2 | Engenharia | Vendas | Compras, Preparação |
| 3 | Compras e Financeiro | Engenharia, Vendas | Almoxarifado |
| 4 | Almoxarifado | Compras | Preparação |
| 5 | Preparação | Engenharia, Almoxarifado | Fabricação |
| 6 | Fabricação e Qualidade | Preparação | Expedição |
| 7 | Expedição, campo e Financeiro (NF e recebimento) | Fabricação, Vendas | encerramento |
| 8 | RH, Agenda, Tarefas e Frota | Base | campo, expedição |
| 9 | Administração completa | Base | todos |

**Proposta:** a Base (0) é feita como primeira entrega do ciclo de Vendas, porque Vendas não funciona sem login e permissões. Da Administração (9) entra agora só o necessário: usuários, perfis, permissões e senhas administrativas.

---

## 4. Requisitos de Vendas que precisam ser definidos antes de implementar

Agrupados por tema. Cada um tem a minha recomendação; basta responder "ok" ou corrigir.

### 4.1 Código da proposta `AA-CC-NNN`

1. **CC (código do cliente no ano):** **[DECIDIDO]** (decisões 8 e 9) o CC vale **para o ano**. Fica guardado no vínculo contato + ano (`contato_anos`), é único dentro do ano e tem no mínimo 2 dígitos (01, 02... 99, 100). Em 2027 os códigos recomeçam do 01, e o mesmo contato pode receber outro número. Os códigos de anos anteriores nunca mudam.
   **[DECIDIR]** Como o CC é atribuído no ano? Recomendo: **automático**, pela ordem em que o contato entra no ano (primeira proposta ou inclusão manual), com possibilidade de a Administração digitar o código na importação de 2026.
   **[DECIDIR]** Os códigos de 2026 que já existem estão em planilha? Preciso desse arquivo (contato, empresa, CC e propostas já emitidas com código) para importar e continuar a numeração de 2026.
2. **NNN:** **[DECIDIDO]** sequência **por contato e por ano** (`26-01-001`, `26-01-002` para o contato 01; o contato 02 começa em `26-02-001`). Também reinicia a cada ano.
3. **AA:** ano de criação da proposta, fixo para sempre.
3a. **Projeto:** **[DECIDIDO]** (decisão 11) o projeto de fabricação usará o **mesmo código da proposta**. Ex.: proposta `26-01-001` gera o projeto `26-01-001`.
4. O código **não muda** se depois corrigirmos o contato da proposta. Guardamos o contato que originou a numeração.
5. Revisão aparece junto: `26-07-001 R1`. **[DECIDIR]** Formato de exibição: `R1` ou `REV.01`?

### 4.2 Empresas

6. CNPJ opcional (há clientes pessoa física ou estrangeiros?), mas **único** quando informado, guardado só com números e validado pelo dígito verificador. **[DECIDIR]** Pode haver empresa sem CNPJ?
7. Mesmo CNPJ com várias unidades (ex.: duas plantas do mesmo grupo têm CNPJs diferentes, mas e unidades sem CNPJ próprio?). **[PROPOSTA]** Cada CNPJ é uma empresa. Unidade/planta fica como campo livre no contato e na proposta.
8. Antiduplicação sem CNPJ: aviso de nome parecido ao cadastrar (busca por similaridade). Não bloqueia, só alerta.
9. Busca automática de endereço por CEP (ViaCEP) e de dados por CNPJ (BrasilAPI). **[DECIDIR]** Pode usar serviços públicos externos? Recomendo CEP sim; CNPJ opcional.
10. Segmento industrial: lista configurável (Sucroenergético, Alimentos, Mineração, Papel e celulose...). **[DECIDIR]** Me passe a lista inicial.

### 4.3 Contatos e organização anual

11. **[PROPOSTA]** O contato é cadastrado uma vez (`contatos`). A participação em cada ano é uma linha em `contato_anos` (contato + ano). A tela de Contatos mostra o ano escolhido. Um contato entra num ano automaticamente quando ganha proposta naquele ano, ou manualmente pelo botão "Incluir contato existente neste ano". Nada é duplicado.
12. **Lead e Cliente:**
    - **[PROPOSTA]** Classificação no contato. Vira Cliente automaticamente quando uma proposta dele é aprovada, e **continua Cliente** nos anos seguintes (guardamos a data "cliente desde").
    - **[DECIDIR]** A empresa também deve aparecer como cliente quando qualquer contato dela tiver proposta aprovada? E os outros contatos da mesma empresa continuam Lead?
    - **[DECIDIR]** Um Cliente pode voltar a Lead (manualmente, com permissão) ou nunca?
13. Contato que muda de empresa: **[PROPOSTA]** cria-se um novo contato na nova empresa (histórico de cada empresa fica correto), com vínculo "mesma pessoa" opcional. **[DECIDIR]** Ok?
14. "Situação comercial" (Documento Mestre 8.2): além de Lead/Cliente, vocês usam outra situação (ativo, inativo, prospect...)? **[DECIDIR]**

### 4.4 Propostas e Kanban

15. Colunas: À enviar, Enviados, Follow-up, Aprovado, Reprovado, Finalizado, Emitido NF, Pago.
16. **Transições permitidas [PROPOSTA]** (qualquer outra é bloqueada pelo banco):

| De | Para | Regra |
|---|---|---|
| À enviar | Enviados | Exige data de envio e ao menos um PDF da proposta comercial anexado à revisão. **[DECIDIR]** exigir o PDF? |
| Enviados | Follow-up | Registra o follow-up automaticamente (sem botão extra) |
| Follow-up | Enviados | Registra retorno do cliente sem decisão |
| Enviados / Follow-up | Aprovado | Abre formulário de aprovação com comprovante obrigatório |
| Enviados / Follow-up | Reprovado | Abre formulário de motivo da perda |
| Enviados / Follow-up / Reprovado | À enviar | Cria nova revisão (R+1). Reprovação anterior fica no histórico |
| Aprovado | Finalizado | **[DECIDIDO]** só o **Financeiro** move (decisão 12). **[DECIDIR]** O que marca "Finalizado" (execução concluída? entrega aceita?) |
| Finalizado | Emitido NF | **[DECIDIDO]** só o **Financeiro** move. **[PROPOSTA]** pede nº da NF, data de emissão e valor |
| Emitido NF | Pago | **[DECIDIDO]** só o **Financeiro** move. **[PROPOSTA]** pede data do recebimento |
| Aprovado ou depois | volta | Só Administração, com justificativa. Não altera nada de outros setores |

17. Faturamento por marcos (regra já aprovada nº 2): uma proposta grande pode ter várias NFs. Como o módulo Financeiro ainda não existe, em Vendas criamos o **perfil Financeiro** com permissão só para mover essas três colunas no Kanban. **[PROPOSTA]** Emitido NF e Pago são marcações da proposta inteira. O controle por NF e por marco nasce no módulo Financeiro. **[DECIDIR]** Ok deixar assim por enquanto?
18. Mover o card abre um formulário curto para confirmar os dados da transição (data, observação). **[DECIDIR]** Quer confirmação em toda movimentação ou só nas que pedem dados (Enviados, Aprovado, Reprovado, voltar)?
19. Filtros do Kanban: ano, responsável comercial, empresa, contato, faixa de valor, follow-up vencido, texto livre.
20. Campos da proposta: código, empresa, contato, título do fornecimento, descrição, data de emissão, responsável comercial, valor, status, revisão, condições comerciais, prazo previsto, validade, data de follow-up, observações. **[DECIDIR]** "Prazo previsto" é prazo de entrega em dias/semanas (texto) ou uma data? Valor com ou sem impostos? Há outros campos usados hoje (unidade/planta, tipo de fornecimento: fabricação, montagem, projeto, manutenção)?
21. Proposta técnica e comercial: **[DECIDIR]** são dois PDFs separados por revisão, ou um só? Recomendo dois tipos de anexo (Técnica e Comercial) mais anexos livres e documentos técnicos.

### 4.5 Revisões

22. **[PROPOSTA]**
    - R0 nasce com a proposta.
    - Em **À enviar**, edição livre e troca de PDF livre, sem gerar revisão.
    - Ao ir para **Enviados**, a revisão é **congelada**: dados copiados (foto da revisão) e arquivos ficam somente leitura.
    - Voltar de Enviados, Follow-up ou Reprovado para À enviar cria **uma** nova revisão (R1), que começa como cópia da anterior. Várias edições no mesmo ciclo continuam R1.
    - Arquivos de revisões anteriores nunca são sobrescritos nem apagados.
    - **[DECIDIR]** O cliente pedir ajuste sem a proposta voltar ao Comercial (ex.: só desconto por e-mail) também gera revisão? Recomendo sim: qualquer mudança após envio é revisão.

### 4.6 Follow-up

23. **[PROPOSTA]**
    - Cada proposta enviada tem "próximo follow-up" (data). Preenchido com um **prazo padrão configurável** (ex.: 5 dias após o envio) e editável.
    - Registrar contato: data, canal (Ligação, WhatsApp, E-mail, Presencial, Outro), resumo e nova data.
    - O sistema indica follow-ups **vencidos** e **de hoje** no Dashboard, no Kanban (selo no card) e numa lista "Meus retornos".
    - O cálculo é feito na consulta, sem rotina agendada no servidor. Notificação por e-mail fica para depois.
    - **[DECIDIR]** Proposta em Enviados com follow-up vencido deve **mudar sozinha** para a coluna Follow-up, ou só ganhar o alerta? Recomendo só o alerta (mais previsível).
    - **[DECIDIR]** Prazo padrão: quantos dias?

### 4.7 Aprovação e reprovação

24. Aprovação: forma (PC, E-mail, WhatsApp, Contrato, Outra), número do documento (ex.: nº do PC), data da aprovação, valor aprovado, revisão aprovada, observações e **comprovante obrigatório** (PDF/imagem, armazenado em área privada). **[DECIDIR]** O comprovante é sempre obrigatório ou há casos sem (aprovação verbal)? O valor aprovado pode ser diferente do valor da proposta?
25. **[DECIDIR]** Quem pode aprovar: qualquer vendedor ou só perfil com permissão `aprovar`?
26. Reprovação: motivo (Preço, Prazo, Concorrência, Projeto cancelado, Cliente desistiu, Outro) obrigatório; concorrente vencedor e preço do concorrente opcionais; observação.

### 4.8 Exclusão

27. **[PROPOSTA]**
    - Sempre exclusão **lógica** (some das telas, fica no banco e na auditoria; Administração pode restaurar).
    - Proposta em **À enviar que nunca foi enviada:** quem tem permissão `excluir` pode excluir, com confirmação e justificativa, **sem senha**.
    - Proposta que **já foi enviada** (qualquer revisão): exige permissão `excluir` + **senha administrativa** "Excluir Proposta" + justificativa.
    - Proposta **aprovada ou posterior:** não pode ser excluída (pode ser cancelada/reaberta por Administração).
    - Senha guardada com hash no servidor, com limite de tentativas. Configurada em **Administração → Senhas → Excluir Proposta**.
    - O número usado **não é reaproveitado** (evita dois documentos com o mesmo código).
    - **[DECIDIR]** Ok?

### 4.9 Kick-off

28. **[PROPOSTA]** Só disponível para proposta aprovada. Uma reunião por proposta (com possibilidade de nova versão se algo mudar), contendo: data, participantes, observações gerais e um **checklist por setor** (Engenharia, Compras, Fabricação, Montagem em campo, Logística, RH e Segurança, Financeiro). Cada item: necessário (Sim/Não/A definir), responsável, prazo, observação. O modelo do checklist é configurável. Ao **finalizar**, o kick-off fica somente leitura e a proposta passa a "pronta para Engenharia".
    **[DECIDIR]** Me envie o checklist que vocês usam hoje (ou aprovo usar o do sistema anterior como ponto de partida). Precisa gerar PDF da ata agora ou depois?
29. Condições de medição/faturamento (marcos) combinadas no kick-off: **[PROPOSTA]** campo de texto estruturado agora (marcos: descrição, % ou valor, evento). O Financeiro usará depois.

### 4.10 Usuários e perfis

30. **[DECIDIDO]** Todo usuário do setor de Vendas vê **todas** as propostas (decisão 13). Perfis iniciais **[PROPOSTA]**: Administração (você), Comercial (cria, edita, envia, follow-up, aprova/reprova), Financeiro (vê propostas e move Finalizado, Emitido NF e Pago), Consulta (só lê). **[DECIDIR]** Quantos usuários no início, e quem aprova proposta (todo Comercial ou só alguns)?
31. **[DECIDIR]** Cadastro de usuários: você cria e o sistema envia convite por e-mail, ou você define senha inicial?

### 4.11 Dados antigos

32. **[DECIDIDO]** Há códigos de 2026 em uso: haverá **importação de 2026** (decisão 10), como entrega própria (V3a). **[DECIDIR]** Formato da fonte (planilha Excel?) e se importamos também os PDFs das propostas ou só os dados.

---

## 5. Estrutura inicial de dados

Notação: PK = chave primária, FK = chave estrangeira. Todas as tabelas têm RLS ligado. Detalhamento final vai para `docs/MODELO_DE_DADOS.md` quando o banco for criado.

### 5.1 Base

| Tabela | Campos principais | Observação |
|---|---|---|
| `usuarios` | id (= auth.users), nome, email, telefone, ativo | Perfil do usuário logado |
| `perfis` | id, nome, descricao | Administração, Comercial... |
| `permissoes` | id, modulo, acao | ex.: `vendas.propostas` + `aprovar` |
| `perfil_permissoes` | perfil_id, permissao_id | |
| `usuario_perfis` | usuario_id, perfil_id | Um usuário pode ter mais de um perfil |
| `usuario_permissoes` | usuario_id, permissao_id, concedida (sim/não) | Ajuste individual |
| `senhas_administrativas` | acao (ex.: `excluir_proposta`), hash, atualizado_por, atualizado_em | Hash com pgcrypto, nunca lido pelo frontend |
| `senha_tentativas` | usuario_id, acao, sucesso, criado_em | Limite de tentativas |
| `configuracoes` | chave, valor (json) | ex.: prazo padrão de follow-up |
| `auditoria` | tabela, registro_id, acao, antes, depois, usuario_id, criado_em | Gatilho genérico |

### 5.2 Vendas

| Tabela | Campos principais | Regras |
|---|---|---|
| `segmentos` | id, nome, ativo | Lista configurável |
| `empresas` | id, razao_social, nome_fantasia, cnpj, inscricao_estadual, cep, logradouro, numero, complemento, bairro, cidade, uf, telefones, emails, site, segmento_id, observacoes, ativo, excluido_em | CNPJ único quando preenchido (só dígitos, validado) |
| `contatos` | id, empresa_id, nome, cargo, departamento, email, telefone, whatsapp, unidade, classificacao (lead/cliente), cliente_desde, observacoes, ativo, excluido_em | A pessoa, cadastrada uma vez |
| `contato_anos` | contato_id, ano, codigo_comercial (CC), origem (manual/proposta/importacao), criado_em | Único por contato + ano; CC único por ano e imutável depois de usado |
| `propostas` | id, codigo, ano_numeracao, contato_numeracao_id, sequencial, empresa_id, contato_id, titulo, descricao, responsavel_id, valor, status, revisao_atual, data_emissao, prazo_previsto, validade, condicoes_comerciais, proximo_followup, observacoes, excluido_em | Código gerado pelo banco; status só muda por RPC |
| `proposta_revisoes` | id, proposta_id, numero (0,1,2...), status (rascunho/enviada), dados (foto em JSON), valor, enviada_em, enviada_por, motivo_revisao | Revisão enviada é imutável |
| `proposta_arquivos` | id, revisao_id, tipo (tecnica, comercial, anexo, documento_tecnico), caminho_storage, nome, tamanho, enviado_por | Bloqueado quando a revisão está enviada |
| `proposta_eventos` | id, proposta_id, tipo, status_de, status_para, dados, usuario_id, criado_em | Linha do tempo exibida na tela |
| `proposta_followups` | id, proposta_id, data_contato, canal, resumo, proxima_data, usuario_id | |
| `proposta_aprovacoes` | id, proposta_id, revisao_id, forma, numero_documento, data_aprovacao, valor_aprovado, comprovante_caminho, observacoes, registrado_por | Obrigatória para entrar em Aprovado |
| `proposta_reprovacoes` | id, proposta_id, revisao_id, motivo, concorrente, valor_concorrente, observacoes, registrado_por | Histórico preservado ao reabrir |
| `contadores_contato` | ano, ultimo_valor | Gera o CC do ano sem colisão (reinicia por ano) |
| `contadores_proposta` | ano, contato_id, ultimo_valor | Gera o NNN sem colisão (por contato e ano) |

### 5.3 Kick-off

| Tabela | Campos principais |
|---|---|
| `kickoff_modelo_itens` | id, setor, descricao, ordem, ativo |
| `kickoffs` | id, proposta_id, versao, data_reuniao, participantes, observacoes, marcos_faturamento (json), status (rascunho/finalizado), finalizado_por, finalizado_em |
| `kickoff_itens` | id, kickoff_id, setor, descricao, necessario (sim/não/a definir), responsavel_id, prazo, observacao |

### 5.4 Storage

Bucket privado `vendas` com pastas `propostas/{proposta_id}/R{n}/...` e `aprovacoes/{proposta_id}/...`. Políticas leem as mesmas permissões das tabelas. Arquivos de revisão enviada não podem ser substituídos nem removidos.

### 5.5 Funções RPC principais

`criar_proposta`, `atualizar_proposta_rascunho`, `mudar_status_proposta` (aplica a tabela de transições do item 4.4), `enviar_proposta`, `reabrir_proposta` (cria revisão), `registrar_followup`, `aprovar_proposta`, `reprovar_proposta`, `excluir_proposta` (confere senha), `incluir_contato_no_ano`, `finalizar_kickoff`.

---

## 6. Telas e funcionalidades

1. **Login** (e-mail e senha, recuperar senha).
2. **Casca do sistema:** sidebar com módulos (só Vendas e Administração ativos; os demais aparecem como "em breve" ou ocultos, a decidir), barra superior com seletor de **ano comercial**, busca, usuário e alternância claro/escuro.
3. **Dashboard Comercial** (do ano escolhido): propostas emitidas, valor enviado, valor aprovado, taxa de conversão, follow-ups vencidos e de hoje, funil por etapa, motivos de perda, top clientes, desempenho por responsável.
4. **Empresas:** lista com busca e filtros (segmento, cidade/UF, cliente/lead); ficha com abas Dados, Contatos, Propostas e Histórico; aviso de duplicidade ao cadastrar.
5. **Contatos:** lista do ano escolhido (opção "todos os anos"), botão "Incluir contato existente neste ano", filtro Lead/Cliente; ficha com dados, anos de atividade e propostas.
6. **Propostas — Kanban:** colunas do item 4.4, arrastar pela área livre do card, selos (follow-up vencido, revisão, valor), filtros e totais por coluna. Movimento proibido é recusado com mensagem.
7. **Propostas — Lista:** mesma informação em tabela, com ordenação e exportação para Excel (**[DECIDIR]** precisa exportar?).
8. **Detalhe da proposta** (painel lateral ou página) com abas: Dados, Revisões e arquivos, Follow-ups, Aprovação ou Reprovação, Kick-off, Histórico.
9. **Formulários de transição:** Enviar, Registrar follow-up, Aprovar (com comprovante), Reprovar, Reabrir (cria revisão), Excluir (com senha quando exigida).
10. **Kick-off:** formulário com checklist por setor, responsáveis e prazos; finalizar.
11. **Administração (mínimo):** Usuários, Perfis e permissões, Senhas administrativas, Listas (segmentos, motivos, modelo do kick-off), Configurações (prazo padrão de follow-up).

Visual: azul-marinho, roxo, branco, cinzas e verde-petróleo para indicadores, cards arredondados, tema claro e escuro. Nesta fase o foco é funcionar bem; o capricho no Kanban e no Dashboard vem no fim do módulo e na reformulação estética.

---

## 7. Preparação para integrar com Engenharia

- O "pacote de passagem" para Engenharia é: **proposta aprovada + revisão aprovada congelada + comprovante + kick-off finalizado** (com itens marcados para Engenharia e demais setores).
- Em Vendas **não** criamos ainda a tabela de projetos. Quando Engenharia começar, ela terá `projetos.proposta_id` apontando para a proposta, e lerá os itens do kick-off por setor.
- O kick-off já guarda o **setor** de cada item. Compras, Financeiro e RH vão filtrar os seus itens quando existirem. Nada é enviado automaticamente agora.
- Os códigos de empresa, contato e proposta são estáveis (uuid + código permanente), então os módulos futuros podem referenciá-los com segurança.
- **[DECIDIDO]** O projeto usa o **mesmo código da proposta** (decisão 11), então `projetos.codigo` = `propostas.codigo`, e um projeto nasce de uma proposta. As montagens seguem o mesmo prefixo (decisão 16): `26-01-001-00-00-000`, `26-01-001-0A-00-000`, `26-01-001-0A-01-000`.

---

## 8. Plano de entregas pequenas e testáveis

Cada entrega tem: migration nova, telas, testes, verificação no navegador, atualização de documentação e **sua validação antes da próxima**.

| Entrega | Conteúdo | Como você testa |
|---|---|---|
| **V0 — Base** | Projeto Vite/React/TS/Tailwind, tema claro/escuro, layout com sidebar, conexão com Supabase dev, login, usuários/perfis/permissões, auditoria, componentes base (tabela, select com busca, data DD/MM/AAAA, upload, modal, avisos), publicação de prévia no Netlify | Entrar com dois usuários de perfis diferentes e ver menus/ações distintos; tentar ação proibida e ver o banco recusar |
| **V1 — Empresas** | Cadastro, edição, busca, CNPJ validado e único, aviso de nome parecido, CEP, exclusão lógica | Cadastrar, duplicar CNPJ (bloqueia), excluir e restaurar |
| **V2 — Contatos e anos** | Cadastro vinculado à empresa, CC automático, anos de atividade, incluir contato existente no ano, Lead/Cliente | Criar contato em 2026, trocar para 2027 (não aparece), incluir em 2027 (mesmo CC) |
| **V3 — Propostas (cadastro)** | Criação com código AA-CC-NNN, R0, edição livre em À enviar, anexos técnicos e comerciais, lista e detalhe | Criar várias propostas e conferir a sequência; trocar PDF no rascunho sem gerar revisão |
| **V4 — Kanban e revisões** | Kanban com arrastar e soltar, transições protegidas, envio congela revisão, reabrir cria R1, linha do tempo | Enviar, tentar editar (bloqueado), reabrir (R1, R0 preservada), tentar pular etapa (recusado) |
| **V5 — Follow-up** | Data padrão e manual, registro de contatos, selos de vencido, lista "Meus retornos" | Proposta com follow-up vencido aparece com alerta; registrar contato atualiza a data |
| **V6 — Aprovação e reprovação** | Formulários, comprovante obrigatório, Lead vira Cliente, motivos de perda, reabrir reprovada | Aprovar sem comprovante (bloqueia), aprovar com comprovante (contato vira Cliente), reprovar e reabrir |
| **V7 — Exclusão e senhas** | Administração → Senhas, regras de exclusão do item 4.8, limite de tentativas | Excluir rascunho sem senha; excluir enviada exige senha; aprovada não exclui |
| **V8 — Kick-off** | Modelo de checklist, formulário por setor, finalizar e travar | Fazer um kick-off completo de uma proposta aprovada |
| **V9 — Dashboard Comercial** | Indicadores e gráficos do ano | Conferir números contra as propostas cadastradas |
| **V10 — Validação e produção** | Ajustes finais e visuais, revisão de segurança (RLS), documentação, migrations aplicadas na produção após sua confirmação, publicação | Uso real pela equipe comercial por alguns dias |

**V3a — Importação de 2026** (decisão 10): empresas, contatos com seus CC de 2026 e propostas já emitidas, com contadores ajustados para continuar a numeração. Entra entre V3 e V4. Teste: conferir os códigos importados e criar uma proposta nova que continue a sequência.

---

## 9. Riscos e decisões pendentes

### 9.1 Riscos técnicos

| Risco | Como tratamos |
|---|---|
| Regras só na interface, burladas por chamada direta à API | Mudanças sensíveis só por RPC; RLS em todas as tabelas; testes SQL tentando burlar |
| Dois usuários gerando código ao mesmo tempo | Contadores travados dentro da mesma transação no banco |
| Arquivos de revisão enviada sobrescritos | Caminho por revisão, política de Storage sem atualização/remoção, bloqueio na tabela |
| Operar no Supabase ou Netlify errado (outros projetos na conta) | Confirmação do identificador antes de cada operação; projetos novos com nomes explícitos |
| Pasta no OneDrive com `node_modules` (milhares de arquivos sincronizando, conflitos) | **[DECIDIR]** Recomendo manter o código em uma pasta fora do OneDrive (ex.: `C:\dev\erp-fabriaco`) com Git/GitHub como cópia de segurança, deixando no OneDrive só a documentação. Ou excluir `node_modules` da sincronização |
| Status Emitido NF/Pago simplificado demais para faturamento por marcos | Tratar como marcação manual agora; Financeiro assume o detalhe depois (item 4.4-17) |
| Kanban com muitos cards ficar lento | Filtro por ano por padrão; carregar só os campos do card |
| Escopo crescer (editor de PDF, e-mails automáticos) | Fora de Vendas v1, só com sua autorização |

### 9.2 Divergências com o material de `referencia/`

1. O guia do ZIP (`LEIA_PRIMEIRO_CLAUDE.md`) diz para **continuar o ERP antigo, no mesmo Supabase e no mesmo Netlify, sem criar outro banco**. Isso diverge da decisão nº 7 de `REGRAS_DE_NEGOCIO.md` (refazer do zero) e da pendência sobre Supabase novo. **Prevalece a decisão atual.** Não sigo instruções do ZIP.
2. O sistema anterior era **multiempresa** (`organization_id` em tudo). Proponho empresa única (item 2.5).
3. Lá, NNN era sequência por contato e por ano (igual à decisão 8), mas o CC era um número **permanente** do contato. Pela decisão 9, aqui o CC **reinicia a cada ano**.
4. Lá, o follow-up vencido dependia de uma rotina agendada (pg_cron) a cada 10 minutos. Proponho calcular na consulta, mais simples e sem dependência de agendador.
5. Lá, novos projetos reaproveitavam o código da proposta; o Documento Mestre define `AA-NNN-SIGLA`. Já está como pendência para Engenharia.

### 9.3 Decisões pendentes (resumo)

Já registradas em `REGRAS_DE_NEGOCIO.md` e respondidas por proposta neste documento:

- Supabase novo e vazio: **proposta** dois projetos novos (dev e prod). Preciso que você os crie (ou autorize criar) e me informe os Project Refs.
- Perfis e matriz de permissões: **parcial**, decisões 12 e 13; restante na pergunta 30.
- Política de exclusão: **proposta** no item 4.8.
- Unicidade do CC: **decidido** (por ano, reinicia anualmente); falta a forma de atribuição (item 4.1).
- Status que dispara faturamento: **decidido** que o Financeiro move; dados de cada etapa no item 4.4-16.
- Critérios de retorno de etapa: **proposta** na tabela do item 4.4-16 e no item 4.5.
- Código do projeto de fabricação: **decidido** (mesmo código da proposta). Códigos de montagem ficam para Engenharia.

Perguntas ainda abertas: item 2.4 (conta do GitHub), itens 4.1 a 4.11 marcados com [DECIDIR] e 9.1 (pasta fora do OneDrive).

---

## Próximo passo

Você responde as perguntas **[DECIDIR]** (pode ser "ok" para as recomendações) e aprova ou corrige o planejamento. Com a aprovação, registro as decisões em `REGRAS_DE_NEGOCIO.md` e começo pela **entrega V0 (Base)**, sem avançar além dela sem sua validação.
