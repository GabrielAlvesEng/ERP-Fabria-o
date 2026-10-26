import { tipoDaPeca } from '@/modules/engenharia/biblioteca';
import type { CodOp } from '@/modules/engenharia/regras';

// Regras do módulo Compras (docs/PLANEJAMENTO_COMPRAS.md e PLANEJAMENTO_COMPRAS_V2.md, decisões 101 e 103).

export type StatusRequisicao = 'aberta' | 'concluida' | 'cancelada';
export type StatusItem = 'a_comprar' | 'comprado' | 'recebido' | 'cancelado';
export type StatusPedido = 'aguardando_entrega' | 'entregue_parcial' | 'entregue' | 'cancelada';
export type Origem = 'engenharia' | 'almoxarifado' | 'compras';
export type CondicaoTipo = 'antecipado' | 'apos_recebimento' | 'parcelado' | 'a_combinar';
export type BibTipo = 'chapa' | 'perfil' | 'item';
export type GrupoItem = 'Chapas' | 'Perfis' | 'Comerciais' | 'Fixadores' | 'Consumíveis' | 'Serviços' | 'Outros';

export const GRUPOS: GrupoItem[] = ['Chapas', 'Perfis', 'Comerciais', 'Fixadores', 'Consumíveis', 'Serviços', 'Outros'];
export const UNIDADES = ['un', 'pç', 'kg', 'm', 'm²', 'barra', 'chapa', 'cx', 'L', 'h', 'serviço'];
export const SETORES = ['Engenharia', 'Almoxarifado', 'Fabricação', 'Montagem em campo', 'Manutenção', 'Qualidade', 'Administrativo', 'Outro'];

export type StatusPacote = 'aberto' | 'comprado' | 'cancelado';
export const ROTULO_PACOTE: Record<StatusPacote, string> = { aberto: 'Em cotação', comprado: 'Comprado', cancelado: 'Cancelado' };

export const ROTULO_STATUS: Record<StatusRequisicao, string> = { aberta: 'Aberta', concluida: 'Concluída', cancelada: 'Cancelada' };
export const ROTULO_ITEM: Record<StatusItem, string> = { a_comprar: 'À comprar', comprado: 'Comprado', recebido: 'Recebido', cancelado: 'Cancelado' };
export const ROTULO_PEDIDO: Record<StatusPedido, string> = { aguardando_entrega: 'Aguardando entrega', entregue_parcial: 'Entrega parcial', entregue: 'Entregue', cancelada: 'Cancelada' };
export const ROTULO_ORIGEM: Record<Origem, string> = { engenharia: 'Engenharia', almoxarifado: 'Almoxarifado', compras: 'Compras' };
export const ROTULO_PAGAMENTO: Record<string, string> = { antecipado: 'Antecipado', apos_recebimento: 'Após o recebimento', a_combinar: 'A combinar' };
export const ROTULO_CONDICAO: Record<CondicaoTipo, string> = { antecipado: 'Antecipado', apos_recebimento: 'Após o recebimento', parcelado: 'Parcelado', a_combinar: 'A combinar' };

// "28" ou "30/60/90" → [28] / [30, 60, 90].
export function lerDias(t: string): number[] {
  return t.split(/[^\d]+/).filter(Boolean).map(Number).filter((n) => n >= 0 && n <= 999);
}
export function descreverCondicao(tipo: CondicaoTipo, dias: number[]): string {
  if (tipo === 'antecipado') return 'Antecipado';
  if (tipo === 'a_combinar') return 'A combinar';
  const d = dias.length ? `${dias.join('/')} dias` : '';
  return tipo === 'parcelado' ? `Parcelado ${d} da emissão`.trim() : `${d || 'No'} após o recebimento`.trim();
}

export function pedidoAtrasado(p: { status: StatusPedido; previsao_entrega: string | null }, hoje: string): boolean {
  return (p.status === 'aguardando_entrega' || p.status === 'entregue_parcial') && !!p.previsao_entrega && p.previsao_entrega < hoje;
}

// ---------- Comparação de cotações ----------

export interface ItemCotado { id: string; quantidade: number }
export interface CotacaoComPrecos { id: string; frete: number; precos: Record<string, number | undefined>; ipis?: Record<string, number | undefined> }
export interface TotalCotacao { itens: number; ipi: number; total: number; faltam: number }

const r2 = (n: number) => Math.round(n * 100) / 100;

// Valor de um item com IPI (decisão 114): quantidade × unitário × (1 + IPI%), em centavos.
export function valorComIpi(quantidade: number, unit: number, ipi = 0): number {
  return r2(quantidade * unit * (1 + (Number(ipi) || 0) / 100));
}

// "itens" é o total dos itens já com IPI; "ipi" é só a parte do IPI dentro dele.
export function totalCotacao(c: CotacaoComPrecos, itens: ItemCotado[]): TotalCotacao {
  let soma = 0;
  let ipi = 0;
  let faltam = 0;
  for (const i of itens) {
    const v = c.precos[i.id];
    if (v == null) { faltam++; continue; }
    const com = valorComIpi(i.quantidade, v, c.ipis?.[i.id]);
    soma += com;
    ipi += com - r2(i.quantidade * v);
  }
  return { itens: r2(soma), ipi: r2(ipi), total: r2(soma + Number(c.frete || 0)), faltam };
}

// Menor preço unitário (com IPI) de cada item entre as cotações (para pintar de verde na comparação).
export function menoresPrecos(cotacoes: CotacaoComPrecos[], itens: ItemCotado[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const i of itens) {
    const vs = cotacoes.map((c) => (c.precos[i.id] == null ? null : c.precos[i.id]! * (1 + (c.ipis?.[i.id] ?? 0) / 100))).filter((v): v is number => v != null);
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

// ---------- À comprar (decisão 111) ----------
// Para quem é o item: pedido (projeto da Engenharia), estoque (Almoxarifado) ou o setor que pediu.
export type Destino = 'pedido' | 'estoque' | 'setor';
export const ROTULO_DESTINO: Record<Destino, string> = { pedido: 'Pedido (Engenharia)', estoque: 'Estoque (Almoxarifado)', setor: 'Setor' };
export function destinoDe(r: { projeto_codigo: string; origem: Origem }): Destino {
  if (r.projeto_codigo) return 'pedido';
  return r.origem === 'almoxarifado' ? 'estoque' : 'setor';
}
export function rotuloDestino(r: { projeto_codigo: string; origem: Origem; setor: string }): string {
  const d = destinoDe(r);
  return d === 'pedido' ? `Pedido ${r.projeto_codigo}` : d === 'estoque' ? 'Estoque' : r.setor || 'Setor';
}

// Agrupa os itens por categoria (na ordem de GRUPOS) e, dentro dela, pedido antes de estoque, urgente e data primeiro.
// A categoria só organiza a tela: o comprador junta itens de categorias diferentes no mesmo pacote.
export interface ItemParaAgrupar {
  grupo: GrupoItem; descricao: string;
  compras_requisicoes: { projeto_codigo: string; origem: Origem; prioridade: 'normal' | 'urgente'; necessario_em: string | null };
}
export function agruparAComprar<T extends ItemParaAgrupar>(itens: T[]): { grupo: GrupoItem; itens: T[] }[] {
  const ordemDestino: Destino[] = ['pedido', 'estoque', 'setor'];
  const chave = (i: T) => [
    ordemDestino.indexOf(destinoDe(i.compras_requisicoes)),
    i.compras_requisicoes.prioridade === 'urgente' ? 0 : 1,
    i.compras_requisicoes.necessario_em ?? '9999',
  ] as const;
  return GRUPOS.map((grupo) => ({
    grupo,
    itens: itens.filter((i) => i.grupo === grupo).sort((a, b) => {
      const [x, y] = [chave(a), chave(b)];
      return x[0] - y[0] || x[1] - y[1] || x[2].localeCompare(y[2]) || a.descricao.localeCompare(b.descricao);
    }),
  })).filter((g) => g.itens.length);
}

// ---------- Importar a lista de materiais do projeto ----------

export interface PecaProjeto {
  descricao: string; cod_op: string[]; cod_mat: string | null; material: string | null; espessura: number | null; largura: number | null;
  comprimento: number | null; peso_unit: number | null; bib_tipo: BibTipo | null; bib_id?: string | null; bib_descricao: string | null;
  bib_grupo: string | null; bib_unidade: string | null; qtd_total: number;
}
export interface LinhaImportada { chave: string; grupo: GrupoItem; descricao: string; quantidade: number; unidade: string; observacoes: string; bib_tipo: BibTipo | null; bib_id: string | null }

const fmt = (n: number, casas = 2) => n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Soma a lista da Engenharia no que precisa ser comprado: chapas em kg (material + espessura), perfis em metros,
// itens comerciais em unidades. Mesma separação da lista de materiais (tipoDaPeca).
export function agruparLista(pecas: PecaProjeto[]): LinhaImportada[] {
  const mapa = new Map<string, LinhaImportada & { pesoFalta: number }>();
  const somar = (chave: string, base: Omit<LinhaImportada, 'chave' | 'quantidade' | 'observacoes' | 'bib_tipo' | 'bib_id'> & { bib_tipo?: BibTipo | null; bib_id?: string | null }, qtd: number, semPeso = 0) => {
    const l = mapa.get(chave) ?? { bib_tipo: null, bib_id: null, ...base, chave, quantidade: 0, observacoes: '', pesoFalta: 0 };
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
      somar(p.bib_tipo === 'item' && p.bib_id ? `item|${p.bib_id}` : `item|${norm(desc)}`, { grupo, descricao: desc, unidade: p.bib_unidade || 'un', ...(p.bib_tipo === 'item' && p.bib_id ? { bib_tipo: 'item' as const, bib_id: p.bib_id } : {}) }, qtd);
    } else if (tipo === 'chapa') {
      const esp = Number(p.espessura) > 0 ? Number(p.espessura) : 0;
      const desc = esp ? `Chapa ${mat} ${fmt(esp)} mm` : `Chapa ${mat} (espessura não informada)`;
      const peso = Number(p.peso_unit) > 0 ? Number(p.peso_unit) * qtd : 0;
      if (p.bib_tipo === 'chapa' && p.bib_id) somar(`chapa|${p.bib_id}`, { grupo: 'Chapas', descricao: desc, unidade: 'kg', bib_tipo: 'chapa', bib_id: p.bib_id }, peso, peso ? 0 : qtd);
      else somar(`chapa|${norm(mat)}|${esp}`, { grupo: 'Chapas', descricao: desc, unidade: 'kg' }, peso, peso ? 0 : qtd);
    } else if (tipo === 'perfil') {
      const desc = p.bib_descricao || [p.descricao, p.material].filter(Boolean).join(' · ') || '(perfil sem descrição)';
      const m = (Number(p.comprimento) || 0) / 1000 * qtd;
      somar(p.bib_tipo === 'perfil' && p.bib_id ? `perfil|${p.bib_id}` : `perfil|${norm(desc)}`, { grupo: 'Perfis', descricao: desc, unidade: 'm', ...(p.bib_tipo === 'perfil' && p.bib_id ? { bib_tipo: 'perfil' as const, bib_id: p.bib_id } : {}) }, m, m ? 0 : qtd);
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

// ---------- Ficha do produto (aba Produtos) ----------
// Junta o cadastro (Biblioteca) com o histórico das OCs. Item comprado sem cadastro vira ficha pela descrição.
export interface CompraHistorico { bib_tipo: BibTipo | null; bib_id: string | null; grupo: GrupoItem; descricao: string; unidade: string; emitido_em: string }
export interface FichaProduto<H extends CompraHistorico = CompraHistorico> {
  chave: string; tipo: BibTipo | null; id: string | null; descricao: string; grupo: GrupoItem; unidade: string; cadastrado: boolean;
  compras: H[]; busca: string;
}
export function fichasDeProdutos<H extends CompraHistorico & { fornecedor_nome?: string; pedido_codigo?: string }>(
  produtos: { tipo: BibTipo; id: string; descricao: string; grupo: GrupoItem; unidade: string }[], historico: H[],
): FichaProduto<H>[] {
  const mapa = new Map<string, FichaProduto<H>>();
  for (const p of produtos) {
    mapa.set(`${p.tipo}|${p.id}`, { chave: `${p.tipo}|${p.id}`, tipo: p.tipo, id: p.id, descricao: p.descricao, grupo: p.grupo, unidade: p.unidade, cadastrado: true, compras: [], busca: '' });
  }
  for (const h of historico) {
    const chave = h.bib_tipo && h.bib_id && mapa.has(`${h.bib_tipo}|${h.bib_id}`) ? `${h.bib_tipo}|${h.bib_id}` : `d|${norm(h.descricao)}|${h.unidade}`;
    let f = mapa.get(chave);
    if (!f) {
      f = { chave, tipo: null, id: null, descricao: h.descricao, grupo: h.grupo, unidade: h.unidade, cadastrado: false, compras: [], busca: '' };
      mapa.set(chave, f);
    }
    f.compras.push(h);
  }
  return [...mapa.values()]
    .map((f) => {
      const compras = [...f.compras].sort((a, b) => b.emitido_em.localeCompare(a.emitido_em));
      const extra = compras.map((c) => `${c.fornecedor_nome ?? ''} ${c.pedido_codigo ?? ''}`).join(' ');
      return { ...f, compras, busca: norm(`${f.descricao} ${f.grupo} ${extra}`) };
    })
    .sort((a, b) => (b.compras[0]?.emitido_em ?? '').localeCompare(a.compras[0]?.emitido_em ?? '') || a.descricao.localeCompare(b.descricao));
}
