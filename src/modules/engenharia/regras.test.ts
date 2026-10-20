import { describe, expect, it } from 'vitest';
import { listaMateriais, montarArvore, multiplicador, pastaDaPeca, progresso, type Conjunto, type Peca } from './regras';

const c = (id: string, pai: string | null, tipo: Conjunto['tipo'], codigo: string, quantidade = 1, status: Conjunto['status'] = 'modelando'): Conjunto => ({
  id, projeto_id: 'p', pai_id: pai, tipo, sub: '', conj: 0, codigo, nome: id, descricao: '', quantidade, status, revisao: 'R0', ordem: 0,
});
const conjuntos = [
  c('g', null, 'geral', '26-01-001-00-00-000'),
  c('b', 'g', 'submontagem', '26-01-001-0B-00-000', 1),
  c('a', 'g', 'submontagem', '26-01-001-0A-00-000', 2, 'liberado'),
  c('a1', 'a', 'conjunto', '26-01-001-0A-01-000', 3),
];
const peca = (id: string, conj: string, qtd: number, ops: Peca['cod_op'], desc = 'Chapa', peso: number | null = null): Peca => ({
  id, projeto_id: 'p', conjunto_id: conj, seq: 1, codigo: id, descricao: desc, quantidade: qtd, cod_op: ops, material: '', espessura: null, peso_unit: peso, observacoes: '',
});

describe('árvore', () => {
  it('monta a hierarquia ordenada por código', () => {
    const r = montarArvore(conjuntos)!;
    expect(r.id).toBe('g');
    expect(r.filhos.map((f) => f.id)).toEqual(['a', 'b']);
    expect(r.filhos[0].filhos[0].id).toBe('a1');
  });
  it('multiplica as quantidades até a montagem geral', () => {
    expect(multiplicador('a1', conjuntos)).toBe(6);
    expect(multiplicador('b', conjuntos)).toBe(1);
  });
  it('progresso pelos conjuntos liberados', () => {
    expect(progresso(conjuntos)).toBe(25);
  });
});

describe('peças e lista de materiais', () => {
  it('separa fabricadas, fixadores e comerciais', () => {
    expect(pastaDaPeca({ cod_op: ['LC', 'DO'], descricao: 'Chapa' })).toBe('fabricada');
    expect(pastaDaPeca({ cod_op: ['CM'], descricao: 'Parafuso M12 x 40' })).toBe('fixador');
    expect(pastaDaPeca({ cod_op: ['CM'], descricao: 'Motorredutor' })).toBe('comercial');
  });
  it('quantidade total considera os conjuntos pais', () => {
    const bom = listaMateriais([peca('x', 'a1', 2, ['LC'], 'Chapa', 1.5)], conjuntos);
    expect(bom[0].qtdTotal).toBe(12);
    expect(bom[0].pesoTotal).toBe(18);
  });
});
