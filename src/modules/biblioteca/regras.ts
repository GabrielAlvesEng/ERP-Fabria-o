// Biblioteca de Materiais (decisão 48): medidas, pesos e descrições de chapas e perfis.
// Pesos em aço de referência: área da seção (mm²) × densidade (g/cm³) ÷ 1000 = kg/m.
// Cantos vivos, sem raio de dobra nem concordância: o peso fica um pouco acima do de catálogo nos tubos e perfis dobrados.

export type GrupoBiblioteca = 'Chapas' | 'Perfis';
export type GrupoItem = 'Comerciais' | 'Fixadores' | 'Consumíveis';

export type Formato =
  | 'chapa_lisa' | 'chapa_manual'
  | 'tubo_quadrado' | 'tubo_retangular' | 'tubo_od' | 'tubo_sch'
  | 'barra_redonda' | 'barra_quadrada' | 'barra_chata' | 'barra_sextavada'
  | 'cantoneira' | 'perfil_u' | 'perfil_h' | 'tabela';

export interface TipoBiblioteca { id: string; grupo: GrupoBiblioteca; nome: string; formato: Formato; ordem: number; ativo: boolean }

// Campos de medida de cada formato de perfil. "parede" é a espessura da parede (vazio em maciços).
export interface DefFormato {
  rotulo: string;
  a?: string; b?: string; c?: string;
  parede?: 'mm' | 'sch';
  bIgualA?: boolean;     // tubo quadrado: tamanho "A x A"
  bOpcional?: boolean;   // cantoneira de abas iguais quando B fica vazio
  calcula: boolean;      // kg/m sai da fórmula; senão, da base de pesos ou digitado
}

export const FORMATOS: Record<Exclude<Formato, 'chapa_lisa' | 'chapa_manual'>, DefFormato> = {
  tubo_quadrado: { rotulo: 'Tubo quadrado', a: 'Lado', parede: 'mm', bIgualA: true, calcula: true },
  tubo_retangular: { rotulo: 'Tubo retangular', a: 'Altura', b: 'Largura', parede: 'mm', calcula: true },
  tubo_od: { rotulo: 'Tubo redondo (diâmetro externo)', a: 'Ø externo', parede: 'mm', calcula: true },
  tubo_sch: { rotulo: 'Tubo redondo SCH', a: 'Bitola (NPS)', parede: 'sch', calcula: true },
  barra_redonda: { rotulo: 'Barra redonda (maciça)', a: 'Ø', calcula: true },
  barra_quadrada: { rotulo: 'Barra quadrada (maciça)', a: 'Lado', calcula: true },
  barra_chata: { rotulo: 'Barra chata (maciça)', a: 'Largura', b: 'Espessura', calcula: true },
  barra_sextavada: { rotulo: 'Barra sextavada (maciça)', a: 'Entre faces', calcula: true },
  cantoneira: { rotulo: 'Cantoneira', a: 'Aba', b: 'Outra aba', bOpcional: true, parede: 'mm', calcula: true },
  perfil_u: { rotulo: 'Perfil U (altura × aba × parede)', a: 'Altura', b: 'Aba', parede: 'mm', calcula: true },
  perfil_h: { rotulo: 'Perfil H (altura × mesa × alma × espessura da mesa)', a: 'Altura', b: 'Mesa', c: 'Espessura da mesa', parede: 'mm', calcula: true },
  tabela: { rotulo: 'Perfil de catálogo (W, I, U laminado…): kg/m da base de pesos', a: 'Bitola', calcula: false },
};

export const SEM_CALCULO = 'tabela';

// ---------- Medidas: mm ou polegada ----------

const POL = 25.4;

// Lê "50", "2,0", "2,00mm", "1-1/2\"", "1.1/2\"", "1 1/2\"", "3/8\"", "Ø 1\"", "2\"".
// Polegada só quando tem aspas ou fração. Devolve mm ou null.
export function lerMedida(txt: string | null | undefined): number | null {
  if (txt == null) return null;
  let t = String(txt).trim().replace(/^Ø\s*/i, '').replace(/[”″]/g, '"').replace(/''/g, '"').replace(/\s*mm$/i, '').trim();
  if (!t) return null;
  const pol = t.endsWith('"') || /\d\/\d/.test(t);
  t = t.replace(/"$/, '').trim();
  let n: number | null = null;
  const fr = t.match(/^(?:(\d+)[\s.-]+)?(\d+)\/(\d+)$/);
  if (fr) n = (fr[1] ? Number(fr[1]) : 0) + Number(fr[2]) / Number(fr[3]);
  else if (/^\d+([.,]\d+)?$/.test(t)) n = Number(t.replace(',', '.'));
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return Math.round((pol ? n * POL : n) * 1000) / 1000;
}

export const ehPolegada = (txt: string) => /"|\d\/\d/.test(txt);

// Número em mm no padrão da tela: "1,5" / "2,00" ficam como digitados; números soltos com vírgula.
export const mmBR = (n: number, casas = 2) => n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas });

// ---------- Tubos SCH (ASME B36.10M / B36.19M) ----------

export const NPS: { nps: string; od: number }[] = [
  { nps: '1/8"', od: 10.3 }, { nps: '1/4"', od: 13.7 }, { nps: '3/8"', od: 17.1 }, { nps: '1/2"', od: 21.3 },
  { nps: '3/4"', od: 26.7 }, { nps: '1"', od: 33.4 }, { nps: '1-1/4"', od: 42.2 }, { nps: '1-1/2"', od: 48.3 },
  { nps: '2"', od: 60.3 }, { nps: '2-1/2"', od: 73.0 }, { nps: '3"', od: 88.9 }, { nps: '3-1/2"', od: 101.6 },
  { nps: '4"', od: 114.3 }, { nps: '5"', od: 141.3 }, { nps: '6"', od: 168.3 }, { nps: '8"', od: 219.1 },
  { nps: '10"', od: 273.0 }, { nps: '12"', od: 323.8 },
];

// Parede (mm) por SCH, na ordem de NPS acima (null = não existe).
const PAREDES: Record<string, (number | null)[]> = {
  'SCH 5S': [null, null, null, 1.65, 1.65, 1.65, 1.65, 1.65, 1.65, 2.11, 2.11, 2.11, 2.11, 2.77, 2.77, 2.77, 3.4, 3.96],
  'SCH 10S': [1.24, 1.65, 1.65, 2.11, 2.11, 2.77, 2.77, 2.77, 2.77, 3.05, 3.05, 3.05, 3.05, 3.4, 3.4, 3.76, 4.19, 4.57],
  'SCH 40': [1.73, 2.24, 2.31, 2.77, 2.87, 3.38, 3.56, 3.68, 3.91, 5.16, 5.49, 5.74, 6.02, 6.55, 7.11, 8.18, 9.27, 10.31],
  'SCH 40S': [1.73, 2.24, 2.31, 2.77, 2.87, 3.38, 3.56, 3.68, 3.91, 5.16, 5.49, 5.74, 6.02, 6.55, 7.11, 8.18, 9.27, 9.53],
  'SCH 80': [2.41, 3.02, 3.2, 3.73, 3.91, 4.55, 4.85, 5.08, 5.54, 7.01, 7.62, 8.08, 8.56, 9.53, 10.97, 12.7, 15.09, 17.48],
  'SCH 80S': [2.41, 3.02, 3.2, 3.73, 3.91, 4.55, 4.85, 5.08, 5.54, 7.01, 7.62, 8.08, 8.56, 9.53, 10.97, 12.7, 12.7, 12.7],
};
export const SCHS = Object.keys(PAREDES);

const normNps = (t: string) => t.replace(/^Ø\s*/i, '').replace(/[”″]/g, '"').replace(/(\d)[\s.](\d\/)/, '$1-$2').trim();

export function tuboSch(nps: string, sch: string): { od: number; parede: number } | null {
  const i = NPS.findIndex((n) => n.nps === normNps(nps) || n.nps === normNps(nps) + '"');
  const s = SCHS.find((x) => x.replace(/\s/g, '').toUpperCase() === sch.replace(/\s/g, '').toUpperCase().replace(/^(\d)/, 'SCH$1'));
  if (i < 0 || !s) return null;
  const e = PAREDES[s][i];
  return e ? { od: NPS[i].od, parede: e } : null;
}

// ---------- Pesos ----------

export interface Medidas { a?: number | null; b?: number | null; c?: number | null; parede?: number | null }

// Área da seção em mm². null quando falta medida ou o formato não tem fórmula.
export function areaSecao(formato: Formato, m: Medidas): number | null {
  const a = m.a ?? 0, b = m.b ?? 0, c = m.c ?? 0, e = m.parede ?? 0;
  const pos = (...v: number[]) => v.every((x) => x > 0);
  switch (formato) {
    case 'tubo_quadrado': return pos(a, e) && 2 * e < a ? a * a - (a - 2 * e) ** 2 : null;
    case 'tubo_retangular': return pos(a, b, e) && 2 * e < Math.min(a, b) ? a * b - (a - 2 * e) * (b - 2 * e) : null;
    case 'tubo_od':
    case 'tubo_sch': return pos(a, e) && 2 * e < a ? Math.PI * e * (a - e) : null;
    case 'barra_redonda': return pos(a) ? (Math.PI * a * a) / 4 : null;
    case 'barra_quadrada': return pos(a) ? a * a : null;
    case 'barra_chata': return pos(a, b) ? a * b : null;
    case 'barra_sextavada': return pos(a) ? (Math.sqrt(3) / 2) * a * a : null;
    case 'cantoneira': { const bb = b > 0 ? b : a; return pos(a, e) && e < Math.min(a, bb) ? e * (a + bb - e) : null; }
    case 'perfil_u': return pos(a, b, e) && 2 * e < a && e < b ? e * (a + 2 * b - 2 * e) : null;
    case 'perfil_h': return pos(a, b, c, e) && 2 * c < a && e < b ? 2 * b * c + (a - 2 * c) * e : null;
    default: return null;
  }
}

const r4 = (n: number) => Math.round(n * 10000) / 10000;

export function kgPorMetro(formato: Formato, m: Medidas, densidade: number | null | undefined): number | null {
  const area = areaSecao(formato, m);
  if (area == null || !densidade || densidade <= 0) return null;
  return r4((area * densidade) / 1000);
}

// Densidade do aço usado nas tabelas de catálogo (kg/m de W, I, U laminado): o kg/m do material é corrigido por ela.
export const DENSIDADE_REF_TABELA = 7.85;
export const kgPorMetroTabela = (kgmCarbono: number, densidade: number | null | undefined) =>
  r4(kgmCarbono * (densidade && densidade > 0 ? densidade / DENSIDADE_REF_TABELA : 1));

// Chapa: espessura × largura × comprimento (mm) × densidade (g/cm³) → kg.
export function pesoChapa(esp: number, larg: number, comp: number, densidade: number | null | undefined): number | null {
  if (!(esp > 0 && larg > 0 && comp > 0) || !densidade || densidade <= 0) return null;
  return Math.round(esp * larg * comp * densidade * 1e-6 * 1000) / 1000;
}

// ---------- Preços ----------

export type ModoPreco = 'm' | 'kg';

// Preço por metro e por kg de um perfil, a partir do valor digitado e do kg/m.
export function precosPerfil(modo: ModoPreco, valor: number, kgM: number | null): { porMetro: number | null; porKg: number | null } {
  if (modo === 'm') return { porMetro: valor, porKg: kgM && kgM > 0 ? r4(valor / kgM) : null };
  return { porKg: valor, porMetro: kgM && kgM > 0 ? r4(valor * kgM) : null };
}

export const valorTotalChapa = (pesoKg: number, valorKg: number) => Math.round(pesoKg * valorKg * 100) / 100;

// ---------- Descrições ----------

const fmtMedida = (txt: string) => {
  const t = txt.trim();
  if (!t) return '';
  return ehPolegada(t) ? t.replace(/\s*mm$/i, '') : t.replace(/\s*mm$/i, '').replace('.', ',');
};

// "Tubo Quadrado 50 x 50 x 2,0 mm AISI 304"; "Barra Redonda Ø 1-1/2" AISI 304"; "Tubo Redondo SCH Ø 3" SCH 40S AISI 316L".
export function descricaoPerfil(tipo: string, formato: Formato, t: { a?: string; b?: string; c?: string; parede?: string }, material: string): string {
  const a = fmtMedida(t.a ?? ''), b = fmtMedida(t.b ?? ''), c = fmtMedida(t.c ?? ''), e = (t.parede ?? '').trim();
  const def = formato in FORMATOS ? FORMATOS[formato as keyof typeof FORMATOS] : undefined;
  let tam = a;
  if (formato === 'tubo_od' || formato === 'tubo_sch' || formato === 'barra_redonda') tam = `Ø ${a}`;
  else if (def?.bIgualA) tam = `${a} x ${a}`;
  else if (b) tam = `${a} x ${b}`;
  let par = '';
  if (formato === 'perfil_h') par = [fmtMedida(e), c].filter(Boolean).join(' x ');
  else if (def?.parede === 'sch') par = e.toUpperCase().startsWith('SCH') ? e.toUpperCase() : e ? `SCH ${e.toUpperCase()}` : '';
  else if (e) par = ehPolegada(e) ? fmtMedida(e) : `${fmtMedida(e)} mm`;
  return [tipo, tam, par && (def?.parede === 'sch' ? par : `x ${par}`), material].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

export function descricaoChapa(tipo: string, espTxt: string, largura: number, comprimento: number, material: string): string {
  const esp = fmtMedida(espTxt);
  return [tipo, material, `${esp} x ${mmBR(largura, 0)} x ${mmBR(comprimento, 0)}`].filter(Boolean).join(' ');
}

// ---------- Leitura da lista de preços antiga (carga inicial) ----------

export interface PerfilLido {
  tipo: string; a: string; b: string; c: string; parede: string; material: string; unidade: 'm' | 'kg';
}

const MATERIAIS_ANTIGOS: [RegExp, string][] = [
  [/inox\s*316\s*l/i, 'IN-004'], [/inox\s*316/i, 'IN-003'], [/inox\s*304/i, 'IN-001'],
  [/sae\s*1020/i, 'AC-003'], [/astm\s*a\s*572/i, 'AC-009'], [/astm\s*a\s*36|\ba36\b/i, 'AC-008'],
];
export function materialAntigo(desc: string): string | null {
  return MATERIAIS_ANTIGOS.find(([re]) => re.test(desc))?.[1] ?? null;
}

// Tipos da lista antiga → nome do tipo na biblioteca (mais longos primeiro).
const TIPOS_ANTIGOS = [
  'Tubo Redondo Estrutural', 'Tubo Redondo OD', 'Tubo Redondo SCH', 'Tubo Quadrado', 'Tubo Retangular',
  'Barra Redonda', 'Barra Quadrada', 'Barra Chata', 'Cantoneira', 'Perfil UDC', 'Perfil HP', 'Perfil H', 'Perfil U', 'Perfil W', 'Viga I', 'Viga U',
];

const MED = String.raw`(?:\d+(?:[.,]\d+)?(?:\s*mm)?|\d+[-.]\d+\/\d+"?|\d+\/\d+"?|\d+")`;

// Lê "Tubo Quadrado 20 x 1,5 Inox 304(Mts)", "Barra Chata 1-1/2\" x 1/4\" SAE 1020(Mts)", "Tubo Redondo SCH 40S Ø 3\" Inox 304(Mts)"...
// Devolve null quando não reconhece: o item fica "a revisar", nada é inventado.
export function lerDescricaoAntiga(desc: string): PerfilLido | null {
  const unidade: 'm' | 'kg' = /\(kg\)\s*$/i.test(desc) ? 'kg' : 'm';
  let d = desc.replace(/\((kg|mts?)\)\s*$/i, '').trim();
  const material = materialAntigo(d);
  if (!material) return null;
  d = d.replace(/\s+(inox\s*316\s*l|inox\s*316|inox\s*304|sae\s*1020|astm\s*a\s*572(\s*gr\s*50)?|astm\s*a\s*36)\s*$/i, '').trim();
  let tipo = TIPOS_ANTIGOS.find((t) => d.toLowerCase().startsWith(t.toLowerCase()));
  if (!tipo) return null;
  let resto = d.slice(tipo.length).trim();
  if (tipo === 'Tubo Redondo SCH') {
    const m = resto.match(/^(\d+S?)\s*Ø\s*(.+)$/i);
    return m ? { tipo, a: m[2].trim(), b: '', c: '', parede: `SCH ${m[1].toUpperCase()}`, material, unidade } : null;
  }
  if (tipo === 'Tubo Redondo Estrutural') tipo = 'Tubo Redondo OD';
  resto = resto.replace(/^Ø\s*/, '');
  const partes = resto.split(/\s+x\s+/i).map((p) => p.trim());
  if (!partes.every((p) => new RegExp(`^${MED}$`, 'i').test(p))) return null;
  const [p1, p2, p3, p4] = partes;
  const r = (a: string, b = '', c = '', parede = ''): PerfilLido => ({ tipo: tipo!, a, b, c, parede, material, unidade });
  switch (tipo) {
    case 'Tubo Quadrado': return partes.length === 2 ? r(p1, '', '', p2) : null;
    case 'Tubo Retangular': return partes.length === 3 ? r(p1, p2, '', p3) : null;
    case 'Tubo Redondo OD': return partes.length === 2 ? r(p1, '', '', p2) : null;
    case 'Barra Redonda':
    case 'Barra Quadrada': return partes.length === 1 ? r(p1) : null;
    case 'Barra Chata': return partes.length === 2 ? r(p1, p2) : null;
    case 'Cantoneira': return partes.length === 2 ? r(p1, '', '', p2) : null;
    case 'Perfil U':
    case 'Perfil UDC': return partes.length === 3 ? r(p1, p2, '', p3) : null;
    case 'Perfil H':
    case 'Perfil HP': return partes.length === 4 ? r(p1, p2, p4, p3) : null;
    case 'Perfil W':
    case 'Viga I':
    case 'Viga U': return partes.length === 2 ? r(`${p1} x ${p2}`) : null;
    default: return null;
  }
}
