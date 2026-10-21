import { AGUARDANDO_RETORNO, type Proposta, type StatusProposta } from '@/modules/vendas/types';
import { followupVencido } from '@/modules/vendas/propostas/regras';

// Números de cada vendedor no ano comercial (decisão 62), com as mesmas regras do Dashboard Comercial.
const APROVADAS: StatusProposta[] = ['Aprovado', 'Finalizado', 'Emitido NF', 'Pago'];

export interface ResumoVendedor { propostas: number; negociacao: number; aprovadas: number; valorAprovado: number; conversao: number | null; vencidos: number }

export function resumoVendedor(propostas: Pick<Proposta, 'status' | 'valor' | 'proximo_followup'>[], hoje: string): ResumoVendedor {
  const aprov = propostas.filter((p) => APROVADAS.includes(p.status));
  const reprov = propostas.filter((p) => p.status === 'Reprovado').length;
  const soma = (l: { valor: number }[]) => l.reduce((a, p) => a + Number(p.valor || 0), 0);
  return {
    propostas: propostas.length,
    negociacao: soma(propostas.filter((p) => AGUARDANDO_RETORNO.includes(p.status))),
    aprovadas: aprov.length,
    valorAprovado: soma(aprov),
    conversao: aprov.length + reprov ? Math.round((aprov.length / (aprov.length + reprov)) * 100) : null,
    vencidos: propostas.filter((p) => AGUARDANDO_RETORNO.includes(p.status) && followupVencido(p.proximo_followup, hoje)).length,
  };
}
