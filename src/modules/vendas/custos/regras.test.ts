import { describe, expect, it } from 'vitest';
import { modeloLinhas, pesoChapa, pesoMateriais, proximaLetra, reordenar, resumoItem, totalLinha, type CustoLinha, type Secao } from './regras';

const linha = (secao: Secao, quantidade: number, fator: number, valor_unitario: number, extra: Partial<CustoLinha> = {}): CustoLinha => ({
  id: Math.random().toString(), item_id: 'i', secao, grupo: '', descricao: '', detalhe: '', detalhe2: '', unidade: '',
  quantidade, fator, valor_unitario, total: 0, ordem: 0, material: '', adicional: 0, consumo: null, combustivel: null, ...extra,
});

// Números da planilha "Item A - Plataforma.xlsx".
const linhas = [
  linha('materiais', 38, 6, 176), linha('materiais', 14, 6, 65), linha('materiais', 38, 95, 28), linha('materiais', 1, 150, 28),
  linha('acessorios', 1, 1, 4000),
  linha('mao_obra', 132, 1, 120), linha('mao_obra', 132, 1, 120), linha('mao_obra', 132, 1, 120),
  linha('maquinas', 30, 1, 180), linha('maquinas', 30, 1, 180),
  linha('fretes', 1, 1, 3000),
];

describe('resumo de custos (decisão 30)', () => {
  it('soma as seções como a planilha', () => {
    const r = resumoItem({ quantidade: 1, lucro_pct: 20, negociacao_pct: 5, imposto_pct: 20 }, linhas);
    expect(r.porSecao.materiais).toBe(150868);
    expect(r.porSecao.mao_obra).toBe(47520);
    expect(r.porSecao.maquinas).toBe(10800);
    expect(r.custos).toBe(216188);
  });
  it('margem e negociação sobre todos os custos; imposto por dentro', () => {
    const r = resumoItem({ quantidade: 1, lucro_pct: 20, negociacao_pct: 5, imposto_pct: 20 }, linhas);
    expect(r.margem).toBe(43237.6);
    expect(r.negociacao).toBe(10809.4);
    expect(r.precoUnitario).toBe(337793.75);
    expect(r.imposto / r.precoUnitario).toBeCloseTo(0.2, 6); // o imposto é 20% do preço
  });
  it('quantidade multiplica o preço (imposto sempre por dentro, decisão 43)', () => {
    const r = resumoItem({ quantidade: 2, lucro_pct: 20, negociacao_pct: 5, imposto_pct: 20 }, linhas);
    expect(r.precoTotal).toBe(675587.5);
  });
});

describe('totais por linha (iguais ao gatilho do banco)', () => {
  it('acabamentos', () => {
    expect(totalLinha(linha('acabamentos', 7, 1, 350, { grupo: 'Acabamento em inox', adicional: 800 }))).toBe(1150);
    expect(totalLinha(linha('acabamentos', 4, 1, 180, { grupo: 'Pintura por tinta', adicional: 500 }))).toBe(1220);
    expect(totalLinha(linha('acabamentos', 250, 1, 6.5, { grupo: 'Galvanização a fogo' }))).toBe(1625);
  });
  it('viagem: veículo próprio (igual à frota antiga) e veículo alugado', () => {
    expect(totalLinha(linha('viagem', 2, 180, 0, { grupo: 'Veículo próprio', consumo: 4, combustivel: 6.2, adicional: 35.4 }))).toBe(628.8);
    expect(totalLinha(linha('frota', 2, 180, 0, { grupo: 'Veículo próprio', consumo: 4, combustivel: 6.2, adicional: 35.4 }))).toBe(628.8);
    // 3 diárias × 250 + 600 km ÷ 10 km/l × 6 + 80 de pedágio (mesmo teste do banco)
    expect(totalLinha(linha('viagem', 3, 600, 250, { grupo: 'Veículo alugado', consumo: 10, combustivel: 6, adicional: 80 }))).toBe(1190);
  });
  it('frete terceirizado e hospedagem ignoram o fator', () => {
    expect(totalLinha(linha('frete', 2, 7, 1500))).toBe(3000);
    expect(totalLinha(linha('viagem', 4, 9, 200, { grupo: 'Hospedagem' }))).toBe(800);
    expect(totalLinha(linha('viagem', 3, 5, 40, { grupo: 'Alimentação' }))).toBe(600);
  });
  it('comerciais, fixadores e consumíveis ignoram o fator', () => {
    expect(totalLinha(linha('materiais', 3, 5, 10, { grupo: 'Comerciais' }))).toBe(30);
    expect(totalLinha(linha('materiais', 3, 5, 10, { grupo: 'Fixadores' }))).toBe(30);
    expect(totalLinha(linha('materiais', 3, 5, 10, { grupo: 'Consumíveis' }))).toBe(30);
  });
  it('peso dos materiais para galvanização', () => {
    const ls = [linha('materiais', 2, 150, 30, { grupo: 'Chapas' }), linha('materiais', 4, 6, 50, { grupo: 'Perfis', descricao: 'Tubo 1' }), linha('materiais', 1, 6, 50, { grupo: 'Perfis', descricao: 'Sem kg' })];
    expect(pesoMateriais(ls, (x) => (x.descricao === 'Tubo 1' ? 1.5 : null))).toEqual({ kg: 336, perfisSemKgM: 1 });
  });
});

describe('apoio', () => {
  it('peso de chapa igual à aba Cálculo Peso', () => {
    expect(pesoChapa(5, 1250, 3000, 'inox')).toBe(150);
    expect(pesoChapa(4.75, 300, 300, 'carbono')).toBeCloseTo(3.356, 3);
  });
  it('próxima letra do item', () => {
    expect(proximaLetra([])).toBe('A');
    expect(proximaLetra(['A', 'B'])).toBe('C');
    expect(proximaLetra(['A', 'C'])).toBe('B');
  });
  it('modelo de item novo traz as linhas padrão', () => {
    const m = modeloLinhas([{ etapa: 'Fabricação', funcao: 'Soldador', valor_hora: 120 }], [{ nome: 'Guilhotina', valor_hora: 100 }]);
    expect(m.filter((l) => ['acessorios', 'frota', 'alimentacao', 'hospedagem'].includes(l.secao))).toHaveLength(0);
    expect(m.find((l) => l.secao === 'maquinas')?.detalhe).toBe('Não'); // só maquinário próprio (decisão 50)
    expect(m.filter((l) => l.secao === 'frete')).toHaveLength(4);
    expect(m.filter((l) => l.secao === 'viagem').map((l) => l.grupo)).toEqual(['Alimentação', 'Hospedagem']);
  });
});

describe('reordenar linhas (arrastar)', () => {
  const l = (id: string, ordem: number) => ({ id, ordem });
  it('move para baixo e devolve só as que mudaram', () => {
    expect(reordenar([l('a', 1), l('b', 2), l('c', 3)], 'a', 'c')).toEqual([{ id: 'b', ordem: 1 }, { id: 'c', ordem: 2 }, { id: 'a', ordem: 3 }]);
  });
  it('move para cima', () => {
    expect(reordenar([l('a', 5), l('b', 6), l('c', 7)], 'c', 'a')).toEqual([{ id: 'c', ordem: 5 }, { id: 'a', ordem: 6 }, { id: 'b', ordem: 7 }]);
  });
  it('sem mudança', () => {
    expect(reordenar([l('a', 1)], 'a', 'a')).toEqual([]);
  });
});
