import { describe, expect, it } from 'vitest';
import { chaveParaBytes, nomeAparelho, ordenarCaixa, pendente, resumoLeitura, rotuloAlcance, situacaoAparelho } from './regras';

const c = (id: string, o: Partial<Parameters<typeof ordenarCaixa>[0][number]> = {}) => ({
  id, criado_em: '2026-10-20T10:00:00Z', fixado_ate: null, lido_em: null, ciente_em: null, exige_ciente: false, urgente: false, ...o,
});

describe('caixa de entrada', () => {
  it('fixados primeiro, depois pendentes urgentes, pendentes e lidos; mais novos antes', () => {
    const lista = [
      c('lido', { lido_em: 'x', criado_em: '2026-10-22T10:00:00Z' }),
      c('normal', { criado_em: '2026-10-21T10:00:00Z' }),
      c('urgente', { urgente: true }),
      c('fixado', { fixado_ate: '2026-10-30', lido_em: 'x' }),
      c('fixado-vencido', { fixado_ate: '2026-10-01', lido_em: 'x', criado_em: '2026-10-01T10:00:00Z' }),
      c('normal-novo', { criado_em: '2026-10-22T11:00:00Z' }),
    ];
    expect(ordenarCaixa(lista, '2026-10-22').map((x) => x.id)).toEqual(['fixado', 'urgente', 'normal-novo', 'normal', 'lido', 'fixado-vencido']);
  });
  it('lido sem ciente continua pendente quando o ciente é exigido', () => {
    expect(pendente({ lido_em: 'x', ciente_em: null, exige_ciente: true })).toBe(true);
    expect(pendente({ lido_em: 'x', ciente_em: null, exige_ciente: false })).toBe(false);
    expect(pendente({ lido_em: 'x', ciente_em: 'y', exige_ciente: true })).toBe(false);
  });
});

describe('enviados', () => {
  it('resumo de leitura', () => {
    expect(resumoLeitura([{ lido_em: 'x', ciente_em: 'x', push_enviado_em: 'x' }, { lido_em: 'x', ciente_em: null }, { lido_em: null, ciente_em: null }]))
      .toEqual({ total: 3, lidos: 2, cientes: 1, celular: 1 });
  });
  it('rótulo de para quem', () => {
    expect(rotuloAlcance('empresa', [], 0)).toBe('Toda a empresa');
    expect(rotuloAlcance('setores', ['Engenharia'], 0)).toBe('Setor Engenharia');
    expect(rotuloAlcance('setores', ['Engenharia', 'Fabricação'], 0)).toBe('Setores Engenharia, Fabricação');
    expect(rotuloAlcance('pessoas', [], 1)).toBe('1 pessoa');
  });
});

describe('aparelho', () => {
  it('nome do aparelho', () => {
    expect(nomeAparelho('Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36')).toBe('Android · Chrome');
    expect(nomeAparelho('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1')).toBe('iPhone · Safari');
    expect(nomeAparelho('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0')).toBe('Windows · Edge');
    expect(nomeAparelho('Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36')).toBe('Android · Samsung Internet');
  });
  it('situação para receber', () => {
    const base = { suporta: true, ios: false, instalado: false, permissao: 'default' as const, inscrito: false };
    expect(situacaoAparelho({ ...base, ios: true, suporta: false })).toBe('iphone-instalar');
    expect(situacaoAparelho({ ...base, ios: true, instalado: true })).toBe('desligado');
    expect(situacaoAparelho({ ...base, suporta: false })).toBe('sem-suporte');
    expect(situacaoAparelho({ ...base, permissao: 'denied' })).toBe('bloqueado');
    expect(situacaoAparelho({ ...base, permissao: 'granted', inscrito: true })).toBe('ativo');
  });
  it('chave VAPID em bytes', () => {
    const b = chaveParaBytes('BC334fgA1d2gSSOJUVhMngfzINPgBCSzpJgXXa9rLJa92woLIzs3M9dRmqM1Lfznq5LryYXfDQpNLqsoo0FnuWA');
    expect(b.length).toBe(65);
    expect(b[0]).toBe(4);
  });
});
