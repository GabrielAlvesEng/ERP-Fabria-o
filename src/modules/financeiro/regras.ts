// Regras do Financeiro, entrega 1: contas a pagar (docs/PLANEJAMENTO_FINANCEIRO.md, decisão 105).
// A situação pela data é calculada aqui; no banco ficam só aberta, paga e cancelada.

export type StatusConta = 'aberta' | 'paga' | 'cancelada';
export type CondicaoTipo = 'antecipado' | 'apos_recebimento' | 'parcelado' | 'a_combinar';
export type FormaPagamento = 'pix' | 'boleto' | 'transferencia' | 'cartao' | 'dinheiro' | 'outro';
export type TipoAnexo = 'orcamento' | 'boleto' | 'nf' | 'outro';

// Colunas do quadro, na ordem.
export type Coluna = 'aguardando_entrega' | 'definir' | 'a_pagar' | 'em_breve' | 'vencida' | 'paga';
export type Prazo = 'vencida' | 'hoje' | 'em_breve' | 'a_pagar' | 'sem_data' | 'paga';

export const DIAS_AVISO = 7; // "vence em breve" (resposta 2 do planejamento)

export const COLUNAS: { id: Coluna; rotulo: string }[] = [
  { id: 'aguardando_entrega', rotulo: 'Aguardando entrega' },
  { id: 'definir', rotulo: 'Definir vencimento' },
  { id: 'a_pagar', rotulo: 'A pagar' },
  { id: 'em_breve', rotulo: 'Vence em breve' },
  { id: 'vencida', rotulo: 'Vencida' },
  { id: 'paga', rotulo: 'Paga' },
];

export const ROTULO_CONDICAO: Record<CondicaoTipo, string> = {
  antecipado: 'Antecipado', apos_recebimento: 'Após o recebimento', parcelado: 'Parcelado', a_combinar: 'A combinar',
};
export const ROTULO_FORMA: Record<FormaPagamento, string> = {
  pix: 'PIX', boleto: 'Boleto', transferencia: 'Transferência', cartao: 'Cartão', dinheiro: 'Dinheiro', outro: 'Outro',
};
export const ROTULO_ANEXO: Record<TipoAnexo, string> = { orcamento: 'Orçamento', boleto: 'Boleto', nf: 'Nota fiscal', outro: 'Outro' };
export const ROTULO_PRAZO: Record<Prazo, string> = {
  vencida: 'Vencida', hoje: 'Vence hoje', em_breve: 'Vence em breve', a_pagar: 'A pagar', sem_data: 'Sem data', paga: 'Paga',
};
// Vermelho vencida, laranja hoje, amarelo em até 7 dias, verde paga.
export const COR_PRAZO: Record<Prazo, 'vermelho' | 'amarelo' | 'verde' | 'azul' | 'cinza'> = {
  vencida: 'vermelho', hoje: 'amarelo', em_breve: 'amarelo', a_pagar: 'azul', sem_data: 'cinza', paga: 'verde',
};

export interface ParcelaBase { id: string; numero: number; vencimento: string | null; valor: number; pago: number; pago_em: string | null; ativa: boolean }
export interface ContaBase { status: StatusConta; condicao_tipo: CondicaoTipo; entregue_em: string | null }

export function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);
}

export const parcelasAtivas = <P extends ParcelaBase>(ps: P[]) => ps.filter((p) => p.ativa).sort((a, b) => a.numero - b.numero);
export const emAberto = <P extends ParcelaBase>(ps: P[]) => parcelasAtivas(ps).filter((p) => !p.pago_em && Number(p.valor) > 0);
export const saldo = (p: ParcelaBase) => Math.round((Number(p.valor) - Number(p.pago)) * 100) / 100;

export function prazoParcela(p: ParcelaBase, hoje: string): Prazo {
  if (p.pago_em || Number(p.valor) <= 0) return 'paga';
  if (!p.vencimento) return 'sem_data';
  if (p.vencimento < hoje) return 'vencida';
  if (p.vencimento === hoje) return 'hoje';
  return diasEntre(hoje, p.vencimento) <= DIAS_AVISO ? 'em_breve' : 'a_pagar';
}

// A próxima parcela a pagar: a de vencimento mais antigo; sem data vai para o fim.
export function proximaParcela<P extends ParcelaBase>(ps: P[]): P | undefined {
  return [...emAberto(ps)].sort((a, b) => (a.vencimento ?? '9999').localeCompare(b.vencimento ?? '9999') || a.numero - b.numero)[0];
}

export function prazoConta(c: ContaBase, ps: ParcelaBase[], hoje: string): Prazo {
  if (c.status === 'paga') return 'paga';
  const p = proximaParcela(ps);
  return p ? prazoParcela(p, hoje) : 'paga';
}

export function colunaConta(c: ContaBase, ps: ParcelaBase[], hoje: string): Coluna | null {
  if (c.status === 'cancelada') return null;
  const prazo = prazoConta(c, ps, hoje);
  if (prazo === 'paga') return 'paga';
  if (prazo === 'sem_data') return c.condicao_tipo === 'apos_recebimento' && !c.entregue_em ? 'aguardando_entrega' : 'definir';
  if (prazo === 'vencida') return 'vencida';
  if (prazo === 'hoje' || prazo === 'em_breve') return 'em_breve';
  return 'a_pagar';
}

// Divide o valor em n parcelas iguais; o centavo que sobra vai na última (igual ao banco).
export function dividir(total: number, n: number): number[] {
  const parte = Math.floor((total / n) * 100) / 100;
  const out = Array.from({ length: n }, () => parte);
  out[n - 1] = Math.round((total - parte * (n - 1)) * 100) / 100;
  return out;
}

// "R$ 1.234,56" / "1234,56" / "1234.56" → número.
export function lerValor(s: string): number {
  const t = s.replace(/R\$/i, '').trim();
  if (!t) return NaN;
  return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
}

export const textoCondicao = (tipo: CondicaoTipo, dias: number[]) =>
  tipo === 'antecipado' || tipo === 'a_combinar' || dias.length === 0 ? ROTULO_CONDICAO[tipo]
    : `${ROTULO_CONDICAO[tipo]} · ${dias.join('/')} dias${tipo === 'parcelado' ? ' da emissão' : ' da entrega'}`;

// Painel: o que vence em cada uma das próximas n semanas (a semana 1 começa hoje; o que já venceu entra na semana 1).
export function aVencerPorSemana(ps: ParcelaBase[], hoje: string, n = 8): number[] {
  const out = Array.from({ length: n }, () => 0);
  for (const p of emAberto(ps)) {
    if (!p.vencimento) continue;
    const s = Math.max(0, Math.floor(diasEntre(hoje, p.vencimento) / 7));
    if (s < n) out[s] = Math.round((out[s] + saldo(p)) * 100) / 100;
  }
  return out;
}
