// Solicitação de compra da lista de materiais (decisão 103): a Engenharia manda a lista inteira para Compras.
// A soma é a mesma da importação de Compras (agruparLista); cada envio é uma revisão R0, R1…
import { ROTULO_STATUS, agruparLista, type GrupoItem, type LinhaImportada, type StatusRequisicao } from '@/modules/compras/regras';

export interface ItemSolicitado { grupo: GrupoItem; descricao: string; quantidade: number; unidade: string }
// Compras v2: a requisição aberta que já tem item comprado volta como "em_compra" (engenharia_solicitacoes).
export type StatusSolicitacao = StatusRequisicao | 'em_compra';
export const ROTULO_SOLICITACAO: Record<StatusSolicitacao, string> = { ...ROTULO_STATUS, em_compra: 'Em compra' };
export interface Solicitacao {
  id: string; codigo: string; revisao: number; status: StatusSolicitacao; necessario_em: string | null; prioridade: 'normal' | 'urgente';
  criado_em: string; solicitante: string | null; itens: ItemSolicitado[];
}

// Ainda dá para trocar: a requisição aberta sem nada comprado é substituída pela nova revisão.
export const SUBSTITUIVEL: StatusSolicitacao[] = ['aberta'];

const chave = (i: Pick<ItemSolicitado, 'grupo' | 'descricao' | 'unidade'>) => `${i.grupo}|${i.descricao.trim().toLowerCase()}|${i.unidade}`;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

function somar(itens: Pick<ItemSolicitado, 'grupo' | 'descricao' | 'unidade' | 'quantidade'>[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const i of itens) m.set(chave(i), (m.get(chave(i)) ?? 0) + Number(i.quantidade));
  return m;
}

export interface PlanoEnvio<T extends LinhaImportada = LinhaImportada> {
  itens: T[];        // o que vai na nova requisição
  substitui: Solicitacao[];        // requisições abertas/em cotação que serão canceladas
  reducoes: string[];              // o que já foi comprado e saiu ou diminuiu na lista
  comparacao: Comparacao[];        // era × agora por item, contra as revisões vivas (pedido do Gabriel, Compras v2 item 4)
  saidas: string[];                // itens que estavam nas revisões vivas e saíram da lista
  proximaRevisao: number;
}

// chave = a da linha da lista (LinhaImportada.chave), para a tela casar com plano.itens.
export interface Comparacao { chave: string; grupo: GrupoItem; descricao: string; unidade: string; era: number | null; agora: number }

const qtd = (n: number) => r3(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

// Texto que vai na observação do item da RC: "era 100 kg, agora 120 kg" ou "novo na R1".
export function textoMudanca(c: Pick<Comparacao, 'era' | 'agora' | 'unidade'>, revisao: number): string {
  if (c.era == null) return `novo na R${revisao}`;
  if (Math.abs(c.era - c.agora) <= 0.0005) return '';
  return `era ${qtd(c.era)} ${c.unidade}, agora ${qtd(c.agora)} ${c.unidade}`;
}

// Lista atual × o que já está com Compras e não pode mais ser trocado (já tem item comprado, ou concluída):
// vai só o que falta. Sem nada travado, vai a lista inteira.
export function planoEnvio<T extends LinhaImportada>(atual: T[], solicitacoes: Solicitacao[]): PlanoEnvio<T> {
  const vivas = solicitacoes.filter((s) => s.status !== 'cancelada');
  const travadas = vivas.filter((s) => !SUBSTITUIVEL.includes(s.status));
  const base = somar(travadas.flatMap((s) => s.itens));
  const proximaRevisao = solicitacoes.length ? Math.max(...solicitacoes.map((s) => s.revisao)) + 1 : 0;
  // "Era" = soma do que está vivo com Compras antes deste envio (a revisão que será substituída também conta).
  const enviado = somar(vivas.flatMap((s) => s.itens));
  const doAtual = somar(atual);
  const comparacao: Comparacao[] = vivas.length ? atual.map((l) => ({
    chave: l.chave, grupo: l.grupo, descricao: l.descricao, unidade: l.unidade, era: enviado.has(chave(l)) ? r3(enviado.get(chave(l))!) : null, agora: r3(doAtual.get(chave(l)) ?? 0),
  })) : [];
  const mudanca = new Map(comparacao.map((c) => [chave(c), textoMudanca(c, proximaRevisao)]));
  const itens: T[] = [];
  for (const l of atual) {
    const q = r3(l.quantidade - (base.get(chave(l)) ?? 0));
    const notas = [mudanca.get(chave(l)), l.observacoes, base.has(chave(l)) ? `complemento: já pedidos ${r3(base.get(chave(l))!)} ${l.unidade}` : ''];
    if (q > 0) itens.push({ ...l, quantidade: q, observacoes: notas.filter(Boolean).join(' · ') });
  }
  const vistos = new Set<string>();
  const saidas = vivas.flatMap((s) => s.itens).filter((i) => !doAtual.has(chave(i)) && !vistos.has(chave(i)) && vistos.add(chave(i)))
    .map((i) => `${i.descricao} (era ${qtd(enviado.get(chave(i))!)} ${i.unidade})`);
  const reducoes = [...base.entries()].filter(([k, q]) => (doAtual.get(k) ?? 0) < q - 0.0005).map(([k, q]) => {
    const [, , unidade] = k.split('|');
    const desc = travadas.flatMap((s) => s.itens).find((i) => chave(i) === k)!.descricao;
    return `${desc}: pedido ${r3(q)} ${unidade}, lista atual ${r3(doAtual.get(k) ?? 0)} ${unidade}`;
  });
  return { itens, substitui: vivas.filter((s) => SUBSTITUIVEL.includes(s.status)), reducoes, comparacao, saidas, proximaRevisao };
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

// Itens da revisão (decisão 113) → linhas para Compras. Itens iguais (grupo, descrição e unidade) somam numa linha;
// observações juntam, e o primeiro link e a primeira imagem valem.
export interface ItemRevisao {
  grupo: GrupoItem; descricao: string; quantidade: number; unidade: string; observacoes: string;
  bib_tipo: LinhaImportada['bib_tipo']; bib_id: string | null; link: string; imagem: string | null;
}
export type LinhaRevisao = LinhaImportada & { link: string; imagem: string | null };
export function linhasDaRevisao(itens: ItemRevisao[]): LinhaRevisao[] {
  const m = new Map<string, LinhaRevisao>();
  for (const i of itens) {
    const k = chave({ grupo: i.grupo, descricao: i.descricao, unidade: i.unidade.trim() || 'un' });
    const atual = m.get(k);
    if (!atual) {
      m.set(k, { chave: k, grupo: i.grupo, descricao: i.descricao.trim(), quantidade: Number(i.quantidade), unidade: i.unidade.trim() || 'un',
        observacoes: i.observacoes.trim(), bib_tipo: i.bib_tipo, bib_id: i.bib_id, link: i.link, imagem: i.imagem });
      continue;
    }
    atual.quantidade = r3(atual.quantidade + Number(i.quantidade));
    if (i.observacoes.trim() && !atual.observacoes.includes(i.observacoes.trim())) atual.observacoes = [atual.observacoes, i.observacoes.trim()].filter(Boolean).join(' · ');
    atual.link ||= i.link;
    atual.imagem ||= i.imagem;
  }
  return [...m.values()];
}
