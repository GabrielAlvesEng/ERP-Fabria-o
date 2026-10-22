import { describe, expect, it } from 'vitest';
import { anoMesSP, avancoMedio, seriePorMes } from './indicadores';

describe('indicadores da Engenharia (decisão 97)', () => {
  it('mês pelo horário de São Paulo', () => {
    expect(anoMesSP('2026-11-01T02:00:00Z')).toEqual([2026, 10]);
    expect(anoMesSP('2026-11-01T04:00:00Z')).toEqual([2026, 11]);
  });

  it('projetos por mês sem duplicar idas e voltas e só dos projetos filtrados', () => {
    const ev = [
      { projeto_id: 'a', tipo: 'criado', para: 'nao_iniciado', criado_em: '2026-10-05T12:00:00Z' },
      { projeto_id: 'a', tipo: 'status', para: 'liberado', criado_em: '2026-10-10T12:00:00Z' },
      { projeto_id: 'a', tipo: 'status', para: 'em_andamento', criado_em: '2026-10-11T12:00:00Z' },
      { projeto_id: 'a', tipo: 'status', para: 'liberado', criado_em: '2026-10-12T12:00:00Z' },
      { projeto_id: 'a', tipo: 'status', para: 'finalizado', criado_em: '2026-11-02T12:00:00Z' },
      { projeto_id: 'b', tipo: 'criado', para: 'nao_iniciado', criado_em: '2026-10-05T12:00:00Z' },
      { projeto_id: 'a', tipo: 'criado', para: 'nao_iniciado', criado_em: '2025-10-05T12:00:00Z' },
    ];
    const itens = [{ projeto_id: 'a', criado_em: '2026-10-06T12:00:00Z' }, { projeto_id: 'b', criado_em: '2026-10-06T12:00:00Z' }];
    const m = seriePorMes(2026, ev, itens, new Set(['a']));
    expect(m[9]).toEqual({ abertos: 1, liberados: 1, finalizados: 0, itens: 1 });
    expect(m[10]).toEqual({ abertos: 0, liberados: 0, finalizados: 1, itens: 0 });
  });

  it('avanço médio ignora quem não tem dado', () => {
    const base = { id: 'x', conjuntos: 2, conjuntos_modelados: 2, conjuntos_liberados: 1, conjuntos_revisao: 0, status_geral: 'modelando' as const, pecas: 0, pecas_material: 0, pecas_sem_material: 0 };
    expect(avancoMedio([base, { ...base, conjuntos_modelados: 0, conjuntos_liberados: 0 }])).toEqual({ modelagem: 50, materiais: null, detalhamento: 25 });
  });
});
