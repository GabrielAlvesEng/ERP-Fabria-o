import { describe, expect, it } from 'vitest';
import { agruparLista, melhorCotacao, menoresPrecos, pedidoAtrasado, totalCotacao, type PecaProjeto } from './regras';

const peca = (p: Partial<PecaProjeto>): PecaProjeto => ({
  descricao: '', cod_op: [], cod_mat: null, material: null, espessura: null, largura: null, comprimento: null, peso_unit: null,
  bib_tipo: null, bib_descricao: null, bib_grupo: null, bib_unidade: null, qtd_total: 1, ...p,
});

describe('cotações', () => {
  const itens = [{ id: 'a', quantidade: 10 }, { id: 'b', quantidade: 2 }];
  const c1 = { id: 'c1', frete: 50, precos: { a: 12.5, b: 100 } };
  const c2 = { id: 'c2', frete: 0, precos: { a: 11, b: 140 } };
  const c3 = { id: 'c3', frete: 0, precos: { a: 1 } };

  it('soma itens × quantidade e o frete, e conta os preços que faltam', () => {
    expect(totalCotacao(c1, itens)).toEqual({ itens: 325, total: 375, faltam: 0 });
    expect(totalCotacao(c3, itens).faltam).toBe(1);
  });
  it('menor preço por item e melhor cotação completa', () => {
    expect(menoresPrecos([c1, c2, c3], itens)).toEqual({ a: 1, b: 100 });
    expect(melhorCotacao([c1, c2, c3], itens)).toBe('c1'); // c3 é incompleta; c1 375 < c2 390
  });
  it('pedido atrasado só antes de entregue', () => {
    expect(pedidoAtrasado({ status: 'aguardando_entrega', previsao_entrega: '2026-10-01' }, '2026-10-22')).toBe(true);
    expect(pedidoAtrasado({ status: 'entregue', previsao_entrega: '2026-10-01' }, '2026-10-22')).toBe(false);
    expect(pedidoAtrasado({ status: 'entregue_parcial', previsao_entrega: null }, '2026-10-22')).toBe(false);
  });
});

describe('lista de materiais do projeto', () => {
  it('soma chapas em kg por material e espessura, perfis em metros e comerciais em unidades', () => {
    const l = agruparLista([
      peca({ descricao: 'Chapa base', cod_op: ['LC'], material: 'ASTM A36', espessura: 6.35, peso_unit: 8, qtd_total: 4 }),
      peca({ descricao: 'Reforço', cod_op: ['LC', 'DO'], material: 'ASTM A36', espessura: 6.35, peso_unit: 2, qtd_total: 3 }),
      peca({ descricao: 'TUBO QUADRADO 50X50', cod_op: ['PO'], material: 'ASTM A36', comprimento: 1500, qtd_total: 4 }),
      peca({ descricao: 'Rodízio', cod_op: ['CM'], bib_tipo: 'item', bib_descricao: 'Rodízio giratório 4"', bib_grupo: 'Comerciais', bib_unidade: 'pç', qtd_total: 6 }),
    ]);
    expect(l.map((x) => [x.grupo, x.descricao, x.quantidade, x.unidade])).toEqual([
      ['Chapas', 'Chapa ASTM A36 6,35 mm', 38, 'kg'],
      ['Perfis', 'TUBO QUADRADO 50X50 · ASTM A36', 6, 'm'],
      ['Comerciais', 'Rodízio giratório 4"', 6, 'pç'],
    ]);
  });
  it('chapa sem peso vai em peças, com aviso', () => {
    const [l] = agruparLista([peca({ descricao: 'Chapa', cod_op: ['LC'], material: 'AISI 304', espessura: 2, qtd_total: 5 })]);
    expect([l.quantidade, l.unidade]).toEqual([5, 'pç']);
    expect(l.observacoes).toContain('sem peso');
  });
});
