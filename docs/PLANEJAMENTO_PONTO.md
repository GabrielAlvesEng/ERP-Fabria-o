# Ponto eletrônico (dentro do RH)

Versão 2, 27/10/2026. **Estado: aprovado com as respostas do Gabriel (decisão 115) e implementado (entregas 1 a 4).**

Respostas do Gabriel (27/10):
1. Local: o portão da Fabriaço pelo link do Google Maps (-21.4687341, -47.0208632); raio 150 m.
2. Quem trabalha fora: o RH lança manualmente depois, ou, em obra grande, cadastra um **local provisório** (ex.: Gelita) e a equipe bate o ponto direto lá.
3. **Controle interno** por enquanto; no fim do mês o RH imprime o relatório e todos assinam.
4. Pode ter sábado/hora extra: o funcionário bate, mas o **RH aprova** para ir ao relatório oficial.
5. Tolerância de **5 min antes** e **10 min de atraso por dia**; fora disso, alerta no RH, que aprova para entrar no relatório oficial.
6. O saldo **zera todo mês** e o relatório mostra a hora extra ou quanto ficou devendo.
7. Só o RH vê; cada funcionário vê só o seu.
8. Sócios ficam fora.
9. Computador vale se a localização for boa.

O que mudou em relação à v1: não há bloqueio de horário para bater (tudo fora do horário vira alerta para o RH); não há fechamento de mês nem banco de horas acumulado (resposta 6); o ponto vale a partir do dia em que a migration roda, para os dias anteriores não virarem falta; quem bate ponto entra no ERP direto na tela do ponto. As perguntas abaixo ficaram como registro.

Pedido do Gabriel (27/10):
- o funcionário chega na empresa, entra na sua conta do ERP (com a localização permitida);
- o ERP vê pela localização que ele está na empresa e só então deixa bater o ponto;
- manhã das **07:00 às 11:30**, tarde das **13:00 às 17:18**;
- o ERP grava o horário no banco, faz todo o controle de horas, mostra as faltas e quantas horas no mês ficaram **devendo ou a mais**.

## Hoje
- O RH já tem o cadastro de funcionários (`funcionarios`), cada um ligado ao seu login (`usuario_id`), setor, função e situação (ativo, férias, afastado, desligado).
- O ERP já é instalável no celular (tem `manifest.webmanifest`) e roda em HTTPS (GitHub Pages), que é o que o navegador exige para liberar a localização.
- Não existe nada de ponto, jornada, feriados ou banco de horas.

## Conta da jornada
- Manhã 07:00–11:30 = 4h30. Tarde 13:00–17:18 = 4h18. **Dia = 8h48.**
- Segunda a sexta: 8h48 × 5 = **44h por semana**, que é a jornada CLT cheia. Por isso a proposta é **sem expediente no sábado** (confirmar na pergunta 4).
- São **4 batidas por dia**: entrada da manhã, saída para o almoço, volta do almoço, saída da tarde.

## 1. Bater o ponto (tela "Ponto")
- Item novo no menu, **para todos os funcionários com login**: um botão grande "Bater ponto" com o relógio, o nome da próxima batida ("Entrada da manhã", "Saída para almoço"…) e as batidas de hoje.
- Ao tocar, o ERP pede a localização ao celular. Se a pessoa estiver **dentro do raio da empresa** (ex.: 150 m do portão), o ponto é gravado. Fora do raio, aparece "Você está a 2,3 km da Fabriaço" e o botão fica bloqueado.
- **A hora gravada é a do servidor**, não a do celular, então mudar o relógio do aparelho não adianta.
- Gravamos junto: a distância até a empresa, a precisão do GPS e o aparelho usado. Se a precisão vier muito ruim (ex.: computador sem GPS, precisão de 2 km), o ERP pede para tentar de novo pelo celular.
- O ERP decide sozinho qual batida é a próxima pela ordem do dia; não precisa escolher.
- Depois de bater, mostra o **comprovante na tela** (dia, hora, tipo de batida) e ele fica guardado no histórico da pessoa.
- Batida repetida em menos de 2 minutos é ignorada (toque duplo).

**Sobre a segurança da localização:** dá para enganar o GPS com aplicativos de "localização falsa" num celular Android preparado para isso. É raro, e o ERP guarda a precisão e o aparelho de cada batida para o RH perceber padrões estranhos. Se um dia isso virar problema, dá para somar uma segunda conferência (ex.: estar no Wi-Fi da empresa ou ler um QR code na parede).

## 2. Horários e tolerâncias
- Janela de cada batida (proposta, ajustável em RH → Configurações → Ponto):
  - entrada da manhã: liberada a partir das **06:30**;
  - saída do almoço e volta: entre **11:00 e 13:30**;
  - saída da tarde: até as **23:59** (hora extra fica registrada, não é bloqueada).
- **Tolerância da CLT (art. 58):** até **5 minutos** por batida, no máximo **10 minutos no dia**, não contam nem como atraso nem como extra. Passou disso, conta o tempo inteiro.
- Chegou 07:04 → sem atraso. Chegou 07:20 → 20 min de atraso. Saiu 17:40 → 22 min a mais.
- O almoço tem o mínimo legal de **1 hora**; se a pessoa voltar antes, o ERP avisa o RH.

## 3. Controle de horas (cálculo do dia e do mês)
Para cada dia útil e cada funcionário ativo, o ERP calcula:
- **horas trabalhadas** (soma dos dois períodos);
- **horas previstas** (8h48, ou zero em feriado, férias, afastamento, atestado);
- **saldo do dia** = trabalhadas − previstas (já com a tolerância);
- **situação do dia:** normal, atraso, saída antecipada, hora extra, **batida faltando**, **falta**.

**Falta** = dia útil sem nenhuma batida e sem justificativa. **Batida faltando** = bateu entrada mas não saída (ou parecido): o dia fica "pendente" até a pessoa ou o RH corrigir.

**Mês:** total previsto, total trabalhado, **saldo do mês (devendo ou a mais)**, número de faltas, atrasos e pendências. O saldo de cada mês fica guardado quando o RH **fecha o mês** (pergunta 6).

## 4. Correções e justificativas
- Nenhuma batida é apagada nem editada. Correção é sempre um **registro novo**, com motivo e quem fez.
- **Esqueci de bater:** o funcionário pede o ajuste pelo próprio ERP ("Esqueci a saída de 24/10, saí às 17:20") e o RH aprova ou recusa. Só depois de aprovado entra na conta.
- **Justificativas do dia** (lançadas pelo RH): atestado médico (com anexo), férias, folga, afastamento, compensação de banco de horas, falta justificada. Férias e afastamento já vêm da situação do funcionário no RH.
- **Feriados:** calendário em RH → Configurações → Ponto, já carregado com os nacionais de 2026 e 2027; o RH acrescenta os municipais e os dias de ponte.

## 5. Telas
- **Ponto** (todos): bater ponto + "Meu espelho": calendário do mês com as batidas de cada dia, a situação e o saldo; botão "Pedir ajuste".
- **RH → Ponto** (só RH):
  - **Hoje:** quem já chegou, quem está atrasado, quem ainda não bateu;
  - **Espelho por funcionário:** o mesmo do "Meu espelho", com lançamento de justificativas;
  - **Pedidos de ajuste:** aprovar/recusar;
  - **Resumo do mês:** uma linha por funcionário com previsto, trabalhado, saldo, faltas, atrasos; exportar em PDF (espelho para assinatura) e planilha;
  - **Configurações:** local da empresa (no mapa) e raio, horários, tolerância, feriados.

## 6. Modelo de dados (resumo)
- `ponto_locais`: nome, latitude, longitude, raio em metros, ativo (permite mais de um local, ver pergunta 2).
- `ponto_jornadas`: horários de cada período e dias da semana; `funcionarios.jornada_id` (todos começam na jornada padrão 07:00–11:30 / 13:00–17:18).
- `ponto_marcacoes`: funcionário, data e hora (do servidor), tipo, latitude, longitude, precisão, distância, local, aparelho, origem (app ou ajuste aprovado). Só se grava pela função `ponto_bater`, que confere o raio no servidor; ninguém altera nem apaga.
- `ponto_ajustes`: pedido de ajuste com motivo, situação e quem aprovou.
- `ponto_justificativas`: dia(s), tipo, anexo, observação.
- `feriados`: data, nome, nacional/municipal.
- `ponto_fechamentos`: mês fechado por funcionário com os totais.
- Permissão nova `ponto` (ler, editar) para o perfil RH. Cada funcionário só lê as próprias batidas.

## 7. Entregas
1. **Bater ponto:** configuração do local e raio, tela de bater ponto e "Meu espelho" simples (batidas do dia e do mês).
2. **Cálculo:** horas do dia e do mês, tolerância, faltas, atrasos, saldo; tela RH → Ponto (Hoje e Espelho).
3. **Correções:** pedidos de ajuste, justificativas, feriados.
4. **Fechamento e relatórios:** fechar o mês, saldo acumulado, PDF do espelho e planilha.

## Perguntas para o Gabriel
1. **Endereço da empresa** (ou mande o link do Google Maps do portão) e o **raio** aceito. Proposta: 150 m.
2. **Quem trabalha fora** (montagem em campo, motorista de munck, visita a cliente): como bate o ponto? Proposta: o RH cadastra a obra/cliente como local extra com o seu raio, e a pessoa bate ponto lá.
3. **Valor legal:** o ponto será só um **controle interno** ou vai substituir o ponto oficial? Pela lei (Portaria 671/2021), um ponto por programa com validade oficial precisa de software registrado no INPI e arquivos fiscais (AFD/AEJ), o que é bem mais trabalhoso. Empresa com até 20 funcionários não é obrigada a ter ponto. Proposta: começar como controle interno, com o espelho mensal assinado pelo funcionário.
4. **Sábado:** sem expediente (a semana já fecha 44h)? Alguém tem jornada diferente (estagiário, meio período, sócios)?
5. **Tolerância e janelas:** concorda com 5 min por batida / 10 min por dia e com as janelas do item 2? A entrada antes das 07:00 conta como hora extra ou não (proposta: não conta, a não ser que o RH autorize)?
6. **Saldo do mês:** o saldo **acumula** de um mês para o outro (banco de horas) ou **zera** todo mês e o RH resolve fora (pagar extra / descontar)?
7. **Quem vê os relatórios:** só o RH, ou também o responsável de cada setor (ex.: a Engenharia vê a sua equipe)? O funcionário vê o próprio espelho (proposta: sim).
8. **Quem bate ponto:** todos os ativos com login, inclusive você e o Fabiano (sócios), ou os sócios ficam fora?
9. **Computador:** pode bater ponto pelo computador do escritório? O navegador do PC costuma errar a localização em centenas de metros; proposta: aceitar se a precisão for boa, senão pedir o celular.
