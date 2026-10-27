import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, dataHoraBR, mensagemErro } from '@/shared/lib/formato';
import { listarPessoas } from '../api';
import { hhmm, horaDoMomento, SITUACAO_DIA } from '../calculo';
import { mesAtual, nomeMes, useMesPonto, type MesPessoa } from '../useMes';

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

// Relatório do mês para imprimir e assinar (resposta 3): um espelho por página, só com o saldo oficial
// (dias fora da tolerância entram só se o RH aprovou). Abre fora do layout, para imprimir limpo.
export function RelatorioPonto() {
  const [busca] = useSearchParams();
  const mes = busca.get('mes') ?? mesAtual();
  const so = busca.get('f') ?? undefined;
  const { pode, permissoesProntas } = useAuth();
  const { data: todas = [], error } = useQuery({ queryKey: ['ponto', 'pessoas'], queryFn: listarPessoas, enabled: pode('rh', 'ler') });
  const pessoas = useMemo(() => todas.filter((p) => (so ? p.id === so : p.bate_ponto && p.situacao !== 'desligado')), [todas, so]);
  const { resultado, erro, carregando } = useMesPonto(mes, pessoas, so);

  if (!permissoesProntas) return null;
  if (!pode('rh', 'ler')) return <p className="p-8 text-sm">Só o RH imprime o relatório de ponto.</p>;
  if (error || erro) return <p className="p-8 text-sm text-red-700">{mensagemErro(error ?? erro)}</p>;
  if (carregando || !resultado.length) return <p className="p-8 text-sm">Carregando…</p>;
  const pendentes = resultado.reduce((s, m) => s + m.resumo.pendentes, 0);

  return (
    <div className="relatorio-ponto min-h-screen bg-white text-[11px] text-black">
      <style>{'@page { size: A4; margin: 12mm; } @media print { .nao-imprimir { display: none !important; } .pagina-ponto { break-after: page; } }'}</style>
      <div className="nao-imprimir sticky top-0 z-10 flex items-center gap-3 border-b bg-slate-50 px-6 py-3 text-sm">
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-roxo-500 px-3 py-1.5 font-medium text-white"><Printer size={16} /> Imprimir</button>
        <span>{resultado.length} espelho(s) de {nomeMes(mes)}.</span>
        {pendentes > 0 && <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">{pendentes} dia(s) ainda aguardando aprovação do RH: não entram no saldo.</span>}
      </div>
      {resultado.map((m) => <Pagina key={m.pessoa.id} m={m} mes={mes} />)}
    </div>
  );
}

function Pagina({ m, mes }: { m: MesPessoa; mes: string }) {
  const r = m.resumo;
  const dias = m.dias.filter((d) => d.situacao !== 'futuro');
  return (
    <section className="pagina-ponto mx-auto max-w-[190mm] px-2 py-6">
      <header className="mb-3 flex items-end justify-between border-b-2 border-black pb-2">
        <div>
          <div className="text-[15px] font-bold">Espelho de ponto · {nomeMes(mes)}</div>
          <div className="text-[13px]">{m.pessoa.nome}</div>
        </div>
        <div className="text-right">
          <div className="font-semibold">Fabriaço Montagens Industriais e Caldeiraria</div>
          <div>Controle interno · emitido em {dataHoraBR(new Date().toISOString())}</div>
        </div>
      </header>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-1">Dia</th><th className="text-center">Entrada</th><th className="text-center">Almoço</th><th className="text-center">Volta</th><th className="text-center">Saída</th>
            <th className="text-right">Trabalhado</th><th className="text-right">Saldo</th><th className="pl-2">Observação</th>
          </tr>
        </thead>
        <tbody>
          {dias.map((d) => {
            const obs = [d.situacao === 'normal' ? '' : d.situacao === 'feriado' ? d.feriado : SITUACAO_DIA[d.situacao].rotulo, d.justificativa,
              d.precisaDecisao ? (d.decisao ? (d.decisao.decisao === 'aprovado' ? 'aprovado pelo RH' : `abonado: ${d.decisao.observacao}`) : 'aguardando o RH') : '']
              .filter(Boolean).join(' · ');
            return (
              <tr key={d.dia} className="border-b border-slate-300">
                <td className="whitespace-nowrap py-[3px]">{dataBR(d.dia).slice(0, 5)} {SEMANA[new Date(`${d.dia}T12:00:00Z`).getUTCDay()]}</td>
                {[0, 1, 2, 3].map((i) => <td key={i} className="text-center tabular-nums">{d.batidas[i] ? `${horaDoMomento(d.batidas[i].momento)}${d.batidas[i].origem === 'app' ? '' : '*'}` : ''}</td>)}
                <td className="text-right tabular-nums">{d.trabalhado ? hhmm(d.trabalhado) : ''}</td>
                <td className="text-right tabular-nums">{d.saldoOficial ? hhmm(d.saldoOficial, true) : ''}</td>
                <td className="pl-2">{obs}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-3 grid grid-cols-5 gap-2 border border-black p-2 text-[12px]">
        <div>Previsto<br /><b>{hhmm(r.previsto)}</b></div>
        <div>Trabalhado<br /><b>{hhmm(r.trabalhado)}</b></div>
        <div>Horas extras aprovadas<br /><b>{hhmm(r.extrasAprovadas)}</b></div>
        <div>Faltas<br /><b>{r.faltas}</b></div>
        <div>Saldo do mês<br /><b>{r.saldoOficial === 0 ? '0h00' : `${hhmm(r.saldoOficial, true)} ${r.saldoOficial > 0 ? '(a mais)' : '(devendo)'}`}</b></div>
      </div>
      <p className="mt-1 text-[10px]">* batida lançada pelo RH ou por ajuste aprovado. O saldo zera a cada mês.</p>
      <div className="mt-12 grid grid-cols-2 gap-12 text-center">
        <div className="border-t border-black pt-1">{m.pessoa.nome}<br />Funcionário</div>
        <div className="border-t border-black pt-1">Fabriaço<br />RH</div>
      </div>
    </section>
  );
}
