// Séries do Dashboard da Engenharia (decisão 97): projetos e itens por mês, pelo horário de São Paulo.
import type { PainelProjeto } from './regras';
import { avanco } from './regras';

export const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export interface EventoMes { projeto_id: string; tipo: string; para: string | null; criado_em: string }
export interface ItemMes { projeto_id: string; criado_em: string }
export interface Mes { abertos: number; liberados: number; finalizados: number; itens: number }

// "2026-10-22T02:00:00Z" → 2026-10 em São Paulo (21/10 às 23h).
export function anoMesSP(iso: string): [number, number] {
  const d = new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  return [Number(d.slice(0, 4)), Number(d.slice(5, 7))];
}

// Cada projeto conta uma vez por mês em cada série (ir e voltar de coluna no mesmo mês não duplica).
export function seriePorMes(ano: number, eventos: EventoMes[], itens: ItemMes[], projetos: Set<string>): Mes[] {
  const meses: Mes[] = MESES.map(() => ({ abertos: 0, liberados: 0, finalizados: 0, itens: 0 }));
  const vistos = new Set<string>();
  for (const e of eventos) {
    if (!projetos.has(e.projeto_id)) continue;
    const [a, m] = anoMesSP(e.criado_em);
    if (a !== ano) continue;
    const serie = e.tipo === 'criado' ? 'abertos' : e.tipo === 'status' && e.para === 'liberado' ? 'liberados' : e.tipo === 'status' && e.para === 'finalizado' ? 'finalizados' : null;
    if (!serie) continue;
    const chave = `${serie}|${m}|${e.projeto_id}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    meses[m - 1][serie]++;
  }
  for (const i of itens) {
    if (!projetos.has(i.projeto_id)) continue;
    const [a, m] = anoMesSP(i.criado_em);
    if (a === ano) meses[m - 1].itens++;
  }
  return meses;
}

// Média do avanço dos projetos que ainda estão na Engenharia (não iniciados e em andamento); quem não tem dado não entra.
export function avancoMedio(painel: PainelProjeto[]): { modelagem: number | null; materiais: number | null; detalhamento: number | null } {
  const media = (vs: (number | null)[]) => { const v = vs.filter((x): x is number => x != null); return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null; };
  const av = painel.map(avanco);
  return { modelagem: media(av.map((a) => a.modelagem)), materiais: media(av.map((a) => a.materiais)), detalhamento: media(av.map((a) => a.detalhamento)) };
}
