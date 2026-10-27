import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { dataBR } from '@/shared/lib/formato';
import { Botao, Selo } from '@/shared/ui';
import { hhmm, horaDoMomento, SITUACAO_DIA } from './calculo';
import type { MesPessoa } from './useMes';
import { mudarMes, nomeMes } from './useMes';

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function SeletorMes({ mes, onChange }: { mes: string; onChange: (m: string) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg bg-superficie p-1 shadow-sm ring-1 ring-borda">
      <button type="button" className="rounded p-1.5 hover:bg-pagina" onClick={() => onChange(mudarMes(mes, -1))} aria-label="Mês anterior"><ChevronLeft size={16} /></button>
      <span className="min-w-[9.5rem] text-center text-sm font-medium">{nomeMes(mes)}</span>
      <button type="button" className="rounded p-1.5 hover:bg-pagina" onClick={() => onChange(mudarMes(mes, 1))} aria-label="Próximo mês"><ChevronRight size={16} /></button>
    </div>
  );
}

export function Saldo({ min, className = '' }: { min: number; className?: string }) {
  const cor = min > 0 ? 'text-petroleo-600 dark:text-teal-300' : min < 0 ? 'text-red-600 dark:text-red-300' : 'text-suave';
  return <span className={`tabular-nums ${cor} ${className}`}>{min === 0 ? '0h00' : hhmm(min, true)}</span>;
}

export function CartoesResumo({ m }: { m: MesPessoa }) {
  const r = m.resumo;
  const C = ({ rotulo, children, detalhe }: { rotulo: string; children: ReactNode; detalhe?: string }) => (
    <div className="rounded-xl bg-superficie p-4 shadow-sm ring-1 ring-borda">
      <div className="text-xs text-suave">{rotulo}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{children}</div>
      {detalhe && <div className="mt-0.5 text-[11px] text-suave">{detalhe}</div>}
    </div>
  );
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
      <C rotulo="Previsto até hoje">{hhmm(r.previsto)}</C>
      <C rotulo="Trabalhado">{hhmm(r.trabalhado)}</C>
      <C rotulo="Saldo do mês (oficial)" detalhe={r.saldoOficial >= 0 ? 'a mais' : 'devendo'}><Saldo min={r.saldoOficial} /></C>
      <C rotulo="Faltas">{r.faltas}</C>
      <C rotulo="Aguardando o RH" detalhe="dias fora da tolerância">{r.pendentes}</C>
    </div>
  );
}

// Espelho do mês: uma linha por dia com as 4 batidas, a situação, o saldo e os avisos.
// `acoes` (RH) desenha os botões de cada dia.
export function TabelaEspelho({ m, acoes, soDiasComRegistro = false }: { m: MesPessoa; acoes?: (d: MesPessoa['dias'][number]) => ReactNode; soDiasComRegistro?: boolean }) {
  const dias = m.dias.filter((d) => d.situacao !== 'futuro' && (!soDiasComRegistro || d.batidas.length || d.precisaDecisao));
  return (
    <>
    {/* Celular: uma linha curta por dia. */}
    <div className="divide-y divide-borda overflow-hidden rounded-xl bg-superficie ring-1 ring-borda md:hidden">
      {dias.map((d) => {
        const s = SITUACAO_DIA[d.situacao];
        const apagado = ['sem_expediente', 'fora', 'feriado'].includes(d.situacao) && !d.batidas.length;
        return (
          <div key={d.dia} className={`px-3 py-2 text-sm ${apagado ? 'text-suave' : ''}`}>
            <div className="flex items-center gap-2">
              <span className="w-[4.5rem] shrink-0"><span className="font-medium">{dataBR(d.dia).slice(0, 5)}</span> <span className="text-xs text-suave">{SEMANA[new Date(`${d.dia}T12:00:00Z`).getUTCDay()]}</span></span>
              <span className="flex-1 tabular-nums">{d.batidas.map((b) => horaDoMomento(b.momento)).join(' · ') || (s.rotulo && !apagado ? '' : '—')}</span>
              {d.precisaDecisao && <Saldo min={d.saldo} className="text-xs" />}
              {acoes?.(d)}
            </div>
            {(d.situacao !== 'normal' && s.rotulo && !apagado) || d.pendente || d.decisao ? (
              <div className="mt-1 flex flex-wrap items-center gap-1 pl-[4.5rem]">
                {s.rotulo && d.situacao !== 'normal' && <Selo cor={s.cor}>{s.rotulo}</Selo>}
                {d.decisao && d.precisaDecisao && <Selo cor={d.decisao.decisao === 'aprovado' ? 'verde' : 'azul'}>{d.decisao.decisao === 'aprovado' ? 'Aprovado' : 'Abonado'}</Selo>}
                {d.pendente && <Selo cor="amarelo">Aguardando o RH</Selo>}
                {(d.alertas.length > 0 || d.justificativa) && <span className="text-xs text-suave">{[d.justificativa, ...d.alertas].filter(Boolean).join(' · ')}</span>}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
    <div className="hidden overflow-x-auto rounded-xl ring-1 ring-borda md:block">
      <table className="w-full text-sm">
        <thead className="bg-pagina text-left text-xs uppercase text-suave">
          <tr>
            <th className="px-3 py-2">Dia</th>
            <th className="px-2 py-2 text-center">Entrada</th><th className="px-2 py-2 text-center">Almoço</th>
            <th className="px-2 py-2 text-center">Volta</th><th className="px-2 py-2 text-center">Saída</th>
            <th className="px-3 py-2 text-right">Trabalhado</th><th className="px-3 py-2 text-right">Saldo</th>
            <th className="px-3 py-2">Situação</th>
            {acoes && <th className="px-3 py-2" />}
          </tr>
        </thead>
        <tbody>
          {dias.map((d) => {
            const s = SITUACAO_DIA[d.situacao];
            const apagado = ['sem_expediente', 'fora', 'feriado'].includes(d.situacao) && !d.batidas.length;
            return (
              <tr key={d.dia} className={`border-t border-borda align-top ${apagado ? 'text-suave' : ''}`}>
                <td className="whitespace-nowrap px-3 py-2">
                  <span className="font-medium">{dataBR(d.dia).slice(0, 5)}</span> <span className="text-xs text-suave">{SEMANA[new Date(`${d.dia}T12:00:00Z`).getUTCDay()]}</span>
                </td>
                {[0, 1, 2, 3].map((i) => {
                  const b = d.batidas[i];
                  return (
                    <td key={i} className="px-2 py-2 text-center tabular-nums">
                      {b ? <span title={b.origem === 'app' ? `Pelo ERP${b.distancia_m != null ? `, a ${Math.round(b.distancia_m)} m` : ''}` : `Lançada ${b.origem === 'ajuste' ? 'por ajuste aprovado' : 'pelo RH'}: ${b.motivo}`}
                        className={b.origem === 'app' ? '' : 'underline decoration-dotted'}>{horaDoMomento(b.momento)}</span> : <span className="text-suave">—</span>}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right tabular-nums">{d.trabalhado ? hhmm(d.trabalhado) : '—'}</td>
                <td className="px-3 py-2 text-right">{d.precisaDecisao ? <Saldo min={d.saldo} /> : <span className="text-suave">—</span>}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-1">
                    {s.rotulo && <Selo cor={s.cor}>{d.situacao === 'feriado' && d.feriado ? d.feriado : s.rotulo}</Selo>}
                    {d.decisao && d.precisaDecisao && <Selo cor={d.decisao.decisao === 'aprovado' ? 'verde' : 'azul'}>{d.decisao.decisao === 'aprovado' ? 'Aprovado pelo RH' : 'Abonado'}</Selo>}
                    {d.pendente && <Selo cor="amarelo">Aguardando o RH</Selo>}
                  </div>
                  {(d.alertas.length > 0 || d.justificativa) && (
                    <div className="mt-1 text-xs text-suave">{[d.justificativa, ...d.alertas].filter(Boolean).join(' · ')}</div>
                  )}
                  {d.desconsideradas.length > 0 && <div className="mt-0.5 text-[11px] text-suave line-through">{d.desconsideradas.map((x) => horaDoMomento(x.momento)).join(', ')}</div>}
                </td>
                {acoes && <td className="whitespace-nowrap px-3 py-2 text-right">{acoes(d)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}

export const BotaoPequeno = (p: Parameters<typeof Botao>[0]) => <Botao tamanho="sm" variante="secundario" {...p} />;
