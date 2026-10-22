# Recursos Humanos (RH)

Versão 2, 22/10/2026. **Estado: aprovado com as respostas do Gabriel (decisão 69). Entrega 1 feita; entregas 2 a 4 em andamento.**

Respostas do Gabriel (22/10):
1. "Senhas" é só o **gerenciamento dos logins** dos funcionários no ERP;
2. salário e dados bancários ficam **só no Financeiro**;
3. **ART fica fora do RH** (é de obra/serviço e entra depois, na Engenharia);
4. **cada cliente define** a validade da sua integração;
5. aviso **30 dias antes**, **só para o RH**;
6. **o funcionário pode ver** a própria ficha;
7. **holerites depois**, com o Financeiro;
8. **documento vencido impede** a pessoa de ser agendada para ir àquele cliente naquele dia;
9. carga inicial: Gabriel Alves (Engenheiro/CEO), Guilherme Santos Silva (Projetista Mecânico), Pedro Vinicius da Silva Pereira e Caio Henrique Alves da Silva (Desenhistas Mecânicos) e Fabiano Alves da Silva (Administrador Geral/Dono), todos no setor Engenharia.

As seções abaixo já estão ajustadas a essas respostas.

Pedido do Gabriel (22/10), com a decisão de fazer o RH **antes de seguir com a Engenharia**:
- o RH serve para ter o controle de cada funcionário e das suas informações;
- cada funcionário pode precisar fazer **integração nas empresas clientes**;
- cada funcionário pode ter uma **norma específica da sua função** (ex.: o Luis Fernando é motorista de munck e tem formalidades diferentes dos outros);
- controle de **e-mail de acesso, senhas, documentação** e aviso do que está **vencendo**.

Também vale o que o Documento Mestre (seção 5.8) pede para o RH: colaboradores, usuários do ERP, setores e funções, permissões individuais, documentações, integrações de segurança por cliente, validade de documentos e treinamentos, holerites e informações funcionais. E a decisão 62: o vendedor passa a apontar para o cadastro de funcionário quando o RH existir.

## Hoje
- Os logins do ERP são criados direto no Supabase (Auth). O ERP tem a tabela `usuarios`, perfis e permissões por módulo e ação, mas **não tem tela para criar, desativar ou redefinir login, nem para dar perfil a um usuário** (hoje isso é feito no banco, como foi com o Pedro Vinicius e o Guilherme Santos na decisão 68).
- **Meu perfil (decisão 68):** cada usuário já edita o próprio nome, telefone, data de nascimento e foto (colunas em `usuarios`, foto no espaço privado `perfis`). A decisão 68 deixou endereço e documentos para o RH.
- Já existem a permissão `rh` (ler, editar) e o perfil **RH** (migration `20261021000032_vendedores.sql`). Hoje só os vendedores usam essa permissão.
- Frota tem o tipo de veículo **caminhão munck**, mas nenhum vínculo com quem pode dirigir cada veículo.
- O cadastro de **empresas** (clientes) de Vendas já existe e será reaproveitado nas integrações.

## 1. Setores e funções
- **Setores:** Comercial, Engenharia, Preparação, Fabricação, Qualidade, Campo/Montagem, Administrativo… (editáveis em RH → Configurações).
- **Funções** (cargos), cada uma dentro de um setor: ex. Vendedor, Projetista, Soldador, Caldeireiro, Montador, Motorista de munck.
- Cada função tem a sua lista de **requisitos**, que são os documentos e treinamentos obrigatórios. Ex.: *Motorista de munck* exige CNH categoria C ou superior, curso de operador de munck (NR-11), NR-35 e ASO em dia. *Soldador* exige ASO, NR-12 e a qualificação de soldador.
- É assim que "cada função tem as suas formalidades": o ERP sabe o que cobrar de cada pessoa pela função que ela ocupa, e o RH pode **acrescentar requisitos individuais** a um funcionário (ex.: um montador que também opera plataforma).

## 2. Cadastro do funcionário (ficha)
Abas da ficha:
- **Dados pessoais:** nome completo, nome de exibição, foto, CPF (único), RG, data de nascimento, telefone/WhatsApp, e-mail pessoal, endereço e contato de emergência.
- **Dados funcionais:** matrícula, setor, função, data de admissão, tipo de vínculo (CLT, PJ, temporário, estágio), situação (ativo, afastado, férias, desligado) e data de desligamento. E-mail corporativo (Outlook), que pode ser diferente do e-mail de login.
- **Documentos e treinamentos** (seção 3).
- **Integrações em clientes** (seção 4).
- **Acesso ao ERP** (seção 5).
- **Observações** e histórico (quem mudou o quê, pela auditoria que o ERP já tem).

**Relação com Meu perfil:** telefone e nascimento ficam iguais nos dois lugares: o que o funcionário muda em Meu perfil aparece na ficha, e o que o RH muda na ficha aparece em Meu perfil. A foto continua sendo a de Meu perfil. Os outros dados pessoais (CPF, RG, endereço, contato de emergência) só o RH edita.

**O funcionário vê a própria ficha** (resposta 6): em Meu perfil, uma parte "Minha ficha" mostra, só para leitura, os dados funcionais, os documentos com a situação de cada um e as integrações.

Salário e dados bancários **não** entram no RH (resposta 2).

Nada é apagado: funcionário que sai fica **desligado**, com a data, e some das listas do dia a dia.

**Dados sensíveis (LGPD):** CPF, RG, endereço, nascimento e os arquivos dos documentos ficam visíveis **só para quem tem a permissão do RH**. Os outros setores, quando precisarem (ex.: escolher o motorista de uma viagem), veem só nome, foto, setor, função e se está "liberado" ou não. O ASO é dado de saúde: fora do RH aparece só "apto" e a validade, nunca o arquivo.

## 3. Documentos, treinamentos, normas e vencimentos
- **Tipos de documento** (catálogo em RH → Configurações): nome, categoria (documento pessoal, CNH, ASO, treinamento NR, certificação/qualificação, registro profissional), se **tem validade**, a validade padrão (ex.: NR-35 = 24 meses, ASO = 12 meses) e com quantos dias de antecedência avisar (padrão 30).
- **Documento do funcionário:** tipo, número, data de emissão, data de validade (sugerida pela validade padrão e editável), arquivo (PDF ou foto, no Storage, em espaço privado do RH) e observações. Ex.: na CNH, guarda a categoria.
- **Renovação:** renovar cria um novo registro e o anterior fica no histórico (não é sobrescrito).
- **Situação de cada requisito**, calculada pelo ERP: 🟢 em dia, 🟡 vence em até N dias, 🔴 vencido, ⚪ faltando (a função exige e não há documento).
- **ART:** fica fora do RH (resposta 3). As ARTs de obra/serviço entram depois, na Engenharia.

## 4. Integrações nas empresas clientes
- Em cada **empresa cliente** (o mesmo cadastro de Vendas), o RH registra as **exigências de integração**: validade da integração naquele cliente, que **cada cliente define** (ex.: 6 ou 12 meses) e os documentos que o cliente exige para entrar (ex.: ASO, NR-10, NR-35).
- **Integração do funcionário:** cliente, data em que fez, validade (calculada pela regra do cliente e editável), comprovante (arquivo) e observações.
- **"Quem está liberado no cliente X":** a tela mostra, para um cliente, todos os funcionários com integração em dia **e** com os documentos que aquele cliente exige em dia. - **Bloqueio na Agenda (resposta 8):** o banco ganha a função `funcionario_liberado(funcionário, cliente, data)`, que diz se a pessoa pode ir àquele cliente naquele dia e, se não puder, o motivo (integração vencida, documento exigido vencido ou faltando, funcionário desligado). A conta é feita **na data do serviço**, não na data de hoje. Quando a Agenda existir, ela usa essa função para **impedir** o agendamento.

## 5. Acesso ao ERP (e-mail de acesso e senhas)
- Na aba **Acesso ao ERP** da ficha, o RH:
  - **cria o login** com o e-mail de acesso. O funcionário recebe um e-mail para criar a própria senha;
  - escolhe os **perfis** (Comercial, RH, Financeiro…) e os ajustes individuais de permissão que já existem no ERP. É a tela que falta hoje para dar perfil a um usuário;
  - **envia link de redefinição** de senha quando alguém esquece;
  - **desativa o login**, o que acontece sozinho também quando o funcionário é desligado.
- **O ERP nunca guarda nem mostra a senha de ninguém.** A senha é do funcionário e fica só no Supabase Auth, criptografada. Nem o RH nem a Administração conseguem vê-la; eles só mandam o link para criar ou trocar.
- Criar e desativar login exige a chave `service_role`, que não pode ir para o navegador. Por isso essas ações passam por uma **função do Supabase (Edge Function)** que confere se quem pede tem a permissão de RH.

## 6. Painel de vencimentos e avisos
- **Painel do RH:** contadores de vencidos, a vencer em 30 dias e faltando; lista com filtros por setor, função, cliente e tipo de documento; e um quadro funcionário × requisito com as cores da seção 3.
- **Aviso no sino** do ERP **só para o RH** (resposta 5), quando um documento ou integração entra nos **30 dias** antes de vencer, ou vence. Os 30 dias são o padrão de cada tipo de documento.

## 7. Integrações com os outros módulos
- **Vendedores (decisão 62):** cada vendedor passa a ter ficha de funcionário. Os vendedores atuais ganham a ficha automaticamente pela migration, e a aba Vendedores de Vendas continua igual: os dados pessoais ficam no RH, e em Vendas fica só o que Vendas usa.
- **Frota:** a ficha do veículo poderá dizer quais requisitos o motorista precisa (ex.: munck exige o curso de operador). Isso só é usado quando Agenda e Frota forem feitas; agora fica só preparado.
- **Engenharia, Fabricação, Agenda:** usarão o cadastro de funcionários (responsável por projeto, apontamentos, escala), sem duplicar dados.

## 8. Permissões
- `rh` **ler**: ver as fichas completas, documentos e o painel.
- `rh` **editar**: cadastrar e editar funcionários, documentos e integrações.
- `rh` **critica** (nova): criar, desativar login e mudar perfis e permissões de acesso. Proposta: só a Administração e o perfil RH.
- Todos os logados: ver nome, foto, setor, função e situação de liberação, sem dados pessoais.
- A segurança fica no banco (RLS e Storage privado), como no resto do ERP.

## 9. Modelo de dados (resumo)
- `setores`, `funcoes` (setor_id)
- `tipos_documento` (categoria, tem_validade, validade_meses, aviso_dias)
- `funcao_requisitos` (funcao_id, tipo_documento_id) e `funcionario_requisitos` (requisitos extras individuais)
- `funcionarios` (dados pessoais e funcionais, `usuario_id` opcional → `usuarios`, situação)
- `funcionario_documentos` (tipo, número, emissão, validade, arquivo, substituído_por)
- `empresa_exigencias_integracao` (empresa_id, validade_meses) e `empresa_documentos_exigidos` (empresa_id, tipo_documento_id)
- `funcionario_integracoes` (funcionario_id, empresa_id, data, validade, arquivo)
- Visão `situacao_requisitos` com a cor de cada requisito por funcionário, usada no painel e no sino; função `funcionario_liberado(funcionario, empresa, data)` para a Agenda.
- O vendedor chega à ficha pelo mesmo `usuario_id` (sem coluna nova em `vendedores`). Bucket privado `rh` no Storage.
- Edge Function `rh-acesso` (criar login por convite, redefinir senha, desativar).

## Entregas
1. **Cadastro:** Setores, funções e fichas de funcionário (dados pessoais e funcionais), com o vínculo dos vendedores atuais. Menu **RH** na barra lateral.
2. **Documentos e vencimentos:** tipos de documento, requisitos por função e individuais, documentos com arquivo e validade, painel de vencimentos e aviso no sino.
3. **Integrações em clientes:** exigências por cliente, integrações do funcionário, a tela "quem está liberado no cliente X", a função `funcionario_liberado` e "Minha ficha" em Meu perfil.
4. **Acesso ao ERP:** criar login, enviar link de senha, perfis e desativação pelo RH, pela Edge Function.

Fica para depois: holerites (com o Financeiro), ARTs (com a Engenharia) e o uso de `funcionario_liberado` na Agenda e na Frota.

## Perguntas
Respondidas em 22/10 (ver o topo). Sem pendências.

Observação: o Luis Fernando (motorista de munck) do exemplo não está na lista da carga inicial. Ele e os outros funcionários podem ser cadastrados pela tela do RH.
