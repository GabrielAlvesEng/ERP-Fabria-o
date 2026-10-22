# Área de Engenharia completa

Versão 1, 22/10/2026. **Estado: aprovado com as respostas da seção 6 (decisão 96).** Feitos: Dashboard, Kanban e, dentro do projeto, Kick-off, Árvore e Lista de materiais com cadastro manual. O restante fica para as próximas entregas.

Respostas do Gabriel (22/10/2026): 1) o Gabriel é o Chefe; 2) só a Engenharia abre a área; 3) tirar Vendas do perfil Engenharia; 4) a critério do Claude (todos os conjuntos Liberados); 5) sempre a lista inteira; 6) sem tipo no nome do arquivo; 7) pode ser; 8) começar pelo Dashboard. Por enquanto só Dashboard, Kanban e, no projeto, Kick-off, Árvore (sem mudança) e Lista de materiais (manual); criar um projeto de exemplo.

Pedido do Gabriel (22/10/2026): a Engenharia passa a ter Dashboard de projetos, aba Projetos em Kanban e uma área interna por projeto com Dados técnicos, Equipe e permissões, Árvore, Lista de materiais, Itens de corte, Detalhamentos, Tarefas e pendências, e Histórico e revisões.

## 0. O que já existe e o que muda

| Parte | Hoje | Depois |
|---|---|---|
| Lista de projetos | Grade de cartões com busca | Vira o **Kanban** (aba Projetos) |
| Status do projeto | Em andamento, Pausado, Concluído, Cancelado | Não iniciado, Em andamento, Liberado para fabricação, Finalizado (+ selo Pausado e Cancelado fora do quadro) |
| Área interna | Abas Árvore, Mapa, Lista de materiais, Kick-off, Dados | 8 abas do pedido (seção 3) |
| Árvore e Mapa | Importação do SolidWorks, soldados, peças em pastas dentro do card, COD_OP, COD_MAT, zoom, expandir e recolher | **Mantidos.** O Mapa vira um modo de visualização dentro da aba Árvore |
| Lista de materiais | Uma tabela com pastas Fabricadas, Fixadores e Comerciais | Chapas, Perfis e Itens comerciais, com revisões, PDF e envio para Compras |
| Acesso | Quem tem o perfil Engenharia vê e edita todos os projetos | Equipe por projeto, definida pelo Engenheiro Mecânico Chefe, com ver/editar por parte |
| Exclusão e Lixeira | Feitas (decisão 60) | Sem mudança |

## 1. Dashboard de projetos (aba nova "Dashboard")

- **Indicadores** (cartões com contagem): Não iniciados, Em andamento, Liberados para fabricação, Finalizados e **Atrasados**. Atrasado não é coluna: é o projeto não finalizado com prazo vencido (data de hoje em São Paulo).
- **Tabela de execução**: código, projeto, cliente, responsável, prazo (em vermelho se vencido), status, pendências abertas (tarefas não concluídas) e três barras de avanço.
- **Avanço pelos registros reais** (sem número digitado à mão):
  - **Modelagem**: % de conjuntos que já saíram de "Modelando" (estão em Detalhando, Em revisão ou Liberado).
  - **Materiais**: % de peças com material (COD_MAT) e item da biblioteca confirmado; os itens comerciais contam pela confirmação do item.
  - **Detalhamento**: % de conjuntos e peças fabricadas que têm ao menos um desenho na aba Detalhamentos.
- **Filtros**: ano (pelo início do código, ex.: 26), cliente, responsável e status. Os filtros valem para os cartões e para a tabela.
- Cada linha abre a área interna do projeto. O usuário só vê os projetos a que tem acesso (seção 3.2).

## 2. Aba "Projetos": Kanban

- Mesmo padrão do Kanban de Vendas (arrastar e soltar, `@dnd-kit`), com 4 colunas: **Não iniciado, Em andamento, Liberado para fabricação, Finalizado**.
- **Card**: código, nome do projeto, cliente, responsável e prazo (vermelho se atrasado). Selo "Pausado" quando pausado. Clique abre a área interna.
- O bloco "Propostas aprovadas aguardando projeto" continua acima do quadro; o projeto aberto nasce em **Não iniciado**.
- **Regras de movimentação** (validadas no banco, por RPC, não só na tela):
  - Não iniciado → Em andamento: quem edita o projeto. Também acontece **sozinho** na primeira importação do SolidWorks ou no primeiro conjunto criado.
  - Em andamento → Liberado para fabricação: só o **Chefe**, e só quando **todos os conjuntos estão Liberados**. Se faltar algum, o ERP mostra quais.
  - Liberado → Finalizado: acompanha a conclusão da fabricação. Como o módulo de Fabricação ainda não existe, **por enquanto** o Chefe marca com a data de término da fabricação; quando a Fabricação existir, ela finaliza sozinha.
  - Voltar uma coluna: só o Chefe, com justificativa obrigatória.
  - Cancelado sai do quadro (fica no filtro "Cancelados"); Pausado continua na coluna com o selo.
- **Histórico**: toda mudança registra quem, quando, de onde para onde e a justificativa (seção 3.8).

## 3. Área interna do projeto (8 abas)

### 3.1 Dados técnicos
- **Da proposta, sem valores comerciais**: cliente, contato técnico, título, código, revisão aprovada, escopo e prazo de entrega. A Engenharia lê por uma função do banco que devolve **só** esses campos; nenhum custo, preço ou condição comercial passa.
- **Proposta técnica**: o PDF técnico da revisão aprovada (o comercial não aparece).
- **Prazos do projeto**: início, prazo da Engenharia e prazo de entrega.
- **Anexos**: arquivos do projeto (espaço privado novo `engenharia`), mais os anexos técnicos da proposta.
- **Levantamento de campo**: campo para o link do OneNote, que abre em nova aba.
- O registro do **Kick-off** continua acessível aqui (só leitura para quem não é Chefe).

### 3.2 Equipe e permissões
- O **Engenheiro Mecânico Chefe** escolhe os funcionários do projeto e, para cada um, marca **Ver** ou **Editar** em cada parte: Dados técnicos, Árvore, Lista de materiais, Itens de corte, Detalhamentos, Tarefas. Histórico é sempre só leitura.
- Quem não está na equipe **não vê o projeto** (nem no Dashboard nem no Kanban). O Chefe e a Administração veem todos.
- Segurança no banco: todas as tabelas do projeto passam a checar `pode_projeto(projeto, parte, ação)` nas políticas (RLS). Esconder botão não basta.
- Novo responsável e novos membros entram com a ficha do RH (funcionário ativo com login).

### 3.3 Árvore do projeto
- Mantém tudo que existe: importação e reimportação do SolidWorks, hierarquia de montagens, submontagens e conjuntos soldados, peças dentro dos cards, itens comerciais e fixadores agrupados, COD_OP, COD_MAT, quantidades, zoom, centralizar, expandir e recolher.
- O Mapa passa a ser um botão "Ver como mapa" dentro desta aba.

### 3.4 Lista de materiais
- Três blocos: **Chapas** (espessura × largura × comprimento em mm, material, quantidade, peso), **Perfis** (perfil, comprimento em mm, material, quantidade, peso) e **Itens comerciais** (descrição, unidade, quantidade; fixadores dentro deste bloco).
- **Revisões da lista** (R0, R1…), independentes das revisões da proposta e do CAD. Cada revisão guarda uma cópia congelada da lista.
- **PDF personalizado** com o cabeçalho da Fabriaço: código e nome do projeto, cliente, revisão, data, responsável e os três blocos.
- **Enviar para Compras**: congela a revisão. A partir daí a Engenharia não altera aquela revisão; mudanças na árvore geram aviso "lista diferente da enviada" e exigem **nova revisão**, que mostra as diferenças (entrou, saiu, mudou quantidade) antes de enviar.
- Sem consulta de estoque nesta tela. O módulo de Compras ainda não existe: o envio fica registrado e pronto para Compras ler quando ele for feito.

### 3.5 Itens de corte
- Peças fabricadas organizadas por **operação** (LC, LP, PO, GU, DO, CL, US), depois **material**, depois **espessura** (chapas) ou **perfil**.
- **Arquivos DXF e STEP** por peça: upload múltiplo, o ERP liga o arquivo à peça pelo código no nome (ex.: `26-01-001-0A-01-003.dxf`). Arquivo sem peça correspondente fica listado para ligar à mão.
- **Envio para Preparação de Materiais**: a Engenharia marca as peças (ou um grupo inteiro) como enviadas; cada peça mostra Pendente, Enviada e, depois, o que a Preparação informar. **Os lotes são criados pela Preparação**, não aqui.
- Peça sem DXF/STEP quando a operação pede arquivo (LC, LP) aparece com alerta e não pode ser enviada.

### 3.6 Detalhamentos
- Tipos: Implantação, Montagem, Soldagem, Dobra, Calandra, Perfil e Usinagem.
- **Upload múltiplo direto** (arrastar vários PDFs/DWG de uma vez). O código vem do **nome do arquivo** e liga o desenho ao conjunto ou peça. Título começa igual ao nome do conjunto/peça; título e descrição podem ser editados depois.
- Novo arquivo com o mesmo código e tipo vira **nova revisão** do desenho; o anterior fica no histórico, nunca sobrescrito.

### 3.7 Tarefas e pendências
- Atividades da Engenharia com título, descrição, responsável, prazo e status (A fazer, Em andamento, Concluída, Cancelada).
- **Demandas do Kick-off**: os itens do Kick-off do setor Engenharia marcados como necessários entram como tarefas, com o responsável e o prazo que vieram de lá e o selo "Kick-off".
- Tarefas abertas contam como **pendências** no Dashboard; atrasadas ficam em vermelho.

### 3.8 Histórico e revisões
- Linha do tempo única do projeto: mudanças de status (Kanban), importações do SolidWorks, revisões e envios da lista de materiais, envios para Preparação, desenhos enviados e revisados, liberações de conjuntos, mudanças de equipe e tarefas concluídas.
- Filtro por tipo de evento e por pessoa. Só leitura.

## 4. Dados (resumo para o MODELO_DE_DADOS)

- `projetos`: status passa a `nao_iniciado | em_andamento | liberado | finalizado | cancelado` + `pausado boolean`; campos novos `inicio`, `prazo_engenharia`, `link_onenote`, `fabricacao_concluida_em`. Conversão: em_andamento e pausado → Em andamento (pausado com o selo); concluido → Finalizado; cancelado continua cancelado.
- `projeto_equipe` (projeto, usuário, permissões por parte em jsonb) e função `pode_projeto`.
- `projeto_eventos` (projeto, tipo, de/para, justificativa, dados jsonb, quem, quando): o histórico.
- `projeto_anexos`, `projeto_bom_revisoes` (número, status rascunho/enviada, cópia da lista, enviada em/por), `projeto_arquivos_peca` (DXF/STEP), `projeto_envios_preparacao`, `projeto_desenhos` (tipo, código, conjunto ou peça, revisão, título, descrição, arquivo), `projeto_tarefas` (com `kickoff_item_id` opcional).
- Permissão nova `engenharia.chefe` (Engenheiro Mecânico Chefe).
- Migrations pequenas e ordenadas, aplicadas pela decisão 54; nada é apagado.

## 5. Entregas (cada uma testável e publicada no GitHub)

1. **Status novo, Kanban e histórico de movimentação**, com as regras da seção 2.
2. **Equipe e permissões por projeto** (RLS em todas as tabelas da Engenharia).
3. **Dados técnicos e Tarefas** (com o Kick-off).
4. **Lista de materiais**: blocos, revisões, PDF e envio para Compras.
5. **Itens de corte**: DXF/STEP e envio para Preparação.
6. **Detalhamentos**: upload múltiplo e revisões de desenho.
7. **Dashboard** com indicadores, avanço e filtros, e a aba **Histórico** completa.

O Dashboard fica por último porque o avanço depende das entregas 4 a 6; se você preferir vê-lo antes, ele entra na entrega 1 com os indicadores de status e o avanço de modelagem, e ganha as outras barras depois.

## 6. Perguntas (com a minha recomendação)

1. **Quem é o Engenheiro Mecânico Chefe?** Recomendo uma permissão nova `engenharia.chefe`, dada a você agora; outros podem recebê-la pelo RH depois.
2. **Visibilidade:** quem não está na equipe não vê o projeto. O Comercial hoje lê a Engenharia: recomendo que o Comercial veja só o card no Kanban e o status (sem abrir a área interna). Pode ser assim?
3. **Valores comerciais:** o perfil Engenharia hoje tem leitura de Vendas, então tecnicamente consegue ver valores. Recomendo **tirar `vendas.ler` do perfil Engenharia**, já que os Dados técnicos passam a vir pela função sem valores. Posso tirar?
4. **Liberar para fabricação:** recomendo exigir todos os conjuntos Liberados (bloqueia) e só avisar se a lista de materiais ainda não foi enviada para Compras. Concorda?
5. **Envio parcial para Compras:** o Documento Mestre diz que Compras pode começar enquanto a Engenharia ainda detalha. Recomendo permitir que uma revisão da lista seja enviada só com os conjuntos escolhidos (ex.: R0 com as submontagens 0A e 0B). Ou prefere sempre a lista inteira?
6. **Nome dos arquivos de detalhamento:** recomendo `<código>` + opcional `_<tipo>` (ex.: `26-01-001-0A-01-000_SOLDAGEM.pdf`); sem o tipo no nome, você escolhe o tipo no envio para todos os arquivos daquele lote. Serve?
7. **Finalizado antes da Fabricação existir:** o Chefe marca manualmente com a data de término, como na seção 2. Pode ser?
8. **Ordem das entregas:** a da seção 5, ou o Dashboard primeiro?
