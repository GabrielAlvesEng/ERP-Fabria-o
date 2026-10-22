import { tipoDaPeca } from '@/modules/engenharia/biblioteca';
import type { CodOp } from '@/modules/engenharia/regras';

// Regras do módulo Compras (docs/PLANEJAMENTO_COMPRAS.md, decisão 101).

export type StatusRequisicao = 'aberta' | 'em_cotacao' | 'aguardando_aprovacao' | 'aprovada' | 'pedido_emitido' | 'entregue' | 'cancelada';
export type StatusPedido = 'aguardando_entrega' | 'entregue_parcial' | 'entregue';
export type GrupoItem = 'Chapas' | 'Perfis' | 'Comerciais' | 'Fixadores' | 'Consumíveis' | 'Serviços' | 'Outros';

export const GRUPOS: GrupoItem[] = ['Chapas', 'Perfis', 'Comerciais', 'Fixadores', 'Consumíveis', 'Serviços', 'Outros'];
export const UNIDADES = ['un', 'pç', 'kg', 'm', 'm²', 'barra', 'chapa', 'cx', 'L', 'h', 'serviço'];
export const SETORES = ['Engenharia', 'Fabricação', 'Montagem em campo', 'Manutenção', 'Qualidade', 'Administrativo', 'Outro'];

// Colunas do painel, na ordem do fluxo (cancelada fica fora do quadro).
export const ETAPAS: { status: StatusRequisicao; rotulo: string }[] = [
  { status: 'aberta', rotulo: 'Abertas' },
  { status: 'em_cotacao', rotulo: 'Em cotação' },
  { status: 'aguardando_aprovacao', rotulo: 'Aguardando aprovação' },
  { status: 'aprovada', rotulo: 'Aprovadas' },
  { status: 'pedido_emitido', rotulo: 'Pedido emitido' },
  { status: 'entregue', rotulo: 'Entregues' },
];

export const ROTULO_STATUS: Record<StatusRequisicao, string> = {
  aberta: 'Aberta', em_cotacao: 'Em cotação', aguardando_aprovacao: 'Aguardando aprovação', aprovada: 'Aprovada',
  pedido_emitido: 'Pedido emitido', entregue: 'Entregue', cancelada: 'Cancelada',
};
export const ROTULO_PEDIDO: Record<StatusPedido, string> = { aguardando_entrega: 'Aguardando entrega', entregue_parcial: 'Entrega parcial', entregue: 'Entregue' };
export const ROTULO_PAGAMENTO: Record<string, string> = { antecipado: 'Antecipado', apos_recebimento: 'Após o recebimento', a_combinar: 'A combinar' };

export const editavel = (s: StatusRequisicao) => s === 'aberta' || s === 'em_cotacao';

export function pedidoAtrasado(p: { status: StatusPedido; previsao_entrega: string | null }, hoje: string): boolean {
  return p.status !== 'entregue' && !!p.previsao_entrega && p.previsao_entrega < hoje;
}

// ---------- Comparação de cotações ----------

export interface ItemCotado { id: string; quantidade: number }
export interface CotacaoComPrecos { id: string; frete: number; precos: Record<string, number | undefined> }
export interface TotalCotacao { itens: number; total: number; faltam: number }

const r2 = (n: number) => Math.round(n * 100) / 100;

export function totalCotacao(c: CotacaoComPrecos, itens: ItemCotado[]): TotalCotacao {
  let soma = 0;
  let faltam = 0;
  for (const i of itens) {
    const v = c.precos[i.id];
    if (v == null) faltam++;
    else soma += r2(i.quantidade * v);
  }
  return { itens: r2(soma), total: r2(soma + Number(c.frete || 0)), faltam };
}

// Menor preço unitário de cada item entre as cotações (para pintar de verde na comparação).
export function menoresPrecos(cotacoes: CotacaoComPrecos[], itens: ItemCotado[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const i of itens) {
    const vs = cotacoes.map((c) => c.precos[i.id]).filter((v): v is number => v != null);
    if (vs.length) m[i.id] = Math.min(...vs);
  }
  return m;
}

// Cotação completa (todos os itens com preço) de menor total.
export function melhorCotacao(cotacoes: CotacaoComPrecos[], itens: ItemCotado[]): string | null {
  let melhor: { id: string; total: number } | null = null;
  for (const c of cotacoes) {
    const t = totalCotacao(c, itens);
    if (t.faltam > 0 || !itens.length) continue;
    if (!melhor || t.total < melhor.total) melhor = { id: c.id, total: t.total };
  }
  return melhor?.id ?? null;
}

// ---------- Importar a lista de materiais do projeto ----------

export interface PecaProjeto {
  descricao: string; cod_op: string[]; cod_mat: string | null; material: string | null; espessura: number | null; largura: number | null;
  comprimento: number | null; peso_unit: number | null; bib_tipo: 'chapa' | 'perfil' | 'item' | null; bib_descricao: string | null;
  bib_grupo: string | null; bib_unidade: string | null; qtd_total: number;
}
export interface LinhaImportada { chave: string; grupo: GrupoItem; descricao: string; quantidade: number; unidade: string; observacoes: string }

const fmt = (n: number, casas = 2) => n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Soma a lista da Engenharia no que precisa ser comprado: chapas em kg (material + espessura), perfis em metros,
// itens comerciais em unidades. Mesma separação da lista de materiais (tipoDaPeca).
export function agruparLista(pecas: PecaProjeto[]): LinhaImportada[] {
  const mapa = new Map<string, LinhaImportada & { pesoFalta: number }>();
  const somar = (chave: string, base: Omit<LinhaImportada, 'chave' | 'quantidade' | 'observacoes'>, qtd: number, semPeso = 0) => {
    const l = mapa.get(chave) ?? { ...base, chave, quantidade: 0, observacoes: '', pesoFalta: 0 };
    l.quantidade += qtd;
    l.pesoFalta += semPeso;
    mapa.set(chave, l);
  };
  for (const p of pecas) {
    const qtd = Number(p.qtd_total) || 0;
    if (qtd <= 0) continue;
    const tipo = p.bib_tipo ?? tipoDaPeca({ ...p, cod_op: (p.cod_op ?? []) as CodOp[] });
    const mat = p.material || p.cod_mat || 'material não informado';
    if (tipo === 'item') {
      const desc = p.bib_descricao || p.descricao || '(sem descrição)';
      const grupo = (p.bib_grupo === 'Fixadores' || p.bib_grupo === 'Consumíveis' ? p.bib_grupo : 'Comerciais') as GrupoItem;
      somar(`item|${norm(desc)}`, { grupo, descricao: desc, unidade: p.bib_unidade || 'un' }, qtd);
    } else if (tipo === 'chapa') {
      const esp = Number(p.espessura) > 0 ? Number(p.espessura) : 0;
      const desc = esp ? `Chapa ${mat} ${fmt(esp)} mm` : `Chapa ${mat} (espessura não informada)`;
      const peso = Number(p.peso_unit) > 0 ? Number(p.peso_unit) * qtd : 0;
      somar(`chapa|${norm(mat)}|${esp}`, { grupo: 'Chapas', descricao: desc, unidade: 'kg' }, peso, peso ? 0 : qtd);
    } else if (tipo === 'perfil') {
      const desc = p.bib_descricao || [p.descricao, p.material].filter(Boolean).join(' · ') || '(perfil sem descrição)';
      const m = (Number(p.comprimento) || 0) / 1000 * qtd;
      somar(`perfil|${norm(desc)}`, { grupo: 'Perfis', descricao: desc, unidade: 'm' }, m, m ? 0 : qtd);
    } else {
      const desc = p.descricao || '(sem descrição)';
      somar(`outro|${norm(desc)}|${norm(mat)}`, { grupo: 'Outros', descricao: desc, unidade: 'pç' }, qtd);
    }
  }
  const ordem: GrupoItem[] = GRUPOS;
  return [...mapa.values()]
    .map(({ pesoFalta, ...l }) => {
      const quantidade = Math.round(l.quantidade * 1000) / 1000;
      const obs = pesoFalta > 0 ? (l.grupo === 'Chapas' ? `${fmt(pesoFalta, 0)} peça(s) sem peso no projeto` : `${fmt(pesoFalta, 0)} peça(s) sem comprimento no projeto`) : '';
      // Sem peso/comprimento nenhum, a linha vai em peças para Compras ajustar.
      return quantidade > 0 ? { ...l, quantidade, observacoes: obs } : { ...l, quantidade: pesoFalta, unidade: 'pç', observacoes: obs };
    })
    .sort((a, b) => ordem.indexOf(a.grupo) - ordem.indexOf(b.grupo) || a.descricao.localeCompare(b.descricao));
}
