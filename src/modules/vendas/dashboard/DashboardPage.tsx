import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlarmClock, BadgeCheck, CircleCheck, FileText, Handshake, Percent, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAno } from '@/app/AnoContext';
import { dataBR, hojeISO, moeda } from '@/shared/lib/formato';
import { Cabecalho, Cartao, Selo } from '@/shared/ui';
import { Rosca, useContagem, type FatiaRosca } from '@/shared/ui/graficos';
import { listarContatos, listarPropostas } from '../api';
import { AGUARDANDO_RETORNO, ETAPAS_FINANCEIRO, STATUS_KANBAN, colunaKanban, type StatusProposta } from '../types';
import { followupVencido } from '../propostas/regras';

const aprovadas = ['Aprovado', 'Finalizado', 'Emitido NF', 'Pago'];
// Cor de cada coluna do Kanban: paleta categórica em ordem fixa (validada no claro e no escuro).
const COR_COLUNA: Record<string, string> = { 'À enviar': 'var(--serie-1)', Enviados: 'var(--serie-2)', Aprovado: 'var(--serie-3)', Reprovado: 'var(--serie-4)' };

type Kpi = { rotulo: string; valor: number; formato: 'numero' | 'moeda' | 'pct'; icone: LucideIcon; destaque?: boolean; alerta?: boolean; vazio?: boolean };

export function DashboardPage() {
  const { ano } = useAno();
  const { data: propostas = [] } = useQuery({ queryKey: ['propostas', ano], queryFn: () => listarPropostas(ano) });
  const { data: contatos = [] } = useQuery({ queryKey: ['contatos'], queryFn: listarContatos });
  const hoje = hojeISO();

  const soma = (f: (s: string) => boolean) => propostas.filter((p) => f(p.status)).reduce((s, p) => s + Number(p.valor), 0);
  const nAprov = propostas.filter((p) => aprovadas.includes(p.status)).length;
  const nReprov = propostas.filter((p) => p.status === 'Reprovado').length;
  const conversao = nAprov + nReprov ? Math.round((nAprov / (nAprov + nReprov)) * 100) : null;
  const vencidos = propostas.filter((p) => AGUARDANDO_RETORNO.includes(p.status) && followupVencido(p.proximo_followup, hoje));
  const contatosAno = contatos.filter((c) => c.contato_anos?.some((a) => a.ano === ano));

  const kpis: Kpi[] = [
    { rotulo: 'Propostas no ano', valor: propostas.length, formato: 'numero', icone: FileText },
    { rotulo: 'Valor em negociação', valor: soma((s) => AGUARDANDO_RETORNO.includes(s as StatusProposta)), formato: 'moeda', icone: Handshake },
    { rotulo: 'Valor aprovado', valor: soma((s) => aprovadas.includes(s)), formato: 'moeda', icone: BadgeCheck, destaque: true },
    { rotulo: 'Conversão', valor: conversao ?? 0, formato: 'pct', icone: Percent, vazio: conversao === null },
    { rotulo: `Contatos ativos em ${ano}`, valor: contatosAno.length, formato: 'numero', icone: Users },
    { rotulo: 'Follow-ups vencidos', valor: vencidos.length, formato: 'numero', icone: AlarmClock, alerta: vencidos.length > 0 },
  ];

  // Propostas por coluna do Kanban (Finalizado, Emitido NF e Pago contam em Aprovado, como no Kanban).
  const porColuna = STATUS_KANBAN.map((s) => {
    const lista = propostas.filter((p) => colunaKanban(p.status) === s);
    const fin = s === 'Aprovado' ? ETAPAS_FINANCEIRO.map((e) => [e, propostas.filter((p) => p.status === e).length] as const).filter(([, n]) => n > 0) : [];
    return { s, n: lista.length, valor: lista.reduce((t, p) => t + Number(p.valor), 0), fin };
  });
  const fatias: FatiaRosca[] = porColuna.map((c) => ({ id: c.s, rotulo: c.s, valor: c.n, cor: COR_COLUNA[c.s], detalhe: moeda(c.valor) }));

  return (
    <>
      <Cabecalho titulo="Dashboard Comercial" subtitulo={`Ano ${ano}`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => <CartaoKpi key={k.rotulo} k={k} />)}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Cartao>
          <div className="mb-4 font-semibold">Propostas por etapa</div>
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
            <Rosca fatias={fatias} total={propostas.length} rotuloTotal="propostas" />
            {/* Legenda e tabela ao mesmo tempo: cada cor com nome, quantidade, % e valor (a cor nunca carrega a informação sozinha). */}
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase text-suave"><th className="pb-1 font-medium">Etapa</th><th className="pb-1 pl-3 text-right font-medium">Qtd</th><th className="pb-1 pl-3 text-right font-medium">%</th><th className="pb-1 pl-3 text-right font-medium">Valor</th></tr></thead>
              <tbody>
                {porColuna.map((c) => (
                  <tr key={c.s} className="border-t border-borda align-top">
                    <td className="py-1.5">
                      <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: COR_COLUNA[c.s] }} />{c.s}</span>
                      {c.fin.length > 0 && <div className="pl-[18px] text-xs text-suave">{c.fin.map(([e, n]) => `${e === 'Emitido NF' ? 'NF emitida' : e} ${n}`).join(' · ')}</div>}
                    </td>
                    <td className="py-1.5 pl-3 text-right font-semibold tabular-nums">{c.n}</td>
                    <td className="py-1.5 pl-3 text-right tabular-nums text-suave">{propostas.length ? Math.round((c.n / propostas.length) * 100) : 0}%</td>
                    <td className="whitespace-nowrap py-1.5 pl-3 text-right tabular-nums">{moeda(c.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Cartao>
        <Cartao>
          <div className="mb-3 flex items-center justify-between font-semibold">
            Retornos pendentes <Link to="/vendas/propostas" className="text-xs font-normal text-roxo-600 hover:underline dark:text-roxo-100">Abrir Kanban</Link>
          </div>
          {vencidos.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-petroleo-50 text-petroleo-600 dark:bg-petroleo-500/15 dark:text-teal-300"><CircleCheck size={22} /></span>
              <div className="font-semibold">Tudo em dia</div>
              <div className="text-sm text-suave">Nenhum follow-up vencido.</div>
            </div>
          ) : (
            <ul className="divide-y divide-borda text-sm">
              {vencidos.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0"><span className="font-mono text-xs font-semibold text-roxo-600 dark:text-roxo-100">{p.codigo}</span> {p.titulo}<div className="truncate text-xs text-suave">{p.empresas?.nome_fantasia} · {p.contatos?.nome}</div></div>
                  <Selo cor="amarelo">{dataBR(p.proximo_followup)}</Selo>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>
    </>
  );
}

function CartaoKpi({ k }: { k: Kpi }) {
  const v = useContagem(k.valor);
  const texto = k.vazio ? '—' : k.formato === 'moeda' ? moeda(v) : k.formato === 'pct' ? `${Math.round(v)}%` : String(Math.round(v));
  return (
    <Cartao className="p-4 transition-shadow duration-150 hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-suave">{k.rotulo}</span>
        <k.icone size={16} className={k.alerta ? 'text-amber-500' : k.destaque ? 'text-petroleo-500 dark:text-teal-300' : 'text-suave'} />
      </div>
      <div className={`mt-1.5 text-xl font-semibold tabular-nums tracking-tight ${k.destaque ? 'text-petroleo-600 dark:text-teal-300' : k.alerta ? 'text-amber-600 dark:text-amber-400' : 'text-texto'}`}>{texto}</div>
    </Cartao>
  );
}
