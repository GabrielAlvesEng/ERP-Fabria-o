import { describe, expect, it } from 'vitest';
import { followupVencido, tipoTransicao } from './regras';

describe('transições do Kanban', () => {
  it('À enviar só vai para Enviados', () => {
    expect(tipoTransicao('À enviar', 'Enviados')).toBe('enviar');
    expect(tipoTransicao('À enviar', 'Aprovado')).toBe('proibida');
  });
  it('aprovação e reprovação pedem formulário', () => {
    expect(tipoTransicao('Enviados', 'Aprovado')).toBe('aprovar');
    expect(tipoTransicao('Follow-up', 'Reprovado')).toBe('reprovar');
  });
  it('voltar para À enviar cria revisão', () => {
    expect(tipoTransicao('Enviados', 'À enviar')).toBe('reabrir');
    expect(tipoTransicao('Reprovado', 'À enviar')).toBe('reabrir');
  });
  it('etapas finais são do Financeiro e em ordem', () => {
    expect(tipoTransicao('Aprovado', 'Finalizado')).toBe('financeiro');
    expect(tipoTransicao('Emitido NF', 'Pago')).toBe('financeiro');
    expect(tipoTransicao('Aprovado', 'Pago')).toBe('proibida');
  });
  it('voltar depois de aprovado é só da Administração', () => {
    expect(tipoTransicao('Finalizado', 'Aprovado')).toBe('voltar_admin');
  });
});

describe('follow-up', () => {
  it('vence no dia e depois', () => {
    expect(followupVencido('2026-10-19', '2026-10-19')).toBe(true);
    expect(followupVencido('2026-10-20', '2026-10-19')).toBe(false);
    expect(followupVencido(null, '2026-10-19')).toBe(false);
  });
});
