import { describe, expect, it } from 'vitest';
import { combinacoesNovas, compararTamanho, lerLista, medidaEmMm } from './fixadores';

describe('fixadores', () => {
  it('converte medidas para mm', () => {
    expect(medidaEmMm('M8')).toBe(8);
    expect(medidaEmMm('1/4"')).toBeCloseTo(6.35);
    expect(medidaEmMm('1.1/2"')).toBeCloseTo(38.1);
    expect(medidaEmMm('2"')).toBeCloseTo(50.8);
    expect(medidaEmMm('3,2')).toBeCloseTo(3.2);
    expect(medidaEmMm('10 mm')).toBe(10);
    expect(medidaEmMm('')).toBe(Number.POSITIVE_INFINITY);
  });
  it('ordena métrico antes de polegada, pela medida e pelo comprimento', () => {
    const l = [
      { medida: '1/2"', comprimento: '1"' }, { medida: 'M10', comprimento: '20' }, { medida: 'M8', comprimento: '100' },
      { medida: 'M8', comprimento: '20' }, { medida: '1/4"', comprimento: '1.1/2"' }, { medida: '1/4"', comprimento: '3/4"' },
    ].sort(compararTamanho).map((t) => `${t.medida} x ${t.comprimento}`);
    expect(l).toEqual(['M8 x 20', 'M8 x 100', 'M10 x 20', '1/4" x 3/4"', '1/4" x 1.1/2"', '1/2" x 1"']);
  });
  it('lê listas digitadas', () => {
    expect(lerLista('M6, M8; M10\nM12, M8')).toEqual(['M6', 'M8', 'M10', 'M12']);
    expect(lerLista(' 1/4" , 3/8" ')).toEqual(['1/4"', '3/8"']);
  });
  it('gera só as combinações que faltam', () => {
    expect(combinacoesNovas(['M8', 'M10'], ['20', '30'], [{ medida: 'M8', comprimento: '20' }])).toHaveLength(3);
    expect(combinacoesNovas(['M8'], [], [])).toEqual([{ medida: 'M8', comprimento: '' }]);
  });
});
