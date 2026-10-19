# Regras de negócio — ERP Fabriaço

Este arquivo registra o que foi **decidido** e o que está **pendente**. Não substitua decisões antigas em silêncio: ao mudar uma regra, mantenha a anterior marcada como substituída, com data e motivo.

## Decisões confirmadas pelo Gabriel (19/10/2026)

1. **Pintura vem antes da inspeção final.** Ordem em Fabricação: peças prontas, solda e montagem, pintura, e então Qualidade (inspeção).
2. **Faturamento:** na maioria dos pedidos, a NF é emitida quando o pedido é finalizado. Em pedidos muito grandes, o faturamento pode ser por marcos do projeto (medição por etapas).
3. **Compras:** quem aprova a compra e quem paga é o **Financeiro**.
4. **Pagamento ao fornecedor:** varia por fornecedor (antecipado ou após o recebimento do material). O cadastro de fornecedor deve guardar a condição.
5. **PCP e Preparação são o mesmo setor.** O módulo se chama apenas **Preparação**. Não criar um módulo PCP separado.
6. **Retrabalho na inspeção:** se a reprovação for por erro de fabricação, o item volta ao início da Fabricação, somente. Outros motivos de reprovação dependem do caso e devem ser definidos quando chegarmos em Qualidade.
7. **Estratégia:** o site será refeito do zero, módulo a módulo. O ZIP de `referencia/` serve só como consulta.

## Decisões confirmadas pelo Gabriel (19/10/2026, resposta ao planejamento de Vendas)

8. **Código da proposta `AA-CC-NNN`:** AA = ano, CC = código do cliente (contato) **naquele ano**, NNN = sequência das propostas **daquele contato naquele ano**. Exemplo: `26-01-001` é a 1ª proposta de 2026 do contato 01.
9. **Os códigos reiniciam a cada ano.** Em 2027 tudo recomeça: os códigos de cliente (CC) e as sequências (NNN). Os códigos de 2026 continuam válidos e nunca são renumerados. Consequência: o CC pertence ao par contato + ano, e o mesmo contato pode ter CC diferente em anos diferentes.
10. **Já existem códigos em uso em 2026.** Eles precisam ser importados, e a numeração de 2026 continua a partir deles.
11. **O projeto de fabricação usa o mesmo código da proposta** (ex.: proposta `26-01-001` gera o projeto `26-01-001`). *Substitui* o padrão `AA-NNN-SIGLA` (ex.: 26-038-SPP) da seção 7 do Documento Mestre. O Documento Mestre não foi editado; vale esta decisão.
12. **Finalizado, Emitido NF e Pago são movidos pelo Financeiro.** O Comercial não move a proposta para essas etapas.
13. **Visibilidade:** todo usuário do setor de Vendas vê todas as propostas (não só as próprias).
14. **Empresa única:** o ERP atende só a Fabriaço Brasil. Não haverá estrutura multiempresa.
15. **Código versionado em repositório Git.**
16. **Montagens seguem o prefixo do projeto** (registrado pelo Gabriel no `CLAUDE.md`): `26-01-001-00-00-000` (montagem geral), `26-01-001-0A-00-000` (submontagem), `26-01-001-0A-01-000` (conjunto secundário). O código não muda com revisões da proposta.
17. **Supabase:** projeto novo e vazio, exclusivo do ERP (registrado pelo Gabriel no `CLAUDE.md`).

## Decisões confirmadas pelo Gabriel (19/10/2026, terceira rodada)

18. **CC atribuído automaticamente pela ordem do contato no ano.** Para 2026, a ordem é a da planilha `1.3.Vendas/.../2026/Lista de Cliente 2026.xlsx` (1ª linha de dados = 01, e assim por diante; 67 contatos).
19. **Um único projeto Supabase**, já criado pelo Gabriel. *Substitui* a recomendação de dois projetos (desenvolvimento e produção) e diverge da regra do `CLAUDE.md` "manter desenvolvimento separado da produção". Prevalece a decisão do Gabriel; enquanto não houver dados reais de uso, o projeto serve para teste. Quando o sistema entrar em uso, rever a separação.
20. **GitHub:** conta pessoal do Gabriel. O Claude faz as importações e pede acesso quando precisar.
21. **Aprovação:** todo usuário do Comercial pode aprovar propostas. No início haverá **um único usuário geral com acesso a tudo**.
22. **Finalizado** = execução concluída. Depois vêm Emitido NF e Pago, todos movidos pelo Financeiro (decisão 12).
23. **Exemplar agora:** o Gabriel autorizou executar um exemplar funcional de Vendas já, deixando as perguntas restantes para depois. Onde a pergunta continua aberta, o exemplar usa a recomendação do planejamento, e isso pode ser revisto.

## Decisões confirmadas pelo Gabriel (19/10/2026, ajustes do exemplar)

24. **Navegação:** a sidebar lista só os módulos. Dentro de Vendas, Dashboard, Empresas, Contatos e Propostas são abas superiores (estilo abas do Windows).
25. **Desativar empresa:** o formulário de edição tem o botão "Desativar empresa" (com confirmação). A empresa desativada vai para a lista "Empresas desativadas", abaixo das ativas, e pode ser reativada. Desativar **não apaga nada** (contatos, propostas e histórico ficam) e a empresa deixa de aparecer na escolha de empresa para novos contatos e propostas. Quem pode: permissão vendas.editar.
26. **CNPJ preenche a empresa:** ao digitar um CNPJ válido no cadastro, o sistema consulta a Receita Federal por serviços públicos gratuitos (BrasilAPI, depois CNPJ.ws, depois CNPJá) e preenche **só os campos vazios**. Só o CNPJ é enviado a esses serviços. Se todos falharem, o cadastro continua manual.
27. **Campos de formulário:** datas sempre em DD/MM/AAAA com botão de calendário ao lado; checkboxes, selects e escolha de arquivo com visual próprio do sistema.

## Regras do módulo Vendas (do Documento Mestre)

Detalhes completos em `DOCUMENTO_MESTRE.md`, seção 8. Resumo:

- Áreas: Dashboard Comercial, Empresas, Contatos, Propostas (com Kanban e Kick-off).
- Kanban: À enviar, Enviados, Follow-up, Aprovado, Finalizado, Emitido NF, Pago, Reprovado. Mover o card para Follow-up já marca o follow-up (sem botão específico).
- Revisões (R0, R1, R2): só nascem quando uma proposta já enviada volta para edição. Em "À enviar" edita-se livremente. PDFs de revisões anteriores nunca são sobrescritos.
- Aprovação exige registro (PC, e-mail, WhatsApp, contrato, outra) e comprovante anexado.
- Reprovação registra o motivo da perda.
- Exclusão por permissão e senha administrativa configurável; nunca exclusão irreversível sem verificações.
- Contatos acompanhados por ano, sem duplicar a pessoa. Lead vira Cliente quando uma proposta é aprovada.
- Kick-off: preparar apenas a estrutura de dados. Editor de PDF de propostas fica para depois, com autorização.

## Pendências

- [x] ~~**Código do projeto de fabricação.**~~ Resolvido pelas decisões 11 e 16 (mesmo código da proposta; montagens com o mesmo prefixo). Detalhes de peças e da macro do SolidWorks ficam para Engenharia.
- [ ] **Supabase:** um projeto só, já criado (decisões 17 e 19). Falta confirmar o Project Ref antes de qualquer operação.
- [ ] Perfis de usuário e matriz de permissões por módulo e ação. *Parcial:* decisões 12 e 13.
- [ ] Política exata de exclusão de propostas (rascunhos incluídos).
- [ ] Unicidade do código comercial do contato (CC). *Parcial:* decisões 8 e 9. Atribuição decidida (decisão 18). Falta: lista das propostas de 2026 já emitidas, para continuar o NNN de cada contato.
- [ ] Ligação com o Financeiro. *Parcial:* decisão 12. Falta definir que dados o Financeiro informa em cada etapa (nº da NF, data do pagamento etc.).
- [ ] Critérios de retorno de etapa (ex.: voltar de Enviados para À enviar cria revisão).
- [ ] Onde fica a pasta do código (dentro ou fora do OneDrive) e qual conta do GitHub usar.

As demais perguntas marcadas [DECIDIR] no `docs/PLANEJAMENTO_VENDAS.md` continuam abertas até o Gabriel responder ou aprovar as recomendações.
