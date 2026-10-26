// Solicitação de compra da lista de materiais (decisão 103): a Engenharia manda a lista inteira para Compras.
// A soma é a mesma da importação de Compras (agruparLista); cada envio é uma revisão R0, R1…
import { agruparLista, type GrupoItem, type LinhaImportada, type StatusRequisicao } from '@/modules/compras/regras';

export interface ItemSolicitado { grupo: GrupoItem; descricao: string; quantidade: number; unidade: string }
export interface Solicitacao {
  id: string; codigo: string; revisao: number; status: StatusRequisicao; necessario_em: string | null; prioridade: 'normal' | 'urgente';
  criado_em: string; solicitante: string | null; itens: ItemSolicitado[];
}

// Ainda dá para trocar: a requisição aberta ou em cotação é substituída pela nova revisão.
export const SUBSTITUIVEL: StatusRequisicao[] = ['aberta', 'em_cotacao'];

const chave = (i: Pick<ItemSolicitado, 'grupo' | 'descricao' | 'unidade'>) => `${i.grupo}|${i.descricao.trim().toLowerCase()}|${i.unidade}`;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

function somar(itens: Pick<ItemSolicitado, 'grupo' | 'descricao' | 'unidade' | 'quantidade'>[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const i of itens) m.set(chave(i), (m.get(chave(i)) ?? 0) + Number(i.quantidade));
  return m;
}

export interface PlanoEnvio {
  itens: LinhaImportada[];        // o que vai na nova requisição
  substitui: Solicitacao[];        // requisições abertas/em cotação que serão canceladas
  reducoes: string[];              // o que já foi comprado (ou está em aprovação) e saiu ou diminuiu na lista
  proximaRevisao: number;
}

// Lista atual × o que já está com Compras e não pode mais ser trocado (em aprovação, aprovado, pedido, entregue):
// vai só o que falta. Sem nada travado, vai a lista inteira.
export function planoEnvio(atual: LinhaImportada[], solicitacoes: Solicitacao[]): PlanoEnvio {
  const vivas = solicitacoes.filter((s) => s.status !== 'cancelada');
  const travadas = vivas.filter((s) => !SUBSTITUIVEL.includes(s.status));
  const base = somar(travadas.flatMap((s) => s.itens));
  const itens: LinhaImportada[] = [];
  for (const l of atual) {
    const q = r3(l.quantidade - (base.get(chave(l)) ?? 0));
    if (q > 0) itens.push({ ...l, quantidade: q, observacoes: base.has(chave(l)) ? [l.observacoes, `complemento: já pedidos ${r3(base.get(chave(l))!)} ${l.unidade}`].filter(Boolean).join(' · ') : l.observacoes });
  }
  const doAtual = somar(atual);
  const reducoes = [...base.entries()].filter(([k, q]) => (doAtual.get(k) ?? 0) < q - 0.0005).map(([k, q]) => {
    const [, , unidade] = k.split('|');
    const desc = travadas.flatMap((s) => s.itens).find((i) => chave(i) === k)!.descricao;
    return `${desc}: pedido ${r3(q)} ${unidade}, lista atual ${r3(doAtual.get(k) ?? 0)} ${unidade}`;
  });
  const proximaRevisao = solicitacoes.length ? Math.max(...solicitacoes.map((s) => s.revisao)) + 1 : 0;
  return { itens, substitui: vivas.filter((s) => SUBSTITUIVEL.includes(s.status)), reducoes, proximaRevisao };
}

// A lista mudou desde a última revisão enviada (que não foi cancelada)?
export function mudouDesde(atual: LinhaImportada[], solicitacoes: Solicitacao[]): boolean {
  const vivas = solicitacoes.filter((s) => s.status !== 'cancelada');
  if (!vivas.length) return false;
  const enviado = somar(vivas.flatMap((s) => s.itens));
  const agora = somar(atual);
  if (enviado.size !== agora.size) return true;
  return [...agora.entries()].some(([k, q]) => Math.abs((enviado.get(k) ?? 0) - q) > 0.0005);
}

export { agruparLista };
