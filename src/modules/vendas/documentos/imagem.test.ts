import { describe, expect, it } from 'vitest';
import { alturasDasImagens, dimensoesImagem } from './imagem';

const png = (w: number, h: number) => {
  const bytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, (w >>> 24) & 255, (w >> 16) & 255, (w >> 8) & 255, w & 255, (h >>> 24) & 255, (h >> 16) & 255, (h >> 8) & 255, h & 255, 8, 6, 0, 0, 0];
  return 'data:image/png;base64,' + btoa(String.fromCharCode(...bytes));
};
const jpeg = (w: number, h: number) => {
  const bytes = [0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0];
  return 'data:image/jpeg;base64,' + btoa(String.fromCharCode(...bytes));
};

describe('imagens do escopo (decisão 119)', () => {
  it('lê o tamanho de PNG e JPEG', () => {
    expect(dimensoesImagem(png(400, 1200))).toEqual({ largura: 400, altura: 1200 });
    expect(dimensoesImagem(jpeg(1920, 1080))).toEqual({ largura: 1920, altura: 1080 });
    expect(dimensoesImagem('data:image/gif;base64,R0lGODlh')).toBeNull();
    expect(dimensoesImagem('blob:x')).toBeNull();
  });
  it('a comprida ocupa a largura e cresce até o máximo; a larga fica na altura padrão', () => {
    const o = { largura: 178, padrao: 104, maxima: 300, coluna: 640, espaco: 8, extras: [0, 0, 10] };
    expect(alturasDasImagens([1080 / 1920, 1.5], o)).toEqual([168 * (1080 / 1920) + 10, 168 * 1.5 + 10]);
    expect(alturasDasImagens([null, 3], o)).toEqual([104, 300]);
  });
  it('se a coluna não cabe na página, o que passa do padrão encolhe na mesma proporção', () => {
    const o = { largura: 178, padrao: 104, maxima: 640, coluna: 640, espaco: 8, extras: [0, 0, 0] };
    const a = alturasDasImagens([3, 3, 3], o);
    expect(a.reduce((x, h) => x + h, 0) + 16).toBeCloseTo(640, 6);
    expect(a[0]).toBeCloseTo(a[2], 6);
    expect(alturasDasImagens([null, null, null, null, null, null, null], o)).toEqual(Array(7).fill(104));
  });
});
