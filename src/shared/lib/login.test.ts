import { describe, expect, it } from 'vitest';
import { USUARIO, emailDoLogin, loginVisivel, semEmail, sugerirUsuario } from './login';

describe('login por usuário', () => {
  it('usuário vira o endereço interno; e-mail fica como está', () => {
    expect(emailDoLogin(' Joao.Silva ')).toBe('joao.silva@sem-email.fabriacobrasil.com.br');
    expect(emailDoLogin('Gabriel@Fabriacobrasil.com.br')).toBe('gabriel@fabriacobrasil.com.br');
  });
  it('mostra só o usuário', () => {
    expect(loginVisivel('joao.silva@sem-email.fabriacobrasil.com.br')).toBe('joao.silva');
    expect(loginVisivel('gabriel@fabriacobrasil.com.br')).toBe('gabriel@fabriacobrasil.com.br');
    expect(semEmail('x@fabriacobrasil.com.br')).toBe(false);
  });
  it('sugestão e formato do usuário', () => {
    expect(sugerirUsuario('João da Silva')).toBe('joao.silva');
    expect(sugerirUsuario('Caio')).toBe('caio');
    expect(USUARIO.test('joao.silva')).toBe(true);
    expect(USUARIO.test('jo')).toBe(false);
    expect(USUARIO.test('joão')).toBe(false);
    expect(USUARIO.test('.joao')).toBe(false);
  });
});
