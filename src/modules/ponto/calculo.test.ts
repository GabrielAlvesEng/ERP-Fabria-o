import { describe, expect, it } from 'vitest';
import { calcularDia, CONFIG_PADRAO, coordenadasDoTexto, distanciaM, hhmm, resumirMes } from './calculo';

// Batida em horário de Brasília (UTC−3).
const em = (dia: string, h: string) => ({ momento: new Date(`${dia}T${h}:00-03:00`).toISOString() });
const dia = (d: string, horas: string[], extra: Partial<Parameters<typeof calcularDia>[0]> = {}) =>
  calcularDia({ dia: d, hoje: '2026-10-31', config: CONFIG_PADRAO, batidas: horas.map((h) => em(d, h)), justificativas: [], ...extra });

describe('ponto: dia', () => {
  it('jornada exata é normal, 8h48', () => {
    const r = dia('2026-10-26', ['07:00', '11:30', '13:00', '17:18']);
    expect(r.situacao).toBe('normal');
    expect(r.previsto).toBe(528);
    expect(r.trabalhado).toBe(528);
    expect(r.saldoOficial).toBe(0);
    expect(r.pendente).toBe(false);
  });

  it('até 5 min antes/depois e até 10 min de atraso no dia ficam na tolerância', () => {
    const r = dia('2026-10-26', ['06:55', '11:26', '13:04', '17:20']); // 4 + 4 = 8 min de atraso
    expect(r.situacao).toBe('normal');
    expect(r.saldo).toBe(0);
  });

  it('atraso acima de 10 min no dia conta inteiro e precisa do RH', () => {
    const r = dia('2026-10-26', ['07:12', '11:30', '13:00', '17:18']);
    expect(r.situacao).toBe('divergente');
    expect(r.deficit).toBe(12);
    expect(r.saldo).toBe(-12);
    expect(r.pendente).toBe(true);
    expect(r.saldoOficial).toBe(0);
    expect(r.alertas).toContain('Chegou 0h12 atrasado');
  });

  it('hora extra só entra no oficial depois de aprovada; abonada conta zero', () => {
    const horas = ['07:00', '11:30', '13:00', '18:00'];
    expect(dia('2026-10-26', horas).saldo).toBe(42);
    expect(dia('2026-10-26', horas).saldoOficial).toBe(0);
    expect(dia('2026-10-26', horas, { decisao: { decisao: 'aprovado', observacao: '' } }).saldoOficial).toBe(42);
    expect(dia('2026-10-26', horas, { decisao: { decisao: 'abonado', observacao: 'x' } }).saldoOficial).toBe(0);
  });

  it('dia útil sem batida é falta', () => {
    const r = dia('2026-10-26', []);
    expect(r.situacao).toBe('falta');
    expect(r.deficit).toBe(528);
    expect(dia('2026-10-26', [], { decisao: { decisao: 'aprovado', observacao: '' } }).saldoOficial).toBe(-528);
  });

  it('sábado, feriado e justificativa', () => {
    expect(dia('2026-10-24', []).situacao).toBe('sem_expediente');
    const sab = dia('2026-10-24', ['08:00', '12:00']);
    expect(sab.situacao).toBe('divergente');
    expect(sab.extra).toBe(240);
    expect(dia('2026-10-12', [], { feriado: 'Nossa Senhora Aparecida' }).situacao).toBe('feriado');
    const atestado = dia('2026-10-26', [], { justificativas: [{ inicio: '2026-10-26', fim: '2026-10-27', periodo: 'dia', tipo: 'Atestado médico' }] });
    expect(atestado.situacao).toBe('justificado');
    const meio = dia('2026-10-26', ['13:00', '17:18'], { justificativas: [{ inicio: '2026-10-26', fim: '2026-10-26', periodo: 'manha', tipo: 'Atestado médico' }] });
    expect(meio.situacao).toBe('normal');
    expect(meio.previsto).toBe(258);
  });

  it('batida faltando e dia de hoje em andamento', () => {
    expect(dia('2026-10-26', ['07:00', '11:30', '13:00']).situacao).toBe('incompleto');
    expect(calcularDia({ dia: '2026-10-31', hoje: '2026-10-31', config: { ...CONFIG_PADRAO, dias_semana: [6] }, batidas: [em('2026-10-31', '07:00')], justificativas: [] }).situacao).toBe('em_andamento');
    expect(dia('2026-11-02', []).situacao).toBe('futuro');
  });

  it('antes da admissão ou do início do ponto não conta', () => {
    expect(dia('2026-10-26', [], { admissao: '2026-10-27' }).situacao).toBe('fora');
    expect(dia('2026-10-26', [], { config: { ...CONFIG_PADRAO, inicio: '2026-10-27' } }).situacao).toBe('fora');
  });
});

describe('ponto: mês', () => {
  it('soma só o que o RH decidiu', () => {
    const r = resumirMes([
      dia('2026-10-26', ['07:00', '11:30', '13:00', '18:00'], { decisao: { decisao: 'aprovado', observacao: '' } }),
      dia('2026-10-27', ['07:30', '11:30', '13:00', '17:18']),
      dia('2026-10-28', []),
    ]);
    expect(r.saldoOficial).toBe(42);
    expect(r.pendentes).toBe(2);
    expect(r.faltas).toBe(1);
    expect(hhmm(-528)).toBe('-8h48');
  });
});

describe('ponto: localização', () => {
  it('lê o link do Google Maps do Gabriel', () => {
    const link = 'https://www.google.com/maps/place/FABRIA%C3%87O/@-21.4687286,-47.0212299,19.75z/data=!4m6!3m5!1s0x94b7b95fa28a17a5:0x5bb85cb492da813e!8m2!3d-21.4687341!4d-47.0208632!16s';
    expect(coordenadasDoTexto(link)).toEqual({ latitude: -21.4687341, longitude: -47.0208632 });
    expect(coordenadasDoTexto('-21.4687, -47.0208')).toEqual({ latitude: -21.4687, longitude: -47.0208 });
    expect(coordenadasDoTexto('Mococa')).toBeNull();
  });
  it('distância', () => {
    expect(Math.round(distanciaM(-21.4687341, -47.0208632, -21.4687286, -47.0212299))).toBe(38);
  });
});
