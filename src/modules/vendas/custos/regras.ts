// Regras da aba Custos (decisões 29, 30, 41, 42, 43 e 50). Espelham o gatilho ajustar_linha_custo e public.custo_resumo no banco.

export type Secao =
  | 'materiais' | 'acabamentos' | 'frete' | 'mao_obra' | 'maquinas' | 'viagem'
  // Seções antigas: só aparecem em revisões enviadas antes das decisões 42 e 50 (ficam como foram enviadas).
  | 'frota' | 'alimentacao' | 'hospedagem' | 'acessorios' | 'deslocamento' | 'fretes';

export interface CustoItem {
  id: string;
  revisao_id: string;
  letra: string;
  descricao: string;
  quantidade: number;
  lucro_pct: number;
  negociacao_pct: number;
  imposto_pct: number;
  imposto_modo: 'dentro';
  ordem: number;
  valor_manual?: number | null; // decisões 70 e 99: preço de venda UNITÁRIO digitado à mão (× quantidade = total do item)
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
  material: string;
  adicional: number;
  consumo: number | null;
  combustivel: number | null;
  bib_id?: string | null;
  ida_volta?: boolean;
}

export type CampoLinha = 'grupo' | 'descricao' | 'detalhe' | 'detalhe2' | 'quantidade' | 'fator' | 'valor_unitario' | 'material' | 'adicional' | 'consumo' | 'combustivel' | 'ida_volta';

export interface Coluna {
  campo: CampoLinha;
  rotulo: string;
  tipo: 'texto' | 'numero' | 'material' | 'catalogo' | 'escolha' | 'simnao' | 'veiculo' | 'leitura' | 'idavolta';
  largura?: string;
  pesoMateriais?: boolean; // botão "usar peso dos materiais" (galvanização e zincagem)
  rota?: boolean;          // botões de rota (Qualp e mapa) no destino da frota
}

// Seção com blocos fixos: cada bloco tem seu grupo, suas colunas e seu botão de adicionar.
export interface Bloco { grupo: string; colunas: Coluna[]; adicionar: string }

export interface DefSecao { id: Secao; letra: string; titulo: string; colunas: Coluna[]; blocos?: Bloco[]; legado?: boolean }

const ITEM_COLS = (rotulo: string): Coluna[] => [
  { campo: 'descricao', rotulo, tipo: 'material', largura: 'min-w-[280px]' },
  { campo: 'quantidade', rotulo: 'Qtd', tipo: 'numero', largura: 'w-20' },
  { campo: 'valor_unitario', rotulo: 'Preço unitário', tipo: 'numero', largura: 'w-32' },
];
const DESCRICAO: Coluna = { campo: 'descricao', rotulo: 'Descrição', tipo: 'texto', largura: 'min-w-[200px]' };
const MAO_OBRA_COLS: Coluna[] = [
  { campo: 'descricao', rotulo: 'Função', tipo: 'escolha', largura: 'min-w-[200px]' },
  { campo: 'valor_unitario', rotulo: 'Valor hora', tipo: 'numero', largura: 'w-28' },
  { campo: 'quantidade', rotulo: 'Horas', tipo: 'numero', largura: 'w-24' },
];

export const SECOES: DefSecao[] = [
  {
    id: 'materiais', letra: 'A', titulo: 'Materiais', colunas: [],
    blocos: [
      { grupo: 'Chapas', adicionar: 'chapa', colunas: [
        { campo: 'material', rotulo: 'Material', tipo: 'catalogo', largura: 'w-44' },
        { campo: 'descricao', rotulo: 'Chapa', tipo: 'material', largura: 'min-w-[240px]' },
        { campo: 'quantidade', rotulo: 'Qtd', tipo: 'numero', largura: 'w-20' },
        { campo: 'fator', rotulo: 'Peso (kg)', tipo: 'numero', largura: 'w-32' },
        { campo: 'valor_unitario', rotulo: 'Preço por peso', tipo: 'numero', largura: 'w-32' },
      ] },
      { grupo: 'Perfis', adicionar: 'perfil', colunas: [
        { campo: 'material', rotulo: 'Material', tipo: 'catalogo', largura: 'w-44' },
        { campo: 'descricao', rotulo: 'Perfil', tipo: 'material', largura: 'min-w-[240px]' },
        { campo: 'quantidade', rotulo: 'Qtd', tipo: 'numero', largura: 'w-20' },
        { campo: 'fator', rotulo: 'Metros', tipo: 'numero', largura: 'w-32' },
        { campo: 'valor_unitario', rotulo: 'Preço por metro', tipo: 'numero', largura: 'w-32' },
      ] },
      { grupo: 'Comerciais', adicionar: 'item comercial', colunas: ITEM_COLS('Item comercial') },
      { grupo: 'Fixadores', adicionar: 'fixador', colunas: ITEM_COLS('Fixador') },
      { grupo: 'Consumíveis', adicionar: 'consumível', colunas: ITEM_COLS('Consumível') },
    ],
  },
  {
    id: 'acabamentos', letra: 'B', titulo: 'Acabamentos', colunas: [],
    blocos: [
      { grupo: 'Acabamento em inox', adicionar: 'acabamento em inox', colunas: [
        { ...DESCRICAO, rotulo: 'Acabamento (escovado, polido…)' },
        { campo: 'valor_unitario', rotulo: 'Consumíveis (R$)', tipo: 'numero', largura: 'w-36' },
        { campo: 'adicional', rotulo: 'Mão de obra (R$)', tipo: 'numero', largura: 'w-36' },
      ] },
      { grupo: 'Pintura por tinta', adicionar: 'pintura', colunas: [
        { ...DESCRICAO, rotulo: 'Tinta' },
        { campo: 'quantidade', rotulo: 'Latas', tipo: 'numero', largura: 'w-24' },
        { campo: 'valor_unitario', rotulo: 'Valor da lata', tipo: 'numero', largura: 'w-32' },
        { campo: 'adicional', rotulo: 'Mão de obra (R$)', tipo: 'numero', largura: 'w-36' },
      ] },
      { grupo: 'Galvanização a fogo', adicionar: 'galvanização', colunas: [
        DESCRICAO,
        { campo: 'quantidade', rotulo: 'Peso (kg)', tipo: 'numero', largura: 'w-40', pesoMateriais: true },
        { campo: 'valor_unitario', rotulo: 'Valor por kg', tipo: 'numero', largura: 'w-32' },
      ] },
      { grupo: 'Pintura eletrostática', adicionar: 'pintura eletrostática', colunas: [
        DESCRICAO,
        { campo: 'quantidade', rotulo: 'Área (m²)', tipo: 'numero', largura: 'w-28' },
        { campo: 'valor_unitario', rotulo: 'Valor por m²', tipo: 'numero', largura: 'w-32' },
      ] },
      { grupo: 'Zincagem', adicionar: 'zincagem', colunas: [
        DESCRICAO,
        { campo: 'quantidade', rotulo: 'Peso (kg)', tipo: 'numero', largura: 'w-40', pesoMateriais: true },
        { campo: 'valor_unitario', rotulo: 'Valor por kg', tipo: 'numero', largura: 'w-32' },
      ] },
    ],
  },
  {
    id: 'frete', letra: 'C', titulo: 'Frete terceirizado',
    colunas: [
      { campo: 'descricao', rotulo: 'Descrição', tipo: 'texto', largura: 'min-w-[220px]' },
      { campo: 'detalhe', rotulo: 'Origem', tipo: 'texto', largura: 'min-w-[130px]' },
      { campo: 'detalhe2', rotulo: 'Destino', tipo: 'texto', largura: 'min-w-[130px]' },
      { campo: 'quantidade', rotulo: 'Qtd', tipo: 'numero', largura: 'w-20' },
      { campo: 'valor_unitario', rotulo: 'Preço unitário', tipo: 'numero', largura: 'w-32' },
    ],
  },
  {
    id: 'mao_obra', letra: 'D', titulo: 'Mão de obra', colunas: [],
    blocos: [
      { grupo: 'Administrativo', adicionar: 'função administrativa', colunas: MAO_OBRA_COLS },
      { grupo: 'Fabricação', adicionar: 'função de fabricação', colunas: MAO_OBRA_COLS },
      { grupo: 'Instalação', adicionar: 'função de instalação', colunas: MAO_OBRA_COLS },
    ],
  },
  {
    // Terceirizada "Sim": escolhe o serviço (por hora) de um fornecedor; "Não": escolhe no Maquinário próprio (decisão 50).
    id: 'maquinas', letra: 'E', titulo: 'Máquinas',
    colunas: [
      { campo: 'detalhe', rotulo: 'Terceirizada', tipo: 'simnao', largura: 'w-28' },
      { campo: 'descricao', rotulo: 'Máquina / serviço', tipo: 'escolha', largura: 'min-w-[220px]' },
      { campo: 'detalhe2', rotulo: 'Fornecedor', tipo: 'leitura', largura: 'min-w-[140px]' },
      { campo: 'valor_unitario', rotulo: 'Valor hora', tipo: 'numero', largura: 'w-28' },
      { campo: 'quantidade', rotulo: 'Horas', tipo: 'numero', largura: 'w-24' },
    ],
  },
  {
    id: 'viagem', letra: 'F', titulo: 'Viagem', colunas: [],
    blocos: [
      { grupo: 'Veículo próprio', adicionar: 'trecho com veículo próprio', colunas: [
        // Km/l e R$/l vêm do cadastro do veículo (Administração → Frota) e aparecem embaixo do nome, sem coluna.
        { campo: 'descricao', rotulo: 'Veículo', tipo: 'veiculo', largura: 'min-w-[200px]' },
        { campo: 'detalhe', rotulo: 'Origem', tipo: 'texto', largura: 'min-w-[140px]' },
        { campo: 'detalhe2', rotulo: 'Destino', tipo: 'texto', largura: 'min-w-[170px]', rota: true },
        { campo: 'fator', rotulo: 'Km (ida)', tipo: 'numero', largura: 'w-24' },
        { campo: 'adicional', rotulo: 'Pedágio (ida)', tipo: 'numero', largura: 'w-32' },
        { campo: 'quantidade', rotulo: 'Viagens', tipo: 'numero', largura: 'w-20' },
        { campo: 'ida_volta', rotulo: 'Ida e volta', tipo: 'idavolta', largura: 'w-20' },
      ] },
      { grupo: 'Veículo alugado', adicionar: 'veículo alugado', colunas: [
        { campo: 'descricao', rotulo: 'Veículo / locadora', tipo: 'texto', largura: 'min-w-[160px]' },
        { campo: 'detalhe', rotulo: 'Origem', tipo: 'texto', largura: 'min-w-[120px]' },
        { campo: 'detalhe2', rotulo: 'Destino', tipo: 'texto', largura: 'min-w-[140px]', rota: true },
        { campo: 'quantidade', rotulo: 'Diárias', tipo: 'numero', largura: 'w-20' },
        { campo: 'valor_unitario', rotulo: 'Valor da diária', tipo: 'numero', largura: 'w-32' },
        { campo: 'fator', rotulo: 'Km (ida)', tipo: 'numero', largura: 'w-24' },
        { campo: 'consumo', rotulo: 'Km/l', tipo: 'numero', largura: 'w-20' },
        { campo: 'combustivel', rotulo: 'R$/l', tipo: 'numero', largura: 'w-28' },
        { campo: 'adicional', rotulo: 'Pedágio (ida)', tipo: 'numero', largura: 'w-32' },
        { campo: 'ida_volta', rotulo: 'Ida e volta', tipo: 'idavolta', largura: 'w-20' },
      ] },
      { grupo: 'Alimentação', adicionar: 'alimentação', colunas: [
        { campo: 'descricao', rotulo: 'Descrição', tipo: 'texto' },
        { campo: 'quantidade', rotulo: 'Colaboradores', tipo: 'numero', largura: 'w-28' },
        { campo: 'fator', rotulo: 'Dias', tipo: 'numero', largura: 'w-20' },
        { campo: 'valor_unitario', rotulo: 'Valor da refeição', tipo: 'numero', largura: 'w-32' },
      ] },
      { grupo: 'Hospedagem', adicionar: 'hospedagem', colunas: [
        { campo: 'quantidade', rotulo: 'Diárias', tipo: 'numero', largura: 'w-24' },
        { campo: 'valor_unitario', rotulo: 'Valor do hotel', tipo: 'numero', largura: 'w-32' },
      ] },
    ],
  },
  // Seções antigas (só em revisões enviadas antes da decisão 50): ficam como foram enviadas.
  { id: 'frota', letra: '·', titulo: 'Frota e fretes (antigo)', legado: true, colunas: [
    { campo: 'grupo', rotulo: 'Grupo', tipo: 'texto', largura: 'w-36' },
    { campo: 'descricao', rotulo: 'Descrição', tipo: 'texto' },
    { campo: 'detalhe', rotulo: 'Origem', tipo: 'texto', largura: 'w-32' },
    { campo: 'detalhe2', rotulo: 'Destino', tipo: 'texto', largura: 'w-32' },
    { campo: 'quantidade', rotulo: 'Qtd / viagens', tipo: 'numero', largura: 'w-24' },
    { campo: 'valor_unitario', rotulo: 'Preço unitário', tipo: 'numero', largura: 'w-28' },
  ] },
  { id: 'alimentacao', letra: '·', titulo: 'Alimentação (antigo)', legado: true, colunas: [
    { campo: 'descricao', rotulo: 'Descrição', tipo: 'texto' },
    { campo: 'quantidade', rotulo: 'Colaboradores', tipo: 'numero', largura: 'w-28' },
    { campo: 'fator', rotulo: 'Dias', tipo: 'numero', largura: 'w-20' },
    { campo: 'valor_unitario', rotulo: 'Valor da refeição', tipo: 'numero', largura: 'w-32' },
  ] },
  { id: 'hospedagem', letra: '·', titulo: 'Hospedagem (antigo)', legado: true, colunas: [
    { campo: 'quantidade', rotulo: 'Diárias', tipo: 'numero', largura: 'w-24' },
    { campo: 'valor_unitario', rotulo: 'Valor do hotel', tipo: 'numero', largura: 'w-32' },
  ] },
  // Seções antigas (só em revisões enviadas antes da decisão 42).
  { id: 'acessorios', letra: '·', titulo: 'Acessórios (antigo)', legado: true, colunas: [
    { campo: 'descricao', rotulo: 'Descrição', tipo: 'texto' },
    { campo: 'valor_unitario', rotulo: 'Valor', tipo: 'numero', largura: 'w-36' },
  ] },
  { id: 'deslocamento', letra: '·', titulo: 'Deslocamento (antigo)', legado: true, colunas: [
    { campo: 'descricao', rotulo: 'Tipo', tipo: 'texto' },
    { campo: 'detalhe', rotulo: 'Destino', tipo: 'texto', largura: 'w-40' },
    { campo: 'quantidade', rotulo: 'Qtd', tipo: 'numero', largura: 'w-20' },
    { campo: 'valor_unitario', rotulo: 'Preço unitário', tipo: 'numero', largura: 'w-32' },
  ] },
  { id: 'fretes', letra: '·', titulo: 'Fretes (antigo)', legado: true, colunas: [
    { campo: 'descricao', rotulo: 'Tipo', tipo: 'texto' },
    { campo: 'detalhe', rotulo: 'Partida', tipo: 'texto', largura: 'w-36' },
    { campo: 'detalhe2', rotulo: 'Destino', tipo: 'texto', largura: 'w-36' },
    { campo: 'quantidade', rotulo: 'Qtd', tipo: 'numero', largura: 'w-20' },
    { campo: 'valor_unitario', rotulo: 'Preço unitário', tipo: 'numero', largura: 'w-32' },
  ] },
];

// Seções mostradas: as atuais sempre; as antigas só se tiverem linhas.
export const secoesVisiveis = (linhas: CustoLinha[]) => SECOES.filter((s) => !s.legado || linhas.some((l) => l.secao === s.id));

export type GrupoMaterial = 'Chapas' | 'Perfis' | 'Comerciais' | 'Fixadores' | 'Consumíveis';
export const GRUPOS_ITEM: GrupoMaterial[] = ['Comerciais', 'Fixadores', 'Consumíveis'];

// Nova ordem depois de arrastar: a linha sai da posição antiga e entra na nova; devolve só as que mudaram.
export function reordenar<T extends { id: string; ordem: number }>(lista: T[], deId: string, paraId: string): { id: string; ordem: number }[] {
  const ids = lista.map((l) => l.id);
  const de = ids.indexOf(deId);
  const para = ids.indexOf(paraId);
  if (de < 0 || para < 0 || de === para) return [];
  ids.splice(para, 0, ids.splice(de, 1)[0]);
  const base = Math.min(...lista.map((l) => l.ordem));
  const antes = new Map(lista.map((l) => [l.id, l.ordem]));
  return ids.map((id, i) => ({ id, ordem: base + i })).filter((x) => antes.get(x.id) !== x.ordem);
}

// Mesma regra do gatilho ajustar_linha_custo no banco.
export function totalLinha(l: Pick<CustoLinha, 'secao' | 'grupo' | 'quantidade' | 'fator' | 'valor_unitario'> & Partial<Pick<CustoLinha, 'adicional' | 'consumo' | 'combustivel' | 'ida_volta'>>): number {
  const q = Number(l.quantidade), f = Number(l.fator), v = Number(l.valor_unitario), a = Number(l.adicional ?? 0);
  const c = Number(l.consumo ?? 0);
  const combustivel = c > 0 ? (f / c) * Number(l.combustivel ?? 0) : 0; // km ÷ km/l × R$/l
  const mult = l.ida_volta ? 2 : 1; // ida e volta: km e pedágio contam 2 vezes (decisão 55)
  let t: number;
  if (l.grupo === 'Veículo próprio' && (l.secao === 'viagem' || l.secao === 'frota')) {
    t = q * (combustivel + a) * mult;
  } else if (l.secao === 'viagem' && l.grupo === 'Veículo alugado') {
    t = q * v + (combustivel + a) * mult;
  } else if (l.secao === 'acabamentos') {
    t = (l.grupo === 'Acabamento em inox' ? 1 : q) * v + a;
  } else if ((l.secao === 'materiais' && GRUPOS_ITEM.includes(l.grupo as GrupoMaterial)) || l.secao === 'frete' || (l.secao === 'viagem' && l.grupo === 'Hospedagem')) {
    t = q * v;
  } else {
    t = q * f * v;
  }
  return Math.round(t * 100) / 100;
}

export function totalSecao(linhas: CustoLinha[], secao: Secao): number {
  return linhas.filter((l) => l.secao === secao).reduce((s, l) => s + totalLinha(l), 0);
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export interface Resumo {
  porSecao: Record<Secao, number>;
  custos: number;
  margem: number;
  negociacao: number;
  imposto: number;
  precoUnitario: number;
  precoTotal: number;
  precoCalculado: number; // pelos custos, margem, negociação e imposto
  precoCalculadoUnitario: number;
  manual: boolean;
}

// Margem e negociação sobre todos os custos; imposto sempre por dentro, sobre o preço (decisões 30 e 43).
// Valor manual (decisões 70 e 99): quando preenchido, é o preço de venda de uma unidade; o total do item é ele × quantidade.
export function resumoItem(item: Pick<CustoItem, 'quantidade' | 'lucro_pct' | 'negociacao_pct' | 'imposto_pct'> & Partial<Pick<CustoItem, 'valor_manual'>>, linhas: CustoLinha[]): Resumo {
  const porSecao = Object.fromEntries(SECOES.map((s) => [s.id, r2(totalSecao(linhas, s.id))])) as Record<Secao, number>;
  const custos = Object.values(porSecao).reduce((a, b) => a + b, 0);
  const margem = (custos * Number(item.lucro_pct)) / 100;
  const negociacao = (custos * Number(item.negociacao_pct)) / 100;
  const base = custos + margem + negociacao;
  const pu = base / (1 - Number(item.imposto_pct) / 100);
  const manual = item.valor_manual != null;
  return {
    porSecao,
    custos: r2(custos),
    margem: r2(margem),
    negociacao: r2(negociacao),
    imposto: r2(pu - base),
    precoUnitario: manual ? r2(Number(item.valor_manual)) : r2(pu),
    precoTotal: manual ? r2(Number(item.valor_manual) * Number(item.quantidade)) : r2(pu * Number(item.quantidade)),
    precoCalculado: r2(pu * Number(item.quantidade)),
    precoCalculadoUnitario: r2(pu),
    manual,
  };
}

// Peso dos materiais do item (para galvanização e zincagem): chapas = qtd × kg; perfis = qtd × metros × kg/m da biblioteca.
export function pesoMateriais(linhas: CustoLinha[], kgPorMetro: (l: CustoLinha) => number | null): { kg: number; perfisSemKgM: number } {
  let kg = 0;
  let perfisSemKgM = 0;
  for (const l of linhas.filter((x) => x.secao === 'materiais')) {
    if (l.grupo === 'Chapas') kg += Number(l.quantidade) * Number(l.fator);
    else if (l.grupo === 'Perfis' && Number(l.quantidade) * Number(l.fator) > 0) {
      const kgm = kgPorMetro(l);
      if (kgm) kg += Number(l.quantidade) * Number(l.fator) * kgm;
      else perfisSemKgM += 1;
    }
  }
  return { kg: Math.round(kg * 1000) / 1000, perfisSemKgM };
}

// Links de rota (decisão 42): o Qualp não aceita origem/destino pelo endereço, então abre o site e a rota vai para a área de transferência;
// o Google Maps abre a rota pronta para conferir os km.
export const linkMapa = (origem: string, destino: string) =>
  `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origem)}&destination=${encodeURIComponent(destino)}&travelmode=driving`;
export const LINK_QUALP = 'https://qualp.com.br/';

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

// Linhas iniciais de um item novo.
export type LinhaNova = Omit<CustoLinha, 'id' | 'item_id' | 'total'>;
export function modeloLinhas(maoObra: { etapa: string; funcao: string; valor_hora: number }[], maquinas: { nome: string; valor_hora: number }[]): LinhaNova[] {
  const base = { grupo: '', descricao: '', detalhe: '', detalhe2: '', unidade: '', quantidade: 0, fator: 1, valor_unitario: 0, material: '', adicional: 0, consumo: null, combustivel: null };
  const linhas: LinhaNova[] = [];
  let o = 0;
  const add = (secao: Secao, l: Partial<LinhaNova>) => linhas.push({ ...base, ...l, secao, ordem: o++ });
  maoObra.forEach((m) => add('mao_obra', { grupo: m.etapa, descricao: m.funcao, valor_unitario: Number(m.valor_hora) }));
  // Só o maquinário próprio entra no modelo; serviço terceirizado é escolhido no fornecedor (decisão 50).
  maquinas.forEach((m) => add('maquinas', { descricao: m.nome, detalhe: 'Não', valor_unitario: Number(m.valor_hora) }));
  add('viagem', { grupo: 'Alimentação', descricao: 'Refeições' });
  add('viagem', { grupo: 'Hospedagem' });
  [
    ['Coleta de matéria-prima (chapas)', 'São Paulo-SP', 'Mococa-SP'],
    ['Coleta de matéria-prima (perfis)', 'São Paulo-SP', 'Mococa-SP'],
    ['Coleta dos itens comerciais', 'São Paulo-SP', 'Mococa-SP'],
    ['Transporte para entrega no projeto', 'Mococa-SP', ''],
  ].forEach(([d, p, de]) => add('frete', { descricao: d, detalhe: p, detalhe2: de }));
  return linhas;
}
