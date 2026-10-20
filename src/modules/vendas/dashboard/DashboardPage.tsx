import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAno } from '@/app/AnoContext';
import { dataBR, hojeISO, moeda } from '@/shared/lib/formato';
import { Cabecalho, Cartao, Selo, Vazio } from '@/shared/ui';
import { listarContatos, listarPropostas } from '../api';
import { AGUARDANDO_RETORNO, STATUS_DASHBOARD, type StatusProposta } from '../types';
import { followupVencido } from '../propostas/regras';

const aprovadas = ['Aprovado', 'Finalizado', 'Emitido NF', 'Pago'];

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
  const maxQtd = Math.max(1, ...STATUS_DASHBOARD.map((s) => propostas.filter((p) => p.status === s).length));

  const kpis = [
    { rotulo: 'Propostas no ano', valor: String(propostas.length) },
    { rotulo: 'Valor em negociação', valor: moeda(soma((s) => AGUARDANDO_RETORNO.includes(s as StatusProposta))) },
    { rotulo: 'Valor aprovado', valor: moeda(soma((s) => aprovadas.includes(s))), destaque: true },
    { rotulo: 'Conversão', valor: conversao === null ? '—' : `${conversao}%` },
    { rotulo: `Contatos ativos em ${ano}`, valor: String(contatosAno.length) },
    { rotulo: 'Follow-ups vencidos', valor: String(vencidos.length), alerta: vencidos.length > 0 },
  ];

  return (
    <>
      <Cabecalho titulo="Dashboard Comercial" subtitulo={`Ano ${ano}`} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <Cartao key={k.rotulo} className="p-4">
            <div className="text-xs text-slate-500">{k.rotulo}</div>
            <div className={`mt-1 text-xl font-bold ${k.destaque ? 'text-petroleo-600 dark:text-teal-300' : k.alerta ? 'text-amber-600' : ''}`}>{k.valor}</div>
          </Cartao>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Cartao>
          <div className="mb-3 font-semibold">Propostas por etapa</div>
          <div className="space-y-2">
            {STATUS_DASHBOARD.map((s) => {
              const n = propostas.filter((p) => p.status === s).length;
              return (
                <div key={s} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 text-slate-500">{s}</span>
                  <div className="h-5 flex-1 rounded bg-slate-100 dark:bg-marinho-700">
                    <div className="h-5 rounded bg-roxo-500" style={{ width: `${(n / maxQtd) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right font-semibold">{n}</span>
                </div>
              );
            })}
          </div>
        </Cartao>
        <Cartao>
          <div className="mb-3 flex items-center justify-between font-semibold">
            Retornos pendentes <Link to="/vendas/propostas" className="text-xs font-normal text-roxo-600 hover:underline">Abrir Kanban</Link>
          </div>
          {vencidos.length === 0 ? <Vazio>Nenhum follow-up vencido.</Vazio> : (
            <ul className="divide-y divide-slate-100 text-sm dark:divide-marinho-700">
              {vencidos.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2">
                  <div><span className="font-mono text-xs font-semibold text-roxo-600">{p.codigo}</span> {p.titulo}<div className="text-xs text-slate-500">{p.empresas?.nome_fantasia} · {p.contatos?.nome}</div></div>
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
