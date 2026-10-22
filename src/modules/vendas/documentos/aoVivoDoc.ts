import type { Documento, Secao } from './modelo';

// Decisão 85: enquanto alguém digita, só o que mudou no documento vai para as outras telas (Realtime Broadcast).
// Seções que mudaram vão inteiras; se a lista de seções mudou (seção nova, removida ou movida), vai o documento todo.
export interface DiferencaDoc {
  completo?: Documento;
  topo?: Partial<Omit<Documento, 'secoes'>>;
  secoes?: Record<string, Secao>;
}

const ids = (d: Documento) => d.secoes.map((s) => s.id).join('|');

export function diferencaDocumento(antes: Documento | undefined, depois: Documento): DiferencaDoc | null {
  if (!antes || ids(antes) !== ids(depois)) return { completo: depois };
  const dif: DiferencaDoc = {};
  for (const k of Object.keys(depois) as (keyof Documento)[]) {
    if (k === 'secoes' || antes[k] === depois[k]) continue;
    if (JSON.stringify(antes[k]) !== JSON.stringify(depois[k])) dif.topo = { ...dif.topo, [k]: depois[k] };
  }
  depois.secoes.forEach((s, i) => {
    if (s !== antes.secoes[i] && JSON.stringify(s) !== JSON.stringify(antes.secoes[i])) dif.secoes = { ...dif.secoes, [s.id]: s };
  });
  return dif.topo || dif.secoes ? dif : null;
}

export function aplicarDiferenca(doc: Documento | undefined, dif: DiferencaDoc): Documento | undefined {
  if (dif.completo) return aplicarDiferenca(dif.completo, { topo: dif.topo, secoes: dif.secoes });
  if (!doc) return doc;
  return { ...doc, ...dif.topo, secoes: doc.secoes.map((s) => dif.secoes?.[s.id] ?? s) };
}

// Junta duas diferenças seguidas (o envio é agrupado a cada ~80 ms).
export function juntarDiferencas(a: DiferencaDoc | null, b: DiferencaDoc): DiferencaDoc {
  if (!a) return b;
  if (b.completo) return b;
  if (a.completo) return { completo: aplicarDiferenca(a.completo, b) };
  return { topo: a.topo || b.topo ? { ...a.topo, ...b.topo } : undefined, secoes: a.secoes || b.secoes ? { ...a.secoes, ...b.secoes } : undefined };
}
