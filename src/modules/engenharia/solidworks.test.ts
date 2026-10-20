import { describe, expect, it } from 'vitest';
import { lerJsonMacro, sufixoCad } from './solidworks';

// JSON inventado no formato da macro V2 (montagem com rodízio repetido e um conjunto soldado com 2 corpos).
const p = (v: string) => ({ evaluated: v });
const json = {
  schema: 'fabriaco.solidworks.tree', schema_version: 2, exporter_version: '2.0.0', requires_review: true,
  definitions: [
    { source_key: 'raiz', code: '26-099-TST-00-00-000', kind: 'assembly', document_path: 'C:/x/26-099-TST-00-00-000.SLDASM',
      properties_effective: { '9-TITULO 2': p('MESA DE TESTE'), '12-PESO ': p('20.5'), '3-APROVADO': p('FULANO') } },
    { source_key: 'rod', code: 'Rodizio 2pol', name: 'Rodizio 2pol', kind: 'part', cod_op: '', cod_mat: 'IN-001', material_name: 'AISI 304',
      properties_effective: { '10-TITULO 3': p('RODIZIO 2"'), '12-PESO': p('0.52') } },
    { source_key: 'sold', code: '26-099-TST-00-00-001', kind: 'weldment', properties_effective: { '10-TITULO 3': p('MESA') } },
    { source_key: 'c1', kind: 'part', source_type: 'cut_list_item', cut_list_name: '01', name: 'TUBO', cod_op: 'LP', cod_mat: 'IN-001', material_name: 'AISI 304',
      specification: { length_raw: '880.5' }, properties: { DENOMINAÇÃO: p('TUBO Ø1"'), PESO: p('1.00') } },
    { source_key: 'c2', kind: 'part', source_type: 'cut_list_item', cut_list_name: '02', name: 'CHAPA', cod_op: 'LC/DO', cod_mat: 'IN-001',
      specification: { thickness_raw: '1.5', length_raw: '700', width_raw: '600' }, properties: { DENOMINAÇÃO: p('CHAPA 1,50'), PESO: p('6.02'), Dobras: p('4') } },
  ],
  occurrences: [
    { id: 'root', parent_id: '', definition_key: 'raiz', quantity: 1, position: 1 },
    { id: 'a', parent_id: 'root', definition_key: 'rod', quantity: 1, position: 1 },
    { id: 'b', parent_id: 'root', definition_key: 'rod', quantity: 1, position: 2 },
    { id: 'c', parent_id: 'root', definition_key: 'sold', quantity: 1, position: 3 },
    { id: 'd', parent_id: 'c', definition_key: 'c1', quantity: 4, position: 1 },
    { id: 'e', parent_id: 'c', definition_key: 'c2', quantity: 1, position: 2 },
  ],
  issues: [{ severity: 'warning', context: 'c:/x/rodizio 2pol.sldprt|config', message: 'COD_OP nao preenchido' }],
};

describe('leitor do JSON da macro', () => {
  const r = lerJsonMacro(JSON.stringify(json), '26-27-001');

  it('soldado vira nó com o final do código CAD sob o prefixo do projeto', () => {
    expect(r.plano.nos).toHaveLength(1);
    expect(r.plano.nos[0]).toMatchObject({ tipo: 'soldado', sufixo: '00-00-001', nome: 'MESA', codigo_cad: '26-099-TST-00-00-001' });
  });

  it('corpos da lista de corte viram peças .01, .02 do soldado, na ordem', () => {
    const corpos = r.previa.filter((l) => l.tipo === 'peca' && l.codigo.includes('.'));
    expect(corpos.map((l) => l.codigo)).toEqual(['26-27-001-00-00-001.01', '26-27-001-00-00-001.02']);
    expect(r.plano.pecas.find((x) => x.chave_cad === 'c1')).toMatchObject({ quantidade: 4, cod_op: ['LP'], comprimento: 880.5, peso_unit: 1 });
    expect(r.plano.pecas.find((x) => x.chave_cad === 'c2')).toMatchObject({ cod_op: ['LC', 'DO'], espessura: 1.5, comprimento: null });
  });

  it('ocorrências repetidas somam quantidade e o código evita o do soldado', () => {
    const rod = r.previa.find((l) => l.nome === 'RODIZIO 2"')!;
    expect(rod.quantidade).toBe(2);
    expect(rod.codigo).toBe('26-27-001-00-00-002');
    expect(rod.pendente).toBe(true);
  });

  it('considera códigos que já existem no projeto', () => {
    const r2 = lerJsonMacro(JSON.stringify(json), '26-27-001', ['26-27-001-00-00-002']);
    expect(r2.previa.find((l) => l.nome === 'RODIZIO 2"')!.codigo).toBe('26-27-001-00-00-003');
    const r3 = lerJsonMacro(JSON.stringify(json), '26-27-001', ['26-27-001-00-00-001']);
    expect(r3.avisos.some((a) => a.includes('será recusada'))).toBe(true);
  });

  it('dados do projeto e avisos', () => {
    expect(r.plano.projeto_dados).toMatchObject({ titulo: 'MESA DE TESTE', peso: 20.5, aprovado: 'FULANO' });
    expect(r.avisos.some((a) => a.includes('26-099-TST'))).toBe(true);
    expect(r.avisos.some((a) => a.includes('COD_OP nao preenchido'))).toBe(true);
  });

  it('recusa arquivo que não é da macro', () => {
    expect(() => lerJsonMacro('{"schema":"outro"}', '26-27-001')).toThrow(/macro/);
    expect(() => lerJsonMacro('não é json', '26-27-001')).toThrow(/JSON válido/);
  });
});

describe('sufixo do código CAD', () => {
  it('respeita o padrão por tipo', () => {
    expect(sufixoCad('26-059-BMA-0A-00-000', 'submontagem')).toBe('0A-00-000');
    expect(sufixoCad('26-059-BMA-0A-01-000', 'submontagem')).toBeNull();
    expect(sufixoCad('26-059-BMA-0A-01-000', 'conjunto')).toBe('0A-01-000');
    expect(sufixoCad('26-059-BMA-00-00-001', 'peca')).toBe('00-00-001');
    expect(sufixoCad('Rodizio', 'peca')).toBeNull();
  });
});
