import { describe, expect, it } from 'vitest';
import { modeloLinhas, pesoChapa, proximaLetra, resumoItem, type CustoLinha, type Secao } from './regras';

const linha = (secao: Secao, quantidade: number, fator: number, valor_unitario: number): CustoLinha => ({
  id: Math.random().toString(), item_id: 'i', secao, grupo: '', descricao: '', detalhe: '', detalhe2: '', unidade: '',
  quantidade, fator, valor_unitario, total: 0, ordem: 0,
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
    const r = resumoItem({ quantidade: 1, lucro_pct: 20, negociacao_pct: 5, imposto_pct: 20, imposto_modo: 'dentro' }, linhas);
    expect(r.porSecao.materiais).toBe(150868);
    expect(r.porSecao.mao_obra).toBe(47520);
    expect(r.porSecao.maquinas).toBe(10800);
    expect(r.custos).toBe(216188);
  });
  it('lucro e negociação incluem acessórios; imposto por dentro', () => {
    const r = resumoItem({ quantidade: 1, lucro_pct: 20, negociacao_pct: 5, imposto_pct: 20, imposto_modo: 'dentro' }, linhas);
    expect(r.lucro).toBe(43237.6);
    expect(r.negociacao).toBe(10809.4);
    expect(r.precoUnitario).toBe(337793.75);
    expect(r.imposto / r.precoUnitario).toBeCloseTo(0.2, 6); // o imposto é 20% do preço
  });
  it('imposto por fora e quantidade', () => {
    const r = resumoItem({ quantidade: 2, lucro_pct: 20, negociacao_pct: 5, imposto_pct: 20, imposto_modo: 'fora' }, linhas);
    expect(r.precoUnitario).toBe(324282);
    expect(r.precoTotal).toBe(648564);
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
    const m = modeloLinhas([{ etapa: 'Fabricação', funcao: 'Soldador', valor_hora: 120 }], [{ nome: 'Dobradeira', terceirizada: true, valor_hora: 180 }]);
    expect(m.filter((l) => l.secao === 'acessorios')).toHaveLength(6);
    expect(m.find((l) => l.secao === 'maquinas')?.detalhe).toBe('Sim');
    expect(m.filter((l) => l.secao === 'fretes')).toHaveLength(4);
  });
});
