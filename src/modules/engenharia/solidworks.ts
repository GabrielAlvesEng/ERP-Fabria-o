// Leitor do JSON da macro do SolidWorks (esquema fabriaco.solidworks.tree v2) → plano para a RPC importar_solidworks.
// Decisões 34 a 36: conjunto soldado é nó próprio; corpos da lista de corte viram peças <código>.01, .02…;
// o ERP usa o final do código CAD sob o prefixo do projeto e guarda o código CAD original.
import { COD_OPS, type CodOp, type TipoConjunto } from './regras';

type Prop = { evaluated?: string } | string | undefined;
interface Definicao {
  source_key: string;
  document_path?: string;
  code?: string;
  name?: string;
  kind: 'assembly' | 'part' | 'weldment' | string;
  source_type?: string;
  cut_list_name?: string;
  body_names?: string[];
  properties?: Record<string, Prop>;
  properties_effective?: Record<string, Prop>;
  specification?: { length_raw?: string; thickness_raw?: string; width_raw?: string };
  cod_op?: string;
  cod_mat?: string;
  material_name?: string;
}
interface Ocorrencia { id: string; parent_id: string; definition_key: string; quantity: number; position: number; excluded_from_bom?: boolean }
interface Aviso { severity?: string; context?: string; message?: string }
export interface JsonMacro {
  schema: string;
  schema_version: number;
  exporter_version?: string;
  created_local?: string;
  requires_review?: boolean;
  definitions: Definicao[];
  occurrences: Ocorrencia[];
  issues?: Aviso[];
}

export interface NoPlano { ref: string; pai_ref: string | null; tipo: Exclude<TipoConjunto, 'geral'>; sufixo: string | null; nome: string; quantidade: number; codigo_cad: string; arquivo_cad: string; chave_cad: string; dados_cad: Record<string, unknown> }
export interface PecaPlano {
  no_ref: string | null; sufixo: string | null; descricao: string; quantidade: number; cod_op: CodOp[]; cod_mat: string | null; material: string;
  espessura: number | null; peso_unit: number | null; comprimento: number | null; codigo_cad: string; arquivo_cad: string; chave_cad: string; dados_cad: Record<string, unknown>;
}
export interface Plano {
  projeto_dados: Record<string, unknown>;
  raiz: { chave_cad: string; codigo_cad: string; arquivo_cad: string; dados_cad: Record<string, unknown> };
  nos: NoPlano[];
  pecas: PecaPlano[];
}
// Linha da prévia: o que será criado, já com o código que o ERP deve gerar (o banco confirma na importação).
export interface LinhaPrevia { nivel: number; tipo: TipoConjunto | 'peca'; codigo: string; codigoCad: string; nome: string; quantidade: number; codOp: CodOp[]; codMat: string | null; peso: number | null; pendente: boolean }
export interface ResultadoLeitura { plano: Plano; previa: LinhaPrevia[]; avisos: string[] }

const SUFIXO = /(\d[A-Z0-9]-\d{2}-\d{3})$/i;

// Propriedades do SolidWorks vêm com espaço/tab no nome e às vezes com prefixo numérico ("7-PESO\t").
function prop(d: Definicao, ...nomes: string[]): string {
  const fontes = [d.properties, d.properties_effective];
  for (const nome of nomes) {
    for (const f of fontes) {
      if (!f) continue;
      for (const [k, v] of Object.entries(f)) {
        const chave = k.trim().replace(/^\d+-/, '').toUpperCase();
        if (chave === nome.toUpperCase()) {
          const val = (typeof v === 'string' ? v : v?.evaluated ?? '').trim();
          if (val && val !== 'XXX' && val !== '-') return val;
        }
      }
    }
  }
  return '';
}

const num = (s: string | undefined): number | null => {
  const limpo = (s ?? '').replace(',', '.').replace(/[^0-9.\-]/g, '');
  if (!/[0-9]/.test(limpo)) return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
};

function codOps(texto: string | undefined): CodOp[] {
  return (texto ?? '').toUpperCase().split(/[/,;+\s]+/).filter((x): x is CodOp => (COD_OPS as readonly string[]).includes(x));
}

function nomeArquivo(caminho: string | undefined): string {
  return (caminho ?? '').split(/[\\/]/).pop() ?? '';
}

// Sufixo do código CAD (…-0A-01-000) que respeita o padrão esperado para o tipo do nó.
export function sufixoCad(codigo: string | undefined, tipo: TipoConjunto | 'peca'): string | null {
  const m = (codigo ?? '').toUpperCase().match(SUFIXO);
  if (!m) return null;
  const [sub, conj, item] = m[1].split('-');
  if (tipo === 'submontagem') return sub !== '00' && conj === '00' && item === '000' ? m[1] : null;
  if (tipo === 'conjunto') return conj !== '00' && item === '000' ? m[1] : null;
  return item !== '000' ? m[1] : null;
}

export function lerJsonMacro(texto: string, projetoCodigo: string, codigosExistentes: string[] = []): ResultadoLeitura {
  let j: JsonMacro;
  try {
    j = JSON.parse(texto.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('O arquivo não é um JSON válido.');
  }
  if (j?.schema !== 'fabriaco.solidworks.tree') throw new Error('Este JSON não foi gerado pela macro da Fabriaço (esquema fabriaco.solidworks.tree).');
  if (Number(j.schema_version) !== 2) throw new Error(`Versão do esquema não suportada (${j.schema_version}). O ERP lê a versão 2.`);
  if (!Array.isArray(j.definitions) || !Array.isArray(j.occurrences)) throw new Error('JSON incompleto: faltam definições ou ocorrências.');

  const defs = new Map(j.definitions.map((d) => [d.source_key.toLowerCase(), d]));
  const def = (o: Ocorrencia) => defs.get(o.definition_key.toLowerCase());
  const raizOc = j.occurrences.find((o) => !o.parent_id);
  const raizDef = raizOc && def(raizOc);
  if (!raizOc || !raizDef || raizDef.kind !== 'assembly') throw new Error('A raiz do JSON precisa ser uma montagem (SLDASM).');

  const avisos: string[] = [];
  const nos: NoPlano[] = [];
  const pecas: PecaPlano[] = [];
  const previa: LinhaPrevia[] = [];

  const prefixoCad = (raizDef.code ?? '').toUpperCase().replace(SUFIXO, '').replace(/-$/, '');
  if (prefixoCad && prefixoCad !== projetoCodigo.toUpperCase()) {
    avisos.push(`O CAD usa o prefixo ${prefixoCad}; no ERP os códigos ficam com o prefixo do projeto (${projetoCodigo}). O código CAD original fica guardado em cada item.`);
  }
  if (j.requires_review) avisos.push('A macro marcou este arquivo como "precisa de revisão".');

  const dadosRaiz = {
    titulo: [prop(raizDef, 'TITULO 1'), prop(raizDef, 'TITULO 2'), prop(raizDef, 'TITULO 3')].filter(Boolean).join(' / '),
    pedido: prop(raizDef, 'Nº PEDIDO'), peso: num(prop(raizDef, 'PESO')), area_pintura: num(prop(raizDef, 'AREA DE PINTURA')),
    projetado: prop(raizDef, 'PROJETADO'), data_projetado: prop(raizDef, 'DATA PROJETADO'),
    desenhado: prop(raizDef, 'DESENHADO'), data_desenhado: prop(raizDef, 'DATA DESENHADO'),
    modelado: prop(raizDef, 'MODELADO'), aprovado: prop(raizDef, 'APROVADO'), data_aprovado: prop(raizDef, 'DATA APROVADO'),
    revisao: prop(raizDef, 'REV'),
  };
  const plano: Plano = {
    projeto_dados: { ...dadosRaiz, macro: j.exporter_version ?? '', exportado_em: j.created_local ?? '', codigo_cad: raizDef.code ?? '' },
    raiz: { chave_cad: raizDef.source_key, codigo_cad: raizDef.code ?? '', arquivo_cad: nomeArquivo(raizDef.document_path), dados_cad: dadosRaiz },
    nos, pecas,
  };
  previa.push({ nivel: 0, tipo: 'geral', codigo: `${projetoCodigo}-00-00-000`, codigoCad: raizDef.code ?? '', nome: dadosRaiz.titulo || 'Montagem geral', quantidade: 1, codOp: [], codMat: null, peso: dadosRaiz.peso, pendente: false });

  // Códigos já usados na prévia, para simular o gerador do banco (próximo livre).
  const usados = new Set<string>([`${projetoCodigo}-00-00-000`, ...codigosExistentes]);
  // Peças recebem código só depois dos conjuntos, na mesma ordem do banco (nós primeiro, peças depois).
  const pendentes: { linha: LinhaPrevia; base: string; soldado: boolean; sufixo: string | null; noRef: string | null }[] = [];
  const proximoLivre = (base: string, soldado: boolean, contador: { n: number }) => {
    if (soldado) { contador.n += 1; return `${base}.${String(contador.n).padStart(2, '0')}`; }
    for (let n = 1; n < 1000; n++) {
      const c = base.slice(0, -3) + String(n).padStart(3, '0');
      if (!usados.has(c)) return c;
    }
    return base;
  };

  // Ocorrências iguais sob o mesmo pai viram uma linha com a quantidade somada.
  function filhosAgrupados(paiId: string) {
    const grupos = new Map<string, { oc: Ocorrencia; d: Definicao; qtd: number }>();
    for (const o of j.occurrences.filter((x) => x.parent_id === paiId && !x.excluded_from_bom).sort((a, b) => a.position - b.position)) {
      const d = def(o);
      if (!d) { avisos.push(`Ocorrência ${o.id} sem definição no JSON; ignorada.`); continue; }
      const k = o.definition_key.toLowerCase();
      const g = grupos.get(k);
      if (g) g.qtd += Number(o.quantity) || 1; else grupos.set(k, { oc: o, d, qtd: Number(o.quantity) || 1 });
    }
    return [...grupos.values()];
  }

  function pecaDe(d: Definicao, qtd: number, noRef: string | null, base: string, soldado: boolean, nivel: number) {
    const ops = codOps(d.cod_op || prop(d, 'COD-OP', 'COD_OP'));
    const codMat = (d.cod_mat || prop(d, 'COD-MATERIAL', 'COD_MAT') || '').toUpperCase() || null;
    const sufixo = soldado ? null : sufixoCad(d.code, 'peca');
    const ehPerfil = ops.some((o) => o === 'LP' || o === 'PO') || prop(d, 'UNIT_OF_MEASURE').toUpperCase() === 'COMPRIMENTO';
    const descricao = prop(d, 'DENOMINAÇÃO', 'TITULO 3') || d.name || d.code || 'Peça sem nome';
    const peso = num(prop(d, 'PESO', 'Massa'));
    pecas.push({
      no_ref: noRef, sufixo, descricao, quantidade: qtd, cod_op: ops, cod_mat: codMat, material: d.material_name ?? prop(d, 'MATERIAL'),
      espessura: num(d.specification?.thickness_raw) ?? num(prop(d, 'Espessura da Chapa metálica')),
      peso_unit: peso, comprimento: ehPerfil ? num(d.specification?.length_raw) ?? num(prop(d, 'COMPRIMENTO')) : null,
      codigo_cad: d.code ?? '', arquivo_cad: nomeArquivo(d.document_path), chave_cad: d.source_key,
      dados_cad: {
        lista_corte: d.cut_list_name ?? null, corpos: d.body_names ?? null,
        largura: num(d.specification?.width_raw) ?? num(prop(d, 'LARGURA')), comprimento: num(d.specification?.length_raw),
        dobras: num(prop(d, 'Dobras')), recortes: num(prop(d, 'Recortes')), area_pintura: num(prop(d, 'AREA DE PINTURA')),
      },
    });
    const linha: LinhaPrevia = { nivel, tipo: 'peca', codigo: '', codigoCad: d.code ?? '', nome: descricao, quantidade: qtd, codOp: ops, codMat, peso, pendente: ops.length === 0 };
    previa.push(linha);
    pendentes.push({ linha, base, soldado, sufixo, noRef });
  }

  let ref = 0;
  function percorrer(paiOcId: string, paiRef: string | null, paiTipo: TipoConjunto, paiCodigo: string, nivel: number) {
    for (const { oc, d, qtd } of filhosAgrupados(paiOcId)) {
      if (paiTipo === 'soldado' || d.source_type === 'cut_list_item') {
        pecaDe(d, qtd, paiRef, paiCodigo, paiTipo === 'soldado', nivel);
        continue;
      }
      if (d.kind === 'part') { pecaDe(d, qtd, paiRef, paiCodigo, false, nivel); continue; }

      let tipo: NoPlano['tipo'];
      if (d.kind === 'weldment') tipo = 'soldado';
      else if (paiTipo === 'geral') tipo = 'submontagem';
      else if (paiTipo === 'submontagem') tipo = 'conjunto';
      else {
        avisos.push(`A montagem ${d.code ?? d.name} está num 4º nível; o ERP tem até 3 níveis de montagem. As peças dela entram no conjunto acima.`);
        percorrer(oc.id, paiRef, paiTipo, paiCodigo, nivel);
        continue;
      }
      const sufixo = sufixoCad(d.code, tipo === 'soldado' ? 'peca' : tipo);
      if (!sufixo && d.code && SUFIXO.test(d.code)) avisos.push(`O código ${d.code} não segue o padrão de ${tipo === 'soldado' ? 'conjunto soldado' : tipo}; o ERP vai gerar o próximo código livre.`);
      let codigo: string;
      if (sufixo) {
        codigo = `${projetoCodigo}-${sufixo}`;
        if (usados.has(codigo)) avisos.push(`O código ${codigo} (de ${d.code}) já existe neste projeto: a importação será recusada.`);
      }
      else if (tipo === 'soldado') codigo = proximoLivre(paiCodigo, false, { n: 0 });
      else codigo = '(automático)';
      usados.add(codigo);
      const meuRef = `n${++ref}`;
      const nome = prop(d, 'TITULO 3', 'DENOMINAÇÃO') || d.name || d.code || meuRef;
      nos.push({
        ref: meuRef, pai_ref: paiRef, tipo, sufixo, nome, quantidade: qtd, codigo_cad: d.code ?? '', arquivo_cad: nomeArquivo(d.document_path),
        chave_cad: d.source_key, dados_cad: { peso: num(prop(d, 'PESO')), area_pintura: num(prop(d, 'AREA DE PINTURA')), revisao: prop(d, 'REV') },
      });
      previa.push({ nivel, tipo, codigo, codigoCad: d.code ?? '', nome, quantidade: qtd, codOp: [], codMat: null, peso: num(prop(d, 'PESO')), pendente: false });
      percorrer(oc.id, meuRef, tipo, codigo, nivel + 1);
    }
  }
  percorrer(raizOc.id, null, 'geral', `${projetoCodigo}-00-00-000`, 1);

  const contadores = new Map<string, { n: number }>();
  for (const p of pendentes) {
    if (p.sufixo) {
      p.linha.codigo = `${projetoCodigo}-${p.sufixo}`;
      if (usados.has(p.linha.codigo)) avisos.push(`O código ${p.linha.codigo} já existe neste projeto: a importação será recusada.`);
    } else {
      const chave = p.noRef ?? 'raiz';
      if (!contadores.has(chave)) contadores.set(chave, { n: 0 });
      p.linha.codigo = proximoLivre(p.base, p.soldado, contadores.get(chave)!);
    }
    usados.add(p.linha.codigo);
  }

  // Avisos da macro agrupados por mensagem (ex.: 4 corpos sem código viram uma linha só).
  const porMensagem = new Map<string, { itens: Set<string>; qtd: number }>();
  for (const i of j.issues ?? []) {
    const item = (i.context ?? '').split(/[\\/]/).pop()?.split('|')[0] ?? '';
    const g = porMensagem.get(i.message ?? '') ?? { itens: new Set<string>(), qtd: 0 };
    g.itens.add(item);
    g.qtd += 1;
    porMensagem.set(i.message ?? '', g);
  }
  for (const [msg, g] of porMensagem) {
    const onde = [...g.itens].filter(Boolean).join(', ');
    avisos.push(`Macro${onde ? ` (${onde})` : ''}${g.qtd > 1 ? ` [${g.qtd}×]` : ''}: ${msg}`);
  }
  const semOp = pecas.filter((p) => p.cod_op.length === 0).length;
  if (semOp) avisos.push(`${semOp} item(ns) sem COD_OP entram como "pendente de classificação".`);
  return { plano, previa, avisos };
}
