import { describe, expect, it } from 'vitest';
import { TABELAS_AO_VIVO, chavesDaMudanca, outrasPessoas, type Presente } from './aoVivo';

describe('chavesDaMudanca', () => {
  it('proposta alterada recarrega o Kanban e o detalhe dela', () => {
    const k = chavesDaMudanca('propostas', { id: 'p1' });
    expect(k).toContainEqual(['propostas']);
    expect(k).toContainEqual(['proposta', 'p1']);
  });
  it('linhas filhas recarregam só a proposta delas', () => {
    expect(chavesDaMudanca('proposta_eventos', { proposta_id: 'p2' })).toEqual([['proposta', 'p2']]);
    expect(chavesDaMudanca('proposta_eventos', {})).toEqual([['proposta']]); // exclusão sem dados: recarrega todas
  });
  it('custos atualizam também os valores da proposta comercial', () => {
    expect(chavesDaMudanca('custo_linhas', {})).toEqual([['custos'], ['proposta_documentos_dados']]);
  });
  it('toda tabela ao vivo recarrega alguma coisa', () => {
    for (const t of TABELAS_AO_VIVO) expect(chavesDaMudanca(t, {}).length).toBeGreaterThan(0);
  });
});

describe('outrasPessoas', () => {
  const p = (id: string, nome: string, aba = 'Dados'): Presente => ({ id, nome, aba, foto_caminho: null, foto_atualizada_em: null, proposta_id: 'x', campo: null });
  it('tira a própria pessoa, junta janelas repetidas e ordena por nome', () => {
    const r = outrasPessoas({ eu: [p('eu', 'Gabriel')], b: [p('b', 'Pedro', 'Dados'), p('b', 'Pedro', 'Custos')], a: [p('a', 'Ana')] }, 'eu');
    expect(r.map((x) => `${x.nome}/${x.aba}`)).toEqual(['Ana/Dados', 'Pedro/Custos']);
  });
});

describe('outrasPessoas com duas janelas', () => {
  it('prefere a janela que tem proposta aberta', () => {
    const base = { nome: 'Pedro', aba: null, campo: null, foto_caminho: null, foto_atualizada_em: null, id: 'b' };
    const r = outrasPessoas({ b: [{ ...base, proposta_id: 'p1' }, { ...base, proposta_id: null }] }, 'eu');
    expect(r[0]?.proposta_id).toBe('p1');
  });
});
