import { describe, expect, it } from 'vitest';
import { assuntoProposta, corpoPadrao, emailValido, montarEml, separarEmails, separarImagens, textoDoHtml } from './email';

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
      para: ['cliente@empresa.com'], cc: ['outro@empresa.com'], assunto: 'Proposta 26-26-005 FABRIAÇO - Tanque', corpo: 'Olá',
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

describe('títulos com espaços sobrando', () => {
  it('ignora espaços nas pontas', () => {
    expect(assuntoProposta('26-02-001', 0, 'Teste ')).toBe('Proposta 26-02-001 FABRIAÇO - Teste');
    expect(corpoPadrao(' Moisés ', '26-02-001', 0, 'Teste ')).toContain('a proposta: 26-02-001 - Teste.');
  });
});

describe('assinatura importada do Outlook', () => {
  const html = '<style>p.MsoNormal{margin:0}</style><div class="assinatura-outlook"><p class="MsoNormal"><b>Gabriel Alves</b><br>Comercial</p><p>Fabriaço &amp; Cia</p><img width="120" src="data:image/png;base64,iVBORw0KGgo="></div>';
  it('troca as imagens embutidas por cid', () => {
    const r = separarImagens(html);
    expect(r.imagens).toEqual([{ cid: 'assinatura1@fabriaco', tipo: 'image/png', base64: 'iVBORw0KGgo=' }]);
    expect(r.html).toContain('src="cid:assinatura1@fabriaco"');
    expect(r.html).not.toContain('data:');
  });
  it('gera o texto puro', () => {
    expect(textoDoHtml(html)).toBe('Gabriel Alves\nComercial\nFabriaço & Cia');
  });
  it('vai no e-mail em HTML com a imagem inline', () => {
    const eml = montarEml({ para: ['a@b.com'], cc: [], assunto: 'X', corpo: 'Olá', assinaturaHtml: html, anexos: [] });
    expect(eml).toContain('multipart/related');
    expect(eml).toContain('Content-ID: <assinatura1@fabriaco>');
    const partes = eml.split('\r\n\r\n');
    const htmlB64 = eml.split('Content-Type: text/html; charset="utf-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n')[1].split('\r\n--')[0].replace(/\r\n/g, '');
    const decod = new TextDecoder().decode(Uint8Array.from(atob(htmlB64), (c) => c.charCodeAt(0)));
    expect(decod).toContain('Gabriel Alves');
    expect(decod).toContain('cid:assinatura1@fabriaco');
    expect(partes.length).toBeGreaterThan(3);
  });
  it('sem assinatura não cria parte de imagens', () => {
    expect(montarEml({ para: ['a@b.com'], cc: [], assunto: 'X', corpo: 'Olá', anexos: [] })).not.toContain('multipart/related');
  });
});
