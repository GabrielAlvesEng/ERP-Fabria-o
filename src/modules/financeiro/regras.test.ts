import { describe, expect, it } from 'vitest';
import { aVencerPorSemana, colunaConta, dividir, lerValor, prazoParcela, proximaParcela, somarDias, type ParcelaBase } from './regras';

const p = (x: Partial<ParcelaBase>): ParcelaBase => ({ id: 'p', numero: 1, vencimento: null, valor: 100, pago: 0, pago_em: null, ativa: true, ...x });
const hoje = '2026-10-22';

describe('prazos', () => {
  it('classifica pela data', () => {
    expect(prazoParcela(p({ vencimento: '2026-10-21' }), hoje)).toBe('vencida');
    expect(prazoParcela(p({ vencimento: hoje }), hoje)).toBe('hoje');
    expect(prazoParcela(p({ vencimento: '2026-10-29' }), hoje)).toBe('em_breve');
    expect(prazoParcela(p({ vencimento: '2026-10-30' }), hoje)).toBe('a_pagar');
    expect(prazoParcela(p({ vencimento: null }), hoje)).toBe('sem_data');
    expect(prazoParcela(p({ vencimento: '2026-10-01', pago_em: '2026-10-01', pago: 100 }), hoje)).toBe('paga');
  });
  it('a próxima parcela é a mais antiga em aberto, ignorando substituídas', () => {
    const ps = [p({ id: 'a', numero: 1, vencimento: '2026-12-01' }), p({ id: 'b', numero: 2, vencimento: '2026-11-01' }),
      p({ id: 'c', numero: 3, vencimento: '2026-01-01', ativa: false }), p({ id: 'd', numero: 4, vencimento: null })];
    expect(proximaParcela(ps)?.id).toBe('b');
  });
});

describe('colunas do quadro', () => {
  const base = { status: 'aberta' as const, condicao_tipo: 'apos_recebimento' as const, entregue_em: null };
  it('sem entrega fica aguardando; a combinar pede vencimento', () => {
    expect(colunaConta(base, [p({})], hoje)).toBe('aguardando_entrega');
    expect(colunaConta({ ...base, condicao_tipo: 'a_combinar' }, [p({})], hoje)).toBe('definir');
  });
  it('vence hoje entra em "vence em breve"; vencida e paga', () => {
    expect(colunaConta(base, [p({ vencimento: hoje })], hoje)).toBe('em_breve');
    expect(colunaConta(base, [p({ vencimento: '2026-10-01' })], hoje)).toBe('vencida');
    expect(colunaConta({ ...base, status: 'paga' }, [p({ pago_em: hoje, pago: 100 })], hoje)).toBe('paga');
    expect(colunaConta({ ...base, status: 'cancelada' }, [p({})], hoje)).toBeNull();
  });
});

describe('valores e datas', () => {
  it('divide com o centavo na última', () => {
    expect(dividir(1000, 3)).toEqual([333.33, 333.33, 333.34]);
    expect(dividir(100, 1)).toEqual([100]);
  });
  it('lê valores em reais', () => {
    expect(lerValor('R$ 1.234,56')).toBe(1234.56);
    expect(lerValor('99.9')).toBe(99.9);
    expect(lerValor('')).toBeNaN();
  });
  it('soma dias atravessando o mês', () => {
    expect(somarDias('2026-10-20', 15)).toBe('2026-11-04');
  });
});

describe('painel', () => {
  it('soma o saldo por semana, com as vencidas na primeira', () => {
    const ps = [p({ vencimento: '2026-10-01', valor: 50 }), p({ vencimento: '2026-10-28', valor: 100, pago: 40 }), p({ vencimento: '2026-10-29', valor: 10 }), p({ vencimento: '2027-05-01' })];
    expect(aVencerPorSemana(ps, hoje, 3)).toEqual([110, 10, 0]);
  });
});
