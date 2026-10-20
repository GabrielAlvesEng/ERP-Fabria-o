import { describe, expect, it } from 'vitest';
import { assuntoProposta, corpoPadrao, emailValido, montarEml, separarEmails } from './email';

describe('e-mail de envio', () => {
  it('assunto no padrão aprovado', () => {
    expect(assuntoProposta('26-26-005', 0, 'Tanques Diversos Inox')).toBe('Proposta 26-26-005 FABRIAÇO - Tanques Diversos Inox');
    expect(assuntoProposta('26-26-005', 1, 'Tanques Diversos Inox')).toBe('Proposta 26-26-005-R1 FABRIAÇO - Tanques Diversos Inox');
  });
  it('texto padrão com contato e proposta', () => {
    const c = corpoPadrao('Kenny Nunes', '26-26-003', 0, 'Plataforma Superior Lavadoras');
    expect(c.startsWith('Prezado Kenny Nunes\n')).toBe(true);
    expect(c).toContain('a proposta: 26-26-003 - Plataforma Superior Lavadoras.');
    expect(c.endsWith('Atenciosamente,')).toBe(true);
  });
  it('separa e valida e-mails', () => {
    expect(separarEmails('a@x.com; b@y.com.br,c@z.com')).toEqual(['a@x.com', 'b@y.com.br', 'c@z.com']);
    expect(emailValido('fulano@empresa.com.br')).toBe(true);
    expect(emailValido('fulano@empresa')).toBe(false);
  });
  it('monta .eml com CC, assunto acentuado e anexos', () => {
    const eml = montarEml({
      para: ['cliente@empresa.com'], cc: ['outro@empresa.com'], assunto: 'Proposta 26-26-005 FABRIAÇO - Tanque', corpo: 'Olá', assinatura: 'Gabriel',
      anexos: [{ nome: 'Proposta Técnica.pdf', tipo: 'application/pdf', base64: 'JVBERi0x' }],
    });
    expect(eml).toContain('To: cliente@empresa.com');
    expect(eml).toContain('Cc: outro@empresa.com');
    expect(eml).toContain('X-Unsent: 1');
    expect(eml).toMatch(/Subject: =\?UTF-8\?B\?/);
    expect(eml).toContain('filename="Proposta Tecnica.pdf"');
    expect(eml).toContain("filename*=UTF-8''Proposta%20T%C3%A9cnica.pdf");
  });
});
