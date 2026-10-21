// Gerador de propostas (decisão 61): estrutura dos documentos técnico e comercial e textos padrão,
// tirados dos modelos "Novo Modelo de Proposta Técnica/Comercial" (26-01-019, Symrise).
// Nos textos: parágrafos separados por linha em branco, linhas com "- " viram lista e **assim** fica em negrito.
// {cliente}, {local} e {validade_dias} são trocados pelos dados da proposta.

export type TipoDocumento = 'tecnica' | 'comercial';
export type Marca3 = 'Sim' | 'Não' | 'N/A';

export interface Cartao { titulo: string; texto: string }
export interface LinhaMatriz { texto: string; cliente: boolean; fabriaco: boolean }

export type Secao = { id: string; titulo: string; ativo: boolean } & (
  | { tipo: 'texto'; texto: string; dica?: string }
  | { tipo: 'cartoes'; intro: string; cartoes: Cartao[]; fecho: string; marcador: 'numero' | 'letra'; destaque?: string; dica?: string }
  | { tipo: 'dados_empresas' }
  | { tipo: 'competencias'; itens: { nome: string; valor: Marca3 }[] }
  | { tipo: 'matriz'; itens: LinhaMatriz[] }
  | { tipo: 'impostos'; intro: string; ncm: string; linhas: { tributo: string; valor: string }[] }
  | { tipo: 'valores'; intro: string; descricoes: Record<string, string> }
  | { tipo: 'pagamento'; condicao: string; marco: string; forma: string; texto: string }
);
export type TipoSecao = Secao['tipo'];

export interface Documento {
  tipo: TipoDocumento;
  capa: { linha1: string; linha2: string; subtitulo: string };
  visao: { objeto: string; solucao: string; unidade: string }; // técnica: cartões do "Visão do documento"
  abertura: string; // comercial: parágrafo do "Olá, {contato}"
  explicacao?: string; // o que o vendedor escreveu para a IA (não sai no PDF)
  secoes: Secao[];
}

export interface DadosEmpresaFabriaco {
  razao_social: string; cnpj: string; ie: string; endereco: string; bairro: string; cep_cidade: string;
  responsavel: string; telefone: string; email: string; site: string; cidade: string;
}

export const EMPRESA_PADRAO: DadosEmpresaFabriaco = {
  razao_social: 'Fabriaço Montagem Industrial LTDA', cnpj: '39.433.848/0001-40', ie: '453.114.885.111',
  endereco: 'R. Paraná, 731', bairro: 'Vila Santa Rosa', cep_cidade: '13731-160 / Mococa-SP',
  responsavel: 'Gabriel Alves', telefone: '+55 (19) 98901-0359', email: 'gabriel.alves@fabriacobrasil.com.br',
  site: 'www.fabriacobrasil.com.br', cidade: 'Mococa · São Paulo',
};

const FORA_DO_ESCOPO = `A presente proposta contempla exclusivamente os fornecimentos e serviços descritos na proposta técnica, não estando inclusos os seguintes itens:

- **Obras Civis e Adequações Estruturais:** Execução de obras civis, reformas, reforços estruturais ou modificações nas instalações existentes que não estejam diretamente relacionadas ao escopo contratado.
- **Instalações Elétricas e Automação:** Fornecimento, instalação ou adequação de sistemas elétricos, painéis de comando, sensores, instrumentação e componentes de automação.
- **Rede de Ar Comprimido:** Fornecimento de compressores, tubulações de alimentação, filtros, reguladores de pressão e demais componentes da rede pneumática.
- **Modificações Adicionais no Equipamento:** Substituição ou adequação de componentes do equipamento não previstos na proposta técnica.
- **Equipamentos Especiais de Acesso:** Fornecimento ou locação de plataformas elevatórias (PTA), andaimes, guindastes e equipamentos especiais de movimentação, quando necessários.
- **Testes e Validações de Processo:** Ensaios laboratoriais, certificações, análises de qualidade do produto e validações específicas do processo produtivo, além dos testes funcionais previstos no escopo.
- **Descarte e Limpeza Industrial:** Transporte e destinação final dos componentes removidos, resíduos industriais e serviços de limpeza fina ou higienização especializada do equipamento.
- **Serviços e Fornecimentos Adicionais:** Alterações de projeto após aprovação, modificações não previstas, fornecimento de materiais complementares e quaisquer atividades não expressamente descritas no escopo contratado.`;

const GARANTIA = `A Fabriaço oferece garantia de **18 meses (1 ano e meio)** contados a partir da data de emissão da Nota Fiscal de entrega dos equipamentos, cobrindo defeitos de fabricação, materiais e mão de obra empregada na execução dos serviços contratados.

A garantia é válida exclusivamente para os equipamentos fornecidos e instalados conforme especificações do projeto e condições normais de operação. Não se aplica a falhas decorrentes de:

- Mau uso ou operação incorreta;
- Alterações não autorizadas nas especificações ou estruturas;
- Armazenamento ou instalação em condições inadequadas;
- Desgaste natural, negligência, imprudência ou imperícia durante a operação.

A assistência técnica em garantia será prestada mediante avaliação técnica e, se constatado defeito coberto, a Fabriaço realizará os reparos ou substituições necessárias sem custos adicionais, respeitando os prazos e condições acordadas.`;

const PRAZO = `O prazo para fabricação, fornecimento e instalação será definido em comum acordo com a {cliente} – {local}, considerando as necessidades operacionais da unidade industrial e a disponibilidade do equipamento para intervenção.

O cronograma de execução será estabelecido após a aprovação formal da proposta comercial e liberação para início dos serviços, contemplando as etapas de engenharia, aquisição de materiais, fabricação, montagem, instalação e testes funcionais.

A Fabriaço Brasil – Montagens Industriais e Caldeiraria realizará o planejamento das atividades de forma a atender aos prazos acordados, buscando minimizar as interferências no processo produtivo da contratante e garantir a qualidade dos serviços executados.`;

const VALIDADE = `Esta proposta técnica e comercial tem validade de **{validade_dias} dias corridos** a contar da data de sua emissão.

Após este prazo, os valores e prazos apresentados poderão ser revistos, considerando possíveis variações nos custos de matéria-prima, disponibilidade de materiais e condições de mercado.

A confirmação do pedido deverá ser feita por meio de emissão de ordem de compra, acompanhada da aprovação técnica do projeto executivo para início das atividades.`;

const CONFIDENCIALIDADE = `Todas as informações técnicas, comerciais, desenhos, modelos, especificações, cálculos, imagens, documentos e demais dados contidos nesta proposta são de propriedade exclusiva da FABRIAÇO Montagens Industriais e Caldeiraria, sendo consideradas informações confidenciais e de uso restrito às partes envolvidas neste processo de fornecimento.

Este documento foi elaborado exclusivamente para fins de análise técnica e comercial por parte da {cliente}, não podendo ser reproduzido, compartilhado, divulgado ou utilizado para quaisquer outros fins sem a prévia autorização formal e por escrito da FABRIAÇO.

Os conceitos, soluções construtivas, detalhamentos técnicos, metodologias de fabricação e demais informações apresentadas nesta proposta constituem propriedade intelectual da FABRIAÇO, permanecendo protegidos pelas legislações aplicáveis de direitos autorais, sigilo comercial e propriedade intelectual.

O descumprimento destas condições poderá acarretar as medidas administrativas e legais cabíveis, conforme previsto na legislação vigente.`;

const SOBRE_NOS = `A Fabriaço Montagens Industriais e Caldeiraria é uma empresa especializada em projetos, fabricação e montagem de equipamentos e estruturas metálicas voltados para o setor industrial, com foco em soluções técnicas personalizadas, seguras e eficientes.

Localizada em Mococa – SP, a Fabriaço conta com uma estrutura fabril completa, equipe técnica qualificada e experiência consolidada em atender indústrias dos segmentos alimentício, químico, farmacêutico, papel e celulose, entre outros.

Nosso diferencial está na capacidade de entregar soluções integradas, unindo engenharia, fabricação, montagem e documentação técnica em um único fluxo coordenado de trabalho. Atuamos com responsabilidade, agilidade e foco no resultado, sempre alinhados às normas técnicas e às necessidades específicas de cada cliente.

Nossos principais serviços incluem:

- Projetos e fabricação de tanques industriais e vasos de pressão;
- Montagem de estruturas metálicas e tubulações industriais;
- Caldeiraria leve e pesada sob medida;
- Instalação de sistemas e equipamentos em plantas industriais;
- Elaboração de memoriais, ARTs, cronogramas e documentações.

Com compromisso com a qualidade e a segurança, a Fabriaço é reconhecida por sua seriedade, capacidade técnica e confiabilidade na execução de projetos industriais de pequeno, médio e grande porte.`;

const NORMAS = `Para a execução dos serviços de fabricação e instalação, serão consideradas as seguintes normas e referências técnicas, conforme aplicabilidade:

- NR-12 – Segurança no Trabalho em Máquinas e Equipamentos: Requisitos de segurança aplicáveis às intervenções, montagem e manutenção de equipamentos industriais.
- ABNT NBR ISO 12100 – Segurança de Máquinas: Princípios gerais de projeto, apreciação e redução de riscos.
- ASTM A240/A240M – Aços Inoxidáveis: Especificações técnicas aplicáveis às chapas de aço inoxidável utilizadas na fabricação.

Boas Práticas de Fabricação (BPF): Critérios de fabricação, acabamento superficial e higienização adequados aos equipamentos empregados na indústria de processamento de produtos alimentícios.

Desenhos e Especificações Técnicas do Projeto: Utilização dos modelos tridimensionais, desenhos de fabricação e informações dimensionais do conjunto para garantir a compatibilidade com o equipamento existente.

Procedimentos Internos da {cliente}: Atendimento às exigências de segurança, qualidade, higiene e liberação de serviços estabelecidas pela unidade industrial de {local}.`;

const COMPETENCIAS: { nome: string; valor: Marca3 }[] = ['Mecânica', 'Civil', 'Automação', 'Elétrica', 'Pneumática', 'Instalação', 'Adequação']
  .map((nome) => ({ nome, valor: 'N/A' as Marca3 }));

const RESP_FABRIACO = ['Materiais', 'Consumíveis', 'Mão de obra qualificada',
  'Equipamentos e ferramentas para transformação dos materiais (Laser, Plasma, Dobradeira, Calandra, Furadeira, Lixadeira, Torno etc.)',
  'Equipamentos de segurança dos profissionais', 'Despesas de refeições, hospedagem e transporte dos profissionais',
  'Limpeza da área após execução dos serviços', 'Responsável pela sinalização de segurança da área de trabalho',
  'Responsável por análise de riscos e elaboração de APRs', 'Carregamento para transporte', 'Descarregamento do transporte', 'Transporte / Seguro'];
const RESP_CLIENTE = ['Equipamentos de aluguel (Gerador de energia, Andaime Industrial, Guindaste, PTA etc.)',
  'Emissão e controle de documentos de acesso à planta (credenciamento, crachás etc.)', 'Permissões e licenças p/ execução dos trabalhos, se necessário',
  'Liberações e agendamentos de parada de setores, se necessário', 'Aberturas das PT e verificação de todas as assinaturas dos responsáveis, se necessário',
  'Ponto de energia (necessita na instalação)', 'Água potável (necessita na instalação)', 'Banheiro (necessita na instalação)'];
const RESPONSABILIDADES: LinhaMatriz[] = [
  ...RESP_FABRIACO.map((texto) => ({ texto, cliente: false, fabriaco: true })),
  ...RESP_CLIENTE.map((texto) => ({ texto, cliente: true, fabriaco: false })),
];
const DOCUMENTACOES: LinhaMatriz[] = [
  { texto: 'Pedido de compras', cliente: true, fabriaco: false },
  ...['Cronograma detalhado de fabricação e instalação', 'Projeto Técnico', 'Lista de Materiais', 'Memorial de cálculo', 'Laudo Técnico',
    'ART (Anotação de Responsabilidade Técnica)', 'Databook', 'As built', 'Manual de Operação', 'Plano de rigging',
    'Treinamentos obrigatórios (NR-10, NR-12, NR-35 etc.)', 'APRs (Análise Preliminar de Riscos)', 'PCMSO e ASO atualizados dos colaboradores',
    'PT (Permissão de Trabalho) preenchida e assinada', 'PIT – Plano de Inspeção e Testes de Fabricação conforme normas vigentes.',
    'PP – Plano Detalhado de Pintura.', 'Histograma de instalação', 'Procedimento de Soldagem, EPS, RQPS, CQP',
    'Certificados dos Materiais Utilizados na Fabricação', 'Relatório de Controle de Qualidade durante toda a fabricação',
    'Toda a documentação conforme requisitos NR13', 'Ficha de EPI', 'Relatório Diário das atividades', 'Nota Fiscal',
  ].map((texto) => ({ texto, cliente: false, fabriaco: true })),
];

const GESTAO: Cartao[] = [
  { titulo: 'Engenharia e planejamento', texto: 'Responsável pela análise técnica do equipamento existente, desenvolvimento dos desenhos de fabricação, definição dos materiais e componentes, além do planejamento das etapas de execução.' },
  { titulo: 'PCP – Planejamento e controle da produção', texto: 'Responsável pela programação das atividades de fabricação, aquisição e controle dos materiais, acompanhamento dos processos produtivos e cumprimento dos prazos estabelecidos, garantindo a integração entre as etapas do projeto.' },
  { titulo: 'Fabricação e controle de qualidade', texto: 'Responsável pela execução dos processos de corte, usinagem, soldagem, montagem e acabamento dos componentes, incluindo inspeções dimensionais e verificações de qualidade, conforme os desenhos técnicos e especificações do projeto.' },
  { titulo: 'Instalação e acompanhamento técnico', texto: 'Responsável pela coordenação das atividades de desmontagem e instalação, integração dos componentes e realização dos ajustes necessários, respeitando os procedimentos de segurança e as condições operacionais da unidade industrial.' },
  { titulo: 'Inspeção final e entrega técnica', texto: 'Responsável pela verificação das condições de montagem, realização dos testes funcionais previstos e acompanhamento da entrega técnica do conjunto, assegurando que os serviços executados estejam em conformidade com o escopo contratado.' },
];

const FRETE: Cartao[] = [
  { titulo: 'Transporte e entrega dos materiais', texto: 'O transporte dos materiais, componentes e do conjunto fabricado será realizado sob responsabilidade da Fabriaço Brasil, com entrega diretamente na unidade da contratante, na modalidade CIF (frete incluso).' },
  { titulo: 'Mobilização de equipe e ferramentas', texto: 'Estão inclusos os deslocamentos da equipe técnica, ferramentas e equipamentos convencionais necessários à execução dos serviços.' },
  { titulo: 'Programação e acesso à unidade', texto: 'As atividades de entrega e instalação serão previamente alinhadas com a {cliente}, respeitando os horários disponíveis, procedimentos internos de segurança e condições de acesso às instalações industriais.' },
  { titulo: 'Movimentação e instalação', texto: 'A movimentação e o posicionamento dos componentes serão realizados conforme as condições de acesso e montagem existentes, utilizando os recursos previstos no escopo contratado.' },
];

const IMPOSTOS = [
  { tributo: 'ICMS', valor: '8,8%' }, { tributo: 'IPI', valor: '0%' }, { tributo: 'PIS', valor: '0,65% — incluso' },
  { tributo: 'COFINS', valor: '3,0% — incluso' }, { tributo: 'CSLL', valor: '1,08% — incluso' }, { tributo: 'IRPJ', valor: '1,20% — incluso' },
];

const VALORES_INTRO = `A presente proposta comercial apresenta os valores correspondentes ao fornecimento de materiais, fabricação e instalação, conforme as especificações e condições estabelecidas na proposta técnica.

Os valores apresentados contemplam os custos de engenharia, aquisição de materiais e componentes, processos de fabricação, montagem, instalação, testes funcionais, mão de obra especializada, transporte e logística necessários à execução dos serviços.

A seguir, apresenta-se a relação dos itens que compõem o fornecimento, com suas respectivas descrições e valores comerciais.`;

const texto = (id: string, titulo: string, t: string, dica?: string): Secao => ({ id, titulo, ativo: true, tipo: 'texto', texto: t, dica });

export function documentoPadrao(tipo: TipoDocumento): Documento {
  const capa = { linha1: '', linha2: '', subtitulo: '' };
  if (tipo === 'tecnica') {
    return {
      tipo, capa, visao: { objeto: '', solucao: '', unidade: '' }, abertura: '',
      secoes: [
        texto('sobre', 'Sobre nós', SOBRE_NOS),
        { id: 'dados', titulo: 'Dados da Empresa', ativo: true, tipo: 'dados_empresas' },
        texto('objetivo', 'Objetivo', '', 'O que será fornecido, para quem e com qual finalidade.'),
        texto('aplicacao', 'Aplicação', '', 'Onde e como a solução será aplicada, com a lista de benefícios.'),
        texto('normas', 'Referência e Normas', NORMAS),
        { id: 'competencias', titulo: 'Competências', ativo: true, tipo: 'competencias', itens: COMPETENCIAS },
        { id: 'responsabilidades', titulo: 'Responsabilidades', ativo: true, tipo: 'matriz', itens: RESPONSABILIDADES },
        { id: 'documentacoes', titulo: 'Documentações', ativo: true, tipo: 'matriz', itens: DOCUMENTACOES },
        { id: 'escopo', titulo: 'Escopo', ativo: true, tipo: 'cartoes', marcador: 'numero', cartoes: [], fecho: '',
          intro: 'A presente proposta contempla o fornecimento de materiais, fabricação e instalação, conforme descrito a seguir:', dica: 'Etapas do serviço, uma por cartão.' },
        texto('fora', 'Fora do Escopo', FORA_DO_ESCOPO),
        { id: 'gestao', titulo: 'Gestão do Projeto', ativo: true, tipo: 'cartoes', marcador: 'letra', cartoes: GESTAO,
          intro: 'A gestão do projeto será realizada pela Fabriaço Brasil – Montagens Industriais e Caldeiraria, contemplando o planejamento, acompanhamento e controle das atividades necessárias, garantindo o atendimento aos requisitos técnicos, de qualidade e segurança estabelecidos pela {cliente}.',
          fecho: 'Todas as etapas serão acompanhadas pela equipe técnica da Fabriaço Brasil, mantendo comunicação com os responsáveis da {cliente} para alinhamento das atividades, programação das intervenções e atendimento às necessidades operacionais da unidade.' },
        texto('garantia', 'Garantia', GARANTIA),
        texto('prazo', 'Prazo de Entrega', PRAZO),
        texto('validade', 'Validade da Proposta', VALIDADE),
        texto('confidencialidade', 'Termo de Confidencialidade', CONFIDENCIALIDADE),
        texto('anexo', 'Anexo', 'Não contém.'),
      ],
    };
  }
  return {
    tipo, capa, visao: { objeto: '', solucao: '', unidade: '' },
    abertura: 'Apresentamos as condições comerciais para o fornecimento descrito nesta proposta. O detalhamento técnico da solução consta na proposta técnica correspondente.',
    secoes: [
      texto('objetivo', 'Objetivo', '', 'O que será fornecido, para quem e com qual finalidade.'),
      texto('fora', 'Fora do Escopo', FORA_DO_ESCOPO),
      { id: 'frete', titulo: 'Frete e Logística', ativo: true, tipo: 'cartoes', marcador: 'letra', cartoes: FRETE, intro: '', fecho: '',
        destaque: '**Destino: {cliente} — {local}.** A Fabriaço será responsável pela organização e execução da logística necessária ao fornecimento e à instalação.' },
      texto('garantia', 'Garantia', GARANTIA),
      { id: 'impostos', titulo: 'Impostos (Inclusos)', ativo: true, tipo: 'impostos', ncm: '', linhas: IMPOSTOS,
        intro: 'Nota fiscal de venda. As alíquotas abaixo deverão ser confirmadas antes da emissão definitiva.' },
      texto('prazo', 'Prazo de Entrega', PRAZO),
      { id: 'valores', titulo: 'Valores', ativo: true, tipo: 'valores', intro: VALORES_INTRO, descricoes: {} },
      { id: 'pagamento', titulo: 'Forma de Pagamento', ativo: true, tipo: 'pagamento', condicao: '21 dias (21 DDL)', marco: 'Emissão da Nota Fiscal', forma: 'Depósito / transferência',
        texto: '- Pagamento em 21 (vinte e um) dias após a emissão da Nota Fiscal, contados a partir da data de faturamento do fornecimento ou da etapa concluída (quando aplicável).\n\nTodos os valores deverão ser pagos via depósito bancário ou transferência eletrônica, mediante apresentação de nota fiscal e documentação de entrega assinada pelo responsável técnico da {cliente}.' },
      texto('validade', 'Validade da Proposta', VALIDADE),
      texto('confidencialidade', 'Termo de Confidencialidade', CONFIDENCIALIDADE),
      texto('anexo', 'Anexo', 'Não contém.'),
    ],
  };
}

// Documento salvo pode ser de uma versão anterior do modelo: completa campos e seções que faltam, sem mexer no que existe.
export function completarDocumento(doc: Partial<Documento> | null | undefined, tipo: TipoDocumento): Documento {
  const base = documentoPadrao(tipo);
  if (!doc) return base;
  const secoes = Array.isArray(doc.secoes) && doc.secoes.length ? doc.secoes : base.secoes;
  return { ...base, ...doc, tipo, capa: { ...base.capa, ...doc.capa }, visao: { ...base.visao, ...doc.visao }, secoes };
}

// Texto simples → blocos para a prévia e o PDF.
export type Trecho = { texto: string; negrito: boolean };
export type Bloco = { tipo: 'p'; trechos: Trecho[] } | { tipo: 'lista'; itens: Trecho[][] };

export function trechos(linha: string): Trecho[] {
  const partes = linha.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return partes.map((p) => (p.startsWith('**') && p.endsWith('**') && p.length > 4 ? { texto: p.slice(2, -2), negrito: true } : { texto: p, negrito: false }));
}

export function blocos(texto: string): Bloco[] {
  const saida: Bloco[] = [];
  for (const paragrafo of texto.replace(/\r/g, '').split(/\n\s*\n/)) {
    const linhas = paragrafo.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!linhas.length) continue;
    let texto: string[] = [];
    let lista: Trecho[][] = [];
    const fecharTexto = () => { if (texto.length) saida.push({ tipo: 'p', trechos: trechos(texto.join(' ')) }); texto = []; };
    const fecharLista = () => { if (lista.length) saida.push({ tipo: 'lista', itens: lista }); lista = []; };
    for (const l of linhas) {
      if (/^[-•]\s+/.test(l)) { fecharTexto(); lista.push(trechos(l.replace(/^[-•]\s+/, ''))); } else { fecharLista(); texto.push(l); }
    }
    fecharTexto(); fecharLista();
  }
  return saida;
}

export interface Variaveis { cliente: string; local: string; validade_dias: string }
export const substituir = (t: string, v: Variaveis) =>
  t.replace(/\{(cliente|local|validade_dias)\}/g, (_, k: keyof Variaveis) => v[k] || `{${k}}`);

// Numeração das seções ativas: 01, 02… (como nos modelos).
export const numerar = (secoes: Secao[]) => secoes.filter((s) => s.ativo).map((s, i) => ({ secao: s, numero: String(i + 1).padStart(2, '0') }));
export const marcadorCartao = (marcador: 'numero' | 'letra', i: number) => (marcador === 'letra' ? String.fromCharCode(65 + i) : String(i + 1).padStart(2, '0'));

// Nome do arquivo gerado: "Proposta 26-01-019-R0 FABRIAÇO - Título - Técnica.pdf".
export function nomeArquivo(codigo: string, revisao: number, titulo: string, tipo: TipoDocumento): string {
  const limpo = titulo.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  return `Proposta ${codigo}-R${revisao} FABRIAÇO - ${limpo} - ${tipo === 'tecnica' ? 'Técnica' : 'Comercial'}.pdf`;
}

// Resposta da IA (Edge Function gerar-textos-proposta) encaixada nas seções. Preços nunca vêm daqui.
export interface TextosIA {
  capa?: { linha1: string; linha2: string; subtitulo: string };
  visao?: { objeto: string; solucao: string };
  objetivo?: string; aplicacao?: string; normas?: string; fora_escopo?: string; abertura?: string; escopo_intro?: string;
  competencias?: Record<string, Marca3>;
  escopo?: Cartao[];
  descricoes?: { letra: string; texto: string }[];
}

export function aplicarTextosIA(doc: Documento, t: TextosIA): Documento {
  const secoes = doc.secoes.map((s): Secao => {
    if (s.tipo === 'texto') {
      const novo = ({ objetivo: t.objetivo, aplicacao: t.aplicacao, normas: t.normas, fora: t.fora_escopo } as Record<string, string | undefined>)[s.id];
      return novo?.trim() ? { ...s, texto: novo.trim() } : s;
    }
    if (s.tipo === 'competencias' && t.competencias) return { ...s, itens: s.itens.map((i) => ({ ...i, valor: t.competencias![i.nome] ?? i.valor })) };
    if (s.tipo === 'cartoes' && s.id === 'escopo' && t.escopo?.length) return { ...s, intro: t.escopo_intro?.trim() || s.intro, cartoes: t.escopo.filter((c) => c.titulo.trim()) };
    if (s.tipo === 'valores' && t.descricoes?.length) return { ...s, descricoes: { ...s.descricoes, ...Object.fromEntries(t.descricoes.map((d) => [d.letra, d.texto])) } };
    return s;
  });
  return {
    ...doc,
    capa: t.capa ? { ...doc.capa, ...t.capa } : doc.capa,
    visao: t.visao ? { ...doc.visao, ...t.visao } : doc.visao,
    abertura: t.abertura?.trim() || doc.abertura,
    secoes,
  };
}
