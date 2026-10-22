import { describe, expect, it } from 'vitest';
import { atrasado, avanco, lerMaterial, listaMateriais, montarArvore, multiplicador, pastaDaPeca, pendencias, progresso, tipoMovimento, type CodOp, type Conjunto, type Peca } from './regras';
import { blocoDaPeca } from './biblioteca';

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
  id, projeto_id: 'p', conjunto_id: conj, seq: 1, codigo: id, descricao: desc, quantidade: qtd, cod_op: ops, material: '', cod_mat: null, espessura: null, peso_unit: peso, observacoes: '',
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

describe('COD_MAT', () => {
  const cat = [{ cod_mat: 'IN-001', nome: 'AISI 304', categoria: 'Inox' }, { cod_mat: 'AC-008', nome: 'ASTM A36', categoria: 'Carbono' }];
  it('lê o código do catálogo', () => {
    expect(lerMaterial('IN-001 — AISI 304', cat)).toEqual({ cod_mat: 'IN-001', material: 'AISI 304' });
    expect(lerMaterial('ac-008', cat)).toEqual({ cod_mat: 'AC-008', material: 'ASTM A36' });
    expect(lerMaterial('astm a36', cat)).toEqual({ cod_mat: 'AC-008', material: 'ASTM A36' });
  });
  it('texto fora do catálogo fica sem COD_MAT', () => {
    expect(lerMaterial('Nylon especial', cat)).toEqual({ cod_mat: null, material: 'Nylon especial' });
  });
});

describe('Kanban e Dashboard da Engenharia (decisão 96)', () => {
  it('movimentos: Chefe libera, finaliza e volta; os demais só avançam até Em andamento', () => {
    expect(tipoMovimento('nao_iniciado', 'em_andamento', false)).toBe('simples');
    expect(tipoMovimento('em_andamento', 'liberado', false)).toBe('proibido');
    expect(tipoMovimento('em_andamento', 'liberado', true)).toBe('liberar');
    expect(tipoMovimento('liberado', 'finalizado', true)).toBe('finalizar');
    expect(tipoMovimento('liberado', 'em_andamento', false)).toBe('proibido');
    expect(tipoMovimento('liberado', 'em_andamento', true)).toBe('voltar');
    expect(tipoMovimento('cancelado', 'em_andamento', true)).toBe('proibido');
  });

  it('atrasado: prazo vencido e projeto não finalizado', () => {
    expect(atrasado({ status: 'em_andamento', prazo: '2026-10-21' }, '2026-10-22')).toBe(true);
    expect(atrasado({ status: 'em_andamento', prazo: '2026-10-22' }, '2026-10-22')).toBe(false);
    expect(atrasado({ status: 'finalizado', prazo: '2026-01-01' }, '2026-10-22')).toBe(false);
    expect(atrasado({ status: 'nao_iniciado', prazo: null }, '2026-10-22')).toBe(false);
  });

  it('avanço pelos registros e montagem geral quando não há conjuntos', () => {
    const base = { id: 'x', conjuntos: 4, conjuntos_modelados: 3, conjuntos_liberados: 1, conjuntos_revisao: 0, status_geral: 'modelando' as const, pecas: 10, pecas_material: 5, pecas_sem_material: 2 };
    expect(avanco(base)).toEqual({ modelagem: 75, materiais: 50, detalhamento: 25 });
    expect(avanco({ ...base, conjuntos: 0, status_geral: 'liberado', pecas: 0 })).toEqual({ modelagem: 100, materiais: null, detalhamento: 100 });
    expect(pendencias({ responsavel_id: null, prazo: null, status: 'em_andamento' }, base)).toEqual(['Sem responsável', 'Sem prazo', '2 peça(s) sem material']);
    expect(pendencias({ responsavel_id: null, prazo: null, status: 'finalizado' }, base)).toEqual([]);
  });

  it('blocos da lista: chapa lançada à mão com comprimento continua chapa', () => {
    const p = { descricao: 'Chapa base', cod_op: ['LC'] as CodOp[], cod_mat: null, espessura: 6.35, largura: 300, comprimento: 500, peso_unit: null };
    expect(blocoDaPeca(p)).toBe('chapa');
    expect(blocoDaPeca({ ...p, cod_op: ['PO'], espessura: null, largura: null })).toBe('perfil');
    expect(blocoDaPeca({ ...p, cod_op: ['CM'] })).toBe('comercial');
  });
});
