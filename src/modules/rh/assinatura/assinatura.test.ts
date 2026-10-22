import { describe, expect, it } from 'vitest';
import { dividirNome, faltaParaAssinatura, formatarTelefone, montarHtmlAssinatura } from './assinatura';

describe('assinatura gerada (decisão 89)', () => {
  it('formata o telefone no padrão +55 (DD) …', () => {
    expect(formatarTelefone('19989010359')).toBe('+55 (19) 98901-0359');
    expect(formatarTelefone('(19) 98901-0359')).toBe('+55 (19) 98901-0359');
    expect(formatarTelefone('+55 19 99599 0029')).toBe('+55 (19) 99599-0029');
    expect(formatarTelefone('1936561234')).toBe('+55 (19) 3656-1234');
    expect(formatarTelefone(' ramal 12 ')).toBe('ramal 12');
  });
  it('separa o primeiro nome do resto', () => {
    expect(dividirNome('  Gabriel   Alves Silva ')).toEqual(['Gabriel', 'Alves Silva']);
    expect(dividirNome('Pedro')).toEqual(['Pedro', '']);
  });
  it('lista o que falta', () => {
    expect(faltaParaAssinatura({ nome: 'A', cargo: '', email: 'a@b.c', telefone: '' })).toEqual(['função', 'telefone']);
  });
  it('monta o HTML igual ao modelo do Outlook, com a imagem e texto escapado', () => {
    const h = montarHtmlAssinatura({ nome: 'Guilherme Santos Silva', cargo: 'Projetista <Mecânico>', email: 'guilherme.santos@fabriacobrasil.com.br', telefone: '19995990029' }, 'data:image/jpeg;base64,AAA');
    expect(h).toContain('<b style="font-size: 11pt;">Guilherme Santos Silva</b>');
    expect(h).toContain('<i style="font-size: 11pt;">Projetista &lt;Mecânico&gt;</i>');
    expect(h).toContain('📞Phone: +55 (19) 99599-0029');
    expect(h).toContain('<a href="mailto:guilherme.santos@fabriacobrasil.com.br">');
    expect(h).toContain('<img src="data:image/jpeg;base64,AAA"');
    expect(h).not.toMatch(/<script/i);
  });
});
