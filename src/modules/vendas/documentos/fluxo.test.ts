import { describe, expect, it } from 'vitest';
import { dividirTexto, quebrarLinha } from './fluxo';

describe('texto do item passando por baixo das imagens', () => {
  it('quebra a linha por palavras', () => {
    const l = quebrarLinha('aaaa bbbb cccc dddd', 20, 8); // ~4,6 pt por letra: cabem 4 letras por linha
    expect(l).toEqual(['aaaa', 'bbbb', 'cccc', 'dddd']);
  });
  it('não divide o texto que cabe ao lado das imagens', () => {
    expect(dividirTexto('Curto.\n\nTambém curto.', 300, 8, 10)).toEqual({ antes: 'Curto.\n\nTambém curto.', depois: '' });
  });
  it('corta entre parágrafos e tira a linha em branco do começo da sobra', () => {
    const r = dividirTexto('Um.\n\nDois.\n\nTrês.', 300, 8, 3);
    expect(r).toEqual({ antes: 'Um.\n\nDois.', depois: 'Três.' });
  });
  it('corta no meio de um parágrafo longo, com ao menos 2 linhas de cada lado', () => {
    const longo = Array.from({ length: 6 }, (_, i) => `linha${i}`).join(' ');
    const r = dividirTexto(longo, 30, 8, 3); // uma palavra por linha
    expect(r.antes).toBe('linha0 linha1 linha2');
    expect(r.depois).toBe('linha3 linha4 linha5');
  });
  it('não deixa uma linha sozinha de um lado', () => {
    const r = dividirTexto('a1 a2 a3', 14, 8, 2); // 3 linhas, só 2 cabem: sobraria 1 linha
    expect(r).toEqual({ antes: '', depois: 'a1 a2 a3' });
  });
});
