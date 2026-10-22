// Indicadores do Dashboard Comercial (decisão 90): série por mês e desempenho por vendedor.
// Funções puras: recebem as propostas do ano e os marcos (envios, aprovações e reprovações).

export interface MarcoEnvio { proposta_id: string; numero: number; enviada_em: string; valor: number | null }
export interface MarcoAprovacao { proposta_id: string; data_aprovacao: string; valor_aprovado: number }
export interface MarcoReprovacao { proposta_id: string; criado_em: string }
export interface Marcos { envios: MarcoEnvio[]; aprovacoes: MarcoAprovacao[]; reprovacoes: MarcoReprovacao[] }

export interface PropostaIndicador { id: string; data_emissao: string; valor: number; status: string; responsavel_id: string | null; vendedor: string }

export const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const APROVADAS = ['Aprovado', 'Finalizado', 'Emitido NF', 'Pago'];
const EM_NEGOCIACAO = ['Enviados', 'Follow-up'];

const mesDe = (iso: string | null | undefined, ano: number) => (iso && Number(iso.slice(0, 4)) === ano ? Number(iso.slice(5, 7)) - 1 : -1);

// Primeiro envio de cada proposta (mês em que saiu) e o valor do último envio (a cotação que vale para o cliente).
export function enviosPorProposta(envios: MarcoEnvio[]): Map<string, { primeiro: string; valor: number }> {
  const m = new Map<string, { primeiro: string; valor: number; ultimo: number }>();
  for (const e of envios) {
    const a = m.get(e.proposta_id);
    if (!a) m.set(e.proposta_id, { primeiro: e.enviada_em, valor: Number(e.valor ?? 0), ultimo: e.numero });
    else {
      if (e.enviada_em < a.primeiro) a.primeiro = e.enviada_em;
      if (e.numero > a.ultimo) { a.ultimo = e.numero; a.valor = Number(e.valor ?? 0); }
    }
  }
  return new Map([...m].map(([k, v]) => [k, { primeiro: v.primeiro, valor: v.valor }]));
}

export interface Mes { criadas: number; enviadas: number; aprovadas: number; valorEnviado: number; valorAprovado: number }

// Doze meses do ano: propostas criadas (data de emissão), enviadas (1º envio) e aprovadas (data da aprovação).
export function seriePorMes(ano: number, propostas: PropostaIndicador[], marcos: Marcos): Mes[] {
  const meses: Mes[] = MESES.map(() => ({ criadas: 0, enviadas: 0, aprovadas: 0, valorEnviado: 0, valorAprovado: 0 }));
  const ids = new Set(propostas.map((p) => p.id));
  for (const p of propostas) { const i = mesDe(p.data_emissao, ano); if (i >= 0) meses[i].criadas++; }
  for (const [id, e] of enviosPorProposta(marcos.envios)) {
    const i = mesDe(e.primeiro, ano);
    if (i >= 0 && ids.has(id)) { meses[i].enviadas++; meses[i].valorEnviado += e.valor; }
  }
  for (const a of marcos.aprovacoes) {
    const i = mesDe(a.data_aprovacao, ano);
    if (i >= 0 && ids.has(a.proposta_id)) { meses[i].aprovadas++; meses[i].valorAprovado += Number(a.valor_aprovado); }
  }
  return meses;
}

export interface LinhaVendedor {
  id: string; nome: string; feitas: number; enviadas: number; aprovadas: number; reprovadas: number;
  conversao: number | null; valorEnviado: number; valorAprovado: number; emNegociacao: number;
}

export const SEM_VENDEDOR = 'sem';

export function porVendedor(propostas: PropostaIndicador[], marcos: Marcos): LinhaVendedor[] {
  const envios = enviosPorProposta(marcos.envios);
  const aprovado = new Map<string, number>();
  for (const a of marcos.aprovacoes) aprovado.set(a.proposta_id, Number(a.valor_aprovado));
  const linhas = new Map<string, LinhaVendedor>();
  for (const p of propostas) {
    const id = p.responsavel_id ?? SEM_VENDEDOR;
    let l = linhas.get(id);
    if (!l) {
      l = { id, nome: p.responsavel_id ? p.vendedor || 'Vendedor' : 'Sem vendedor', feitas: 0, enviadas: 0, aprovadas: 0, reprovadas: 0, conversao: null, valorEnviado: 0, valorAprovado: 0, emNegociacao: 0 };
      linhas.set(id, l);
    }
    l.feitas++;
    const e = envios.get(p.id);
    if (e) { l.enviadas++; l.valorEnviado += e.valor; }
    if (APROVADAS.includes(p.status)) { l.aprovadas++; l.valorAprovado += aprovado.get(p.id) ?? Number(p.valor); }
    if (p.status === 'Reprovado') l.reprovadas++;
    if (EM_NEGOCIACAO.includes(p.status)) l.emNegociacao += Number(p.valor);
  }
  return [...linhas.values()]
    .map((l) => ({ ...l, conversao: l.aprovadas + l.reprovadas ? Math.round((l.aprovadas / (l.aprovadas + l.reprovadas)) * 100) : null }))
    .sort((a, b) => (a.id === SEM_VENDEDOR ? 1 : b.id === SEM_VENDEDOR ? -1 : b.feitas - a.feitas || a.nome.localeCompare(b.nome)));
}
