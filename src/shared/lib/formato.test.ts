import { describe, expect, it } from 'vitest';
import { moeda, numeroBR } from './formato';

describe('valores em reais', () => {
  it('converte o texto digitado ou exibido para o banco', () => {
    expect(numeroBR('R$ 2.500,50')).toBe('2500.50');
    expect(numeroBR('2.500,50')).toBe('2500.50');
    expect(numeroBR('1000')).toBe('1000');
    expect(numeroBR('r$ 12,3')).toBe('12.3');
    expect(numeroBR('')).toBe('');
  });
  it('exibe com R$', () => expect(moeda(1234.5).replace(/\s/g, ' ')).toBe('R$ 1.234,50'));
});
