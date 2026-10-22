# Comunicação

Versão 2, 22/10/2026. **Estado: aprovado ("A e C" e as recomendações nas perguntas, 22/10/2026) e implementado (decisão 100). Falta o login por usuário para quem não tem e-mail (pergunta 3).**

Resposta do Gabriel (22/10): "quero ativar os itens A e C, enviar pelo app do celular e pelo email também se quiser". Ou seja: **o push no celular (A) é o canal principal**, e **quem envia escolhe, em cada comunicado, se também manda por e-mail (C)**.

Pedido do Gabriel (22/10):
> "quero criar um novo módulo de Comunicação, onde cada um dos líderes de cada setor poderá ter o poder de enviar notificações para cada funcionário, e os chefes podem enviar comunicados gerais para toda a empresa. e essa notificação deve chegar ao celular do funcionário."

## Hoje
- O RH já tem **setores, funções e fichas de funcionário** (decisão 69). O setor de uma pessoa vem da função dela (`funcionarios.funcao_id → funcoes.setor_id`).
- Só recebe algo no ERP quem tem **login** (`funcionarios.usuario_id`). Funcionário sem login não tem como ser avisado pelo ERP.
- Não existe a ideia de **líder de setor** nem de **chefe** no banco. Existem perfis (Administração, Comercial, RH, Financeiro…) e permissões por módulo e ação.
- O ERP já tem o **sino** na barra superior (retornos de Vendas e vencimentos do RH) e avisos do Windows, mas esses avisos só aparecem com o ERP **aberto** no navegador.
- O ERP já tem um `manifest.webmanifest` com ícones (dá para "instalar" na tela inicial), mas **não tem service worker**, que é a peça que recebe notificação com o app fechado.
- O ERP já usa **Supabase Realtime** em Vendas (decisões 83 a 85) e envia e-mail pelo SMTP da Locaweb (contato@fabriacobrasil.com.br).

## 1. Como a notificação chega ao celular (a escolha principal)

| Opção | Como funciona | Custo | Prós | Contras |
|---|---|---|---|---|
| **A. ERP como app no celular (PWA) com notificação push** | O funcionário abre o ERP no celular, toca em "Adicionar à tela inicial" e em "Ativar notificações". O aviso chega como o de qualquer app, mesmo com o ERP fechado. | **Grátis** (o envio passa pelo Google/Apple sem cobrança) | Sem loja de apps, sem mensalidade. O toque no aviso abre o comunicado no ERP, onde fica registrado quem leu. Funciona em Android e iPhone. | No **iPhone** só funciona com o ERP **adicionado à tela inicial** (iOS 16.4 ou mais novo). Cada pessoa precisa ativar uma vez em cada celular. Se a pessoa negar a permissão, não recebe. |
| B. WhatsApp (API oficial da Meta) | O ERP manda a mensagem pelo número da empresa. | Cobrado **por mensagem** pela Meta, mais um provedor (alguns centavos a cada envio) | Todo mundo já tem WhatsApp. Não precisa instalar nada. | Exige **verificar a empresa na Meta**, um **número só para isso** e **modelos de mensagem aprovados** pela Meta antes de usar. Não dá para saber quem leu dentro do ERP. Aviso fora do ERP. |
| C. E-mail | O ERP manda o comunicado por e-mail (o SMTP já funciona). | Grátis | Já está pronto para usar. Bom como registro. | No celular quase ninguém vê e-mail na hora. Muitos funcionários de fábrica não têm e-mail. |
| D. SMS | Mensagem de texto pelo número de celular. | Cobrado por mensagem | Chega em qualquer celular. | Custo, texto curto, cara de propaganda. |
| E. App próprio na Play Store / App Store | Um aplicativo publicado nas lojas. | Conta de desenvolvedor (Apple cobra por ano) | Experiência de app nativo. | Muito mais trabalho para fazer e manter, e a aprovação nas lojas. Exagero para o tamanho da equipe. |

**Escolha do Gabriel: A + C.** Todo comunicado vai para o celular pelo push; quem envia marca "Também enviar por e-mail" quando quiser. O WhatsApp pode entrar depois, se na prática muita gente não ativar o push; o módulo fica preparado para ganhar outros "canais" sem refazer nada.

Por que A: é grátis, chega com o ERP fechado, e o funcionário cai direto no comunicado dentro do ERP, onde a empresa tem o registro de entrega e de leitura ("Ciente"). O WhatsApp tira o comunicado do ERP e tem custo e burocracia com a Meta.

Como fica para o funcionário:
1. Abre o endereço do ERP no celular e entra com o login dele.
2. Aparece um aviso "Receba os comunicados no celular": no **Android**, um botão instala o app e pede a permissão; no **iPhone**, o ERP mostra o passo a passo (Compartilhar → Adicionar à Tela de Início → abrir pelo ícone → Ativar notificações).
3. Pronto: comunicado novo toca e aparece na tela de bloqueio. Tocar abre o comunicado.

Em "Meu perfil" fica "Notificações no celular" com os aparelhos ativados, um botão "Enviar teste" e "Desativar neste aparelho".

**Ponto de atenção (endereço do ERP):** o app instalado fica preso ao endereço do site. Hoje o ERP publica pelo GitHub Pages (`gabrielalveseng.github.io/ERP-Fabria-o/`), e a equipe já usou o endereço do Netlify. Se o endereço mudar depois (ex.: domínio próprio como `erp.fabriacobrasil.com.br`), cada pessoa precisa instalar e ativar de novo. Vale decidir o endereço definitivo antes de pedir para a equipe instalar (pergunta 6).

## 2. Quem envia e para quem

| Quem | Pode enviar para | Como é definido |
|---|---|---|
| **Líder de setor** | Um ou mais funcionários **do seu setor**, ou o setor inteiro | O RH marca o(s) líder(es) de cada setor em RH → Configurações → Setores. Um setor pode ter mais de um líder. |
| **Chefe** (direção) | **Toda a empresa**, um ou mais setores, ou qualquer funcionário | Nova permissão "Comunicado geral" (`comunicacao.critica`). Proposta: a Administração já tem; o RH pode dar a outras pessoas pela ficha → Acesso ao ERP. |
| Todos com login | Recebem e leem os seus comunicados | Permissão `comunicacao.ler`, para todos os perfis. |

- O destinatário é sempre um **funcionário com login ativo** (não desligado). Funcionário sem login aparece na lista com o aviso "sem login, não vai receber" (ver pergunta 3).
- A segurança fica no banco: o líder não consegue mandar para fora do seu setor nem pela tela nem por fora dela; só quem tem "Comunicado geral" manda para a empresa toda.

## 3. Telas

Menu **Comunicação** no grupo **Módulos administrativos**, com um contador de não lidos ao lado. Abas:

- **Caixa de entrada** (todos): lista dos comunicados recebidos, os não lidos em destaque, os urgentes com selo vermelho, e os fixados no topo. Abrir marca como lido. Se o comunicado pedir, o botão **"Li e estou ciente"** registra o ciente com data e hora.
- **Novo comunicado** (líderes e chefes):
  - Para: "Toda a empresa" (só chefe), setores, ou pessoas (busca por nome; o líder só vê o próprio setor).
  - Título, texto, **prioridade** (Normal ou Urgente), "Exigir ciente", "Fixar até dd/mm/aaaa" (opcional) e um anexo opcional (foto ou PDF).
  - **"Também enviar por e-mail"** (desmarcado por padrão): manda uma cópia para o e-mail corporativo de cada destinatário (ou o e-mail do login, se não houver corporativo), com o texto e um botão "Abrir no ERP". O anexo não vai no e-mail; abre só no ERP, logado.
  - Antes de enviar, mostra quantas pessoas vão receber e quantas ainda não ativaram o celular.
- **Enviados** (líderes e chefes): os comunicados enviados, cada um com **entregue / lido / ciente / pendente por pessoa**, e o botão "Lembrar quem não leu" (manda o push de novo só para os pendentes).
- **Sino** da barra superior: passa a mostrar também os comunicados não lidos.

Comunicado enviado **não é editado nem apagado** (fica o registro). Quem enviou pode **cancelar**: ele some da caixa de quem recebeu, com a marca "cancelado" no histórico de Enviados.

## 4. Regras
1. Líder envia só para o próprio setor; chefe para qualquer um ou para a empresa toda.
2. Destinatários são definidos **no momento do envio** (quem entrar no setor depois não recebe comunicados antigos, exceto os de "Toda a empresa" que estiverem fixados).
3. Funcionário desligado deixa de receber e perde os aparelhos cadastrados.
4. "Urgente" só muda o destaque (selo, topo da lista e aviso que pede interação no celular). Não há horário de silêncio na primeira versão (pergunta 5).
5. O texto do aviso no celular mostra o título e o começo do texto. Anexos só abrem dentro do ERP, logado.
6. Sem resposta/chat na primeira versão: o funcionário só lê e dá "Ciente".

## 5. Modelo de dados (resumo)
- `setor_lideres` (setor_id, funcionario_id): líderes de cada setor.
- `comunicados` (autor_id, alcance: `empresa` | `setores` | `pessoas`, titulo, texto, prioridade, exige_ciente, enviar_email, fixado_ate, anexo, cancelado_em).
- `comunicado_setores` (comunicado_id, setor_id), quando o alcance é por setor.
- `comunicado_destinatarios` (comunicado_id, usuario_id, push_enviado_em, email_enviado_em, lido_em, ciente_em): uma linha por pessoa, gerada pelo banco no envio. É daqui que saem o contador e o relatório.
- `push_aparelhos` (usuario_id, endpoint, chaves, nome do aparelho, criado_em, ultimo_envio_em, ativo): os celulares/computadores ativados de cada pessoa.
- Funções no banco: `enviar_comunicado(...)` (confere quem pode mandar para quem e gera os destinatários), `marcar_lido`, `dar_ciente`, `cancelar_comunicado`.
- Permissões novas: `comunicacao` ler (todos os perfis), criar (quem é líder) e critica ("Comunicado geral").
- **Envio do push:** Edge Function `comunicacao-push`, chamada logo depois do envio. Ela assina o aviso com as chaves VAPID (a chave privada fica nos Secrets do Supabase, nunca no navegador) e manda para cada aparelho. Aparelho que o Google/Apple diz que não existe mais é desativado sozinho. Como o `service_role` deste projeto não tem acesso às tabelas, a função lê os aparelhos por uma função do banco própria para isso (mesmo cuidado do `rh-acesso`).
- **Envio do e-mail:** a mesma Edge Function manda o e-mail pelo SMTP da Locaweb que já funciona (contato@fabriacobrasil.com.br). A senha desse e-mail hoje só está nas configurações de Auth do Supabase, que a função não consegue ler: o Gabriel precisa cadastrá-la uma vez em Supabase → Edge Functions → Secrets (nome `SMTP_SENHA`). O passo a passo vai junto da entrega.
- **No navegador:** um *service worker* (arquivo `sw.js`) que recebe o aviso com o ERP fechado e abre o comunicado ao tocar; o `manifest` existente ganha o ajuste de endereço do GitHub Pages.
- Tabelas na publicação do Realtime, para a caixa de entrada e o contador atualizarem ao vivo com o ERP aberto (como em Vendas).

## 6. Entregas
1. **Base:** líderes por setor no RH, permissões, envio de comunicado (empresa, setores, pessoas), Caixa de entrada, Enviados com lido/ciente, sino e contador ao vivo. Já funciona no computador e no navegador do celular, mas sem aviso com o app fechado.
2. **Celular e e-mail:** opção "Também enviar por e-mail", app instalável (PWA), service worker, "Ativar notificações" com o passo a passo de Android e iPhone, aparelhos em Meu perfil com "Enviar teste", Edge Function de envio e "Lembrar quem não leu".
3. **Anexos e fixados:** foto/PDF no comunicado e fixar até uma data.

Teste real: a entrega 2 precisa ser testada pelo Gabriel em um Android e um iPhone de verdade, porque o ambiente do Claude não recebe push nem acessa o Supabase pela rede.

## Perguntas
1. **Chefes:** quem são? Recomendação: quem tem o perfil Administração (hoje o Gabriel) e quem o RH liberar com "Comunicado geral" (ex.: o Fabiano).
2. **Líder fora do setor:** o líder pode mandar para alguém de outro setor? Recomendação: não; para isso existe o chefe.
3. **Funcionários sem login (chão de fábrica):** quem vai receber precisa de login no ERP. Todos os funcionários têm e-mail? Recomendação: todo funcionário ganha login com um perfil novo **"Funcionário"**, que só vê Comunicação e Meu perfil. Para quem não tem e-mail, o RH cria um login por **usuário** (ex.: matrícula) com uma senha provisória entregue em mãos, que a pessoa troca no primeiro acesso.
4. **Ciente obrigatório?** Recomendação: quem envia escolhe, comunicado por comunicado.
5. **Horário de silêncio:** avisos à noite e no fim de semana tocam normalmente, ou só os urgentes? Recomendação: tudo toca na primeira versão; ajustamos se incomodar.
6. **Endereço definitivo do ERP:** o celular vai usar o endereço do GitHub Pages, o do Netlify ou um domínio próprio da Fabriaço? Recomendação: decidir antes da entrega 2, porque mudar depois obriga todos a reinstalar.
7. ~~WhatsApp~~ Respondida: fica fora; os canais são o celular (push) e o e-mail opcional.
