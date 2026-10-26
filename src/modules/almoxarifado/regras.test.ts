import { describe, expect, it } from 'vitest';
import { combina, lerQuantidade, qtd, situacaoEstoque, sugestaoCompra, unidadePadrao } from './regras';

describe('Almoxarifado: regras', () => {
  it('situação do estoque', () => {
    expect(situacaoEstoque(0, 5)).toBe('zerado');
    expect(situacaoEstoque(5, 5)).toBe('baixo');
    expect(situacaoEstoque(6, 5)).toBe('ok');
    expect(situacaoEstoque(1, 0)).toBe('ok');
  });
  it('sugestão de compra chega a duas vezes o mínimo', () => {
    expect(sugestaoCompra(3, 5)).toBe(7);
    expect(sugestaoCompra(0, 0)).toBe(1);
    expect(sugestaoCompra(12, 5)).toBe(1);
  });
  it('quantidades no formato brasileiro', () => {
    expect(qtd(7)).toBe('7');
    expect(qtd('2.500')).toBe('2,5');
    expect(lerQuantidade('2,5')).toBe(2.5);
    expect(lerQuantidade('1.234,5')).toBe(1234.5);
    expect(lerQuantidade('2.5')).toBe(2.5);
    expect(lerQuantidade('')).toBeNull();
    expect(lerQuantidade('abc')).toBeNull();
  });
  it('unidade padrão e busca por palavras', () => {
    expect(unidadePadrao('perfil', 'un')).toBe('m');
    expect(unidadePadrao('item', 'cx')).toBe('cx');
    expect(combina('Disco de corte 7" Inox', 'corte disco')).toBe(true);
    expect(combina('Eletrodo 6013', 'disco')).toBe(false);
  });
});
