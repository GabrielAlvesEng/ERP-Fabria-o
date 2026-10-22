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

// Kanban da Engenharia (decisão 96): Cancelado fica fora do quadro; Pausado é selo.
export type StatusProjeto = 'nao_iniciado' | 'em_andamento' | 'liberado' | 'finalizado' | 'cancelado';
export const COLUNAS_PROJETO = ['nao_iniciado', 'em_andamento', 'liberado', 'finalizado'] as const;
export type ColunaProjeto = (typeof COLUNAS_PROJETO)[number];
export const NOME_STATUS_PROJETO: Record<StatusProjeto, string> = {
  nao_iniciado: 'Não iniciado', em_andamento: 'Em andamento', liberado: 'Liberado para fabricação', finalizado: 'Finalizado', cancelado: 'Cancelado',
};
export const COR_STATUS_PROJETO: Record<StatusProjeto, 'cinza' | 'roxo' | 'azul' | 'verde' | 'vermelho'> = {
  nao_iniciado: 'cinza', em_andamento: 'roxo', liberado: 'azul', finalizado: 'verde', cancelado: 'vermelho',
};

export interface Projeto {
  id: string;
  proposta_id: string | null;
  codigo: string;
  titulo: string;
  empresa_id: string | null;
  status: StatusProjeto;
  pausado: boolean;
  exemplo: boolean;
  fabricacao_concluida_em: string | null;
  responsavel_id: string | null;
  prazo: string | null;
  observacoes: string;
  criado_em: string;
  dados_cad?: Record<string, unknown>;
  importado_cad_em?: string | null;
  cliente_nome?: string | null;
}

// Atrasado: não finalizado (nem cancelado) com prazo antes de hoje.
export function atrasado(p: Pick<Projeto, 'status' | 'prazo'>, hoje: string): boolean {
  return !!p.prazo && p.prazo < hoje && p.status !== 'finalizado' && p.status !== 'cancelado';
}

// Regras do Kanban na tela (o banco valida de novo em mover_projeto).
export type Movimento = 'simples' | 'liberar' | 'finalizar' | 'voltar' | 'proibido';
export function tipoMovimento(de: StatusProjeto, para: ColunaProjeto, chefe: boolean): Movimento {
  const ordem = (s: StatusProjeto) => COLUNAS_PROJETO.indexOf(s as ColunaProjeto);
  if (de === 'cancelado' || de === para) return 'proibido';
  if (ordem(para) < ordem(de)) return chefe ? 'voltar' : 'proibido';
  if (para === 'finalizado') return chefe ? 'finalizar' : 'proibido';
  if (para === 'liberado') return chefe ? 'liberar' : 'proibido';
  return 'simples';
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
  largura?: number | null;
  peso_unit: number | null;
  comprimento?: number | null;
  codigo_cad?: string;
  chave_cad?: string | null;
  dados_cad?: Record<string, unknown>;
  removido_cad_em?: string | null;
  observacoes: string;
  bib_tipo?: 'chapa' | 'perfil' | 'item' | null;   // item da Biblioteca de Materiais (decisão 53)
  bib_id?: string | null;
  bib_confirmado?: boolean;
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

// Blocos da lista de materiais (decisão 96): Chapas, Perfis e Itens comerciais (fixadores entram nos comerciais).
export type Bloco = 'chapa' | 'perfil' | 'comercial';
export const NOME_BLOCO: Record<Bloco, string> = { chapa: 'Chapas', perfil: 'Perfis', comercial: 'Itens comerciais' };
export const OPS_PADRAO: Record<Bloco, CodOp[]> = { chapa: ['LC'], perfil: ['PO'], comercial: ['CM'] };

// Avanço pelos registros reais (Dashboard, decisão 96).
export interface PainelProjeto {
  id: string; conjuntos: number; conjuntos_modelados: number; conjuntos_liberados: number; conjuntos_revisao: number;
  status_geral: StatusConjunto | null; pecas: number; pecas_material: number; pecas_sem_material: number;
}
export interface Avanco { modelagem: number | null; materiais: number | null; detalhamento: number | null }
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);

export function avanco(p: PainelProjeto): Avanco {
  // Sem conjuntos, vale a montagem geral (projeto feito só com a lista manual).
  const semConj = p.conjuntos === 0;
  return {
    modelagem: semConj ? (p.status_geral ? (p.status_geral === 'modelando' ? 0 : 100) : null) : pct(p.conjuntos_modelados, p.conjuntos),
    materiais: pct(p.pecas_material, p.pecas),
    detalhamento: semConj ? (p.status_geral ? (p.status_geral === 'liberado' ? 100 : 0) : null) : pct(p.conjuntos_liberados, p.conjuntos),
  };
}

export function pendencias(pj: Pick<Projeto, 'responsavel_id' | 'prazo' | 'status'>, p: PainelProjeto | undefined): string[] {
  if (pj.status === 'finalizado' || pj.status === 'cancelado') return [];
  const lista: string[] = [];
  if (!pj.responsavel_id) lista.push('Sem responsável');
  if (!pj.prazo) lista.push('Sem prazo');
  if (p?.pecas_sem_material) lista.push(`${p.pecas_sem_material} peça(s) sem material`);
  if (p?.conjuntos_revisao) lista.push(`${p.conjuntos_revisao} conjunto(s) em revisão`);
  return lista;
}
