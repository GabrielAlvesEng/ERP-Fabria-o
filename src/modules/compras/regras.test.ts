import { describe, expect, it } from 'vitest';
import { valorComIpi, barraPadrao, agruparAComprar, agruparLista, casarProduto, produtosParecidos, comImpostos, descreverCondicao, comprimentoDoItem, comprimentoNaDescricao, converterPreco, pesoDoItem, precoPorUnidade, ligarLinhas, mesmaUnidade, lerDias, unidadeDoProduto, melhorCotacao, menoresPrecos, pedidoAtrasado, rotuloDestino, totalCotacao, type PecaProjeto } from './regras';

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
    expect(totalCotacao(c1, itens)).toEqual({ itens: 325, ipi: 0, total: 375, faltam: 0 });
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
      ['Chapas', 'Chapa ASTM A36 6,35 x 1.200 x 3.000', 1, 'un'],
      ['Perfis', 'TUBO QUADRADO 50X50 · ASTM A36 barra 6 m', 1, 'un'],
      ['Comerciais', 'Rodízio giratório 4"', 6, 'un'],
    ]);
    expect(l[0].observacoes).toContain('38,00 kg no projeto');
    expect(l[1].observacoes).toContain('6,00 m no projeto');
    expect(barraPadrao('Viga W 200 x 15 (A572)')).toBe(12);
    expect(barraPadrao('Tubo quadrado 50 x 50 x 2,00 (304)')).toBe(6);
  });
  it('chapa sem peso vai em peças, com aviso', () => {
    const [l] = agruparLista([peca({ descricao: 'Chapa', cod_op: ['LC'], material: 'AISI 304', espessura: 2, qtd_total: 5 })]);
    expect([l.quantidade, l.unidade]).toEqual([5, 'un']);
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
    expect(linhas.map((l) => [l.descricao, l.bib_tipo, l.bib_id, l.quantidade])).toEqual([['Chapa ASTM A36 6,35 x 1.200 x 3.000', 'chapa', 'c1', 1], ['Rodízio 4"', 'item', 'r1', 6]]);
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

describe('IPI no orçamento (decisão 114)', () => {
  it('soma o IPI no item e no total, e compara o preço com IPI', () => {
    expect(valorComIpi(10, 20, 5)).toBe(210);
    const itens = [{ id: 'a', quantidade: 10 }, { id: 'b', quantidade: 2 }];
    const x = { id: 'x', frete: 30, precos: { a: 20, b: 100 }, ipis: { a: 5 } };
    expect(totalCotacao(x, itens)).toEqual({ itens: 410, ipi: 10, total: 440, faltam: 0 });
    const y = { id: 'y', frete: 0, precos: { a: 20.5, b: 100 }, ipis: {} };
    expect(menoresPrecos([x, y], itens).a).toBe(20.5);
  });
});

describe('Produtos simplificados (decisão 121)', () => {
  it('valor com impostos', () => {
    expect(comImpostos(32.5, 3.25)).toBe(33.5563);
    expect(comImpostos(10, 0)).toBe(10);
  });
  it('acha o produto pela descrição, sem diferença de maiúsculas, acentos e espaços', () => {
    const ps = [{ id: '1', grupo: 'Chapas', descricao: 'Chapa lisa 5,00 x 1250 x 3000 (304)' }, { id: '2', grupo: 'Perfis', descricao: 'Tubo quadrado 30 x 30 x 1,50 (304)' }];
    expect(casarProduto(ps, 'Chapas', 'chapa  lisa 5,00 x 1250 x 3000 (304) ')?.id).toBe('1');
    expect(casarProduto(ps, 'Barras', 'Tubo quadrado 30 x 30 x 1,50 (304)')?.id).toBe('2');
    expect(casarProduto(ps, 'Chapas', 'Chapa lisa 6,35 x 1250 x 3000 (304)')).toBeUndefined();
  });
  it('unidade do fornecedor vira un, m ou kg', () => {
    expect(['KG', 'MT', 'M', 'PC', 'PÇ', 'UN', 'BR'].map(unidadeDoProduto)).toEqual(['kg', 'm', 'm', 'un', 'un', 'un', 'un']);
  });
});

describe('produtosParecidos (decisão 133)', () => {
  const ps = [
    { id: '1', grupo: 'Perfis', descricao: 'Tubo 1/2" SCH 80 (304)' },
    { id: '2', grupo: 'Perfis', descricao: 'Tubo 1" SCH 40 (304)' },
    { id: '3', grupo: 'Conexões', descricao: 'Cotovelo 90° 1/2" BSP (304)' },
    { id: '4', grupo: 'Consumíveis', descricao: 'Disco de corte 7"' },
  ];
  it('acha o mais parecido primeiro e ignora os que não têm nada em comum', () => {
    const r = produtosParecidos(ps, 'TUBO 1/2" SCH 80 EXTREMIDADE LISA', 'Perfis');
    expect(r[0].id).toBe('1');
    expect(r.map((p) => p.id)).not.toContain('4');
  });
  it('sem nada em comum, não sugere', () => {
    expect(produtosParecidos(ps, 'Motorredutor 0,5 cv')).toEqual([]);
  });
});

describe('PDF do fornecedor na cotação (decisão 135)', () => {
  it('cada item fica com uma linha e cada linha com um item', () => {
    expect(ligarLinhas(3, [{ item: 2 }, { item: 0 }, { item: 2 }, { item: 1 }, { item: 9 }])).toEqual([3, 0, -1]);
    expect(ligarLinhas(2, [])).toEqual([-1, -1]);
  });
  it('unidades parecidas', () => {
    expect(mesmaUnidade('PC', 'pç')).toBe(true);
    expect(mesmaUnidade('MT', 'm')).toBe(true);
    expect(mesmaUnidade('BR', 'barra')).toBe(true);
    expect(mesmaUnidade('BR', 'm')).toBe(false);
    expect(mesmaUnidade('KG', 'un')).toBe(false);
  });
});

describe('Barra para metro (decisões 136 e 139)', () => {
  it('usa o total do fornecedor (barras × preço) rateado nos metros pedidos', () => {
    // Hidrotube: 1 barra de 5,80 m para 1 m pedido → paga a barra inteira.
    expect(converterPreco({ unidade_original: 'BR', quantidade: 1, valor_unit: 209.55, comprimento_min: 5.8, comprimento_max: 5.8 }, 'm', 1)?.valor).toBe(209.55);
    // 5 barras de 5,50 a 6,45 m para 26 m: total do fornecedor 6.819,23.
    const v = converterPreco({ unidade_original: 'BR', quantidade: 5, valor_unit: 1363.846, descricao_original: 'TUBO 3" SCH-40 (5,50 A\n 6,45MT)', comprimento_min: 0, comprimento_max: 0 }, 'mt', 26);
    expect(v?.valor).toBe(262.2781);
    expect(Math.round(v!.valor * 26 * 100) / 100).toBe(6819.23);
    expect(v?.nota).toContain('5,5 a 6,45 m');
    expect(v?.nota).not.toContain('ATENÇÃO');
    // 4 barras de 6,10 a 6,68 m para 25 m: 24,4 a 26,72 m, pode faltar.
    expect(converterPreco({ unidade_original: 'BR', quantidade: 4, valor_unit: 738.18, comprimento_min: 6.1, comprimento_max: 6.68 }, 'm', 25)?.nota).toContain('pode faltar');
    // Sem quantidade no PDF: barras pelo menor comprimento (8 m ÷ 5,8 → 2 barras).
    expect(converterPreco({ unidade_original: 'BR', quantidade: 0, valor_unit: 100, descricao_original: 'TUBO 4" (COMP.5,80MT)' }, 'm', 8)?.valor).toBe(25);
  });
  it('lê o comprimento na descrição', () => {
    expect(comprimentoNaDescricao('TUBO 1/2" (COMP.5,80MT)')).toEqual({ min: 5.8, max: 5.8 });
    expect(comprimentoNaDescricao('TUBO 2" API 5L (6,10 A 6,68MT)')).toEqual({ min: 6.1, max: 6.68 });
    expect(comprimentoNaDescricao('TUBO 2" 6000 MM')).toEqual({ min: 6, max: 6 });
    expect(comprimentoNaDescricao('TUBO 1.1/2" SCH 80')).toBeNull();
  });
  it('não converte sem barras nem comprimento, ou com unidades que já batem', () => {
    expect(converterPreco({ unidade_original: 'BR', quantidade: 0, valor_unit: 100 }, 'm', 10)).toBeNull();
    expect(converterPreco({ unidade_original: 'PC', quantidade: 2, valor_unit: 100 }, 'm', 10)).toBeNull();
    expect(converterPreco({ unidade_original: 'BR', quantidade: 2, valor_unit: 100, comprimento_min: 6 }, 'barra', 2)).toBeNull();
    expect(converterPreco({ unidade_original: 'MT', quantidade: 10, valor_unit: 100 }, 'm', 10)).toBeNull();
  });
});

describe('Tudo por unidade (decisão 140)', () => {
  it('lê comprimento e peso na descrição do item', () => {
    expect(comprimentoDoItem('Tubo redondo 3"x2,00 304 6mts')).toBe(6);
    expect(comprimentoDoItem('Viga W 200 x 15 barra 12 m (ASTM A572)')).toBe(12);
    expect(comprimentoDoItem('Tubo 2" SCH 40 6000 mm')).toBe(6);
    expect(comprimentoDoItem('Parafuso sextavado M12 x 40 (inox 304)')).toBeNull();
    expect(pesoDoItem('Chapa lisa 4,76 x 1500 x 3000 BQ (304)')?.kg).toBe(169.86);
    expect(pesoDoItem('Chapa xadrez 3,00 x 1.200 x 3.000 (SAE 1020)')?.kg).toBe(84.78);
    expect(pesoDoItem('Eletrodo 6013 3,25 mm lata 5 kg')?.kg).toBe(5);
  });
  it('por unidade ou barra: mesmo preço, alerta se a barra for de outro comprimento', () => {
    const item = { unidade: 'un', quantidade: 5, descricao: 'Tubo 3" SCH 40 A-106 barra 6 m' };
    expect(precoPorUnidade({ unidade_original: 'BR', quantidade: 5, valor_unit: 1363.846, comprimento_min: 5.5, comprimento_max: 6.45 }, item)).toBeNull();
    expect(precoPorUnidade({ unidade_original: 'BR', quantidade: 5, valor_unit: 209.55, descricao_original: 'TUBO (COMP.5,80MT)' }, item)?.nota).toContain('5,8 m, o item pede 6 m');
    expect(precoPorUnidade({ unidade_original: 'PC', quantidade: 5, valor_unit: 10 }, item)).toBeNull();
  });
  it('por metro: total do fornecedor dividido pelas unidades, conferido pelo comprimento', () => {
    const item = { unidade: 'un', quantidade: 8, descricao: 'Tubo redondo 3"x2,00 304 6mts' };
    const v = precoPorUnidade({ unidade_original: 'MT', quantidade: 48, valor_unit: 40 }, item);
    expect(v?.valor).toBe(240);
    expect(v?.nota).not.toContain('ATENÇÃO');
    expect(precoPorUnidade({ unidade_original: 'MT', quantidade: 0, valor_unit: 40 }, item)?.valor).toBe(240);
    expect(precoPorUnidade({ unidade_original: 'MT', quantidade: 30, valor_unit: 40 }, item)?.nota).toContain('ATENÇÃO');
  });
  it('por kg: chapa pelo peso calculado das medidas', () => {
    const item = { unidade: 'un', quantidade: 2, descricao: 'Chapa lisa 4,76 x 1500 x 3000 BQ (304)' };
    expect(precoPorUnidade({ unidade_original: 'KG', quantidade: 0, valor_unit: 25 }, item)?.valor).toBe(4246.5);
    expect(precoPorUnidade({ unidade_original: 'KG', quantidade: 340, valor_unit: 25 }, item)?.valor).toBe(4250);
    expect(precoPorUnidade({ unidade_original: 'KG', quantidade: 0, valor_unit: 25 }, { ...item, descricao: 'Rolamento 6205' })).toBeNull();
  });
});
