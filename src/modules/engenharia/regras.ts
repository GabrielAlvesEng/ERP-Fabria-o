// Regras da Engenharia: árvore de montagens, classificação das peças e lista de materiais (BOM).

export type TipoConjunto = 'geral' | 'submontagem' | 'conjunto' | 'soldado';
export type StatusConjunto = 'modelando' | 'detalhando' | 'revisao' | 'liberado';
export const COD_OPS = ['LC', 'LP', 'PO', 'GU', 'DO', 'CL', 'US', 'CM'] as const;
export type CodOp = (typeof COD_OPS)[number];
export const NOME_OP: Record<CodOp, string> = {
  LC: 'Corte a laser de chapas', LP: 'Corte a laser de perfis', PO: 'Corte em policorte', GU: 'Corte em guilhotina',
  DO: 'Dobra', CL: 'Calandragem', US: 'Usinagem', CM: 'Item comercial',
};
export const NOME_STATUS: Record<StatusConjunto, string> = { modelando: 'Modelando', detalhando: 'Detalhando', revisao: 'Em revisão', liberado: 'Liberado' };

export interface Projeto {
  id: string;
  proposta_id: string;
  codigo: string;
  titulo: string;
  empresa_id: string;
  status: 'em_andamento' | 'pausado' | 'concluido' | 'cancelado';
  responsavel_id: string | null;
  prazo: string | null;
  observacoes: string;
  criado_em: string;
  dados_cad?: Record<string, unknown>;
  importado_cad_em?: string | null;
  empresas?: { nome_fantasia: string } | null;
}

export interface Conjunto {
  id: string;
  projeto_id: string;
  pai_id: string | null;
  tipo: TipoConjunto;
  sub: string;
  conj: number;
  codigo: string;
  nome: string;
  descricao: string;
  quantidade: number;
  status: StatusConjunto;
  revisao: string;
  ordem: number;
  codigo_cad?: string;
  chave_cad?: string | null;
  dados_cad?: Record<string, unknown>;
  removido_cad_em?: string | null;
}

export interface Peca {
  id: string;
  projeto_id: string;
  conjunto_id: string;
  seq: number;
  codigo: string;
  descricao: string;
  quantidade: number;
  cod_op: CodOp[];
  material: string;
  cod_mat: string | null;
  espessura: number | null;
  peso_unit: number | null;
  comprimento?: number | null;
  codigo_cad?: string;
  chave_cad?: string | null;
  dados_cad?: Record<string, unknown>;
  removido_cad_em?: string | null;
  observacoes: string;
}

export interface No extends Conjunto { filhos: No[] }

export function montarArvore(conjuntos: Conjunto[]): No | null {
  const nos = new Map<string, No>(conjuntos.map((c) => [c.id, { ...c, filhos: [] }]));
  let raiz: No | null = null;
  for (const n of nos.values()) {
    if (n.pai_id && nos.has(n.pai_id)) nos.get(n.pai_id)!.filhos.push(n);
    else if (n.tipo === 'geral') raiz = n;
  }
  const ordenar = (n: No) => { n.filhos.sort((a, b) => a.codigo.localeCompare(b.codigo)); n.filhos.forEach(ordenar); };
  if (raiz) ordenar(raiz);
  return raiz;
}

// Quantas vezes o conjunto aparece no projeto (multiplica as quantidades até a montagem geral).
export function multiplicador(conjuntoId: string, conjuntos: Conjunto[]): number {
  const porId = new Map(conjuntos.map((c) => [c.id, c]));
  let m = 1;
  let atual = porId.get(conjuntoId);
  const vistos = new Set<string>();
  while (atual && !vistos.has(atual.id)) {
    vistos.add(atual.id);
    m *= Number(atual.quantidade) || 1;
    atual = atual.pai_id ? porId.get(atual.pai_id) : undefined;
  }
  return m;
}

const FIXADORES = /parafuso|porca|arruela|prisioneiro|rebite|fixador|chumbador|parabolt/i;
export type Pasta = 'fabricada' | 'fixador' | 'comercial';
export const NOME_PASTA: Record<Pasta, string> = { fabricada: 'Peças fabricadas', fixador: 'Fixadores', comercial: 'Itens comerciais' };

export function pastaDaPeca(p: Pick<Peca, 'cod_op' | 'descricao'>): Pasta {
  if (!p.cod_op.includes('CM')) return 'fabricada';
  return FIXADORES.test(p.descricao) ? 'fixador' : 'comercial';
}

export interface LinhaBom extends Peca { conjunto: string; qtdTotal: number; pesoTotal: number | null; pasta: Pasta; removido: boolean }

// Removido do CAD (decisão 38, R1): a peça ou algum conjunto acima dela saiu do CAD.
export function removidoNaArvore(conjuntoId: string, conjuntos: Conjunto[]): boolean {
  const porId = new Map(conjuntos.map((c) => [c.id, c]));
  let atual = porId.get(conjuntoId);
  const vistos = new Set<string>();
  while (atual && !vistos.has(atual.id)) {
    if (atual.removido_cad_em) return true;
    vistos.add(atual.id);
    atual = atual.pai_id ? porId.get(atual.pai_id) : undefined;
  }
  return false;
}

export function listaMateriais(pecas: Peca[], conjuntos: Conjunto[], incluirRemovidos = false): LinhaBom[] {
  const porId = new Map(conjuntos.map((c) => [c.id, c]));
  return pecas
    .filter((p) => porId.has(p.conjunto_id))
    .map((p) => ({ p, removido: Boolean(p.removido_cad_em) || removidoNaArvore(p.conjunto_id, conjuntos) }))
    .filter(({ removido }) => incluirRemovidos || !removido)
    .map(({ p, removido }) => ({ ...p, removido }))
    .map((p) => {
      const qtdTotal = Number(p.quantidade) * multiplicador(p.conjunto_id, conjuntos);
      return {
        ...p,
        conjunto: porId.get(p.conjunto_id)!.codigo,
        qtdTotal,
        pesoTotal: p.peso_unit == null ? null : Math.round(Number(p.peso_unit) * qtdTotal * 1000) / 1000,
        pasta: pastaDaPeca(p),
      };
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
}

export interface MaterialCatalogo { cod_mat: string; nome: string; categoria: string }

// "IN-001 — AISI 304" → { cod_mat: "IN-001", material: "AISI 304" }; texto livre fica sem COD_MAT.
export function lerMaterial(texto: string, catalogo: MaterialCatalogo[]): { cod_mat: string | null; material: string } {
  const t = texto.trim();
  const m = t.match(/^([A-Z]{2}-[0-9]{3})(?![0-9])/i);
  const item = m ? catalogo.find((c) => c.cod_mat === m[1].toUpperCase()) : catalogo.find((c) => c.nome.toLowerCase() === t.toLowerCase());
  return item ? { cod_mat: item.cod_mat, material: item.nome } : { cod_mat: null, material: t };
}

export const rotuloMaterial = (p: Pick<Peca, 'cod_mat' | 'material'>) => (p.cod_mat ? `${p.cod_mat} — ${p.material}` : p.material);

// Progresso simples da árvore: % de conjuntos liberados.
export function progresso(conjuntos: Conjunto[]): number {
  if (!conjuntos.length) return 0;
  return Math.round((conjuntos.filter((c) => c.status === 'liberado').length / conjuntos.length) * 100);
}
