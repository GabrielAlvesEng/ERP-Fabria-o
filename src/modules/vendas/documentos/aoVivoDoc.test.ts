import { describe, expect, it } from 'vitest';
import { aplicarDiferenca, diferencaDocumento, juntarDiferencas } from './aoVivoDoc';
import type { Documento } from './modelo';

const doc = (objetivo: string, escopo = 'e'): Documento => ({
  tipo: 'tecnica', capa: { linha1: 'A', linha2: '', subtitulo: '' }, visao: { objeto: '', solucao: '', unidade: '' }, abertura: '',
  secoes: [{ id: 'objetivo', titulo: 'Objetivo', ativo: true, tipo: 'texto', texto: objetivo }, { id: 'escopo', titulo: 'Escopo', ativo: true, tipo: 'texto', texto: escopo }],
});

describe('diferença do documento ao vivo', () => {
  it('manda só a seção alterada e junta com o que a outra pessoa tem', () => {
    const dif = diferencaDocumento(doc('a'), doc('ab'))!;
    expect(Object.keys(dif.secoes!)).toEqual(['objetivo']);
    const outro = doc('a', 'escopo da outra pessoa');
    const r = aplicarDiferenca(outro, dif)!;
    expect(r.secoes.map((s) => ('texto' in s ? s.texto : ''))).toEqual(['ab', 'escopo da outra pessoa']);
  });
  it('sem mudança não manda nada; seção nova manda o documento todo', () => {
    expect(diferencaDocumento(doc('a'), doc('a'))).toBeNull();
    const d = doc('a'); const mais = { ...d, secoes: [...d.secoes, { id: 'x', titulo: 'X', ativo: true, tipo: 'texto' as const, texto: '' }] };
    expect(diferencaDocumento(d, mais)?.completo).toBe(mais);
  });
  it('junta envios seguidos', () => {
    const a = diferencaDocumento(doc('a'), doc('ab'))!;
    const b = diferencaDocumento(doc('ab'), { ...doc('ab'), capa: { linha1: 'B', linha2: '', subtitulo: '' } })!;
    const j = juntarDiferencas(a, b);
    expect(Object.keys(j.secoes!)).toEqual(['objetivo']);
    expect(j.topo?.capa?.linha1).toBe('B');
  });
});
