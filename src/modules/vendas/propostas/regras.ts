import { dataBR } from '@/shared/lib/formato';
import type { StatusProposta } from '../types';

// Espelho da tabela de transições de mover_proposta (no banco). Serve só para a
// interface decidir o que abrir; quem valida de verdade é o banco.
export type TipoTransicao =
  | 'enviar'
  | 'simples'
  | 'aprovar'
  | 'reprovar'
  | 'reabrir'
  | 'financeiro'
  | 'voltar_admin'
  | 'proibida';

export function tipoTransicao(de: StatusProposta, para: StatusProposta): TipoTransicao {
  if (de === para) return 'proibida';
  if (de === 'À enviar') return para === 'Enviados' ? 'enviar' : 'proibida';
  if (de === 'Enviados' || de === 'Follow-up') {
    // Sem coluna Follow-up (decisão 39): só propostas antigas em Follow-up voltam para Enviados.
    if (para === 'Follow-up') return 'proibida';
    if (para === 'Enviados') return de === 'Follow-up' ? 'simples' : 'proibida';
    if (para === 'Aprovado') return 'aprovar';
    if (para === 'Reprovado') return 'reprovar';
    if (para === 'À enviar') return 'reabrir';
    return 'proibida';
  }
  if (de === 'Reprovado') return para === 'À enviar' ? 'reabrir' : 'proibida';
  if ((de === 'Aprovado' && para === 'Finalizado') || (de === 'Finalizado' && para === 'Emitido NF') || (de === 'Emitido NF' && para === 'Pago')) {
    return 'financeiro';
  }
  if (['Aprovado', 'Finalizado', 'Emitido NF', 'Pago'].includes(de) && ['Aprovado', 'Finalizado', 'Emitido NF', 'Enviados'].includes(para)) {
    return 'voltar_admin';
  }
  return 'proibida';
}

export function rotuloRevisao(n: number): string {
  return `R${n}`;
}

export function followupVencido(data: string | null, hoje: string): boolean {
  return Boolean(data && data <= hoje);
}

// "até dd/mm/aaaa", calculado como no banco (emissão + dias).
export function validadeAte(emissao: string | null | undefined, dias: number | null | undefined): string {
  if (!emissao || !dias) return '';
  const d = new Date(`${emissao.slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + Number(dias));
  return `até ${dataBR(d.toISOString().slice(0, 10))}`;
}
