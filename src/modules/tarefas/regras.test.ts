import { describe, expect, it } from 'vitest';
import { mover, novasPara, porUrgencia, separar, situacaoPrazo, type TarefaBase } from './regras';

const t = (id: string, d: Partial<TarefaBase> = {}): TarefaBase => ({
  id, dono_id: 'eu', criado_por: 'eu', urgencia: 'media', prazo: null, ordem: 0, criado_em: '2026-10-27T10:00:00Z',
  feita_em: null, vista_em: '2026-10-27T10:00:00Z', ...d,
});

describe('tarefas', () => {
  it('separa abertas pela ordem e feitas pela mais recente', () => {
    const { abertas, feitas } = separar([t('b', { ordem: 2 }), t('a', { ordem: 1 }), t('f1', { feita_em: '2026-10-01' }), t('f2', { feita_em: '2026-10-05' })]);
    expect(abertas.map((x) => x.id)).toEqual(['a', 'b']);
    expect(feitas.map((x) => x.id)).toEqual(['f2', 'f1']);
  });

  it('organiza por urgência e prazo, mantendo a ordem nos empates', () => {
    const lista = [t('m1'), t('b'), t('a', { urgencia: 'alta' }), t('m2', { prazo: '2026-10-28' }), t('m3')].map((x, i) =>
      x.id === 'b' ? { ...x, urgencia: 'baixa' as const, ordem: i } : { ...x, ordem: i });
    expect(porUrgencia(lista).map((x) => x.id)).toEqual(['a', 'm2', 'm1', 'm3', 'b']);
  });

  it('situação do prazo', () => {
    expect(situacaoPrazo(null, '2026-10-27')).toBeNull();
    expect(situacaoPrazo('2026-10-26', '2026-10-27')).toBe('vencido');
    expect(situacaoPrazo('2026-10-27', '2026-10-27')).toBe('hoje');
    expect(situacaoPrazo('2026-10-28', '2026-10-27')).toBe('futuro');
  });

  it('conta só as novas passadas por outra pessoa', () => {
    const lista = [t('1', { criado_por: 'pedro', vista_em: null }), t('2', { vista_em: null }), t('3', { criado_por: 'pedro' }),
      t('4', { criado_por: 'pedro', vista_em: null, feita_em: '2026-10-27' }), t('5', { dono_id: 'pedro', criado_por: 'caio', vista_em: null })];
    expect(novasPara(lista, 'eu')).toBe(1);
  });

  it('move um item', () => {
    expect(mover([t('a'), t('b'), t('c')], 'c', 'a').map((x) => x.id)).toEqual(['c', 'a', 'b']);
    expect(mover([t('a'), t('b')], 'x', 'a').map((x) => x.id)).toEqual(['a', 'b']);
  });
});
