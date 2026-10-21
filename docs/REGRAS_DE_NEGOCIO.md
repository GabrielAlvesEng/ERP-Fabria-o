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
45. **Publicação pelo GitHub Pages mantida (20/10/2026)** (*complementa* a decisão 37, que continua valendo para o Netlify). O Gabriel decidiu manter o workflow `.github/workflows/pages.yml`, que publica o ERP em `https://gabrielalveseng.github.io/ERP-Fabria-o/` a cada push na `main`. Só funciona depois de criar as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (somente a chave pública) no GitHub e incluir esse endereço nas URLs de redirecionamento do Supabase. Pushes na `main-qauvme` não publicam.
46. **Material só pelo nome na aba Custos (20/10/2026)** (*ajusta* a decisão 41 na exibição): a coluna Material mostra o nome (ex.: "AISI 304"), sem o COD_MAT; o código continua guardado por trás e continua aparecendo na Engenharia. Rótulos: Chapas "Preço por peso", Perfis "Preço por metro". Demais pedidos da mesma data (Kanban com 4 colunas, Predefinições, Biblioteca de Materiais, Viagem, Frete terceirizado, logo) estão em `docs/PLANEJAMENTO_PREDEFINICOES_E_BIBLIOTECA.md`, aguardando aprovação.

## Decisões do Gabriel (20/10/2026, segunda rodada: Predefinições e Biblioteca de Materiais)

O Gabriel pediu para executar as mudanças de `docs/PLANEJAMENTO_PREDEFINICOES_E_BIBLIOTECA.md` ("vc consegue fazer essas mudanças e dar um deploy automático no github?"). As perguntas 1 a 7 do planejamento não foram respondidas uma a uma: **foram implementadas as recomendações** e ficam valendo até ele confirmar ou mudar.

47. **Kanban com 4 colunas: À enviar, Enviados, Aprovado, Reprovado** (*substitui* as colunas Finalizado, Emitido NF e Pago no Kanban; a decisão 12 continua: só o Financeiro move essas etapas). Propostas em Finalizado, Emitido NF ou Pago aparecem na coluna Aprovado com selo ("Finalizado", "NF emitida", "Pago"); o Financeiro muda a etapa pelos botões do detalhe da proposta. O Dashboard continua contando todas as etapas.
48. **Biblioteca de Materiais** (Administração → Predefinições → Materiais), base única para Vendas e, depois, Engenharia e Compras (*substitui* a lista de preços `ref_materiais`, que fica guardada só para consulta). Chapas: material, tipo, espessura (mm ou polegada), largura, comprimento, peso automático (espessura × largura × comprimento × densidade) só para Chapa Lisa e digitado para xadrez, expandida, perfurada e tela; valor/kg herdado de uma tabela por material + tipo, podendo ter valor próprio; valor total = peso × valor/kg. Perfis: material, tipo, tamanho e parede conforme o tipo (mm, SCH ou sem parede nos maciços), kg/m automático por fórmula (tubos, barras, cantoneiras, U e H; tubo SCH pelas paredes ASME B36.10/B36.19) ou pela base de pesos (W, I e U laminados, em aço carbono, corrigida pela densidade), escolha entre valor/m e valor/kg. Itens comerciais, fixadores e consumíveis: descrição, material opcional, unidade e valor. Densidade de cada material no catálogo (inox austenítico 8,00 e carbono 7,85, como a calculadora antiga). Carga inicial: 168 comerciais, 347 perfis lidos pelo nome e 9 preços de chapa; 1 item ("Policarbonato Compacto") ficou em "A revisar".
49. **Predefinições:** Fornecedores com serviços (unidade de cobrança hora, kg, m², metro ou peça, e valor); Mão de obra em Administrativo, Fabricação e Instalação; Maquinário só com máquinas próprias. As máquinas que eram terceirizadas (dois lasers e dobradeira) viraram serviços por hora do fornecedor "A definir" — **o Gabriel ainda precisa informar o fornecedor real**. Comercial lê; só a Administração grava (RLS).
50. **Custos reorganizados** (*substitui* a ordem e as seções da decisão 42): A Materiais (Chapas, Perfis, Comerciais, Fixadores, Consumíveis), B Acabamentos, C **Frete terceirizado**, D Mão de obra, E Máquinas (Terceirizada "Sim" escolhe o serviço por hora de um fornecedor e mostra o fornecedor; "Não" escolhe no Maquinário), F **Viagem** (Veículo próprio, **Veículo alugado**, Alimentação, Hospedagem; o frete terceirizado saiu da antiga Frota). Veículo alugado: diárias × valor da diária + km total ÷ km/l × R$/l + pedágio total. Escolher um item da biblioteca preenche peso/kg, preço e material e guarda a ligação (`bib_id`). Rascunhos convertidos sem mudar valores; revisões enviadas ficam como foram enviadas; nova revisão feita a partir de uma revisão antiga é convertida automaticamente.
51. **Redesign, etapa 1** (`docs/PLANEJAMENTO_REDESIGN.md`, aprovada com "aplique a estilização nova conforme alinhamos"; *substitui* o visual de abas de navegador da decisão 24, a organização em abas continua): roxo da marca #410FA0, grafite #0E0E10 no tema escuro, fonte Geist, sidebar clara, topbar fina, abas com linha roxa que quebram de linha, botões com variantes e tamanhos. **Marca provisória** (símbolo "F" no roxo, favicon e ícones de celular) até chegarem os arquivos da Logo Moderna.

52. **Redesign, etapas 2 a 4 (21/10/2026)** (liberadas com "pode seguir"; só aparência, sem mudar dados, regras ou rotas): Dashboard com rosca de "Propostas por etapa" agrupada pelas **4 colunas do Kanban** (Finalizado, NF emitida e Pago contam em Aprovado, com o detalhe embaixo), cores de gráfico de uma paleta validada para daltonismo no claro e no escuro, tabela ao lado com quantidade, % e valor, cartões com contagem animada e estado "Tudo em dia"; Empresas, Contatos, Propostas, Engenharia e Administração com as cores do tema (superfície, borda, texto suave), Kanban com cartões que sobem levemente ao passar o mouse, e todas as abas internas (proposta, item de custo, projeto) no padrão de linha roxa.

53. **Biblioteca de Materiais na Engenharia (21/10/2026)** (`docs/PLANEJAMENTO_BIBLIOTECA_ENGENHARIA.md`, aprovado com todas as recomendações): cada peça pode apontar para um item da biblioteca; o ERP **sugere** (chapa do mesmo material e espessura, perfil lido da descrição do CAD, comercial/fixador pela descrição) e a **Engenharia confirma**. Peso do CAD continua valendo; nos perfis o ERP calcula o peso pela biblioteca (kg/m × comprimento) e avisa quando a diferença passa de **5%**. Custo estimado: chapas peso × valor/kg (da chapa ou do material + Chapa Lisa), perfis comprimento × valor/m, comerciais valor do item. Resumo para compra: chapas em kg e chapas inteiras pela chapa padrão do material e espessura (1250 × 3000, ou a maior cadastrada), perfis em metros e **barras de 6 m**, comerciais somados. Mostra o custo de materiais da proposta aprovada ao lado do custo estimado do projeto (só leitura).
54. **Migrations aprovadas de antemão (21/10/2026):** o Gabriel disse "eu aprovo todas as migrations a partir daqui, não me pergunte mais". As migrations do projeto "ERP Fabriaço" passam a ser aplicadas sem pedir confirmação, seguindo as mesmas regras de sempre (testadas antes em transação desfeita quando mexem em dados, pequenas e ordenadas, sem editar migration já aplicada, sem apagar dados, registradas no CHANGELOG). Não vale para apagar dados, tabelas, usuários ou arquivos, nem para reset, que continuam pedindo confirmação no momento (CLAUDE.md).

55. **Frota completa e ida e volta (21/10/2026)** (`docs/PLANEJAMENTO_FROTA_E_ROTAS.md`, respostas do Gabriel: "QualP API", "sempre gasolina", campos "sim", "apenas 3 fotos no máximo"; *amplia* a decisão 42 e a parte de veículos da decisão 50):
    - Preço de **gasolina, etanol e diesel** em Administração → Frota, com histórico (cada mudança é uma linha nova, com data e autor). O preço único antigo virou o da gasolina.
    - Ficha do veículo: apelido, placa (única), tipo (carro, utilitário, caminhão, munck, outro), marca, modelo, ano, cor, RENAVAM, chassi, eixos (2 a 9), combustível (gasolina, etanol, diesel ou flex), consumo km/l, capacidade (kg) e passageiros, vencimento do licenciamento e do seguro, próxima revisão (km e data), situação (ativo, em manutenção, vendido/inativo) e observações. Só veículo **ativo** aparece nos custos. Nada é apagado.
    - **Até 3 fotos** por veículo (JPG, PNG ou WEBP, até 5 MB), em espaço privado do Storage; o limite vale também no banco.
    - **Flex calcula sempre com gasolina.** Escolher o veículo na seção Viagem preenche o km/l e o R$/l pelo combustível dele.
    - **Ida e volta** na linha de Veículo próprio e Veículo alugado: km e pedágio digitados são os da ida e contam 2 vezes (veículo próprio: viagens × (combustível + pedágio) × 2; alugado: diárias × diária + (combustível + pedágio) × 2).
    - **Cálculo automático da rota: API QualP** (escolha do Gabriel), por uma Edge Function do Supabase com a chave guardada como segredo `ROTAS_API_KEY`. **Aguarda o Gabriel contratar o plano e cadastrar a chave**; até lá, km e pedágio são digitados.
56. **Viagem mais organizada (21/10/2026)** (pedido do Gabriel; *ajusta* a decisão 55 na tela): no **Veículo próprio** não há mais colunas Km/l e R$/l — vêm do cadastro em Administração → Frota e aparecem em letra pequena embaixo do veículo; veículo digitado sem cadastro mostra aviso para escolher da lista. Colunas na ordem Veículo, Origem, Destino, Km (ida), Pedágio (ida), Viagens, Ida e volta. Veículo alugado (que não é cadastrado) continua com Km/l e R$/l, com Ida e volta no fim. Colunas de número com largura mínima: em tela estreita a tabela rola de lado em vez de cortar os valores. A fórmula não mudou.
57. **Logo oficial (21/10/2026)** (*substitui* a marca provisória da decisão 51): arquivos do Gabriel usados sem alteração no tema claro (`public/marca/fabriaco-simbolo.svg`, `fabriaco-letreiro.svg`, `fabriaco-logo-cor.svg`); no tema escuro, a versão do manual de identidade (roxo #8B63E7 e branco no lugar do preto). Menu lateral: símbolo + letreiro; topo do celular: símbolo; login: logo completa com "Montagens Industriais e Caldeiraria". **Favicon = `fabriaco-simbolo.svg`**, como pedido. Ícones do celular gerados do símbolo em fundo branco, como o ícone de aplicativo do manual.
58. **Fixadores em pastas (21/10/2026)** (`docs/PLANEJAMENTO_FIXADORES.md`; *substitui* a lista única de fixadores da decisão 48). Respostas do Gabriel: tem polegada; valor **por peça**; os 4 materiais só nos tipos que os têm. A pergunta 1 (grade inicial) voltou sem resposta, e foi seguida a recomendação.
    - Pastas **tipo → material → tamanhos**. Os 15 tipos seguem a ordem das pastas da empresa.
    - Materiais: Inox 304, Zincado, Bicromatizado e Preto, mais Alumínio e Aço mola.
    - Cada tipo tem as suas pastas de material, editáveis em "Tipo e materiais". Recomendação inicial, a confirmar:
      - anéis de trava: só Aço mola;
      - porca rebite: Inox 304, Zincado e Alumínio;
      - cupilha: Inox 304 e Zincado;
      - parabolt: Inox 304, Zincado e Bicromatizado;
      - demais tipos: os 4 materiais.
    - Descrição montada pelo banco: "Parafuso Allen Cab. Cilíndrica M8 x 20 Inox 304".
    - **Grade inicial sem preço**, 2.093 tamanhos:
      - parafusos M5 a M20, com comprimentos conforme o diâmetro, e polegada de 1/4" a 3/4" no sextavado e no Allen cilíndrico;
      - porcas e arruelas M5 a M24 e 1/4" a 1";
      - porca rebite M3 a M10, cupilhas, parabolt PBA e anéis de trava E e I;
      - Grampo Tipo U vazio, para cadastrar.
    - "Gerar vários" cria combinações de medidas × comprimentos. Tamanhos e pastas são desativados, nunca apagados.
    - Busca da proposta por palavras em qualquer ordem ("allen m8 inox").
59. **Celular com jeito de aplicativo (21/10/2026)** (pedido do Gabriel; *substitui*, no celular, os ícones de módulos no topo da decisão 51):
    - sem zoom (pinça, toque duplo e zoom automático ao tocar em campo);
    - **menu lateral** aberto pelo botão ☰, com a logo, os módulos, o e-mail e Sair; fecha ao escolher, ao tocar fora ou com Esc;
    - abas numa linha só, que rola de lado (no computador continuam quebrando linha);
    - margens menores dentro da caixa de conteúdo.
    - Correções de formatação: os cartões da Frota e o preço dos combustíveis passavam da largura da tela.
60. **Exclusão de projetos e Lixeira (21/10/2026)** (`docs/PLANEJAMENTO_LIXEIRA.md`; *substitui* "exclusão sempre lógica" e a lista "Propostas excluídas"):
    - Excluir projeto funciona como excluir proposta: justificativa obrigatória e, se o projeto tem peças ou conjuntos, a senha nova **"Excluir Projeto"**. A proposta continua aprovada.
    - Excluir (proposta ou projeto) **cancela**: o item sai das telas e vai para a **Lixeira** da Administração.
    - Na Lixeira: **Restaurar** ou **Excluir definitivamente**. A exclusão definitiva é só da Administração, com o código digitado e a senha do tipo.
    - Excluído definitivamente **some do site**, com tudo ligado a ele: revisões, custos, arquivos, histórico, kick-off; no projeto, conjuntos, peças e importações.
    - Depois de **30 dias** na Lixeira, a limpeza diária (03:17, horário de Brasília) apaga sozinha.
    - O código nunca é reaproveitado. A auditoria interna do banco continua registrando, como em toda alteração.
61. **Gerador de propostas (21/10/2026)** (`docs/PLANEJAMENTO_PROPOSTA_PDF.md`, aprovado; modelos "Novo Modelo de Proposta Técnica/Comercial" enviados pelo Gabriel):
    - Aba **Documentos** na proposta, com a proposta técnica (16 seções) e a comercial (11 seções) no visual dos modelos, cada uma com editor e prévia em A4.
    - O ERP preenche sozinho código, revisão, cliente, unidade, contato, datas, validade, dados das duas empresas e os **valores dos Custos**. Preço nunca é digitado no documento.
    - **Gerar e anexar PDF** guarda o arquivo na revisão (técnica ou comercial), com o nome `Proposta {código}-R{n} FABRIAÇO - {título} - Técnica/Comercial.pdf`. O arquivo vai junto no e-mail de envio. **Baixar PDF** só baixa.
    - Revisão enviada fica só leitura. A nova revisão começa com os textos da anterior.
    - **Administração → Modelos de proposta**: dados da Fabriaço e textos padrão (sobre nós, normas, responsabilidades, documentações, fora do escopo, gestão, garantia de 18 meses, prazo, validade, confidencialidade, frete CIF, impostos padrão, pagamento 21 DDL). Os padrões foram confirmados pelo Gabriel: dados da Fabriaço e impostos do modelo, capa com assunto na 1ª linha e equipamento na 2ª.
    - Textos por IA (OpenAI) e imagens na capa/escopo são as entregas 3 e 4.

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
- [x] ~~Arquivos da Logo Moderna (SVG)~~ recebidos e aplicados (decisão 57).
- [ ] Fornecedor real dos serviços de laser e dobra hoje em "A definir" (decisão 49).
- [ ] Confirmar as recomendações implementadas nas decisões 47 a 50 (etapa financeira pelo detalhe, veículo alugado, fornecedores com serviços, preço de chapa por material + tipo, base de pesos de mercado, campos de fixadores e consumíveis, migração da lista de preços).
- [ ] Contratar a API QualP e cadastrar a chave no Supabase (Edge Functions → Secrets, nome `ROTAS_API_KEY`) para liberar o botão "Calcular rota" (decisão 55).
- [ ] Fixadores: conferir as pastas de material de porca rebite, cupilha, parabolt e anéis de trava, e a grade inicial de tamanhos (decisão 58).
- [ ] Conferir a base de pesos de I e U laminados e preencher o kg/m das 18 vigas W/I/U da lista antiga que vieram sem peso.

As demais perguntas marcadas [DECIDIR] no `docs/PLANEJAMENTO_VENDAS.md` continuam abertas até o Gabriel responder ou aprovar as recomendações.
