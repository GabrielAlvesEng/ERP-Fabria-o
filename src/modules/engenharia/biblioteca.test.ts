import { describe, expect, it } from 'vitest';
import { chapaPadrao, estimar, lerPerfilCad, resumoCompra, sugerirItem, tipoDaPeca, type PecaBib, type RefsEng } from './biblioteca';

const refs: RefsEng = {
  tipos: [
    { id: 'lisa', grupo: 'Chapas', nome: 'Chapa Lisa', formato: 'chapa_lisa' },
    { id: 'od', grupo: 'Perfis', nome: 'Tubo Redondo OD', formato: 'tubo_od' },
    { id: 'tq', grupo: 'Perfis', nome: 'Tubo Quadrado', formato: 'tubo_quadrado' },
    { id: 'sch', grupo: 'Perfis', nome: 'Tubo Redondo SCH', formato: 'tubo_sch' },
    { id: 'cant', grupo: 'Perfis', nome: 'Cantoneira', formato: 'cantoneira' },
  ],
  chapas: [
    { id: 'c1', cod_mat: 'IN-001', tipo_id: 'lisa', descricao: 'Chapa Lisa AISI 304 2,00 x 1.000 x 2.000', espessura_mm: 2, largura_mm: 1000, comprimento_mm: 2000, peso_kg: 32, valor_kg: null },
    { id: 'c2', cod_mat: 'IN-001', tipo_id: 'lisa', descricao: 'Chapa Lisa AISI 304 2,00 x 1.250 x 3.000', espessura_mm: 2, largura_mm: 1250, comprimento_mm: 3000, peso_kg: 60, valor_kg: null },
  ],
  precosChapa: [{ cod_mat: 'IN-001', tipo_id: 'lisa', valor_kg: 38.5 }],
  perfis: [
    { id: 'p1', cod_mat: 'IN-001', tipo_id: 'od', descricao: 'Tubo Redondo OD Ø 1-1/4" x 1,5 mm AISI 304', a_mm: 31.75, b_mm: null, c_mm: null, parede_mm: 1.5, kg_m: 1.1404, preco_modo: 'm', valor: 40 },
    { id: 'p2', cod_mat: 'IN-001', tipo_id: 'tq', descricao: 'Tubo Quadrado 50 x 50 x 2,0 mm AISI 304', a_mm: 50, b_mm: null, c_mm: null, parede_mm: 2, kg_m: 3.072, preco_modo: 'kg', valor: 30 },
    { id: 'p3', cod_mat: 'IN-004', tipo_id: 'sch', descricao: 'Tubo Redondo SCH Ø 2" SCH 40 AISI 316L', a_mm: 60.3, b_mm: null, c_mm: null, parede_mm: 3.91, kg_m: 5.5414, preco_modo: 'm', valor: 120 },
    { id: 'p4', cod_mat: 'AC-008', tipo_id: 'cant', descricao: 'Cantoneira 2" x 1/4" ASTM A36', a_mm: 50.8, b_mm: null, c_mm: null, parede_mm: 6.35, kg_m: 4.748, preco_modo: 'kg', valor: 9 },
  ],
  itens: [
    { id: 'i1', grupo: 'Comerciais', descricao: 'Rodízio Ajax Ø2"', unidade: 'un', valor: 45 },
    { id: 'i2', grupo: 'Fixadores', descricao: 'Parafuso sextavado M12 x 40', unidade: 'un', valor: 1.2 },
  ],
};
const peca = (x: Partial<PecaBib>): PecaBib => ({ descricao: '', cod_op: [], cod_mat: 'IN-001', espessura: null, peso_unit: null, comprimento: null, ...x });

describe('tipo da peça', () => {
  it('comercial, perfil e chapa', () => {
    expect(tipoDaPeca(peca({ cod_op: ['CM'], descricao: 'Parafuso' }))).toBe('item');
    expect(tipoDaPeca(peca({ descricao: 'TUBO REDONDO Ø1.1/4" X 1,5', comprimento: 880.5, cod_op: ['LP'] }))).toBe('perfil');
    expect(tipoDaPeca(peca({ descricao: 'CHAPA 2,00', espessura: 2, cod_op: ['LC'] }))).toBe('chapa');
    expect(tipoDaPeca(peca({ descricao: 'Eixo', cod_op: ['US'] }))).toBeNull();
  });
});

describe('leitura do perfil do CAD', () => {
  it('tubo do SolidWorks da bancada', () => expect(lerPerfilCad('TUBO REDONDO Ø1.1/4" X 1,5')).toEqual({ formatos: ['tubo_od', 'tubo_sch'], medidas: [31.75, 1.5] }));
  it('tubo SCH pela tabela ASME', () => expect(lerPerfilCad('Tubo SCH 40 Ø 2"')).toEqual({ formatos: ['tubo_sch'], medidas: [60.3, 3.91] }));
  it('sem família conhecida', () => expect(lerPerfilCad('Eixo 50')).toBeNull());
});

describe('sugestão da biblioteca', () => {
  it('tubo da bancada → Tubo Redondo OD 1-1/4" x 1,5', () => expect(sugerirItem(peca({ descricao: 'TUBO REDONDO Ø1.1/4" X 1,5', comprimento: 880.5, cod_op: ['LP'] }), refs)?.id).toBe('p1'));
  it('tubo quadrado com o lado repetido', () => expect(sugerirItem(peca({ descricao: 'TUBO QUADRADO 50 X 50 X 2', comprimento: 600 }), refs)?.id).toBe('p2'));
  it('tubo SCH em 316L', () => expect(sugerirItem(peca({ descricao: 'TUBO SCH 40 Ø 2"', comprimento: 1000, cod_mat: 'IN-004' }), refs)?.id).toBe('p3'));
  it('cantoneira em polegada', () => expect(sugerirItem(peca({ descricao: 'CANTONEIRA 2" X 1/4"', comprimento: 500, cod_mat: 'AC-008' }), refs)?.id).toBe('p4'));
  it('material diferente não casa', () => expect(sugerirItem(peca({ descricao: 'TUBO REDONDO Ø1.1/4" X 1,5', comprimento: 880.5, cod_mat: 'AC-003' }), refs)).toBeNull());
  it('chapa: a de 1250 x 3000 do mesmo material e espessura', () => expect(sugerirItem(peca({ descricao: 'CHAPA 2,00', espessura: 2, cod_op: ['LC'] }), refs)?.id).toBe('c2'));
  it('comercial pela descrição, sem acento e maiúsculas', () => expect(sugerirItem(peca({ descricao: 'RODIZIO AJAX Ø2"', cod_op: ['CM'] }), refs)?.id).toBe('i1'));
  it('peça sem COD_OP que é comercial (rodízio do CAD da bancada)', () => expect(sugerirItem(peca({ descricao: 'RODIZIO AJAX Ø2"', cod_op: [] }), refs)).toEqual({ tipo: 'item', id: 'i1', descricao: 'Rodízio Ajax Ø2"' }));
  it('sem correspondência', () => expect(sugerirItem(peca({ descricao: 'Motorredutor 1 CV', cod_op: ['CM'] }), refs)).toBeNull());
});

describe('peso e custo estimados', () => {
  it('perfil por metro: peso pela biblioteca e aviso de diferença com o CAD', () => {
    const e = estimar(peca({ descricao: 'TUBO', comprimento: 880.5, peso_unit: 1, bib_tipo: 'perfil', bib_id: 'p1' }), refs);
    expect(e.pesoBib).toBeCloseTo(1.004, 3);
    expect(e.custoUnit).toBe(35.22); // 0,8805 m × R$ 40/m
    expect(e.diferenca).toBeCloseTo(0.004, 2); // 1,000 kg do CAD × 1,004 da biblioteca: abaixo de 5%
  });
  it('perfil por kg: converte pelo kg/m', () => {
    const e = estimar(peca({ comprimento: 1000, bib_tipo: 'perfil', bib_id: 'p2' }), refs);
    expect(e.pesoUsado).toBe(3.072);
    expect(e.custoUnit).toBe(92.16); // 1 m × 3,072 kg/m × R$ 30/kg
  });
  it('chapa: peso do CAD × valor/kg herdado do material + tipo', () => {
    expect(estimar(peca({ espessura: 2, peso_unit: 8.03, cod_op: ['LC'], bib_tipo: 'chapa', bib_id: 'c2' }), refs).custoUnit).toBe(309.16);
    // sem chapa ligada, usa o preço da Chapa Lisa do material
    expect(estimar(peca({ espessura: 2, peso_unit: 8.03, cod_op: ['LC'] }), refs).custoUnit).toBe(309.16);
  });
  it('comercial: valor do item', () => expect(estimar(peca({ cod_op: ['CM'], bib_tipo: 'item', bib_id: 'i1' }), refs).custoUnit).toBe(45));
});

describe('resumo para compra', () => {
  const linhas = [
    { ...peca({ descricao: 'CHAPA 2,00', espessura: 2, peso_unit: 8.03, cod_op: ['LC'] }), qtdTotal: 10 },
    { ...peca({ descricao: 'TUBO', comprimento: 880.5, bib_tipo: 'perfil' as const, bib_id: 'p1' }), qtdTotal: 8 },
    { ...peca({ descricao: 'Rodizio', cod_op: ['CM'], bib_tipo: 'item' as const, bib_id: 'i1' }), qtdTotal: 6 },
    { ...peca({ descricao: 'Motorredutor 1 CV', cod_op: ['CM'] }), qtdTotal: 1 },
  ];
  const r = resumoCompra(linhas, refs, () => 'AISI 304');
  it('chapas em kg e chapas inteiras (arredonda para cima)', () => {
    const c = r.find((l) => l.grupo === 'Chapas')!;
    expect(c.quantidade).toBe(80.3);
    expect(c.compra).toBe('2 chapa(s) de 1.250 × 3.000'); // 80,3 kg ÷ 60 kg
    expect(c.custo).toBe(3091.6); // 10 × R$ 309,16
  });
  it('perfis em metros e barras de 6 m', () => {
    const p = r.find((l) => l.grupo === 'Perfis')!;
    expect(p.quantidade).toBe(7.044);
    expect(p.compra).toBe('2 barra(s) de 6 m');
  });
  it('comerciais somados; sem item fica para ligar', () => {
    expect(r.find((l) => l.grupo === 'Comerciais')?.custo).toBe(270);
    expect(r.find((l) => l.grupo === 'Sem item')?.compra).toBe('Ligar a um item da biblioteca');
  });
  it('chapa sem espessura fica em Chapas, pedindo a espessura', () => {
    const r2 = resumoCompra([{ ...peca({ descricao: 'Chapa base 300x300', peso_unit: 5.2, cod_op: ['LC'] }), qtdTotal: 4 }], refs, () => 'AISI 304');
    expect(r2[0]).toMatchObject({ grupo: 'Chapas', quantidade: 20.8, custo: 800.8, compra: 'Informe a espessura das peças para estimar as chapas' });
  });
  it('chapa padrão sem 1250 x 3000 usa a maior', () => expect(chapaPadrao({ ...refs, chapas: [refs.chapas[0]] }, 'IN-001', 2)?.id).toBe('c1'));
});
