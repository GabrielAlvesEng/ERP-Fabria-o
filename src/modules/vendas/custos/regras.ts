// Regras da aba Custos (decisões 29 e 30). Espelham public.custo_resumo no banco.

export type Secao = 'materiais' | 'acessorios' | 'mao_obra' | 'maquinas' | 'deslocamento' | 'alimentacao' | 'hospedagem' | 'fretes';

export interface CustoItem {
  id: string;
  revisao_id: string;
  letra: string;
  descricao: string;
  quantidade: number;
  lucro_pct: number;
  negociacao_pct: number;
  imposto_pct: number;
  imposto_modo: 'dentro' | 'fora';
  ordem: number;
}

export interface CustoLinha {
  id: string;
  item_id: string;
  secao: Secao;
  grupo: string;
  descricao: string;
  detalhe: string;
  detalhe2: string;
  unidade: string;
  quantidade: number;
  fator: number;
  valor_unitario: number;
  total: number;
  ordem: number;
}

export type CampoLinha = 'grupo' | 'descricao' | 'detalhe' | 'detalhe2' | 'quantidade' | 'fator' | 'valor_unitario';

export interface Coluna {
  campo: CampoLinha;
  rotulo: string;
  tipo: 'texto' | 'numero' | 'material' | 'tipoMaterial' | 'simnao';
  largura?: string;
}

export const SECOES: { id: Secao; letra: string; titulo: string; colunas: Coluna[] }[] = [
  {
    id: 'materiais', letra: 'A', titulo: 'Materiais',
    colunas: [
      { campo: 'grupo', rotulo: 'Tipo', tipo: 'tipoMaterial', largura: 'w-32' },
      { campo: 'descricao', rotulo: 'Descrição', tipo: 'material' },
      { campo: 'quantidade', rotulo: 'Qtd', tipo: 'numero', largura: 'w-20' },
      { campo: 'fator', rotulo: 'Und / Peso / Mts', tipo: 'numero', largura: 'w-32' },
      { campo: 'valor_unitario', rotulo: 'Preço unitário', tipo: 'numero', largura: 'w-32' },
    ],
  },
  {
    id: 'acessorios', letra: 'B', titulo: 'Acessórios',
    colunas: [
      { campo: 'descricao', rotulo: 'Descrição', tipo: 'texto' },
      { campo: 'valor_unitario', rotulo: 'Valor', tipo: 'numero', largura: 'w-36' },
    ],
  },
  {
    id: 'mao_obra', letra: 'C', titulo: 'Mão de obra',
    colunas: [
      { campo: 'grupo', rotulo: 'Etapa', tipo: 'texto', largura: 'w-36' },
      { campo: 'descricao', rotulo: 'Função', tipo: 'texto' },
      { campo: 'valor_unitario', rotulo: 'Valor hora', tipo: 'numero', largura: 'w-28' },
      { campo: 'quantidade', rotulo: 'Horas', tipo: 'numero', largura: 'w-24' },
    ],
  },
  {
    id: 'maquinas', letra: 'D', titulo: 'Máquinas',
    colunas: [
      { campo: 'descricao', rotulo: 'Máquina', tipo: 'texto' },
      { campo: 'detalhe', rotulo: 'Terceirizada', tipo: 'simnao', largura: 'w-28' },
      { campo: 'valor_unitario', rotulo: 'Valor hora', tipo: 'numero', largura: 'w-28' },
      { campo: 'quantidade', rotulo: 'Horas', tipo: 'numero', largura: 'w-24' },
    ],
  },
  {
    id: 'deslocamento', letra: 'E', titulo: 'Deslocamento',
    colunas: [
      { campo: 'descricao', rotulo: 'Tipo', tipo: 'texto' },
      { campo: 'detalhe', rotulo: 'Destino', tipo: 'texto', largura: 'w-40' },
      { campo: 'quantidade', rotulo: 'Qtd', tipo: 'numero', largura: 'w-20' },
      { campo: 'valor_unitario', rotulo: 'Preço unitário', tipo: 'numero', largura: 'w-32' },
    ],
  },
  {
    id: 'alimentacao', letra: 'F', titulo: 'Alimentação',
    colunas: [
      { campo: 'descricao', rotulo: 'Descrição', tipo: 'texto' },
      { campo: 'quantidade', rotulo: 'Colaboradores', tipo: 'numero', largura: 'w-28' },
      { campo: 'fator', rotulo: 'Dias', tipo: 'numero', largura: 'w-20' },
      { campo: 'valor_unitario', rotulo: 'Valor da refeição', tipo: 'numero', largura: 'w-32' },
    ],
  },
  {
    id: 'hospedagem', letra: 'G', titulo: 'Hospedagem',
    colunas: [
      { campo: 'detalhe', rotulo: 'Cidade', tipo: 'texto' },
      { campo: 'quantidade', rotulo: 'Diárias', tipo: 'numero', largura: 'w-24' },
      { campo: 'valor_unitario', rotulo: 'Valor do hotel', tipo: 'numero', largura: 'w-32' },
    ],
  },
  {
    id: 'fretes', letra: 'H', titulo: 'Fretes',
    colunas: [
      { campo: 'descricao', rotulo: 'Tipo', tipo: 'texto' },
      { campo: 'detalhe', rotulo: 'Partida', tipo: 'texto', largura: 'w-36' },
      { campo: 'detalhe2', rotulo: 'Destino', tipo: 'texto', largura: 'w-36' },
      { campo: 'quantidade', rotulo: 'Qtd', tipo: 'numero', largura: 'w-20' },
      { campo: 'valor_unitario', rotulo: 'Preço unitário', tipo: 'numero', largura: 'w-32' },
    ],
  },
];

export function totalLinha(l: Pick<CustoLinha, 'quantidade' | 'fator' | 'valor_unitario'>): number {
  return Math.round(Number(l.quantidade) * Number(l.fator) * Number(l.valor_unitario) * 100) / 100;
}

export function totalSecao(linhas: CustoLinha[], secao: Secao): number {
  return linhas.filter((l) => l.secao === secao).reduce((s, l) => s + totalLinha(l), 0);
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export interface Resumo {
  porSecao: Record<Secao, number>;
  custos: number;
  lucro: number;
  negociacao: number;
  imposto: number;
  precoUnitario: number;
  precoTotal: number;
}

// Decisão 30: lucro e negociação sobre todos os custos; imposto por dentro (padrão) ou por fora.
export function resumoItem(item: Pick<CustoItem, 'quantidade' | 'lucro_pct' | 'negociacao_pct' | 'imposto_pct' | 'imposto_modo'>, linhas: CustoLinha[]): Resumo {
  const porSecao = Object.fromEntries(SECOES.map((s) => [s.id, r2(totalSecao(linhas, s.id))])) as Record<Secao, number>;
  const custos = Object.values(porSecao).reduce((a, b) => a + b, 0);
  const lucro = (custos * Number(item.lucro_pct)) / 100;
  const negociacao = (custos * Number(item.negociacao_pct)) / 100;
  const base = custos + lucro + negociacao;
  const t = Number(item.imposto_pct) / 100;
  const pu = item.imposto_modo === 'dentro' ? base / (1 - t) : base * (1 + t);
  return {
    porSecao,
    custos: r2(custos),
    lucro: r2(lucro),
    negociacao: r2(negociacao),
    imposto: r2(pu - base),
    precoUnitario: r2(pu),
    precoTotal: r2(pu * Number(item.quantidade)),
  };
}

// Peso de chapa: espessura × largura × comprimento (mm) × densidade (kg/mm³), como a aba "Cálculo Peso".
export const DENSIDADES = { inox: 8e-6, carbono: 7.85e-6 } as const;
export function pesoChapa(esp: number, larg: number, comp: number, material: keyof typeof DENSIDADES): number {
  return Math.round(esp * larg * comp * DENSIDADES[material] * 1000) / 1000;
}

// Próxima letra livre: A, B, ... Z, AA, AB ...
export function proximaLetra(usadas: string[]): string {
  const set = new Set(usadas);
  for (let i = 0; i < 702; i++) {
    const l = i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26));
    if (!set.has(l)) return l;
  }
  return 'ZZ';
}

// Linhas iniciais de um item novo (o mesmo modelo da planilha de hoje).
export type LinhaNova = Omit<CustoLinha, 'id' | 'item_id' | 'total'>;
export function modeloLinhas(maoObra: { etapa: string; funcao: string; valor_hora: number }[], maquinas: { nome: string; terceirizada: boolean; valor_hora: number }[]): LinhaNova[] {
  const base = { grupo: '', descricao: '', detalhe: '', detalhe2: '', unidade: '', quantidade: 0, fator: 1, valor_unitario: 0 };
  const linhas: LinhaNova[] = [];
  let o = 0;
  const add = (secao: Secao, l: Partial<LinhaNova>) => linhas.push({ ...base, ...l, secao, ordem: o++ });
  ['Fixação', 'Conexões', 'Transmissão de Potência', 'Controle de Fluxo e Nível', 'Componentes Mecânicos', 'Tintas'].forEach((d) => add('acessorios', { descricao: d, quantidade: 1 }));
  maoObra.forEach((m) => add('mao_obra', { grupo: m.etapa, descricao: m.funcao, valor_unitario: Number(m.valor_hora) }));
  maquinas.forEach((m) => add('maquinas', { descricao: m.nome, detalhe: m.terceirizada ? 'Sim' : 'Não', valor_unitario: Number(m.valor_hora) }));
  ['Combustível (ida e volta)', 'Pedágio (ida e volta)', 'Aluguel de veículo'].forEach((d) => add('deslocamento', { descricao: d }));
  add('alimentacao', { descricao: 'Refeições' });
  add('hospedagem', {});
  [
    ['Coleta de matéria-prima (chapas)', 'São Paulo-SP', 'Mococa-SP'],
    ['Coleta de matéria-prima (perfis)', 'São Paulo-SP', 'Mococa-SP'],
    ['Coleta dos itens comerciais', 'São Paulo-SP', 'Mococa-SP'],
    ['Transporte para entrega no projeto', 'Mococa-SP', ''],
  ].forEach(([d, p, de]) => add('fretes', { descricao: d, detalhe: p, detalhe2: de }));
  return linhas;
}
