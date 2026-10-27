// Tarefas por pessoa (decisão 116): o que a tela decide sozinha, sem banco. As regras de quem pode alterar ficam no banco.

export type Urgencia = 'alta' | 'media' | 'baixa';

export const URGENCIAS: { valor: Urgencia; rotulo: string; cor: 'vermelho' | 'amarelo' | 'cinza' }[] = [
  { valor: 'alta', rotulo: 'Alta', cor: 'vermelho' },
  { valor: 'media', rotulo: 'Média', cor: 'amarelo' },
  { valor: 'baixa', rotulo: 'Baixa', cor: 'cinza' },
];
export const urgenciaInfo = (u: Urgencia) => URGENCIAS.find((x) => x.valor === u) ?? URGENCIAS[1]!;

export interface TarefaBase {
  id: string; dono_id: string; criado_por: string; urgencia: Urgencia; prazo: string | null; ordem: number;
  criado_em: string; feita_em: string | null; vista_em: string | null;
}

// Abertas na ordem que o dono escolheu; as feitas, da mais recente para a mais antiga.
export function separar<T extends TarefaBase>(tarefas: T[]): { abertas: T[]; feitas: T[] } {
  const abertas = tarefas.filter((t) => !t.feita_em).sort((a, b) => a.ordem - b.ordem || b.criado_em.localeCompare(a.criado_em));
  const feitas = tarefas.filter((t) => t.feita_em).sort((a, b) => b.feita_em!.localeCompare(a.feita_em!));
  return { abertas, feitas };
}

// Botão "Organizar por urgência": alta, média, baixa; dentro de cada uma, a que tem prazo mais cedo primeiro e mantendo a
// ordem atual nos empates.
const PESO: Record<Urgencia, number> = { alta: 0, media: 1, baixa: 2 };
export function porUrgencia<T extends TarefaBase>(abertas: T[]): T[] {
  return abertas.map((t, i) => ({ t, i })).sort((a, b) =>
    PESO[a.t.urgencia] - PESO[b.t.urgencia]
    || (a.t.prazo ?? '9999').localeCompare(b.t.prazo ?? '9999')
    || a.i - b.i).map((x) => x.t);
}

export type SituacaoPrazo = 'vencido' | 'hoje' | 'futuro' | null;
export function situacaoPrazo(prazo: string | null, hoje: string): SituacaoPrazo {
  if (!prazo) return null;
  return prazo < hoje ? 'vencido' : prazo === hoje ? 'hoje' : 'futuro';
}

// Tarefas que outra pessoa me passou e eu ainda não vi (número no menu).
export const novasPara = <T extends TarefaBase>(tarefas: T[], eu: string) =>
  tarefas.filter((t) => t.dono_id === eu && !t.vista_em && !t.feita_em && t.criado_por !== eu).length;

// Move um item de lugar (arrastar e soltar).
export function mover<T extends { id: string }>(lista: T[], de: string, para: string): T[] {
  const i = lista.findIndex((x) => x.id === de);
  const j = lista.findIndex((x) => x.id === para);
  if (i < 0 || j < 0 || i === j) return lista;
  const nova = [...lista];
  const [item] = nova.splice(i, 1);
  nova.splice(j, 0, item!);
  return nova;
}
