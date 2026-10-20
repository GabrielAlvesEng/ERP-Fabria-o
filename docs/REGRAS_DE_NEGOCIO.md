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

## Decisões confirmadas pelo Gabriel (19/10/2026, custos, e-mail e Engenharia)

28. **Empresas desativadas** ficam recolhidas (ocultas) e só aparecem ao clicar no título da lista.
29. **Custos:** uma proposta pode ter **vários itens** (Item A, B…), cada um com sua planilha de custos e quantidade. Os custos pertencem à revisão (congelam no envio e são copiados na nova revisão).
30. **Fórmulas de custo corrigidas** (substitui o comportamento da planilha "Item A - Plataforma.xlsx"): (a) Acessórios soma todas as linhas; (b) lucro e margem de negociação incidem sobre **todos** os custos, inclusive Acessórios; (c) imposto **por dentro**: preço unitário = (custos + lucro + negociação) ÷ (1 − imposto%). O modo "por fora" continua disponível por item, para conferência.
31. **Quem vê custos:** todo o Comercial (e a Administração).
32. **E-mail de envio:** parte da equipe usa Outlook do Microsoft 365 e parte usa Thunderbird. Assunto: "Proposta {código} FABRIAÇO - {título}" na R0 e "Proposta {código}-R{n} FABRIAÇO - {título}" nas revisões (ex.: Proposta 26-26-005-R1 FABRIAÇO - Tanques Diversos Inox). Texto padrão do Gabriel, com CC e os PDFs comercial e técnico anexados.
33. **Engenharia autorizada:** o Gabriel pediu expressamente para fazer a parte de Engenharia (projetos com árvore de montagens) agora, antes da validação formal de Vendas. Entra como exemplar, seguindo os códigos da decisão 16.

## Decisões confirmadas pelo Gabriel (20/10/2026, importação do SolidWorks)

34. **Primeira importação** do JSON da macro (Bancada Moedor Aplicalis, 26-059-BMA) vai para o **projeto de teste 26-27-001**, só para validar.
35. **Conjunto soldado** (weldment) é um nó próprio da árvore, com os corpos da lista de corte como peças numeradas `<código do soldado>.01`, `.02`… na ordem da lista de corte.
36. **Os próximos modelos do SolidWorks serão nomeados com o código da proposta** (ex.: `26-26-005-00-00-000`). Arquivos antigos com `AA-NNN-SIGLA` continuam importáveis: o ERP usa o final do código CAD e guarda o código CAD original; nenhum arquivo é renomeado.
37. **Sem deploy no Netlify por enquanto (20/10/2026):** o Gabriel quer terminar e testar tudo em localhost antes. Nenhuma publicação no Netlify até ele liberar expressamente. O último deploy feito foi `6ad794964d129e69b74355bb` (importação do SolidWorks), antes deste pedido.
38. **Reimportação de revisão do CAD (20/10/2026):** aprovadas as regras R1 a R8 de `docs/PLANEJAMENTO_SOLIDWORKS.md` (etapa 2): removidos do CAD ficam marcados e fora da lista de materiais; o CAD vence quando traz valor e o ERP mantém o valor quando o CAD vem vazio; códigos nunca mudam nem são reaproveitados; mudança de pai = removido + novo; conjunto Liberado alterado volta a Em revisão e sobe a revisão; itens criados à mão não são tocados; JSON de outra montagem é recusado.

## Decisões confirmadas pelo Gabriel (20/10/2026, ajustes de Vendas)

Aprovado o planejamento `docs/PLANEJAMENTO_AJUSTES_VENDAS.md` com todas as recomendações. Decisões que **substituem** regras anteriores estão marcadas.

39. **Kanban sem coluna Follow-up** (*substitui* o Documento Mestre 8.4/8.6, que tinha a coluna Follow-up, e o fluxo "mover para Follow-up registra o follow-up"). O follow-up vira uma data no card de Enviados; no dia ou depois, o card mostra um ícone de alerta. Registrar follow-up fica no detalhe e num atalho do card.
40. **Notificação de retorno:** sino na barra superior para todo o setor de Vendas; notificação do Windows (navegador) uma vez por dia por proposta, só para o responsável da proposta, enquanto o ERP estiver aberto. E-mail automático fica para depois.
41. **Materiais nos custos:** blocos Chapas, Perfis e Comerciais (sem coluna Tipo); comerciais só com quantidade; coluna Material vinda do catálogo COD_MAT; lista de preços ganha Material; arrastar para reordenar; campos de escolha com lista abaixo e texto livre. kg/m dos perfis entra aos poucos na lista de preços.
42. **Acabamentos no lugar de Acessórios** (*substitui* a decisão 30-a sobre Acessórios). As linhas de Acessórios existentes vão para Comerciais com o mesmo valor; revisões enviadas ficam como estão. Mão de obra em Administrativo, Fabricação e Instalação. Deslocamento e Fretes viram "Frota e fretes" com km e pedágio digitados e botão "Abrir rota no Qualp" (API depois). Hospedagem sem cidade.
43. **Imposto sempre por dentro** (*substitui* a decisão 30-c, que mantinha a opção "por fora"). "Lucro" passa a se chamar **Margem** e a margem de negociação, **Negociação**.
44. **Código da proposta semi-automático** (*substitui* as decisões 8 e 18 no ponto "atribuído automaticamente"; o formato AA-CC-NNN continua). O ERP sugere o código e permite editar o código inteiro antes de salvar; bloqueia código repetido (inclusive de proposta excluída) ou fora do formato; avisa se o CC não for o do contato no ano. A sequência continua do maior número usado. **Validade da proposta em dias**, com a data calculada a partir da emissão.

## Implementado conforme recomendação do planejamento (20/10/2026), aguardando confirmação do Gabriel

Estas regras seguem as recomendações do `PLANEJAMENTO_VENDAS.md` (itens 4.8 e 4.9), porque o Gabriel pediu para seguir. Ficam valendo até ele confirmar ou mudar:

- **Kick-off:** só depois da aprovação; uma reunião por versão; checklist por setor (Engenharia, Compras, Fabricação, Montagem em campo, Logística, RH e Segurança, Financeiro, Prazos) com Sim/Não/A definir, responsável, prazo e observação; condições de medição e faturamento (marcos); para finalizar, nenhum item pode ficar "A definir"; finalizado fica só leitura; mudança gera nova versão. O checklist inicial foi escrito a partir do Documento Mestre 8.10 e pode ser editado.
- **Exclusão de proposta:** sempre lógica e com justificativa; rascunho nunca enviado pede só a permissão "excluir"; proposta já enviada pede também a senha "Excluir Proposta" (Administração → Senhas); aprovada ou com projeto de Engenharia não pode ser excluída; 5 senhas erradas em 15 minutos bloqueiam; código não é reaproveitado; a Administração pode restaurar.
- **COD_MAT:** é o código do material da biblioteca do SolidWorks (ex.: IN-001 = AISI 304). Catálogo inicial de 124 materiais carregado da lista que estava no material de referência (biblioteca "Materiais_Fabriaco(2).sldmat"). Confirmar se é a versão atual.

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
- [ ] Política exata de exclusão de propostas: implementada pela recomendação (ver seção acima); falta confirmação.
- [ ] Unicidade do código comercial do contato (CC). *Parcial:* decisões 8 e 9. Atribuição decidida (decisão 18). Falta: lista das propostas de 2026 já emitidas, para continuar o NNN de cada contato.
- [ ] Ligação com o Financeiro. *Parcial:* decisão 12. Falta definir que dados o Financeiro informa em cada etapa (nº da NF, data do pagamento etc.).
- [ ] Critérios de retorno de etapa (ex.: voltar de Enviados para À enviar cria revisão).
- [ ] Onde fica a pasta do código (dentro ou fora do OneDrive) e qual conta do GitHub usar.
- [ ] SolidWorks: arquivo JSON real exportado pela macro atual, para construir a importação da árvore.
- [ ] E-mail pelo Outlook web (Microsoft 365): exige registrar um aplicativo no Azure da empresa.

As demais perguntas marcadas [DECIDIR] no `docs/PLANEJAMENTO_VENDAS.md` continuam abertas até o Gabriel responder ou aprovar as recomendações.
