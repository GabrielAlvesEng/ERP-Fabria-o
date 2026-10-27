# Agenda de compromissos

Versão 2, 27/10/2026. **Estado: aprovado com as respostas do Gabriel (decisão 118) e implementado.**

Respostas do Gabriel (27/10):
1. Ver a agenda dos outros só como "Ocupado": sim (recomendado).
2. Sem aceitar convite: sim (recomendado).
3. Repetir: **fazer já** (todo dia, toda semana, todo mês, todo ano, a cada N, até).
4. Aviso de véspera: **16:30**.
5. Lembretes a cada hora das 07:00 às 18:00: sim.

As seções abaixo são a v1; onde divergirem, valem as respostas acima.

Pedido do Gabriel (27/10):
- tipo a agenda do e-mail;
- tela principal com o calendário do mês, mostrando em que dia e em que horário eu tenho compromisso;
- posso criar um compromisso só para mim ou incluindo várias pessoas;
- nome do compromisso, data, hora que começa e acaba, local etc.;
- mostrar o primeiro compromisso do dia seguinte um dia antes, os próximos do dia a cada hora e quando faltarem 15 minutos.

## 1. Tela "Agenda" (item novo no menu, para todos que têm login)
- **Mês** (tela principal): calendário do mês, hoje destacado. Dentro de cada dia aparecem os compromissos com a hora ("09:00 Reunião Vale"). Se tiver muitos, mostra 3 e "+2". Setas para trocar de mês e botão "Hoje".
- Clicar num dia abre o **dia** à direita (no celular, embaixo): a lista dos compromissos com hora de início e fim, local e participantes.
- Botões para trocar a visão: **Mês / Semana / Dia** (semana e dia em grade de horários, como no Outlook/Google).
- Clicar num horário vazio (ou no botão "Novo compromisso") abre o formulário.

## 2. Formulário do compromisso
- **Nome** (obrigatório)
- **Data**, **hora de início** e **hora de fim** (o fim já vem 1 hora depois). Opção **"Dia inteiro"**.
- **Local** (texto livre, ex.: "Fábrica", "Cliente Vale, Itabira", ou link de reunião online).
- **Participantes**: "Só eu" já marcado; posso incluir pessoas da lista de quem tem login (igual às Tarefas).
- **Descrição / observações** (opcional).
- **Cor** (opcional, para separar visita, reunião, pessoal).

## 3. Quem pode o quê
| Ação | Quem |
|---|---|
| Ver o compromisso | quem criou e os participantes |
| Mudar ou cancelar | só quem criou |
| Sair de um compromisso para o qual foi chamado | o participante |

Quem é chamado vê o compromisso na sua agenda na hora, com "Marcado por Fulano", e recebe um aviso.

## 4. Lembretes (aviso dentro do ERP)
Os avisos aparecem **dentro do ERP**, no canto da tela e no sininho, enquanto o ERP estiver aberto (no computador ou no celular). O aviso no celular com o ERP fechado (push do módulo Comunicação) ainda não foi testado num celular de verdade, então fica para depois.
- **Um dia antes:** às 16:30 aparece "Amanhã seu primeiro compromisso é 08:00 Reunião Vale, na Fábrica". Se abrir o ERP depois disso, aparece ao abrir.
- **No dia, a cada hora:** de hora em hora (08:00, 09:00, ...) aparece "Próximo: 14:00 Visita técnica (em 2h)". Some se não tiver mais nada no dia.
- **Faltando 15 minutos:** aviso em destaque, com som, "Em 15 min: Visita técnica, Cliente Vale".
- Ao abrir o ERP de manhã, um resumo "Hoje você tem 3 compromissos".

## 5. Entregas
1. Banco: compromissos, participantes, regras de quem pode o quê, atualização ao vivo.
2. Tela Agenda (mês, semana, dia) e formulário.
3. Lembretes dentro do ERP.
4. (Depois, se quiser) aviso no celular com o ERP fechado.

## Perguntas
1. **Ver a agenda dos outros:** quer poder abrir a agenda de outra pessoa (só vendo "Ocupado" nos horários, sem os detalhes)? *Recomendo sim*, ajuda a marcar reunião sem bater horário.
2. **Aceitar convite:** quem é chamado precisa aceitar ou recusar, como no e-mail? *Recomendo não* por enquanto: entra direto na agenda e a pessoa pode sair se não puder ir.
3. **Repetir:** precisa de compromisso que se repete (toda segunda, todo mês)? *Recomendo deixar para depois.*
4. **Horário do aviso de véspera:** 17:00 está bom?
5. **Lembretes a cada hora:** em horário comercial (07:00 às 18:00) está bom?
