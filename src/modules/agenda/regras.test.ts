import { describe, expect, it } from 'vitest';
import { colunas, descreverRepeticao, expandir, isoDia, lembretesDevidos, ocorrencias, semanasDoMes, type CompromissoBase } from './regras';

const c = (id: string, inicio: Date, minutos: number, d: Partial<CompromissoBase> = {}): CompromissoBase & { local: string | null } => ({
  id, titulo: id, inicio: inicio.toISOString(), fim: new Date(inicio.getTime() + minutos * 60_000).toISOString(), dia_inteiro: false,
  repeticao: null, repetir_intervalo: 1, repetir_dias: null, repetir_ate: null, excecoes: [], local: null, ...d,
});
const dias = (lista: { dia: string }[]) => lista.map((o) => o.dia);
const out = new Date(2026, 9, 1);
const nov = new Date(2026, 10, 1);

describe('agenda: repetição', () => {
  it('compromisso avulso só aparece no intervalo', () => {
    expect(dias(expandir(c('a', new Date(2026, 9, 28, 9), 60), out, nov))).toEqual(['2026-10-28']);
    expect(expandir(c('a', new Date(2026, 10, 3, 9), 60), out, nov)).toEqual([]);
  });

  it('toda semana na segunda e quarta, com exceção e "até"', () => {
    const s = c('s', new Date(2026, 9, 5, 8), 30, { repeticao: 'semanal', repetir_dias: [1, 3], excecoes: ['2026-10-14'], repetir_ate: '2026-10-26' });
    expect(dias(expandir(s, out, nov))).toEqual(['2026-10-05', '2026-10-07', '2026-10-12', '2026-10-19', '2026-10-21', '2026-10-26']);
  });

  it('a cada 2 semanas', () => {
    const s = c('s', new Date(2026, 9, 6, 8), 30, { repeticao: 'semanal', repetir_intervalo: 2, repetir_dias: [2] });
    expect(dias(expandir(s, out, nov))).toEqual(['2026-10-06', '2026-10-20']);
  });

  it('diário de muito tempo atrás pula direto para o mês pedido', () => {
    const s = c('d', new Date(2020, 0, 1, 7), 15, { repeticao: 'diaria', repetir_intervalo: 3 });
    const r = expandir(s, out, nov);
    expect(r.length).toBeGreaterThanOrEqual(10);
    expect(r[0]!.inicio.getHours()).toBe(7);
    expect(r.every((o) => o.inicio >= out && o.inicio < nov)).toBe(true);
  });

  it('mensal no dia 31 pula os meses sem dia 31; anual', () => {
    const m = c('m', new Date(2026, 0, 31, 10), 60, { repeticao: 'mensal' });
    expect(dias(expandir(m, new Date(2026, 0, 1), new Date(2026, 6, 1)))).toEqual(['2026-01-31', '2026-03-31', '2026-05-31']);
    const a = c('a', new Date(2024, 9, 15, 10), 60, { repeticao: 'anual' });
    expect(dias(expandir(a, out, nov))).toEqual(['2026-10-15']);
  });

  it('descreve a repetição', () => {
    expect(descreverRepeticao(c('s', new Date(2026, 9, 5, 8), 30, { repeticao: 'semanal', repetir_dias: [3, 1] }))).toBe('Toda semana: segunda e quarta');
    expect(descreverRepeticao(c('m', new Date(2026, 9, 5, 8), 30, { repeticao: 'mensal', repetir_ate: '2026-12-31' }))).toBe('Todo mês, no dia 5, até 31/12/2026');
  });
});

describe('agenda: tela', () => {
  it('mês começa no domingo e tem 6 semanas', () => {
    const s = semanasDoMes(2026, 9);
    expect(s).toHaveLength(6);
    expect(isoDia(s[0]![0]!)).toBe('2026-09-27');
    expect(s[0]![4]!.getDate()).toBe(1);
  });

  it('compromissos sobrepostos ficam lado a lado', () => {
    const dia = new Date(2026, 9, 28);
    const ocs = ocorrencias([c('a', new Date(2026, 9, 28, 9), 60), c('b', new Date(2026, 9, 28, 9, 30), 60), c('x', new Date(2026, 9, 28, 14), 30)], dia, new Date(2026, 9, 29));
    const r = Object.fromEntries(colunas(ocs).map((g) => [g.o.c.id, [g.coluna, g.total]]));
    expect(r).toEqual({ a: [0, 2], b: [1, 2], x: [0, 1] });
  });
});

describe('agenda: lembretes', () => {
  const ocs = ocorrencias([
    c('Reunião', new Date(2026, 9, 27, 14), 60, { local: 'Fábrica' } as Partial<CompromissoBase>),
    c('Visita', new Date(2026, 9, 27, 16), 60),
    c('Cedo', new Date(2026, 9, 28, 8), 60),
    c('Feriado', new Date(2026, 9, 28), 24 * 60, { dia_inteiro: true }),
  ], new Date(2026, 9, 27), new Date(2026, 9, 29));

  it('de hora em hora mostra o próximo do dia, uma vez por hora', () => {
    const r = lembretesDevidos(ocs, new Date(2026, 9, 27, 10, 0), new Set());
    expect(r.map((l) => l.chave)).toEqual(['hora:2026-10-27T10']);
    expect(r[0]!.titulo).toBe('Próximo: 14:00 Reunião');
    expect(r[0]!.texto).toBe('Em 4h, Fábrica · depois dele, mais 1 hoje');
    expect(lembretesDevidos(ocs, new Date(2026, 9, 27, 10, 40), new Set(['hora:2026-10-27T10']))).toEqual([]);
    expect(lembretesDevidos(ocs, new Date(2026, 9, 27, 6, 0), new Set())).toEqual([]);
  });

  it('faltando 15 minutos', () => {
    const r = lembretesDevidos(ocs, new Date(2026, 9, 27, 13, 47), new Set());
    expect(r.map((l) => l.tipo)).toEqual(['quinze']);
    expect(r[0]!.titulo).toBe('Em 13 min: Reunião');
  });

  it('véspera às 16:30 com o primeiro de amanhã (o de horário, não o de dia inteiro)', () => {
    expect(lembretesDevidos(ocs, new Date(2026, 9, 27, 16, 29), new Set(['hora:2026-10-27T16'])).filter((l) => l.tipo === 'vespera')).toEqual([]);
    const r = lembretesDevidos(ocs, new Date(2026, 9, 27, 16, 30), new Set(['hora:2026-10-27T16'])).filter((l) => l.tipo === 'vespera');
    expect(r[0]!.chave).toBe('vespera:2026-10-28');
    expect(r[0]!.titulo).toBe('Amanhã, o primeiro é 08:00 Cedo');
    expect(r[0]!.texto).toBe('2 compromissos amanhã');
  });
});
