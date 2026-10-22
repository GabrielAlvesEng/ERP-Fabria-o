// Gerador de propostas (decisão 61; novo design na decisão 67): estrutura dos documentos técnico e comercial e textos padrão.
// Nos textos: parágrafos separados por linha em branco, linhas com "- " viram lista e **assim** fica em negrito.
// {cliente}, {local}, {validade_dias} e {codigo} são trocados pelos dados da proposta.

export type TipoDocumento = 'tecnica' | 'comercial';
export type Marca3 = 'Sim' | 'Não' | 'N/A' | ''; // '' = ainda não marcado (decisão 98)

export interface Cartao { titulo: string; texto: string; imagens?: Figura[] } // imagens: cards ao lado do item (Escopo)
export interface Figura { caminho: string; legenda: string }
export const MAX_IMAGENS_ITEM = 5; // imagens por item: mais que isso não cabe ao lado do card numa página
export interface LinhaMatriz { texto: string; cliente: boolean; fabriaco: boolean }
export interface GrupoResponsabilidade { area: string; itens: LinhaMatriz[] }
export interface Etapa { nome: string; dias: number }

export type Secao = { id: string; titulo: string; ativo: boolean; escolher?: boolean } & ( // escolher: o vendedor ainda não disse se entra (decisão 98)
  | { tipo: 'texto'; texto: string; dica?: string }
  | { tipo: 'cartoes'; intro: string; cartoes: Cartao[]; fecho: string; marcador: 'numero' | 'letra'; destaque?: string; dica?: string; figuras?: Figura[] }
  | { tipo: 'dados_empresas' }
  | { tipo: 'competencias'; itens: { nome: string; valor: Marca3 }[] }
  | { tipo: 'matriz'; itens: LinhaMatriz[] } // versão 3 (Responsabilidades e Documentações separadas)
  | { tipo: 'impostos'; intro: string; ncm: string; linhas: { tributo: string; valor: string }[] }
  | { tipo: 'valores'; intro: string; descricoes: Record<string, string> }
  | { tipo: 'pagamento'; condicao: string; marco: string; forma: string; texto: string }
  // Versão 4 (decisão 67)
  | { tipo: 'sobre' } // "Conheça a Fabriaço": conteúdo nos dados da empresa (Modelos de proposta)
  | { tipo: 'responsabilidades'; grupos: GrupoResponsabilidade[] }
  | { tipo: 'garantia'; meses: number } // só os meses mudam; o resto é fixo
  | { tipo: 'cronograma'; etapas: Etapa[]; inicio?: string } // dias contados a partir do "inicio" (decisão 70)
  | { tipo: 'validade' } // dias vêm da proposta
  | { tipo: 'confidencialidade' } // texto fixo, sem o nome do cliente
  | { tipo: 'visao_comercial'; frete: string; frete_detalhe: string }
);
export type TipoSecao = Secao['tipo'];

export const VERSAO_DOCUMENTO = 4;

export interface Documento {
  versao?: number;
  tipo: TipoDocumento;
  capa: { linha1: string; linha2: string; subtitulo: string; imagem?: string; fundo?: 'escuro' | 'claro' };
  visao: { objeto: string; solucao: string; unidade: string }; // técnica: cartões do "Visão do documento"
  abertura: string; // versão 3 da comercial; não sai mais no PDF
  explicacao?: string; // o que o vendedor escreveu para a IA (não sai no PDF)
  secoes: Secao[];
}

export interface SobreNos {
  titulo: string; subtitulo: string; texto: string; materiais: string;
  servicos: { titulo: string; texto: string }[]; maquinas: string; setores: string; lema: string;
}

export interface DadosEmpresaFabriaco {
  razao_social: string; cnpj: string; ie: string; endereco: string; bairro: string; cep_cidade: string;
  responsavel: string; telefone: string; email: string; site: string; cidade: string;
  sobre: SobreNos;
}

export const SOBRE_PADRAO: SobreNos = {
  titulo: 'Conheça a Fabriaço',
  subtitulo: 'Montagens industriais e caldeiraria',
  texto: 'A **Fabriaço Montagens Industriais e Caldeiraria**, em **Mococa - SP**, é especializada em projetos, fabricação e montagem de equipamentos e estruturas metálicas industriais.\n\nCom estrutura fabril completa e equipe técnica qualificada, integramos **engenharia, fabricação e montagem**, oferecendo soluções personalizadas, seguras e eficientes.',
  materiais: 'Aço inox e aço carbono',
  servicos: [
    { titulo: 'Tanques e vasos', texto: 'Projetos e fabricação de tanques industriais e vasos de pressão.' },
    { titulo: 'Estruturas e tubos', texto: 'Montagem de estruturas metálicas e tubulações industriais.' },
    { titulo: 'Caldeiraria', texto: 'Caldeiraria leve e pesada, desenvolvida sob medida.' },
    { titulo: 'Instalação', texto: 'Instalação de equipamentos e sistemas industriais.' },
    { titulo: 'Documentação', texto: 'Memoriais, ARTs e documentação técnica.' },
  ],
  maquinas: 'Laser • Dobra • Calandra • Guilhotina • Solda • Montagem • Acabamento',
  setores: 'Alimentício • Químico • Farmacêutico • Papel e celulose • Outros segmentos',
  lema: 'Qualidade / Segurança / Confiabilidade',
};

export const EMPRESA_PADRAO: DadosEmpresaFabriaco = {
  razao_social: 'Fabriaço Montagem Industrial LTDA', cnpj: '39.433.848/0001-40', ie: '453.114.885.111',
  endereco: 'R. Paraná, 731', bairro: 'Vila Santa Rosa', cep_cidade: '13731-160 / Mococa-SP',
  responsavel: 'Gabriel Alves', telefone: '+55 (19) 98901-0359', email: 'gabriel.alves@fabriacobrasil.com.br',
  site: 'www.fabriacobrasil.com.br', cidade: 'Mococa · São Paulo', sobre: SOBRE_PADRAO,
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

// Textos fixos da versão 4 (decisão 67): não se editam na proposta, para ficarem sempre iguais.
export const GARANTIA_COBRE = 'Defeitos de fabricação, dos materiais empregados e da mão de obra dos serviços executados pela Fabriaço.';
export const GARANTIA_NAO_SE_APLICA = [
  'Mau uso ou operação fora das condições de projeto',
  'Alterações não autorizadas no equipamento',
  'Armazenamento ou instalação inadequados por terceiros',
  'Desgaste natural, negligência ou imperícia na operação',
];
export const GARANTIA_ATENDIMENTO = 'Constatado o defeito coberto em avaliação técnica, a Fabriaço faz o reparo ou a substituição sem custo adicional.';
export const VALIDADE_CONDICOES = [
  'Após o prazo, valores e prazos podem ser revistos conforme custos de matéria-prima e condições de mercado.',
  'A confirmação do pedido é feita por ordem de compra, junto da aprovação técnica do projeto para início das atividades.',
];
export const CONFIDENCIALIDADE_TECNICA = `Este documento e todo o seu conteúdo (informações técnicas, desenhos, modelos, especificações, cálculos, imagens, metodologias e soluções construtivas) são de propriedade da Fabriaço Montagens Industriais e Caldeiraria e constituem informação confidencial.

O material foi preparado exclusivamente para a avaliação técnica do destinatário desta proposta. Não pode ser copiado, reproduzido, divulgado ou repassado a terceiros, nem utilizado para outros fins, sem autorização prévia e por escrito da Fabriaço.

As soluções e os detalhamentos aqui apresentados são propriedade intelectual da Fabriaço e estão protegidos pela legislação de direitos autorais e de propriedade industrial. O uso indevido sujeita o responsável às medidas legais cabíveis.`;
export const CONFIDENCIALIDADE_COMERCIAL = `Os valores, condições comerciais e prazos desta proposta foram elaborados exclusivamente para o destinatário e são **estritamente confidenciais**.

Este documento destina-se ao uso interno da empresa destinatária, pelas áreas envolvidas na análise e na aprovação da compra. Não deve ser compartilhado com outros fornecedores, prestadores de serviço ou terceiros, nem utilizado como referência em outras cotações.

Ao receber esta proposta, o destinatário concorda em preservar o sigilo das informações aqui contidas.`;
export const GARANTIA_MESES_PADRAO = 18;
// Decisão 70: de quando o prazo de entrega começa a contar, e os marcos de pagamento. "Outro" deixa digitar.
export const INICIOS_PRAZO = ['o recebimento do pedido de compra', 'a aprovação da proposta', 'a aprovação do projeto', 'o recebimento dos materiais', 'o pagamento do sinal', 'a liberação da área'];
export const INICIO_PRAZO_PADRAO = INICIOS_PRAZO[0];
// "o recebimento…" → "do recebimento…" (texto do PDF: "a partir do recebimento do pedido de compra").
export const aPartirDe = (inicio: string) => { const m = inicio.trim().match(/^(os|as|o|a) (.*)$/i); return m ? `d${m[1].toLowerCase()} ${m[2]}` : `de ${inicio.trim()}`; };
export const MARCOS_PAGAMENTO = ['Emissão da Nota Fiscal', 'Recebimento do pedido de compra', 'Aprovação do projeto', 'Entrega do equipamento', 'Conclusão da instalação', 'Medição mensal'];
// Seções fixas (decisão 70): não se editam nem se renomeiam na proposta.
export const SECOES_FIXAS = ['sobre', 'dados', 'confidencialidade', 'anexo'];
// Limite de caracteres para Objetivo, Aplicação e Referência e Normas caberem juntos numa página (decisão 70).
export const LIMITES_TEXTO: Record<string, number> = { objetivo: 800, aplicacao: 1000, normas: 1200 };
export const CRONOGRAMA_PADRAO: Etapa[] = [
  { nome: 'Engenharia e aprovação do projeto', dias: 10 },
  { nome: 'Compra de materiais', dias: 15 },
  { nome: 'Fabricação', dias: 30 },
  { nome: 'Entrega e instalação', dias: 10 },
];

const NORMAS = `Para a execução dos serviços de fabricação e instalação, serão consideradas as seguintes normas e referências técnicas, conforme aplicabilidade:

- NR-12 – Segurança no Trabalho em Máquinas e Equipamentos: Requisitos de segurança aplicáveis às intervenções, montagem e manutenção de equipamentos industriais.
- ABNT NBR ISO 12100 – Segurança de Máquinas: Princípios gerais de projeto, apreciação e redução de riscos.
- ASTM A240/A240M – Aços Inoxidáveis: Especificações técnicas aplicáveis às chapas de aço inoxidável utilizadas na fabricação.

Boas Práticas de Fabricação (BPF): Critérios de fabricação, acabamento superficial e higienização adequados aos equipamentos empregados na indústria de processamento de produtos alimentícios.

Desenhos e Especificações Técnicas do Projeto: Utilização dos modelos tridimensionais, desenhos de fabricação e informações dimensionais do conjunto para garantir a compatibilidade com o equipamento existente.

Procedimentos Internos da {cliente}: Atendimento às exigências de segurança, qualidade, higiene e liberação de serviços estabelecidas pela unidade industrial de {local}.`;

const COMPETENCIAS: { nome: string; valor: Marca3 }[] = ['Mecânica', 'Civil', 'Automação', 'Elétrica', 'Pneumática', 'Instalação', 'Adequação']
  .map((nome) => ({ nome, valor: 'N/A' as Marca3 }));

const F = (texto: string): LinhaMatriz => ({ texto, cliente: false, fabriaco: true });
const CL = (texto: string): LinhaMatriz => ({ texto, cliente: true, fabriaco: false });
// Responsabilidades e documentações juntas, por área (anexo A do docs/PLANEJAMENTO_PROPOSTA_PDF_V4.md).
export const RESPONSABILIDADES_PADRAO: GrupoResponsabilidade[] = [
  { area: 'Engenharia', itens: ['Cronograma detalhado de fabricação e instalação', 'Projeto técnico', 'Lista de materiais', 'Memorial de cálculo', 'Laudo técnico',
    'ART (Anotação de Responsabilidade Técnica)', 'Databook', 'As built', 'Manual de operação'].map(F) },
  { area: 'Compras', itens: ['Materiais', 'Consumíveis', 'Certificados dos materiais utilizados na fabricação'].map(F) },
  { area: 'Fabricação', itens: ['Mão de obra qualificada', 'Equipamentos e ferramentas de transformação (laser, plasma, dobradeira, calandra, furadeira, torno etc.)',
    'PIT – Plano de inspeção e testes de fabricação', 'PP – Plano detalhado de pintura', 'Procedimento de soldagem (EPS, RQPS, CQP)',
    'Relatório de controle de qualidade durante a fabricação', 'Documentação conforme requisitos da NR-13'].map(F) },
  { area: 'Instalação', itens: [
    ...['Plano de rigging', 'Histograma de instalação', 'Relatório diário das atividades', 'Limpeza da área após a execução dos serviços'].map(F),
    ...['Equipamentos de aluguel (gerador, andaime industrial, guindaste, PTA etc.)', 'Liberações e agendamento de parada de setores, se necessário',
      'Ponto de energia', 'Água potável', 'Banheiro'].map(CL)] },
  { area: 'Frete', itens: ['Carregamento para transporte', 'Descarregamento do transporte', 'Transporte / seguro',
    'Refeições, hospedagem e transporte dos profissionais'].map(F) },
  { area: 'Segurança', itens: [
    ...['Equipamentos de segurança (EPIs) e ficha de EPI', 'Sinalização de segurança da área de trabalho', 'Análise de riscos e APRs',
      'Treinamentos obrigatórios (NR-10, NR-12, NR-35 etc.)', 'PCMSO e ASO atualizados dos colaboradores', 'PT (Permissão de Trabalho) preenchida e assinada'].map(F),
    ...['Documentos de acesso à planta (credenciamento, crachás etc.)', 'Permissões e licenças para execução dos trabalhos, se necessário',
      'Abertura das PT e assinaturas dos responsáveis, se necessário'].map(CL)] },
  { area: 'Financeiro', itens: [CL('Pedido de compras'), F('Nota fiscal')] },
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
      versao: VERSAO_DOCUMENTO, tipo, capa, visao: { objeto: '', solucao: '', unidade: '' }, abertura: '',
      secoes: [
        { id: 'sobre', titulo: 'Sobre nós', ativo: true, tipo: 'sobre' },
        { id: 'dados', titulo: 'Dados da Empresa', ativo: true, tipo: 'dados_empresas' },
        texto('objetivo', 'Objetivo', '', 'O que será fornecido, para quem e com qual finalidade.'),
        texto('aplicacao', 'Aplicação', '', 'Onde e como a solução será aplicada, com a lista de benefícios.'),
        texto('normas', 'Referência e Normas', NORMAS),
        { id: 'competencias', titulo: 'Competências', ativo: true, tipo: 'competencias', itens: COMPETENCIAS },
        { id: 'responsabilidades', titulo: 'Responsabilidades', ativo: true, tipo: 'responsabilidades', grupos: RESPONSABILIDADES_PADRAO },
        { id: 'escopo', titulo: 'Escopo', ativo: true, tipo: 'cartoes', marcador: 'letra', cartoes: [], fecho: '',
          intro: 'A presente proposta contempla o fornecimento de materiais, fabricação e instalação, conforme descrito a seguir:', dica: 'Etapas do serviço, uma por item, cada uma com as imagens que precisar.' },
        texto('fora', 'Fora do Escopo', FORA_DO_ESCOPO),
        { id: 'garantia', titulo: 'Garantia', ativo: true, tipo: 'garantia', meses: GARANTIA_MESES_PADRAO },
        { id: 'prazo', titulo: 'Prazo de Entrega', ativo: true, tipo: 'cronograma', etapas: CRONOGRAMA_PADRAO, inicio: INICIO_PRAZO_PADRAO },
        { id: 'validade', titulo: 'Validade da Proposta', ativo: true, tipo: 'validade' },
        { id: 'confidencialidade', titulo: 'Termo de Confidencialidade', ativo: true, tipo: 'confidencialidade' },
        texto('anexo', 'Anexo', 'Não contém.'),
      ],
    };
  }
  // Comercial em 4 páginas: capa, visão geral (frete, impostos, pagamento), valores e a última (anexos, sigilo e vendedor).
  return {
    versao: VERSAO_DOCUMENTO, tipo, capa, visao: { objeto: '', solucao: '', unidade: '' }, abertura: '',
    secoes: [
      { id: 'visao', titulo: 'Visão geral', ativo: true, tipo: 'visao_comercial', frete: 'CIF — incluso', frete_detalhe: 'Entrega na unidade {cliente} — {local}' },
      { id: 'impostos', titulo: 'Impostos (inclusos)', ativo: true, tipo: 'impostos', ncm: '', linhas: IMPOSTOS,
        intro: 'Nota fiscal de venda. As alíquotas deverão ser confirmadas antes da emissão definitiva.' },
      { id: 'pagamento', titulo: 'Forma de pagamento', ativo: true, tipo: 'pagamento', condicao: '21 dias (21 DDL)', marco: 'Emissão da Nota Fiscal', forma: 'Depósito / transferência',
        texto: 'Pagamento em 21 (vinte e um) dias após a emissão da Nota Fiscal, via depósito bancário ou transferência eletrônica.' },
      { id: 'valores', titulo: 'Valores', ativo: true, tipo: 'valores', intro: VALORES_INTRO, descricoes: {} },
      texto('anexo', 'Anexos', '- Proposta técnica {codigo}', 'Um anexo por linha, começando com "- ".'),
      { id: 'confidencialidade', titulo: 'Termo de Confidencialidade', ativo: true, tipo: 'confidencialidade' },
    ],
  };
}

// Documento salvo pode ser de uma versão anterior do modelo. Na conversão para a versão 4, as seções que mantêm o
// mesmo formato (textos, escopo com imagens, competências, impostos, pagamento, valores) continuam como estavam;
// as que mudaram de formato vêm do padrão ("base": Modelos de proposta, ou o padrão do sistema).
export function completarDocumento(doc: Partial<Documento> | null | undefined, tipo: TipoDocumento, base: Documento = documentoPadrao(tipo)): Documento {
  if (!doc) return base;
  const junto = { ...base, ...doc, tipo, capa: { ...base.capa, ...doc.capa }, visao: { ...base.visao, ...doc.visao } };
  if (doc.versao === VERSAO_DOCUMENTO) return { ...junto, secoes: Array.isArray(doc.secoes) && doc.secoes.length ? doc.secoes : base.secoes };
  const antigas = Array.isArray(doc.secoes) ? doc.secoes : [];
  const secoes = base.secoes.map((b) => {
    const a = antigas.find((x) => x.id === b.id);
    return a && a.tipo === b.tipo ? { ...a, titulo: b.titulo } : b;
  });
  return { ...junto, versao: VERSAO_DOCUMENTO, secoes };
}

// Comercial: garantia e prazo vêm da proposta técnica da mesma revisão (decisão 67).
export function resumoTecnica(tecnica?: Documento | null): { meses: number; dias: number; etapas: Etapa[]; inicio: string } {
  const g = tecnica?.secoes.find((s) => s.tipo === 'garantia');
  const c = tecnica?.secoes.find((s) => s.tipo === 'cronograma');
  const etapas = c?.tipo === 'cronograma' ? c.etapas : CRONOGRAMA_PADRAO;
  const inicio = (c?.tipo === 'cronograma' && c.inicio?.trim()) || INICIO_PRAZO_PADRAO;
  return { meses: g?.tipo === 'garantia' ? g.meses : GARANTIA_MESES_PADRAO, dias: etapas.reduce((t, e) => t + (Number(e.dias) || 0), 0), etapas, inicio };
}

// Texto simples → blocos para a prévia e o PDF.
// **negrito** e __sublinhado__ (barra de formatação, decisão 70); "- " faz lista e "1. " lista numerada.
export type Trecho = { texto: string; negrito: boolean; sublinhado?: boolean };
export type Bloco = { tipo: 'p'; trechos: Trecho[] } | { tipo: 'lista'; itens: Trecho[][]; numerada?: boolean };

export function trechos(linha: string): Trecho[] {
  const partes = linha.split(/(\*\*[^*]+\*\*|__[^_]+__)/g).filter(Boolean);
  return partes.map((p) => {
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4) return { texto: p.slice(2, -2), negrito: true };
    if (p.startsWith('__') && p.endsWith('__') && p.length > 4) return { texto: p.slice(2, -2), negrito: false, sublinhado: true };
    return { texto: p, negrito: false };
  });
}

export function blocos(texto: string): Bloco[] {
  const saida: Bloco[] = [];
  for (const paragrafo of texto.replace(/\r/g, '').split(/\n\s*\n/)) {
    const linhas = paragrafo.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!linhas.length) continue;
    let texto: string[] = [];
    let lista: Trecho[][] = [];
    let numerada = false;
    const fecharTexto = () => { if (texto.length) saida.push({ tipo: 'p', trechos: trechos(texto.join(' ')) }); texto = []; };
    const fecharLista = () => { if (lista.length) saida.push(numerada ? { tipo: 'lista', itens: lista, numerada: true } : { tipo: 'lista', itens: lista }); lista = []; };
    for (const l of linhas) {
      const marcador = /^[-•]\s+/.test(l) ? 'ponto' : /^\d{1,2}[.)]\s+/.test(l) ? 'numero' : null;
      if (!marcador) { fecharLista(); texto.push(l); continue; }
      fecharTexto();
      if (lista.length && numerada !== (marcador === 'numero')) fecharLista();
      numerada = marcador === 'numero';
      lista.push(trechos(l.replace(/^([-•]|\d{1,2}[.)])\s+/, '')));
    }
    fecharTexto(); fecharLista();
  }
  return saida;
}

export interface Variaveis { cliente: string; local: string; validade_dias: string; codigo?: string }
export const substituir = (t: string, v: Variaveis) =>
  t.replace(/\{(cliente|local|validade_dias|codigo)\}/g, (_, k: keyof Variaveis) => v[k] || `{${k}}`);

// Numeração das seções ativas: 01, 02… (como nos modelos). "Sobre nós" tem título próprio e não leva número.
// Decisão 70: "Conheça a Fabriaço" e "Dados da Empresa" ficam na página de abertura, sem número; o 01 é o Objetivo.
export const numerar = (secoes: Secao[]) => secoes.filter((s) => s.ativo && s.tipo !== 'sobre' && s.tipo !== 'dados_empresas').map((s, i) => ({ secao: s, numero: String(i + 1).padStart(2, '0') }));
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
    if (s.tipo === 'cartoes' && s.id === 'escopo' && t.escopo?.length) return { ...s, intro: t.escopo_intro?.trim() || s.intro, cartoes: t.escopo.filter((c) => c.titulo.trim()).map((c, i) => ({ titulo: c.titulo, texto: c.texto, imagens: s.cartoes[i]?.imagens })) };
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

// Caminhos das imagens usadas no documento (capa, figuras da seção e imagens dos itens), para baixar antes de montar o PDF.
export const imagensDoDocumento = (d: Documento): string[] =>
  [d.capa.imagem, ...d.secoes.flatMap((s) => (s.tipo === 'cartoes'
    ? [...(s.figuras ?? []), ...s.cartoes.flatMap((c) => c.imagens ?? [])].map((f) => f.caminho) : []))].filter((c): c is string => Boolean(c));

// Decisão 74: os itens do Escopo da técnica são os itens da aba Custos, na mesma ordem e com o mesmo nome (sem edição).
// Cada item guarda o texto e as imagens que já tinha na posição; sem itens nos Custos, o Escopo fica como está.
export function sincronizarEscopo(doc: Documento, itens: { descricao: string }[]): Documento {
  if (doc.tipo !== 'tecnica' || !itens.length) return doc;
  return {
    ...doc,
    secoes: doc.secoes.map((s) => (s.id === 'escopo' && s.tipo === 'cartoes'
      ? { ...s, marcador: 'letra' as const, cartoes: itens.map((it, i) => ({ ...(s.cartoes[i] ?? { texto: '' }), titulo: it.descricao })) }
      : s)),
  };
}

// Decisões 75 e 76: seções sempre fixas e sempre no PDF. O conteúdo vem do modelo
// (Administração → Modelos de proposta), não do documento da proposta.
export const SECOES_DO_MODELO: Record<TipoDocumento, string[]> = {
  tecnica: ['validade', 'confidencialidade', 'anexo'],
  comercial: ['visao', 'impostos', 'anexo', 'confidencialidade'],
};
export function fixarSecoesDoModelo(doc: Documento, modelo: Documento): Documento {
  const ids = SECOES_DO_MODELO[doc.tipo];
  const secoes = doc.secoes.map((s) => {
    if (!ids.includes(s.id)) return s;
    const m = modelo.secoes.find((x) => x.id === s.id && x.tipo === s.tipo);
    return { ...(m ?? s), ativo: true };
  });
  // Documento antigo sem alguma delas: entra a do modelo, no fim.
  for (const id of ids) {
    const m = modelo.secoes.find((x) => x.id === id);
    if (m && !secoes.some((x) => x.id === id)) secoes.push({ ...m, ativo: true });
  }
  return { ...doc, secoes };
}

// Decisão 98: numa proposta nova, cada seção editável vem com os textos do modelo, mas sem marcar: fica amarela até o
// vendedor dizer se entra ou não. Dentro dela, as competências vêm sem Sim/Não/N/A e as responsabilidades sem
// Cliente/Fabriaço marcados (os textos ficam). Sobre nós, Dados da Empresa e as seções do modelo não mudam.
export function secaoEditavelNaProposta(tipo: TipoDocumento, s: Secao): boolean {
  return s.tipo !== 'sobre' && s.tipo !== 'dados_empresas' && s.tipo !== 'confidencialidade' && !SECOES_DO_MODELO[tipo].includes(s.id) && !SECOES_FIXAS.includes(s.id);
}
export function paraEscolher(doc: Documento): Documento {
  return {
    ...doc,
    secoes: doc.secoes.map((s): Secao => {
      if (!secaoEditavelNaProposta(doc.tipo, s)) return s;
      const base = { ...s, ativo: false, escolher: true };
      if (base.tipo === 'competencias') return { ...base, itens: base.itens.map((x) => ({ ...x, valor: '' as Marca3 })) };
      if (base.tipo === 'responsabilidades') return { ...base, grupos: base.grupos.map((g) => ({ ...g, itens: g.itens.map((x) => ({ ...x, cliente: false, fabriaco: false })) })) };
      return base;
    }),
  };
}
// "Entra" ou "Não entra": a escolha do vendedor resolve a seção.
export const escolherSecao = (s: Secao, entra: boolean): Secao => {
  const { escolher: _e, ...resto } = s;
  return { ...resto, ativo: entra } as Secao;
};

// Decisão 77: o que falta preencher em cada seção editável (vazio = completa). Aparece no editor como um X amarelo
// (com a lista no balão) ou um certinho verde. Itens são os da aba Custos, com o valor de venda.
export function pendencias(s: Secao, itens: { letra: string; valor: number }[] = []): string[] {
  const vazio = (t?: string) => !t || !t.trim();
  if (s.escolher) return ['Marcar se esta seção entra na proposta'];
  const f: string[] = [];
  switch (s.tipo) {
    case 'texto':
      if (vazio(s.texto)) f.push('Texto');
      break;
    case 'cartoes':
      if (s.id === 'escopo' && !itens.length) f.push('Itens na aba Custos');
      if (!s.cartoes.length) f.push('Pelo menos um item');
      s.cartoes.forEach((c, i) => {
        const m = marcadorCartao(s.marcador, i);
        if (vazio(c.titulo)) f.push(`Nome do item ${m}`);
        if (vazio(c.texto)) f.push(`Descrição do item ${m}`);
      });
      break;
    case 'competencias':
      if (!s.itens.some((x) => !vazio(x.nome))) f.push('Pelo menos uma competência');
      if (s.itens.some((x) => vazio(x.nome))) f.push('Competência sem nome');
      s.itens.forEach((x) => { if (!x.valor) f.push(`Sim, Não ou N/A em ${x.nome || 'uma competência'}`); });
      break;
    case 'responsabilidades':
      if (!s.grupos.some((g) => g.itens.length)) f.push('Pelo menos uma responsabilidade');
      s.grupos.forEach((g) => {
        if (vazio(g.area)) f.push('Área sem nome');
        if (g.itens.some((x) => vazio(x.texto))) f.push(`Item sem texto em ${g.area || 'uma área'}`);
        if (g.itens.some((x) => !x.cliente && !x.fabriaco)) f.push(`Responsável não marcado em ${g.area || 'uma área'}`);
      });
      break;
    case 'matriz':
      if (!s.itens.length) f.push('Pelo menos um item');
      break;
    case 'garantia':
      if (!(Number(s.meses) > 0)) f.push('Meses de garantia');
      break;
    case 'cronograma':
      if (!s.etapas.length) f.push('Pelo menos uma etapa');
      s.etapas.forEach((e, i) => {
        if (vazio(e.nome)) f.push(`Nome da etapa ${i + 1}`);
        if (!(Number(e.dias) > 0)) f.push(`Dias da etapa ${e.nome || i + 1}`);
      });
      break;
    case 'pagamento':
      if (vazio(s.condicao)) f.push('Condição');
      if (vazio(s.marco)) f.push('Marco do pagamento');
      if (vazio(s.forma)) f.push('Forma');
      break;
    case 'valores':
      if (!itens.length) f.push('Itens na aba Custos');
      itens.forEach((it) => { if (!(it.valor > 0)) f.push(`Valor do item ${it.letra}`); });
      break;
    case 'impostos':
      if (vazio(s.ncm)) f.push('NCM');
      break;
  }
  return [...new Set(f)];
}

// Decisão 81: refazer com a IA só uma seção. A IA escreve o documento todo, mas só a seção escolhida é trocada;
// o texto atual dela e o pedido de ajuste vão junto na explicação.
export const SECOES_IA = ['objetivo', 'aplicacao', 'normas', 'competencias', 'escopo', 'fora', 'valores'];
export function aplicarTextosIASecao(doc: Documento, t: TextosIA, secaoId: string): Documento {
  const novo = aplicarTextosIA(doc, t).secoes.find((s) => s.id === secaoId);
  return novo ? { ...doc, secoes: doc.secoes.map((s) => (s.id === secaoId ? novo : s)) } : doc;
}
export function textoAtualDaSecao(s: Secao): string {
  switch (s.tipo) {
    case 'texto': return s.texto;
    case 'cartoes': return [s.intro, ...s.cartoes.map((c, i) => `${marcadorCartao(s.marcador, i)}. ${c.titulo}: ${c.texto}`)].filter(Boolean).join('\n\n');
    case 'competencias': return s.itens.map((i) => `${i.nome}: ${i.valor}`).join('\n');
    case 'valores': return Object.entries(s.descricoes).map(([l, d]) => `${l}: ${d}`).join('\n');
    default: return '';
  }
}
// A Edge Function só lê os primeiros 6.000 caracteres: o pedido vai primeiro e os textos longos são cortados,
// senão o pedido ficava de fora (era o que acontecia no Fora do Escopo, que tem texto grande).
export const LIMITE_EXPLICACAO_IA = 6000;
export function explicacaoParaSecao(explicacao: string, s: Secao, pedido: string): string {
  const cortar = (t: string, max: number) => (t.length > max ? `${t.slice(0, max)}…` : t);
  const atual = textoAtualDaSecao(s).trim();
  const ordem = pedido.trim()
    ? `PEDIDO PARA A SEÇÃO "${s.titulo}" (prioridade): ${cortar(pedido.trim(), 800)}`
    : `PEDIDO: reescreva a seção "${s.titulo}" melhorando o texto atual.`;
  return [
    ordem,
    `Desta vez só a seção "${s.titulo}" será usada. Capriche nela.`,
    `Explicação da proposta:\n${cortar(explicacao.trim(), 2200)}`,
    atual ? `Texto atual da seção "${s.titulo}":\n${cortar(atual, 2500)}` : '',
  ].filter(Boolean).join('\n\n').slice(0, LIMITE_EXPLICACAO_IA);
}

