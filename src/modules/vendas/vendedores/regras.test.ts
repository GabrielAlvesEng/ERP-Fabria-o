import { describe, expect, it } from 'vitest';
import { resumoVendedor } from './regras';

describe('resumo do vendedor', () => {
  it('conta propostas, negociação, aprovadas, conversão e follow-ups vencidos', () => {
    const r = resumoVendedor([
      { status: 'À enviar', valor: 1000, proximo_followup: null },
      { status: 'Enviados', valor: 2000, proximo_followup: '2026-10-01' },
      { status: 'Follow-up', valor: 500, proximo_followup: '2026-12-01' },
      { status: 'Aprovado', valor: 3000, proximo_followup: null },
      { status: 'Pago', valor: 4000, proximo_followup: null },
      { status: 'Reprovado', valor: 9000, proximo_followup: null },
    ], '2026-10-21');
    expect(r).toEqual({ propostas: 6, negociacao: 2500, aprovadas: 2, valorAprovado: 7000, conversao: 67, vencidos: 1 });
  });
  it('sem decididas, conversão fica vazia', () => {
    expect(resumoVendedor([{ status: 'À enviar', valor: 0, proximo_followup: null }], '2026-10-21').conversao).toBeNull();
  });
});
