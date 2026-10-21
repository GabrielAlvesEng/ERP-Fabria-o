// Biblioteca de Materiais na Engenharia (decisão 53): cada peça pode apontar para um item da biblioteca
// (chapa, perfil ou item comercial/fixador/consumível). O ERP sugere; a Engenharia confirma.
import { FORMATOS, lerMedida, precosPerfil, tuboSch, type Formato } from '@/modules/biblioteca/regras';
import type { Peca } from './regras';

export type TipoBib = 'chapa' | 'perfil' | 'item';

export interface RefChapaEng { id: string; cod_mat: string; tipo_id: string; descricao: string; espessura_mm: number; largura_mm: number; comprimento_mm: number; peso_kg: number; valor_kg: number | null }
export interface RefPerfilEng { id: string; cod_mat: string | null; tipo_id: string; descricao: string; a_mm: number | null; b_mm: number | null; c_mm: number | null; parede_mm: number | null; kg_m: number | null; preco_modo: 'm' | 'kg'; valor: number }
export interface RefItemEng { id: string; grupo: 'Comerciais' | 'Fixadores' | 'Consumíveis'; descricao: string; unidade: string; valor: number }
export interface RefTipoEng { id: string; grupo: 'Chapas' | 'Perfis'; nome: string; formato: Formato }
export interface RefsEng {
  chapas: RefChapaEng[]; perfis: RefPerfilEng[]; itens: RefItemEng[]; tipos: RefTipoEng[];
  precosChapa: { cod_mat: string; tipo_id: string; valor_kg: number }[];
}

export type PecaBib = Pick<Peca, 'descricao' | 'cod_op' | 'cod_mat' | 'espessura' | 'peso_unit' | 'comprimento'> & { bib_tipo?: TipoBib | null; bib_id?: string | null; bib_confirmado?: boolean };

const OPS_CHAPA = ['LC', 'GU', 'DO', 'CL'];
const OPS_PERFIL = ['LP', 'PO'];
const TOL = 0.06; // mm de folga ao comparar medidas (frações de polegada arredondadas)

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/["”″]/g, '"').replace(/\s+/g, ' ').trim();

// Que tipo de item da biblioteca a peça deve usar.
export function tipoDaPeca(p: PecaBib): TipoBib | null {
  if (p.cod_op.includes('CM')) return 'item';
  if (Number(p.comprimento) > 0 || p.cod_op.some((o) => OPS_PERFIL.includes(o)) || /\b(tubo|barra|cantoneira|perfil|viga)\b/i.test(p.descricao)) return 'perfil';
  if (Number(p.espessura) > 0 || p.cod_op.some((o) => OPS_CHAPA.includes(o)) || /\bchapa\b/i.test(p.descricao)) return 'chapa';
  return null;
}

// Família do perfil pela descrição do CAD ("TUBO REDONDO Ø1.1/4" X 1,5" → tubo redondo) e medidas em mm.
const FAMILIAS: [RegExp, Formato[]][] = [
  [/tubo\s+quadrado/, ['tubo_quadrado']], [/tubo\s+retangular/, ['tubo_retangular']],
  [/tubo\s+(redondo\s+)?sch|\bsch\b/, ['tubo_sch']], [/tubo\s+(redondo|od)|tubo\s+estrutural|\btubo\b/, ['tubo_od', 'tubo_sch']],
  [/barra\s+chata/, ['barra_chata']], [/barra\s+redonda|vergalhao/, ['barra_redonda']], [/barra\s+quadrada/, ['barra_quadrada']],
  [/barra\s+sextavada/, ['barra_sextavada']], [/cantoneira/, ['cantoneira']], [/perfil\s+(h|hp)\b/, ['perfil_h']], [/perfil\s+u|\budc\b/, ['perfil_u']],
];

export function lerPerfilCad(descricao: string): { formatos: Formato[]; medidas: number[] } | null {
  const d = norm(descricao);
  const f = FAMILIAS.find(([re]) => re.test(d));
  if (!f) return null;
  // Tubo SCH: a medida vem da bitola (NPS) + schedule, pela tabela ASME.
  const sch = d.match(/\bsch\s*(\d+s?)\b/);
  if (sch) {
    const nps = d.replace(/\bsch\s*\d+s?\b/, ' ').match(/(\d+(?:[-.]\d+\/\d+)?(?:\/\d+)?)\s*"/);
    const t = nps ? tuboSch(nps[1] + '"', sch[1]) : null;
    return t ? { formatos: ['tubo_sch'], medidas: [t.od, t.parede] } : null;
  }
  const resto = d.replace(f[0], ' ').replace(/ø/g, ' ').replace(/\bsch\s*\d+s?\b/g, ' ');
  const medidas = resto.split(/\s*x\s*|\s+/).map((t) => t.replace(/mm$/, '')).map((t) => lerMedida(t)).filter((n): n is number => n != null);
  return medidas.length ? { formatos: f[1], medidas } : null;
}

// Medidas do perfil da biblioteca na mesma ordem em que aparecem na descrição (tamanho, depois parede).
function medidasPerfil(p: RefPerfilEng, formato: Formato): number[] {
  const def = formato in FORMATOS ? FORMATOS[formato as keyof typeof FORMATOS] : undefined;
  const v = [p.a_mm, def?.bIgualA ? null : p.b_mm, p.parede_mm, p.c_mm].filter((n): n is number => n != null && Number(n) > 0).map(Number);
  return v;
}

const mesmas = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) <= TOL);
// O CAD pode repetir o lado ("50 x 50 x 2", cantoneira "2 x 2 x 1/4"): aceita também sem a repetição.
const iguais = (bib: number[], cad: number[]) =>
  mesmas(bib, cad) || (cad.length >= 3 && Math.abs(cad[0] - cad[1]) <= TOL && mesmas(bib, [cad[0], ...cad.slice(2)]));

// Sugestão da biblioteca para a peça (não grava nada). Devolve null quando não há correspondência.
export function sugerirItem(p: PecaBib, refs: RefsEng): { tipo: TipoBib; id: string; descricao: string } | null {
  const tipo = tipoDaPeca(p);
  if (tipo === 'chapa') {
    const esp = Number(p.espessura);
    if (!(esp > 0) || !p.cod_mat) return null;
    const c = chapaPadrao(refs, p.cod_mat, esp);
    return c ? { tipo, id: c.id, descricao: c.descricao } : null;
  }
  if (tipo === 'perfil') {
    const lido = lerPerfilCad(p.descricao);
    if (!lido) return null;
    const formatoDe = new Map(refs.tipos.map((t) => [t.id, t.formato]));
    const candidatos = refs.perfis.filter((x) => (!p.cod_mat || x.cod_mat === p.cod_mat) && lido.formatos.includes(formatoDe.get(x.tipo_id)!));
    const achado = candidatos.find((x) => iguais(medidasPerfil(x, formatoDe.get(x.tipo_id)!), lido.medidas));
    return achado ? { tipo, id: achado.id, descricao: achado.descricao } : null;
  }
  // Sem pista de tipo (ex.: rodízio do CAD sem COD_OP): tenta os comerciais pela descrição.
  if (tipo === 'item' || tipo === null) {
    const d = norm(p.descricao);
    if (!d) return null;
    const achado = refs.itens.find((x) => norm(x.descricao) === d) ?? refs.itens.find((x) => norm(x.descricao).startsWith(d) || d.startsWith(norm(x.descricao)));
    return achado ? { tipo: 'item', id: achado.id, descricao: achado.descricao } : null;
  }
  return null;
}

// Chapa inteira padrão de um material e espessura (decisão 53): a de 1250 × 3000 se existir, senão a maior cadastrada.
export function chapaPadrao(refs: RefsEng, codMat: string, espessura: number): RefChapaEng | null {
  const lista = refs.chapas.filter((c) => c.cod_mat === codMat && Math.abs(Number(c.espessura_mm) - espessura) <= 0.01);
  if (!lista.length) return null;
  return lista.find((c) => Number(c.largura_mm) === 1250 && Number(c.comprimento_mm) === 3000)
    ?? [...lista].sort((a, b) => b.largura_mm * b.comprimento_mm - a.largura_mm * a.comprimento_mm)[0];
}

// Preço por kg de chapa: o da chapa, senão o do material + tipo (Chapa Lisa quando a peça não aponta chapa).
export function valorKgChapa(refs: RefsEng, codMat: string | null, chapa: RefChapaEng | null): number | null {
  if (chapa?.valor_kg != null) return Number(chapa.valor_kg);
  const tipoId = chapa?.tipo_id ?? refs.tipos.find((t) => t.grupo === 'Chapas' && t.formato === 'chapa_lisa')?.id;
  const p = refs.precosChapa.find((x) => x.cod_mat === (chapa?.cod_mat ?? codMat) && x.tipo_id === tipoId);
  return p ? Number(p.valor_kg) : null;
}

export interface Estimativa {
  tipo: TipoBib | null;
  item: RefChapaEng | RefPerfilEng | RefItemEng | null;
  pesoBib: number | null;     // kg por unidade calculado pela biblioteca (perfis)
  pesoUsado: number | null;   // kg por unidade usado no custo: CAD; nos perfis sem peso do CAD, o da biblioteca
  custoUnit: number | null;   // R$ por unidade
  diferenca: number | null;   // diferença relativa CAD × biblioteca (perfis), ex.: 0.08 = 8%
}

export const LIMITE_DIFERENCA = 0.05; // aviso a partir de 5% (decisão 53)
// Centavos com meio para cima (309,155 → 309,16; o ponto flutuante guarda 309,15499…).
const r2 = (n: number) => Math.round(n * 100 + 1e-6) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

// Peso e custo estimados de uma unidade da peça, pela biblioteca (decisão 53).
export function estimar(p: PecaBib, refs: RefsEng): Estimativa {
  const tipo = (p.bib_tipo as TipoBib | null) ?? tipoDaPeca(p);
  const cad = p.peso_unit == null ? null : Number(p.peso_unit);
  if (tipo === 'perfil') {
    const item = p.bib_id ? refs.perfis.find((x) => x.id === p.bib_id) ?? null : null;
    const comp = Number(p.comprimento) > 0 ? Number(p.comprimento) / 1000 : null;
    const pesoBib = item?.kg_m && comp ? r3(Number(item.kg_m) * comp) : null;
    const pesoUsado = cad ?? pesoBib;
    let custoUnit: number | null = null;
    if (item && comp) {
      const pr = precosPerfil(item.preco_modo, Number(item.valor), item.kg_m == null ? null : Number(item.kg_m));
      custoUnit = pr.porMetro != null ? r2(pr.porMetro * comp) : null;
    }
    const diferenca = cad != null && pesoBib ? Math.abs(cad - pesoBib) / pesoBib : null;
    return { tipo, item, pesoBib, pesoUsado, custoUnit: custoUnit && custoUnit > 0 ? custoUnit : null, diferenca };
  }
  if (tipo === 'chapa') {
    const item = p.bib_id ? refs.chapas.find((x) => x.id === p.bib_id) ?? null : null;
    const vkg = valorKgChapa(refs, p.cod_mat, item);
    return { tipo, item, pesoBib: null, pesoUsado: cad, custoUnit: cad != null && vkg ? r2(cad * vkg) : null, diferenca: null };
  }
  if (tipo === 'item') {
    const item = p.bib_id ? refs.itens.find((x) => x.id === p.bib_id) ?? null : null;
    return { tipo, item, pesoBib: null, pesoUsado: cad, custoUnit: item && Number(item.valor) > 0 ? Number(item.valor) : null, diferenca: null };
  }
  return { tipo: null, item: null, pesoBib: null, pesoUsado: cad, custoUnit: null, diferenca: null };
}

// ---------- Resumo para compra ----------

export const BARRA_PADRAO_M = 6; // decisão 53: barra de 6 m para todos os perfis

export interface LinhaResumo { chave: string; grupo: 'Chapas' | 'Perfis' | 'Comerciais' | 'Fixadores' | 'Consumíveis' | 'Sem item'; descricao: string; quantidade: number; unidade: string; compra: string; custo: number | null }

// Agrupa as peças (com a quantidade total no projeto) no que precisa ser comprado.
export function resumoCompra(linhas: (PecaBib & { qtdTotal: number })[], refs: RefsEng, nomeMaterial: (cod: string | null) => string): LinhaResumo[] {
  const mapa = new Map<string, LinhaResumo>();
  const somar = (chave: string, base: Omit<LinhaResumo, 'quantidade' | 'custo' | 'compra'>, qtd: number, custo: number | null) => {
    const l = mapa.get(chave) ?? { ...base, chave, quantidade: 0, custo: 0, compra: '' };
    l.quantidade += qtd;
    l.custo = l.custo == null || custo == null ? null : l.custo + custo;
    mapa.set(chave, l);
  };
  for (const p of linhas) {
    const e = estimar(p, refs);
    const custo = e.custoUnit == null ? null : e.custoUnit * p.qtdTotal;
    if (e.tipo === 'chapa' && p.cod_mat) {
      const esp = Number(p.espessura) > 0 ? Number(p.espessura) : 0;
      const kg = (e.pesoUsado ?? 0) * p.qtdTotal;
      const desc = esp ? `Chapa ${nomeMaterial(p.cod_mat)} ${esp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} mm` : `Chapa ${nomeMaterial(p.cod_mat)} (espessura não informada)`;
      somar(`chapa|${p.cod_mat}|${esp}`, { chave: '', grupo: 'Chapas', descricao: desc, unidade: 'kg' }, kg, custo);
    } else if (e.tipo === 'perfil' && e.item) {
      const m = (Number(p.comprimento) || 0) / 1000 * p.qtdTotal;
      somar(`perfil|${e.item.id}`, { chave: '', grupo: 'Perfis', descricao: e.item.descricao, unidade: 'm' }, m, custo);
    } else if (e.tipo === 'item' && e.item) {
      const it = e.item as RefItemEng;
      somar(`item|${it.id}`, { chave: '', grupo: it.grupo, descricao: it.descricao, unidade: it.unidade || 'un' }, p.qtdTotal, custo);
    } else {
      somar(`sem|${norm(p.descricao)}|${p.cod_mat ?? ''}|${p.espessura ?? ''}`, { chave: '', grupo: 'Sem item', descricao: p.descricao || '(sem descrição)', unidade: 'un' }, p.qtdTotal, null);
    }
  }
  const ordem = ['Chapas', 'Perfis', 'Comerciais', 'Fixadores', 'Consumíveis', 'Sem item'];
  return [...mapa.values()].map((l) => {
    let compra = '';
    if (l.grupo === 'Chapas') {
      const [, cod, esp] = l.chave.split('|');
      const ch = Number(esp) > 0 ? chapaPadrao(refs, cod, Number(esp)) : null;
      compra = !(Number(esp) > 0) ? 'Informe a espessura das peças para estimar as chapas'
        : ch && Number(ch.peso_kg) > 0
        ? `${Math.ceil(l.quantidade / Number(ch.peso_kg))} chapa(s) de ${Number(ch.largura_mm).toLocaleString('pt-BR')} × ${Number(ch.comprimento_mm).toLocaleString('pt-BR')}`
        : 'Cadastre a chapa inteira na biblioteca para estimar as chapas';
    } else if (l.grupo === 'Perfis') compra = `${Math.ceil(l.quantidade / BARRA_PADRAO_M - 1e-9)} barra(s) de ${BARRA_PADRAO_M} m`;
    else if (l.grupo === 'Sem item') compra = 'Ligar a um item da biblioteca';
    else compra = `${l.quantidade.toLocaleString('pt-BR')} ${l.unidade}`;
    return { ...l, quantidade: Math.round(l.quantidade * 1000) / 1000, custo: l.custo == null ? null : r2(l.custo), compra };
  }).sort((a, b) => ordem.indexOf(a.grupo) - ordem.indexOf(b.grupo) || a.descricao.localeCompare(b.descricao));
}
