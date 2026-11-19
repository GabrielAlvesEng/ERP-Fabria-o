import { tipoDaPeca } from '@/modules/engenharia/biblioteca';
import type { CodOp } from '@/modules/engenharia/regras';

// Regras do módulo Compras (docs/PLANEJAMENTO_COMPRAS.md e PLANEJAMENTO_COMPRAS_V2.md, decisões 101 e 103).

export type StatusRequisicao = 'aberta' | 'concluida' | 'cancelada';
export type StatusItem = 'a_comprar' | 'comprado' | 'recebido' | 'cancelado' | 'estoque';
export type StatusPedido = 'aguardando_entrega' | 'entregue_parcial' | 'entregue' | 'cancelada';
export type Origem = 'engenharia' | 'almoxarifado' | 'compras';
export type CondicaoTipo = 'antecipado' | 'apos_recebimento' | 'parcelado' | 'a_combinar';
export type BibTipo = 'chapa' | 'perfil' | 'item';
export type GrupoItem = 'Chapas' | 'Perfis' | 'Barras' | 'Comerciais' | 'Conexões' | 'Válvulas' | 'Fixadores' | 'Consumíveis' | 'Serviços' | 'Outros';

export const GRUPOS: GrupoItem[] = ['Chapas', 'Perfis', 'Barras', 'Comerciais', 'Conexões', 'Válvulas', 'Fixadores', 'Consumíveis', 'Serviços', 'Outros'];

// ---------- Produtos (decisão 121) ----------
// O produto é tipo + descrição (material entre parênteses) + unidade + preço atual; o preço vem do histórico.
export type TipoProduto = 'Chapas' | 'Perfis' | 'Barras' | 'Comerciais' | 'Conexões' | 'Válvulas' | 'Fixadores' | 'Consumíveis';
export const TIPOS_PRODUTO: TipoProduto[] = ['Chapas', 'Perfis', 'Barras', 'Comerciais', 'Conexões', 'Válvulas', 'Fixadores', 'Consumíveis'];
export const ROTULO_TIPO: Record<TipoProduto, string> = {
  Chapas: 'Chapa', Perfis: 'Perfil', Barras: 'Barra', Comerciais: 'Item comercial', Conexões: 'Conexão', Válvulas: 'Válvula', Fixadores: 'Fixador', Consumíveis: 'Consumível',
};
export const UNIDADES_PRODUTO = [{ valor: 'un', rotulo: 'Unidade' }, { valor: 'm', rotulo: 'Metros' }, { valor: 'kg', rotulo: 'Peso (kg)' }] as const;
export type OrigemPreco = 'estimado' | 'cotado' | 'comprado';
export const ROTULO_PRECO: Record<OrigemPreco, string> = { estimado: 'Estimado', cotado: 'Cotado', comprado: 'Comprado' };
// Valor unitário com o IPI (preço de uma unidade).
export const comImpostos = (valor: number, ipi: number) => Math.round(Number(valor) * (1 + Number(ipi) / 100) * 10000) / 10000;
// Produto ativo com a mesma descrição (sem diferença de maiúsculas, acentos e espaços) e do mesmo tipo.
export function casarProduto<P extends { id: string; grupo: string; descricao: string }>(produtos: P[], grupo: string, descricao: string): P | undefined {
  const d = norm(descricao);
  return produtos.find((p) => p.grupo === grupo && norm(p.descricao) === d) ?? produtos.find((p) => norm(p.descricao) === d);
}
// Decisão 133: na emissão da OC, produtos do cadastro parecidos com a descrição do item (palavras e medidas em comum).
export function produtosParecidos<P extends { id: string; grupo: string; descricao: string }>(produtos: P[], descricao: string, grupo = '', max = 5): P[] {
  const palavras = (t: string) => new Set(norm(t).replace(/[^a-z0-9/.,"]+/g, ' ').split(' ').filter((w) => w.length >= 2 || /\d/.test(w)));
  const alvo = palavras(descricao);
  if (!alvo.size) return [];
  return produtos
    .map((p) => {
      const ws = palavras(p.descricao);
      let comum = 0;
      ws.forEach((w) => { if (alvo.has(w)) comum += /\d/.test(w) ? 2 : 1; });
      const nota = comum / Math.max(alvo.size, ws.size) + (grupo && p.grupo === grupo ? 0.1 : 0);
      return { p, comum, nota };
    })
    .filter((x) => x.comum >= 2 || (x.comum >= 1 && x.nota >= 0.5))
    .sort((a, b) => b.nota - a.nota)
    .slice(0, max)
    .map((x) => x.p);
}
// Unidade que o fornecedor escreve (KG, MT, PC...) → unidade do cadastro.
export function unidadeDoProduto(u: string): 'un' | 'm' | 'kg' {
  const x = norm(u).replace(/[^a-z]/g, '');
  if (x === 'kg' || x === 'quilo' || x === 'peso') return 'kg';
  if (x === 'm' || x === 'mt' || x === 'mts' || x === 'metro' || x === 'metros' || x === 'ml') return 'm';
  return 'un';
}
// Tudo em unidade, com a medida na descrição (decisão 140). Itens antigos com outra unidade continuam como estão.
export const UNIDADES = ['un'];
export const SETORES = ['Engenharia', 'Almoxarifado', 'Fabricação', 'Montagem em campo', 'Manutenção', 'Qualidade', 'Administrativo', 'Outro'];

export type StatusPacote = 'aberto' | 'comprado' | 'cancelado';
export const ROTULO_PACOTE: Record<StatusPacote, string> = { aberto: 'Em cotação', comprado: 'Comprado', cancelado: 'Cancelado' };

export const ROTULO_STATUS: Record<StatusRequisicao, string> = { aberta: 'Aberta', concluida: 'Concluída', cancelada: 'Cancelada' };
export const ROTULO_ITEM: Record<StatusItem, string> = { a_comprar: 'À comprar', comprado: 'Comprado', recebido: 'Recebido', cancelado: 'Cancelado', estoque: 'Atendido pelo estoque' };
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

// Soma a lista da Engenharia no que precisa ser comprado. Tudo em unidade (decisão 140): perfis em barras (6 m; vigas 12 m),
// chapas em chapas inteiras (1.200 × 3.000 em aço carbono, 1.250 × 3.000 em inox e alumínio: o comprador confere),
// itens comerciais em unidades. A soma em metros ou kg vai na observação. Mesma separação da lista de materiais (tipoDaPeca).
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
      const soma = Math.round(l.quantidade * 1000) / 1000;
      const falta = pesoFalta > 0 ? (l.grupo === 'Chapas' ? `${fmt(pesoFalta, 0)} peça(s) sem peso no projeto` : `${fmt(pesoFalta, 0)} peça(s) sem comprimento no projeto`) : '';
      // Sem peso/comprimento nenhum, a linha vai com a quantidade de peças para Compras ajustar.
      if (!(soma > 0)) return { ...l, quantidade: pesoFalta, unidade: 'un', observacoes: falta };
      if (l.grupo === 'Perfis' && l.unidade === 'm') {
        const barra = barraPadrao(l.descricao);
        const obs = [`${fmt(soma)} m no projeto`, falta].filter(Boolean).join(' · ');
        return { ...l, descricao: `${l.descricao} barra ${barra} m`, quantidade: Math.ceil(soma / barra - 1e-9), unidade: 'un', observacoes: obs };
      }
      if (l.grupo === 'Chapas' && l.unidade === 'kg') {
        const esp = Number(l.descricao.match(/(\d+,\d+) mm/)?.[1]?.replace(',', '.')) || 0;
        const larg = densidade(l.descricao) === 7.85 ? 1200 : 1250;
        const kgChapa = esp * larg * 3000 * densidade(l.descricao) / 1e6;
        const obs = [`${fmt(soma)} kg no projeto${kgChapa ? `; chapa de ${fmt(kgChapa)} kg: confira o tamanho` : ''}`, falta].filter(Boolean).join(' · ');
        if (!kgChapa) return { ...l, unidade: 'kg', observacoes: obs };
        return { ...l, descricao: `${l.descricao.replace(/ mm$/, '')} x ${larg.toLocaleString('pt-BR')} x 3.000`, quantidade: Math.ceil(soma / kgChapa - 1e-9), unidade: 'un', observacoes: obs };
      }
      return { ...l, quantidade: soma, unidade: ehPeca(l.unidade) ? 'un' : l.unidade, observacoes: falta };
    })
    .sort((a, b) => ordem.indexOf(a.grupo) - ordem.indexOf(b.grupo) || a.descricao.localeCompare(b.descricao));
}


// ---------- PDF do fornecedor na cotação (decisão 135) ----------
// A IA devolve, em cada linha do PDF, o número (a partir de 1) do item da cotação que ela atende (0 = nenhum).
// Cada item fica com uma linha só e cada linha com um item só (a primeira que aparecer vale); o resto fica sem par.
export function ligarLinhas(totalItens: number, linhas: { item?: number }[]): number[] {
  const usadas = new Set<number>();
  const ligacao = Array<number>(totalItens).fill(-1);
  linhas.forEach((l, n) => {
    const k = Math.trunc(Number(l.item ?? 0)) - 1;
    if (k < 0 || k >= totalItens || ligacao[k] >= 0 || usadas.has(n)) return;
    ligacao[k] = n; usadas.add(n);
  });
  return ligacao;
}
// Unidade parecida o bastante para o preço valer direto (PC = pç = un; MT = m; BR = barra).
export function mesmaUnidade(a: string, b: string): boolean {
  const u = (x: string) => {
    const t = norm(x).replace(/[^a-z]/g, '');
    if (['pc', 'pca', 'peca', 'pecas', 'un', 'und', 'unid', 'unidade', 'p'].includes(t)) return 'un';
    if (['m', 'mt', 'mts', 'metro', 'metros', 'ml'].includes(t)) return 'm';
    if (['kg', 'quilo', 'peso'].includes(t)) return 'kg';
    if (['br', 'barra', 'barras', 'vara'].includes(t)) return 'barra';
    return t;
  };
  return u(a) === u(b);
}
// Comprimento da barra escrito na descrição do fornecedor, em metros: "COMP.5,80MT" → 5,8; "(5,50 A 6,45MT)" → 5,5 a 6,45;
// "6000 MM" → 6. Serve quando a IA não preencheu comprimento_min/max (decisão 139).
export function comprimentoNaDescricao(texto: string): { min: number; max: number } | null {
  const t = texto.replace(/\s+/g, ' ');
  const n = (x: string) => Number(x.replace(',', '.'));
  const faixa = t.match(/(\d{1,2}(?:[.,]\d+)?)\s*(?:A|ATÉ|ATE|-)\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:MTS?|M)\b/i);
  if (faixa) { const a = n(faixa[1]); const b = n(faixa[2]); if (a > 0 && b >= a && b <= 15) return { min: a, max: b }; }
  const um = t.match(/(\d{1,2}(?:[.,]\d+)?)\s*(?:MTS?|M)\b\s*\)?/i);
  if (um && /COMP|\(|BARRA|VARA/i.test(t)) { const a = n(um[1]); if (a >= 1 && a <= 15) return { min: a, max: a }; }
  const mm = t.match(/(\d{4,5})\s*MM\b/i);
  if (mm) { const a = n(mm[1]) / 1000; if (a >= 1 && a <= 15) return { min: a, max: a }; }
  return null;
}

// Fornecedor cotou por barra e o item está em metro (decisões 136 e 139). Vale o total do fornecedor: barras ofertadas × preço da
// barra, rateado nos metros pedidos (ex.: 5 barras × R$ 1.363,85 = R$ 6.819,23 para 26 m → R$ 262,2781/m). Assim o total na
// comparação é o que se paga de fato. Sem a quantidade de barras no PDF, calcula as barras pelo menor comprimento (arredonda para cima).
// O comprimento vem da IA ou da descrição; a nota explica a conta e avisa se as barras podem não cobrir os metros pedidos.
export function converterPreco(
  l: { unidade?: string; unidade_original?: string; descricao_original?: string; quantidade?: number; valor_unit: number; comprimento_min?: number; comprimento_max?: number },
  unidadeItem: string, qtdItem: number,
): { valor: number; nota: string } | null {
  if (!mesmaUnidade(unidadeItem, 'm') || !(qtdItem > 0)) return null;
  const doTexto = comprimentoNaDescricao(l.descricao_original ?? '');
  let min = Number(l.comprimento_min) || 0;
  let max = Math.max(Number(l.comprimento_max) || 0, min);
  if (min <= 0 && doTexto) ({ min, max } = doTexto);
  const un = l.unidade_original || l.unidade || '';
  // Por barra; ou por peça/unidade quando a descrição traz o comprimento da barra (tubo vendido por peça).
  if (!mesmaUnidade(un, 'barra') && !(mesmaUnidade(un, 'un') && min > 0)) return null;
  const doPdf = Number(l.quantidade) > 0;
  const barras = doPdf ? Number(l.quantidade) : min > 0 ? Math.ceil(qtdItem / min - 1e-9) : 0;
  if (!barras) return null;
  const preco = Number(l.valor_unit);
  const total = Math.round(barras * preco * 100) / 100;
  const valor = Math.round((total / qtdItem) * 10000) / 10000;
  const m = (x: number) => x.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  const r = (x: number, casas = 2) => x.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: casas });
  let nota = `Cotado por barra: ${m(barras)} barra(s) × ${r(preco, 4)} = ${r(total)}${doPdf ? '' : ' (barras calculadas pelo comprimento)'}, `
    + `rateado nos ${m(qtdItem)} m pedidos (${r(valor, 4)}/m)`;
  if (min > 0) {
    nota += max > min ? `; barra de ${m(min)} a ${m(max)} m, ${m(barras * min)} a ${m(barras * max)} m no total` : `; barra de ${m(min)} m, ${m(barras * min)} m no total`;
    if (barras * max < qtdItem - 1e-6) nota += '. ATENÇÃO: as barras somam menos que os metros pedidos';
    else if (barras * min < qtdItem - 1e-6) nota += '. Dependendo do comprimento, pode faltar tubo';
  }
  return { valor, nota: nota + '. Confira.' };
}

// ---------- Tudo por unidade (decisão 140) ----------
// A lista de compras é em un, com a medida na descrição ("Tubo 3\" SCH 40 barra 6 m", "Chapa 4,76 x 1500 x 3000 (304)").
// Barra, peça e vara contam como unidade.
export const ehPeca = (u: string) => mesmaUnidade(u, 'un') || mesmaUnidade(u, 'barra');

// Comprimento de uma unidade, lido na descrição do item: "barra 6 m", "6mts", "12 mt", "6000 mm" → metros.
export function comprimentoDoItem(texto: string): number | null {
  const t = texto.replace(/\s+/g, ' ');
  const n = (x: string) => Number(x.replace(',', '.'));
  const mm = [...t.matchAll(/(\d{4,5})\s*MM\b/gi)].pop();
  if (mm) { const a = n(mm[1]) / 1000; if (a >= 1 && a <= 15) return a; }
  const m = [...t.matchAll(/(\d{1,2}(?:[.,]\d+)?)\s*(?:MTS?|METROS?|M)(?![A-Z²³])/gi)].pop();
  if (m) { const a = n(m[1]); if (a >= 0.1 && a <= 15) return a; }
  return null;
}

// Comprimento padrão da barra (decisão 140): 6 m; vigas, 12 m.
export const barraPadrao = (descricao: string) => (/\bviga\b|perfil\s*[wih]\b|\b[wih]\s*\d{3}\b/i.test(descricao) ? 12 : 6);

// Densidade (kg/dm³) pelo material escrito na descrição.
function densidade(texto: string): number {
  const t = norm(texto);
  if (/alumin/.test(t)) return 2.7;
  if (/\b430\b/.test(t)) return 7.7;
  if (/inox|\b30[14]l?\b|\b31[06]l?\b/.test(t)) return 7.93;
  return 7.85;
}

// Peso de uma unidade, pela descrição: chapa "esp x larg x comp" (mm) × densidade, ou embalagem "lata 5 kg", "rolo 15 kg".
export function pesoDoItem(texto: string): { kg: number; como: string } | null {
  const t = texto.replace(/\s+/g, ' ');
  const n = (x: string) => Number(x.replace(/\./g, '').replace(',', '.'));
  const ch = t.match(/(\d{1,3}(?:,\d+)?)\s*[xX×]\s*(\d[\d.]{2,5})\s*[xX×]\s*(\d[\d.]{2,6})/);
  if (/chapa|bobina|xadrez/i.test(t) && ch) {
    const e = Number(ch[1].replace(',', '.')); const l = n(ch[2]); const c = n(ch[3]); const d = densidade(t);
    if (e > 0 && l > 0 && c > 0) {
      const kg = Math.round(e * l * c * d / 1e6 * 100) / 100;
      return { kg, como: `${ch[1]} × ${l.toLocaleString('pt-BR')} × ${c.toLocaleString('pt-BR')} mm × ${d.toLocaleString('pt-BR')} kg/dm³` };
    }
  }
  const emb = t.match(/(\d{1,4}(?:[.,]\d+)?)\s*KG\b/i);
  if (emb) { const kg = Number(emb[1].replace(',', '.')); if (kg > 0) return { kg, como: `embalagem de ${kg.toLocaleString('pt-BR')} kg` }; }
  return null;
}

// Preço do PDF para um item em unidade. Por unidade/barra/peça: o mesmo preço (alerta se o comprimento da barra do
// fornecedor não for o do item). Por metro ou kg: vale o total do fornecedor (quantidade × preço) dividido pelas
// unidades pedidas; sem a quantidade no PDF, preço × comprimento ou peso de uma unidade, lidos na descrição do item.
// A nota mostra a conta e avisa quando as duas contas não batem (mais de 5%).
export function precoPorUnidade(
  l: { unidade?: string; unidade_original?: string; descricao_original?: string; quantidade?: number; valor_unit: number; comprimento_min?: number; comprimento_max?: number },
  item: { unidade: string; quantidade: number; descricao: string },
): { valor: number; nota: string } | null {
  if (!ehPeca(item.unidade) || !(Number(item.quantidade) > 0)) return null;
  const un = l.unidade_original || l.unidade || '';
  const preco = Number(l.valor_unit) || 0;
  const qtd = Number(item.quantidade);
  const qPdf = Number(l.quantidade) || 0;
  const m2 = (x: number) => x.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  const r = (x: number, casas = 2) => x.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: casas });
  const r4 = (x: number) => Math.round(x * 10000) / 10000;

  if (ehPeca(un)) {
    const comp = comprimentoDoItem(item.descricao);
    const ia = Number(l.comprimento_min) > 0 ? { min: Number(l.comprimento_min), max: Math.max(Number(l.comprimento_max) || 0, Number(l.comprimento_min)) } : null;
    const forn = ia ?? comprimentoNaDescricao(l.descricao_original ?? '');
    if (comp && forn && (comp < forn.min - 0.05 || comp > forn.max + 0.05)) {
      const fx = forn.max > forn.min ? `${m2(forn.min)} a ${m2(forn.max)} m` : `${m2(forn.min)} m`;
      return { valor: preco, nota: `Barra do fornecedor de ${fx}, o item pede ${m2(comp)} m. Confira.` };
    }
    return null;
  }
  const porMetro = mesmaUnidade(un, 'm');
  const porKg = mesmaUnidade(un, 'kg');
  if (!porMetro && !porKg) return null;
  const medida = porMetro ? (() => { const c = comprimentoDoItem(item.descricao); return c ? { v: c, como: `${m2(c)} m` } : null; })()
    : (() => { const p = pesoDoItem(item.descricao); return p ? { v: p.kg, como: `${m2(p.kg)} kg (${p.como})` } : null; })();
  const u = porMetro ? 'm' : 'kg';
  const calc = medida ? r4(preco * medida.v) : null;
  if (qPdf > 0) {
    const total = Math.round(qPdf * preco * 100) / 100;
    const valor = r4(total / qtd);
    let nota = `Cotado por ${u}: ${m2(qPdf)} ${u} × ${r(preco, 4)} = ${r(total)}, dividido nas ${m2(qtd)} un pedidas (${r(valor, 4)}/un)`;
    if (calc != null) {
      nota += `; pela descrição, 1 un = ${medida!.como} → ${r(calc, 4)}/un`;
      if (Math.abs(calc - valor) > 0.05 * Math.max(calc, valor)) nota += '. ATENÇÃO: as duas contas não batem';
    }
    return { valor, nota: nota + '. Confira.' };
  }
  if (calc != null) return { valor: calc, nota: `Cotado por ${u}: ${r(preco, 4)}/${u} × ${medida!.como} = ${r(calc, 4)}/un. Confira.` };
  return null;
}

// Decisão 145: produtos do estoque que podem atender o item. O mesmo produto do cadastro vem primeiro; depois os parecidos
// pela descrição. Só entra o que tem disponível (saldo menos o já reservado).
export function estoqueParaItem<E extends { id: string; bib_tipo: string; bib_id: string; grupo: string; descricao: string; disponivel: number }>(
  item: { bib_tipo: string | null; bib_id: string | null; descricao: string; grupo: string }, estoque: E[],
): { mesmo: E | undefined; parecidos: E[] } {
  const comSaldo = estoque.filter((e) => Number(e.disponivel) > 0);
  const mesmo = item.bib_id ? comSaldo.find((e) => e.bib_tipo === item.bib_tipo && e.bib_id === item.bib_id) : undefined;
  const parecidos = produtosParecidos(comSaldo.filter((e) => e !== mesmo), item.descricao, item.grupo, 5);
  return { mesmo, parecidos };
}
