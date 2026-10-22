import { describe, expect, it } from 'vitest';
import { cpfValido, diasAte, formatarCPF, situacaoDocumento, sugerirValidade, validarFicha, type DadosFicha } from './regras';

const ficha: DadosFicha = { nome: 'Caio Henrique Alves da Silva', cpf: '', nascimento: '', admissao: '', situacao: 'ativo', desligamento: '', email_pessoal: '', email_corporativo: '' };

describe('CPF', () => {
  it('aceita CPF válido, com ou sem pontuação', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('52998224725')).toBe(true);
  });
  it('recusa dígito errado, tamanho errado e números repetidos', () => {
    expect(cpfValido('529.982.247-24')).toBe(false);
    expect(cpfValido('5299822472')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
  });
  it('formata 11 dígitos', () => {
    expect(formatarCPF('52998224725')).toBe('529.982.247-25');
  });
});

describe('validarFicha', () => {
  it('aceita a ficha mínima (só o nome)', () => {
    expect(validarFicha(ficha, '2026-10-22')).toBe('');
  });
  it('exige nome, CPF válido e nascimento no passado', () => {
    expect(validarFicha({ ...ficha, nome: 'Ca' }, '2026-10-22')).toMatch(/nome/);
    expect(validarFicha({ ...ficha, cpf: '123' }, '2026-10-22')).toMatch(/CPF/);
    expect(validarFicha({ ...ficha, nascimento: '2027-01-01' }, '2026-10-22')).toMatch(/nascimento/);
  });
  it('desligado precisa da data, e ela não pode ser antes da admissão', () => {
    expect(validarFicha({ ...ficha, situacao: 'desligado' }, '2026-10-22')).toMatch(/desligamento/);
    expect(validarFicha({ ...ficha, situacao: 'desligado', admissao: '2026-05-01', desligamento: '2026-04-01' }, '2026-10-22')).toMatch(/antes da admissão/);
    expect(validarFicha({ ...ficha, situacao: 'desligado', admissao: '2026-05-01', desligamento: '2026-10-01' }, '2026-10-22')).toBe('');
  });
  it('confere o formato dos e-mails', () => {
    expect(validarFicha({ ...ficha, email_pessoal: 'caio@' }, '2026-10-22')).toMatch(/E-mail/);
  });
});

describe('vencimentos', () => {
  it('classifica pela validade e pelo aviso de 30 dias', () => {
    expect(situacaoDocumento(null, 30, '2026-10-22')).toBe('em_dia');
    expect(situacaoDocumento('2026-10-21', 30, '2026-10-22')).toBe('vencido');
    expect(situacaoDocumento('2026-10-22', 30, '2026-10-22')).toBe('vencendo');
    expect(situacaoDocumento('2026-11-21', 30, '2026-10-22')).toBe('vencendo');
    expect(situacaoDocumento('2026-11-22', 30, '2026-10-22')).toBe('em_dia');
  });
  it('sugere a validade pela emissão e pelos meses do tipo', () => {
    expect(sugerirValidade('2026-10-22', 12)).toBe('2027-10-22');
    expect(sugerirValidade('2026-01-31', 1)).toBe('2026-02-28');
    expect(sugerirValidade('2026-10-22', null)).toBe('');
  });
  it('conta os dias até a data', () => {
    expect(diasAte('2026-11-01', '2026-10-22')).toBe(10);
    expect(diasAte('2026-10-20', '2026-10-22')).toBe(-2);
  });
});
