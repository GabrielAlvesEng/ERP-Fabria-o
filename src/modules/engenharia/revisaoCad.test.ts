import { describe, expect, it } from 'vitest';
import { compararRevisao } from './revisaoCad';
import type { Conjunto, Peca } from './regras';

// Árvore como ficaria no ERP depois da importação inicial de um JSON inventado.
const P = '26-27-001';
const conj = (id: string, pai: string | null, tipo: Conjunto['tipo'], codigo: string, extra: Partial<Conjunto> = {}): Conjunto => ({
  id, projeto_id: 'pj', pai_id: pai, tipo, sub: '00', conj: 0, codigo, nome: id, descricao: '', quantidade: 1, status: 'modelando', revisao: 'R0', ordem: 0, ...extra,
});
const peca = (id: string, conjunto: string, codigo: string, extra: Partial<Peca> = {}): Peca => ({
  id, projeto_id: 'pj', conjunto_id: conjunto, seq: 1, codigo, descricao: id, quantidade: 1, cod_op: [], material: '', cod_mat: null,
  espessura: null, peso_unit: null, observacoes: '', ...extra,
});
const conjuntos: Conjunto[] = [
  conj('g', null, 'geral', `${P}-00-00-000`, { codigo_cad: '26-099-TST-00-00-000', chave_cad: 'raiz' }),
  conj('s', 'g', 'soldado', `${P}-00-00-001`, { nome: 'MESA', codigo_cad: '26-099-TST-00-00-001', chave_cad: 'sold', status: 'liberado' }),
  conj('m', 'g', 'submontagem', `${P}-0A-00-000`, { nome: 'Manual' }),
];
const pecas: Peca[] = [
  peca('rod', 'g', `${P}-00-00-002`, { descricao: 'RODIZIO 2"', quantidade: 2, cod_op: ['CM'], cod_mat: 'IN-001', chave_cad: 'rod', codigo_cad: 'Rodizio 2pol' }),
  peca('c1', 's', `${P}-00-00-001.01`, { descricao: 'TUBO Ø1"', quantidade: 4, cod_op: ['LP'], cod_mat: 'IN-001', peso_unit: 1, comprimento: 880.5, chave_cad: 'c1' }),
  peca('c2', 's', `${P}-00-00-001.02`, { descricao: 'CHAPA 1,50', quantidade: 1, cod_op: ['LC', 'DO'], cod_mat: 'IN-001', espessura: 1.5, peso_unit: 6.02, chave_cad: 'c2' }),
  peca('man', 'm', `${P}-0A-00-001`, { descricao: 'Peça manual' }),
];

const p = (v: string) => ({ evaluated: v });
// Revisão: rodízio 2 → 3 (COD_OP vazio no CAD), chapa c2 com espessura 2, tubo c1 removido,
// corpo novo c3 na mesa e um soldado novo com um corpo.
const revisao = {
  schema: 'fabriaco.solidworks.tree', schema_version: 2, exporter_version: '2.0.0',
  definitions: [
    { source_key: 'raiz', code: '26-099-TST-00-00-000', kind: 'assembly' },
    { source_key: 'rod', code: 'Rodizio 2pol', name: 'Rodizio 2pol', kind: 'part', cod_op: '', cod_mat: 'IN-001', properties_effective: { '10-TITULO 3': p('RODIZIO 2"') } },
    { source_key: 'sold', code: '26-099-TST-00-00-001', kind: 'weldment', properties_effective: { '10-TITULO 3': p('MESA') } },
    { source_key: 'c2', kind: 'part', source_type: 'cut_list_item', cod_op: 'LC/DO', cod_mat: 'IN-001', specification: { thickness_raw: '2' }, properties: { DENOMINAÇÃO: p('CHAPA 1,50'), PESO: p('6.02') } },
    { source_key: 'c3', kind: 'part', source_type: 'cut_list_item', cod_op: 'LC', cod_mat: 'IN-001', properties: { DENOMINAÇÃO: p('CHAPA 3,00') } },
    { source_key: 'sold2', code: '26-099-TST-00-00-003', kind: 'weldment', properties_effective: { '10-TITULO 3': p('SUPORTE') } },
    { source_key: 's2c1', kind: 'part', source_type: 'cut_list_item', cod_op: 'LP', properties: { DENOMINAÇÃO: p('CANTONEIRA') } },
  ],
  occurrences: [
    { id: 'root', parent_id: '', definition_key: 'raiz', quantity: 1, position: 1 },
    { id: 'a', parent_id: 'root', definition_key: 'rod', quantity: 1, position: 1 },
    { id: 'b', parent_id: 'root', definition_key: 'rod', quantity: 1, position: 2 },
    { id: 'c', parent_id: 'root', definition_key: 'rod', quantity: 1, position: 3 },
    { id: 'd', parent_id: 'root', definition_key: 'sold', quantity: 1, position: 4 },
    { id: 'e', parent_id: 'd', definition_key: 'c2', quantity: 1, position: 1 },
    { id: 'f', parent_id: 'd', definition_key: 'c3', quantity: 2, position: 2 },
    { id: 'g', parent_id: 'root', definition_key: 'sold2', quantity: 2, position: 5 },
    { id: 'h', parent_id: 'g', definition_key: 's2c1', quantity: 4, position: 1 },
  ],
};

describe('comparação de nova revisão do CAD', () => {
  const r = compararRevisao(JSON.stringify(revisao), P, conjuntos, pecas, 'rev1.json');

  it('quantidade alterada e R2: COD_OP vazio no CAD mantém o do ERP', () => {
    expect(r.plano.alterar_pecas.find((a) => a.id === 'rod')?.dados).toMatchObject({ quantidade: 3 });
    expect(r.plano.alterar_pecas.find((a) => a.id === 'rod')?.dados).not.toHaveProperty('cod_op');
    expect(r.avisos.some((a) => a.includes('COD_OP vazio no CAD'))).toBe(true);
  });

  it('espessura alterada no corpo existente', () => {
    const l = r.linhas.find((x) => x.codigo === `${P}-00-00-001.02`)!;
    expect(l.acao).toBe('alterado');
    expect(l.mudancas.join()).toContain('Espessura: 1,5 → 2');
  });

  it('R1: tubo que saiu do CAD é marcado como removido; item manual não é tocado (R6)', () => {
    expect(r.plano.remover_pecas).toEqual(['c1']);
    expect(r.plano.remover_conjuntos).toEqual([]);
    expect(JSON.stringify(r.plano)).not.toContain('"man"');
  });

  it('R3: corpo novo continua a numeração do soldado; soldado novo usa o final do código CAD', () => {
    const novos = r.linhas.filter((l) => l.acao === 'novo').map((l) => l.codigo);
    expect(novos).toContain(`${P}-00-00-001.03`);
    expect(novos).toContain(`${P}-00-00-003`);
    expect(novos).toContain(`${P}-00-00-003.01`);
    expect(r.plano.novas_pecas.find((x) => x.chave_cad === 'c3')).toMatchObject({ conjunto_id: 's', no_ref: null, quantidade: 2 });
    const corpoNovoSoldado = r.plano.novas_pecas.find((x) => x.chave_cad === 's2c1')!;
    expect(corpoNovoSoldado.conjunto_id).toBeNull();
    expect(r.plano.novos_nos[0]).toMatchObject({ pai_id: 'g', pai_ref: null, tipo: 'soldado', quantidade: 2 });
    expect(corpoNovoSoldado.no_ref).toBe(r.plano.novos_nos[0].ref);
  });

  it('resumo', () => {
    expect(r.resumo).toMatchObject({ novo: 3, alterado: 2, removido: 1, igual: 1 });
  });

  it('R7: JSON de outra montagem é recusado', () => {
    const outro = { ...revisao, definitions: revisao.definitions.map((d) => (d.source_key === 'raiz' ? { ...d, code: '26-500-ABC-00-00-000' } : d)) };
    expect(() => compararRevisao(JSON.stringify(outro), P, conjuntos, pecas)).toThrow(/outra|montagem 26-500-ABC/);
  });

  it('item removido antes que volta ao CAD é restaurado', () => {
    const comRemovido = pecas.map((x) => (x.id === 'c2' ? { ...x, removido_cad_em: '2026-10-20T10:00:00Z' } : x));
    const r2 = compararRevisao(JSON.stringify(revisao), P, conjuntos, comRemovido);
    expect(r2.plano.alterar_pecas.find((a) => a.id === 'c2')?.dados).toMatchObject({ restaurar: true });
    expect(r2.linhas.find((l) => l.codigo === `${P}-00-00-001.02`)?.acao).toBe('restaurado');
  });
});
