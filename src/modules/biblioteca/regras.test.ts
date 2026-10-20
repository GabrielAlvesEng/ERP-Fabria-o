import { describe, expect, it } from 'vitest';
import { descricaoChapa, descricaoPerfil, kgPorMetro, kgPorMetroTabela, lerDescricaoAntiga, lerMedida, pesoChapa, precosPerfil, tuboSch, valorTotalChapa } from './regras';

describe('medidas em mm e polegada', () => {
  it('lê mm com vírgula ou ponto', () => {
    expect(lerMedida('50')).toBe(50);
    expect(lerMedida('2,0')).toBe(2);
    expect(lerMedida('1.5 mm')).toBe(1.5);
  });
  it('lê polegadas inteiras e frações', () => {
    expect(lerMedida('1"')).toBe(25.4);
    expect(lerMedida('1-1/2"')).toBe(38.1);
    expect(lerMedida('1.1/2"')).toBe(38.1);
    expect(lerMedida('3/8"')).toBe(9.525);
    expect(lerMedida('Ø 2"')).toBe(50.8);
  });
  it('recusa texto que não é medida', () => {
    expect(lerMedida('')).toBeNull();
    expect(lerMedida('abc')).toBeNull();
    expect(lerMedida('0')).toBeNull();
  });
});

describe('kg/m por fórmula (aço carbono 7,85)', () => {
  it('tubo quadrado 50 x 50 x 2', () => expect(kgPorMetro('tubo_quadrado', { a: 50, parede: 2 }, 7.85)).toBeCloseTo(3.0144, 3));
  it('tubo 1" SCH 40 igual à tabela ASME (2,50 kg/m)', () => {
    const t = tuboSch('1"', 'SCH 40')!;
    expect(t).toEqual({ od: 33.4, parede: 3.38 });
    expect(kgPorMetro('tubo_sch', { a: t.od, parede: t.parede }, 7.85)).toBeCloseTo(2.5, 1);
  });
  it('aceita "40S" e "Ø 3"" na bitola SCH', () => expect(tuboSch('Ø 3"', '40S')).toEqual({ od: 88.9, parede: 5.49 }));
  it('barra redonda 1" (3,98 kg/m)', () => expect(kgPorMetro('barra_redonda', { a: 25.4 }, 7.85)).toBeCloseTo(3.978, 2));
  it('cantoneira 2" x 1/4" de abas iguais (4,75 kg/m)', () => expect(kgPorMetro('cantoneira', { a: 50.8, parede: 6.35 }, 7.85)).toBeCloseTo(4.748, 2));
  it('perfil H 200 x 200 x 8 x 12', () => expect(kgPorMetro('perfil_h', { a: 200, b: 200, parede: 8, c: 12 }, 7.85)).toBeCloseTo(48.733, 2));
  it('perfil U 100 x 50 x 5', () => expect(kgPorMetro('perfil_u', { a: 100, b: 50, parede: 5 }, 7.85)).toBeCloseTo(7.4575, 3));
  it('inox pesa mais pela densidade', () => expect(kgPorMetro('barra_chata', { a: 50.8, b: 6.35 }, 8)).toBeCloseTo(2.5806, 3));
  it('sem medida, parede maior que o tubo ou sem densidade: não calcula', () => {
    expect(kgPorMetro('tubo_quadrado', { a: 50 }, 7.85)).toBeNull();
    expect(kgPorMetro('tubo_quadrado', { a: 10, parede: 6 }, 7.85)).toBeNull();
    expect(kgPorMetro('barra_redonda', { a: 25.4 }, null)).toBeNull();
    expect(kgPorMetro('tabela', { a: 150 }, 7.85)).toBeNull();
  });
  it('perfil de catálogo em inox: corrige o kg/m do carbono pela densidade', () => expect(kgPorMetroTabela(13, 8)).toBeCloseTo(13.2484, 3));
});

describe('chapas', () => {
  it('peso como a calculadora (inox 8,00)', () => expect(pesoChapa(3, 1200, 3000, 8)).toBe(86.4));
  it('valor total = peso × valor/kg', () => expect(valorTotalChapa(86.4, 38.5)).toBe(3326.4));
  it('descrição', () => expect(descricaoChapa('Chapa Lisa', '2,00', 1250, 3000, 'AISI 304')).toBe('Chapa Lisa AISI 304 2,00 x 1.250 x 3.000'));
});

describe('preço por metro ou por kg', () => {
  it('converte pelo kg/m', () => {
    expect(precosPerfil('m', 30, 1.5)).toEqual({ porMetro: 30, porKg: 20 });
    expect(precosPerfil('kg', 20, 1.5)).toEqual({ porMetro: 30, porKg: 20 });
    expect(precosPerfil('kg', 20, null)).toEqual({ porMetro: null, porKg: 20 });
  });
});

describe('descrição de perfis', () => {
  it('tubo quadrado', () => expect(descricaoPerfil('Tubo Quadrado', 'tubo_quadrado', { a: '50', parede: '2,0' }, 'AISI 304')).toBe('Tubo Quadrado 50 x 50 x 2,0 mm AISI 304'));
  it('tubo SCH', () => expect(descricaoPerfil('Tubo Redondo SCH', 'tubo_sch', { a: '3"', parede: '40S' }, 'AISI 316L')).toBe('Tubo Redondo SCH Ø 3" SCH 40S AISI 316L'));
  it('barra redonda maciça, sem parede', () => expect(descricaoPerfil('Barra Redonda', 'barra_redonda', { a: '1-1/2"' }, 'SAE 1020')).toBe('Barra Redonda Ø 1-1/2" SAE 1020'));
  it('cantoneira em polegada', () => expect(descricaoPerfil('Cantoneira', 'cantoneira', { a: '2"', parede: '1/4"' }, 'ASTM A36')).toBe('Cantoneira 2" x 1/4" ASTM A36'));
});

describe('leitura da lista de preços antiga', () => {
  it('tubo quadrado', () => expect(lerDescricaoAntiga('Tubo Quadrado 20 x 1,5 Inox 304(Mts)')).toEqual({ tipo: 'Tubo Quadrado', a: '20', b: '', c: '', parede: '1,5', material: 'IN-001', unidade: 'm' }));
  it('barra redonda por kg', () => expect(lerDescricaoAntiga('Barra Redonda Ø1-1/8" SAE 1020(Kg)')).toMatchObject({ tipo: 'Barra Redonda', a: '1-1/8"', material: 'AC-003', unidade: 'kg' }));
  it('tubo estrutural vira tubo OD', () => expect(lerDescricaoAntiga('Tubo Redondo Estrutural Ø 1-1/2" x 2,5mm SAE 1020(Mts)')).toMatchObject({ tipo: 'Tubo Redondo OD', a: '1-1/2"', parede: '2,5mm' }));
  it('tubo SCH', () => expect(lerDescricaoAntiga('Tubo Redondo SCH 40S Ø 3" Inox 304(Mts)')).toMatchObject({ tipo: 'Tubo Redondo SCH', a: '3"', parede: 'SCH 40S' }));
  it('perfil H: altura x mesa x alma x mesa', () => expect(lerDescricaoAntiga('Perfil H 200 x 200 x 8 x 12 ASTM A572 GR50(Mts)')).toMatchObject({ a: '200', b: '200', parede: '8', c: '12', material: 'AC-009' }));
  it('316L antes de 316', () => expect(lerDescricaoAntiga('Barra Chata 2" x 1/4" Inox 316L(Mts)')?.material).toBe('IN-004'));
  it('não reconhece: fica a revisar', () => {
    expect(lerDescricaoAntiga('Policarbonato Compacto(Kg)')).toBeNull();
    expect(lerDescricaoAntiga('Tubo Quadrado 20 x 1,5 Latão(Mts)')).toBeNull();
  });
});
