import { describe, expect, it } from 'vitest';
import { enviosPorProposta, porVendedor, seriePorMes, type Marcos, type PropostaIndicador } from './indicadores';

const P = (id: string, emissao: string, status: string, valor: number, resp: string | null, vendedor = ''): PropostaIndicador => ({ id, data_emissao: emissao, status, valor, responsavel_id: resp, vendedor });
const props = [
  P('a', '2026-03-10', 'Aprovado', 1000, 'g', 'Gabriel'),
  P('b', '2026-03-20', 'Enviados', 500, 'g', 'Gabriel'),
  P('c', '2026-04-02', 'Reprovado', 800, 'p', 'Pedro'),
  P('d', '2026-05-01', 'À enviar', 0, null),
];
const marcos: Marcos = {
  envios: [
    { proposta_id: 'a', numero: 0, enviada_em: '2026-03-12', valor: 900 },
    { proposta_id: 'a', numero: 1, enviada_em: '2026-04-01', valor: 1000 },
    { proposta_id: 'b', numero: 0, enviada_em: '2026-03-25', valor: 500 },
    { proposta_id: 'c', numero: 0, enviada_em: '2026-04-05', valor: 800 },
  ],
  aprovacoes: [{ proposta_id: 'a', data_aprovacao: '2026-04-20', valor_aprovado: 950 }],
  reprovacoes: [{ proposta_id: 'c', criado_em: '2026-04-30T10:00:00Z' }],
};

describe('indicadores do dashboard (decisão 90)', () => {
  it('primeiro envio e valor da última revisão enviada', () => {
    expect(enviosPorProposta(marcos.envios).get('a')).toEqual({ primeiro: '2026-03-12', valor: 1000 });
  });
  it('série por mês', () => {
    const s = seriePorMes(2026, props, marcos);
    expect(s[2]).toEqual({ criadas: 2, enviadas: 2, aprovadas: 0, valorEnviado: 1500, valorAprovado: 0 });
    expect(s[3]).toEqual({ criadas: 1, enviadas: 1, aprovadas: 1, valorEnviado: 800, valorAprovado: 950 });
    expect(s[4].criadas).toBe(1);
  });
  it('filtrar propostas filtra os marcos também', () => {
    const s = seriePorMes(2026, props.filter((p) => p.responsavel_id === 'p'), marcos);
    expect(s[2].enviadas).toBe(0);
    expect(s[3]).toEqual({ criadas: 1, enviadas: 1, aprovadas: 0, valorEnviado: 800, valorAprovado: 0 });
  });
  it('por vendedor, com "Sem vendedor" por último', () => {
    const v = porVendedor(props, marcos);
    expect(v.map((l) => l.nome)).toEqual(['Gabriel', 'Pedro', 'Sem vendedor']);
    expect(v[0]).toMatchObject({ feitas: 2, enviadas: 2, aprovadas: 1, reprovadas: 0, conversao: 100, valorEnviado: 1500, valorAprovado: 950, emNegociacao: 500 });
    expect(v[1]).toMatchObject({ feitas: 1, reprovadas: 1, conversao: 0 });
    expect(v[2]).toMatchObject({ feitas: 1, enviadas: 0, conversao: null });
  });
});
