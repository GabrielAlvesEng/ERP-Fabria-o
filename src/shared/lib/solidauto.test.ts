import { describe, expect, it } from 'vitest';
import { lerPedidoSolidAuto, retornoSolidAuto } from './solidauto';

describe('Entrar com o ERP (SolidAuto)', () => {
  const estado = 'Ab3_dEf-1234567890xyz';
  it('lê a porta e o estado do endereço', () => {
    expect(lerPedidoSolidAuto(`?solidauto=51234&estado=${estado}`, null)).toEqual({ porta: 51234, estado });
  });
  it('recusa porta ou estado inválidos', () => {
    expect(lerPedidoSolidAuto(`?solidauto=80&estado=${estado}`, null)).toBeNull();
    expect(lerPedidoSolidAuto('?solidauto=51234&estado=<script>', null)).toBeNull();
    expect(lerPedidoSolidAuto('', null)).toBeNull();
  });
  it('usa o pedido guardado depois do login', () => {
    expect(lerPedidoSolidAuto('', JSON.stringify({ porta: 50000, estado }))).toEqual({ porta: 50000, estado });
    expect(lerPedidoSolidAuto('', '{quebrado')).toBeNull();
  });
  it('volta só para o próprio computador', () => {
    expect(retornoSolidAuto({ porta: 50000, estado }, 'abc/+=')).toBe(`http://127.0.0.1:50000/erp?estado=${estado}&token_hash=abc%2F%2B%3D`);
  });
});
