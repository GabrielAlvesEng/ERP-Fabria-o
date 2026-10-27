# Tarefas por pessoa

Versão 2, 27/10/2026. **Estado: aprovado com as respostas do Gabriel (decisão 116) e implementado.**

Respostas do Gabriel (27/10):
1. Todo mundo que tem login no ERP tem acesso às tarefas (a lista de pessoas é de quem tem login ativo).
2. Prazo opcional: sim.
3. Aviso no celular: depois.
4. Mudar texto, urgência ou prazo: **só o dono**. Apagar: **o dono e quem criou**.
5. (Novo) O dono pode mudar a ordem e organizar do jeito que quiser (arrastar; botão "Organizar por urgência"). Tarefa nova entra no topo.

As seções abaixo são a v1; onde divergirem, valem as respostas acima.

Pedido do Gabriel (27/10):
- uma aba de tarefas em que todo mundo tem a sua;
- tipo check box, com as tarefas que a pessoa tem que fazer;
- eu posso colocar as minhas tarefas, mas outra pessoa também pode me passar uma tarefa (ex.: no do Pedro, "Alinhar com o Técnico de segurança para ele ir na empresa amanhã cedo");
- se outra pessoa criou a tarefa para você, aparece quem criou;
- toda pessoa da empresa tem o seu, é direcionado;
- urgência alta, média e baixa;
- todo mundo vê a tarefa do outro, mas não pode alterar.

## Hoje
- O RH tem o cadastro de funcionários (`funcionarios`), cada um ligado (ou não) a um login (`usuario_id`).
- Não existe nada de tarefas. O módulo Comunicação já tem o sininho e o aviso no celular (push), que podem ser reaproveitados.

## 1. Tela "Tarefas" (item novo no menu, para todos os logados)
- À esquerda, a lista das pessoas da empresa (funcionários ativos do RH), com **"Minhas tarefas" no topo** e, ao lado de cada nome, quantas tarefas abertas a pessoa tem (e um ponto vermelho se tiver alguma alta).
- À direita, a lista da pessoa escolhida, em forma de **check box**, ordenada por urgência (alta, média, baixa) e depois pela data em que foi criada.
- Cada tarefa mostra: o texto, a etiqueta de urgência (vermelho, amarelo, cinza), a data, e **"Passada por Fulano"** quando quem criou não é o dono. Se a pessoa criou para si mesma, não aparece nada.
- Campo no topo da lista: "Nova tarefa para Pedro…", escolha da urgência (média já marcada) e **prazo opcional**. Enter grava.
- As concluídas descem para um bloco "Concluídas" recolhido, com a data e quem marcou.
- No celular, a lista de pessoas vira um seletor no topo.

## 2. Quem pode o quê (regra no banco, não só na tela)
| Ação | Quem |
|---|---|
| Ver as tarefas de qualquer pessoa | todos os logados |
| Criar tarefa para si ou para outra pessoa | todos os logados |
| Marcar como feita / desmarcar | só o **dono** da tarefa |
| Mudar texto, urgência ou prazo | só **quem criou** (enquanto não estiver feita) |
| Excluir (vai para a lixeira, exclusão lógica) | **quem criou**; o dono também, se ele mesmo criou |

Ou seja: quem não é o dono nem o criador só olha. Toda mudança fica na auditoria.

## 3. Aviso de tarefa nova
- Quando alguém passa uma tarefa para você, aparece um **número no item "Tarefas" do menu** ("2 novas") até você abrir a tela.
- A tela atualiza sozinha quando outra pessoa cria ou marca uma tarefa (como em Vendas).
- Aviso no celular (push), usando o que o módulo Comunicação já tem: ver pergunta 3.

## 4. Dados (resumo)
Tabela nova `tarefas`: dono (`funcionario_id`), texto, urgência (`alta`/`media`/`baixa`), prazo (opcional), criado por (login), criado em, feita em, feita por, visto pelo dono em, excluído em. As ações passam por funções no banco que conferem a regra da seção 2.

## 5. Entregas
1. Banco (tabela, regras, auditoria, atualização ao vivo).
2. Tela Tarefas com a lista de pessoas, check box, criar, editar e excluir.
3. Número de novas no menu.
4. (Se aprovado) aviso no celular.

## Perguntas
1. **Quem aparece na lista:** todos os funcionários ativos do RH, mesmo quem ainda não tem login (a tarefa fica lá e outros veem)? *Recomendo sim*, porque "toda pessoa da empresa tem o seu".
2. **Prazo:** além da urgência, quer um campo de prazo opcional (ex.: "amanhã")? *Recomendo sim, opcional*; tarefa com prazo vencido fica destacada.
3. **Celular:** quer o aviso no celular quando alguém te passa uma tarefa? *Recomendo deixar para depois*, porque o push do Comunicação ainda não foi testado em celular de verdade; por enquanto fica o número no menu.
4. **Quem pode editar:** a tabela da seção 2 está certa? Em especial, quem criou a tarefa para outra pessoa pode corrigir o texto, e só o dono marca como feita.
