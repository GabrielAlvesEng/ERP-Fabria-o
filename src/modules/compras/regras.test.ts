import { describe, expect, it } from 'vitest';
import { agruparAComprar, agruparLista, descreverCondicao, fichasDeProdutos, lerDias, melhorCotacao, menoresPrecos, pedidoAtrasado, rotuloDestino, totalCotacao, type PecaProjeto } from './regras';

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

describe('Compras v2 (decisão 103)', () => {
  it('condição de pagamento', () => {
    expect(lerDias('30/60/90')).toEqual([30, 60, 90]);
    expect(descreverCondicao('apos_recebimento', [28])).toBe('28 dias após o recebimento');
    expect(descreverCondicao('parcelado', [30, 60])).toBe('Parcelado 30/60 dias da emissão');
  });
  it('lista do projeto leva o produto da Biblioteca', () => {
    const linhas = agruparLista([
      peca({ descricao: 'Rodízio', cod_op: ['CM'], bib_tipo: 'item', bib_id: 'r1', bib_descricao: 'Rodízio 4"', bib_grupo: 'Comerciais', bib_unidade: 'pç', qtd_total: 6 }),
      peca({ descricao: 'Chapa', cod_op: ['LC'], bib_tipo: 'chapa', bib_id: 'c1', bib_descricao: 'Chapa A36 1/4"', material: 'ASTM A36', espessura: 6.35, peso_unit: 10, qtd_total: 2 }),
    ]);
    expect(linhas.map((l) => [l.descricao, l.bib_tipo, l.bib_id, l.quantidade])).toEqual([['Chapa ASTM A36 6,35 mm', 'chapa', 'c1', 20], ['Rodízio 4"', 'item', 'r1', 6]]);
  });
  it('ficha do produto junta cadastro e histórico, a compra mais recente primeiro', () => {
    const h = (emitido_em: string, valor: number) => ({ bib_tipo: 'item' as const, bib_id: 'p1', grupo: 'Consumíveis' as const, descricao: 'Disco de corte', unidade: 'un', emitido_em, valor_unit: valor, fornecedor_nome: 'F' });
    const f = fichasDeProdutos([{ tipo: 'item', id: 'p1', descricao: 'Disco de corte', grupo: 'Consumíveis', unidade: 'un' }, { tipo: 'item', id: 'p2', descricao: 'Eletrodo', grupo: 'Consumíveis', unidade: 'kg' }],
      [h('2026-09-01', 5), h('2026-10-01', 6), { ...h('2026-08-01', 1), bib_tipo: null, bib_id: null, descricao: 'Lixa 80' }]);
    expect(f.map((x) => [x.descricao, x.cadastrado, x.compras.length])).toEqual([['Disco de corte', true, 2], ['Lixa 80', false, 1], ['Eletrodo', true, 0]]);
    expect(f[0].compras[0].valor_unit).toBe(6);
  });
});

describe('À comprar e pacotes (decisão 111)', () => {
  const req = (projeto_codigo: string, origem: 'engenharia' | 'almoxarifado' | 'compras', prioridade: 'normal' | 'urgente' = 'normal', necessario_em: string | null = null) =>
    ({ projeto_codigo, origem, prioridade, necessario_em, setor: 'Manutenção' });
  it('para quem é o item', () => {
    expect(rotuloDestino(req('26-01-001', 'engenharia'))).toBe('Pedido 26-01-001');
    expect(rotuloDestino(req('', 'almoxarifado'))).toBe('Estoque');
    expect(rotuloDestino(req('', 'compras'))).toBe('Manutenção');
  });
  it('separa por categoria, pedido antes de estoque e urgente primeiro', () => {
    const g = agruparAComprar([
      { grupo: 'Perfis' as const, descricao: 'W150', compras_requisicoes: req('26-01-001', 'engenharia') },
      { grupo: 'Chapas' as const, descricao: 'Inox 2mm', compras_requisicoes: req('', 'almoxarifado') },
      { grupo: 'Chapas' as const, descricao: 'Inox 3mm', compras_requisicoes: req('26-01-001', 'engenharia') },
      { grupo: 'Chapas' as const, descricao: 'A36 1/4', compras_requisicoes: req('26-01-002', 'engenharia', 'urgente') },
    ]);
    expect(g.map((x) => [x.grupo, x.itens.map((i) => i.descricao)])).toEqual([['Chapas', ['A36 1/4', 'Inox 3mm', 'Inox 2mm']], ['Perfis', ['W150']]]);
  });
});
