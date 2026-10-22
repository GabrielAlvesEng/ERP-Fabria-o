import { describe, expect, it } from 'vitest';
import { cpfValido, formatarCPF, validarFicha, type DadosFicha } from './regras';

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
