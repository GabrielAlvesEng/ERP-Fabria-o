import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlarmClock, BadgeCheck, CircleCheck, FileText, Handshake, Percent, Send, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAno } from '@/app/AnoContext';
import { dataBR, hojeISO, moeda } from '@/shared/lib/formato';
import { Cabecalho, Cartao, EsqueletoDashboard, Selecao, Selo } from '@/shared/ui';
import { Linhas, Rosca, useContagem, type FatiaRosca } from '@/shared/ui/graficos';
import { listarContatos, listarMarcosDoAno, listarPropostas } from '../api';
import { nomeVendedor } from '../vendedores/api';
import { APROVADAS, MESES, porVendedor, seriePorMes, SEM_VENDEDOR, type PropostaIndicador } from './indicadores';
import { AGUARDANDO_RETORNO, ETAPAS_FINANCEIRO, STATUS_KANBAN, colunaKanban, type StatusProposta } from '../types';
import { followupVencido } from '../propostas/regras';

const aprovadas = APROVADAS;
const moedaCurta = (v: number) => (v >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : moeda(v));
// Cor de cada coluna do Kanban: paleta categórica em ordem fixa (validada no claro e no escuro).
const COR_COLUNA: Record<string, string> = { 'À enviar': 'var(--serie-1)', Enviados: 'var(--serie-2)', Aprovado: 'var(--serie-3)', Reprovado: 'var(--serie-4)' };

type Kpi = { rotulo: string; valor: number; formato: 'numero' | 'moeda' | 'pct'; icone: LucideIcon; destaque?: boolean; alerta?: boolean; vazio?: boolean };

export function DashboardPage() {
  const { ano } = useAno();
  const { data: todas = [], isLoading: l1 } = useQuery({ queryKey: ['propostas', ano], queryFn: () => listarPropostas(ano) });
  const { data: contatos = [], isLoading: l2 } = useQuery({ queryKey: ['contatos'], queryFn: listarContatos });
  const { data: marcos = { envios: [], aprovacoes: [], reprovacoes: [] } } = useQuery({ queryKey: ['propostas', ano, 'marcos'], queryFn: () => listarMarcosDoAno(ano) });
  const hoje = hojeISO();
  // Filtro por vendedor (decisão 90): vale para todo o painel.
  const [vendedor, setVendedor] = useState('');

  const indicadores: PropostaIndicador[] = useMemo(() => todas.map((p) => ({ id: p.id, data_emissao: p.data_emissao, valor: Number(p.valor), status: p.status, responsavel_id: p.responsavel_id, vendedor: nomeVendedor(p) })), [todas]);
  const vendedores = useMemo(() => porVendedor(indicadores, marcos), [indicadores, marcos]);
  const doFiltro = (id: string | null) => !vendedor || (id ?? SEM_VENDEDOR) === vendedor;
  const propostas = todas.filter((p) => doFiltro(p.responsavel_id));
  const meses = seriePorMes(ano, indicadores.filter((p) => doFiltro(p.responsavel_id)), marcos);
  // No ano corrente o gráfico vai só até o mês atual.
  const ate = Number(hoje.slice(0, 4)) === ano ? Number(hoje.slice(5, 7)) : 12;
  const rotulosMes = MESES.slice(0, ate);
  const nEnviadas = propostas.filter((p) => marcos.envios.some((e) => e.proposta_id === p.id)).length;

  const soma = (f: (s: string) => boolean) => propostas.filter((p) => f(p.status)).reduce((s, p) => s + Number(p.valor), 0);
  const nAprov = propostas.filter((p) => aprovadas.includes(p.status)).length;
  const nReprov = propostas.filter((p) => p.status === 'Reprovado').length;
  const conversao = nAprov + nReprov ? Math.round((nAprov / (nAprov + nReprov)) * 100) : null;
  const vencidos = propostas.filter((p) => AGUARDANDO_RETORNO.includes(p.status) && followupVencido(p.proximo_followup, hoje));
  const contatosAno = contatos.filter((c) => c.contato_anos?.some((a) => a.ano === ano));

  const kpis: Kpi[] = [
    { rotulo: 'Propostas no ano', valor: propostas.length, formato: 'numero', icone: FileText },
    { rotulo: 'Propostas enviadas', valor: nEnviadas, formato: 'numero', icone: Send },
    { rotulo: 'Valor em negociação', valor: soma((s) => AGUARDANDO_RETORNO.includes(s as StatusProposta)), formato: 'moeda', icone: Handshake },
    { rotulo: 'Valor aprovado', valor: soma((s) => aprovadas.includes(s)), formato: 'moeda', icone: BadgeCheck, destaque: true },
    { rotulo: 'Conversão', valor: conversao ?? 0, formato: 'pct', icone: Percent, vazio: conversao === null },
    { rotulo: 'Follow-ups vencidos', valor: vencidos.length, formato: 'numero', icone: AlarmClock, alerta: vencidos.length > 0 },
    // Contatos não têm vendedor: o cartão só aparece com "Todos os vendedores".
    ...(vendedor ? [] : [{ rotulo: `Contatos ativos em ${ano}`, valor: contatosAno.length, formato: 'numero', icone: Users } as Kpi]),
  ];
  const nomeFiltro = vendedores.find((v) => v.id === vendedor)?.nome;
  const filtro = (
    <Selecao value={vendedor} onChange={(e) => setVendedor(e.target.value)} className="w-56" aria-label="Vendedor">
      <option value="">Todos os vendedores</option>
      {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
    </Selecao>
  );

  // Propostas por coluna do Kanban (Finalizado, Emitido NF e Pago contam em Aprovado, como no Kanban).
  const porColuna = STATUS_KANBAN.map((s) => {
    const lista = propostas.filter((p) => colunaKanban(p.status) === s);
    const fin = s === 'Aprovado' ? ETAPAS_FINANCEIRO.map((e) => [e, propostas.filter((p) => p.status === e).length] as const).filter(([, n]) => n > 0) : [];
    return { s, n: lista.length, valor: lista.reduce((t, p) => t + Number(p.valor), 0), fin };
  });
  const fatias: FatiaRosca[] = porColuna.map((c) => ({ id: c.s, rotulo: c.s, valor: c.n, cor: COR_COLUNA[c.s], detalhe: moeda(c.valor) }));

  if (l1 || l2) return <><Cabecalho titulo="Dashboard Comercial" subtitulo={`Ano ${ano}`} /><EsqueletoDashboard /></>;
  return (
    <>
      <Cabecalho titulo="Dashboard Comercial" subtitulo={nomeFiltro ? `Ano ${ano} · ${nomeFiltro}` : `Ano ${ano}`} acoes={filtro} />
      <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 ${kpis.length > 6 ? 'xl:grid-cols-7' : 'xl:grid-cols-6'}`}>
        {kpis.map((k) => <CartaoKpi key={k.rotulo} k={k} />)}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Cartao>
          <div className="mb-3 font-semibold">Propostas por mês</div>
          <Linhas inteiro rotulosX={rotulosMes} formatar={(v) => String(v)}
            series={[
              { id: 'criadas', rotulo: 'Criadas', cor: 'var(--serie-1)', valores: meses.slice(0, ate).map((m) => m.criadas) },
              { id: 'enviadas', rotulo: 'Enviadas', cor: 'var(--serie-2)', valores: meses.slice(0, ate).map((m) => m.enviadas) },
              { id: 'aprovadas', rotulo: 'Aprovadas', cor: 'var(--serie-3)', valores: meses.slice(0, ate).map((m) => m.aprovadas) },
            ]} />
        </Cartao>
        <Cartao>
          <div className="mb-3 font-semibold">Valores por mês</div>
          <Linhas rotulosX={rotulosMes} formatar={moeda} formatarEixo={moedaCurta}
            series={[
              { id: 'enviado', rotulo: 'Enviado', cor: 'var(--serie-2)', valores: meses.slice(0, ate).map((m) => m.valorEnviado) },
              { id: 'aprovado', rotulo: 'Aprovado', cor: 'var(--serie-3)', valores: meses.slice(0, ate).map((m) => m.valorAprovado) },
            ]} />
          <p className="mt-2 text-xs text-suave">Enviado: valor da última revisão enviada, no mês do primeiro envio. Aprovado: valor aprovado, no mês da aprovação.</p>
        </Cartao>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Cartao>
          <div className="mb-4 font-semibold">Propostas por etapa</div>
          {/* A tabela desce para baixo da rosca quando o cartão fica estreito (tela dividida), em vez de vazar. */}
          <div className="flex flex-wrap items-center justify-center gap-6">
            <div className="shrink-0"><Rosca fatias={fatias} total={propostas.length} rotuloTotal="propostas" /></div>
            <div className="min-w-[18rem] max-w-full flex-1 overflow-x-auto">
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
      <Cartao className="mt-4 p-0">
        <div className="flex items-center justify-between px-5 pb-2 pt-5 font-semibold">
          Desempenho por vendedor
          {vendedor && <button type="button" onClick={() => setVendedor('')} className="text-xs font-normal text-roxo-600 hover:underline dark:text-roxo-100">Ver todos</button>}
        </div>
        <div className="overflow-x-auto px-2 pb-3">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase text-suave">
                {['Vendedor', 'Feitas', 'Enviadas', 'Aprovadas', 'Reprovadas', 'Conversão', 'Em negociação', 'Valor enviado', 'Valor aprovado'].map((t, i) => (
                  <th key={t} className={`px-3 pb-1.5 font-medium ${i ? 'text-right' : ''}`}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendedores.map((v) => {
                const max = Math.max(1, ...vendedores.map((x) => x.feitas));
                return (
                  <tr key={v.id} onClick={() => setVendedor(vendedor === v.id ? '' : v.id)} title="Clique para filtrar o painel por este vendedor"
                    className={`cursor-pointer border-t border-borda hover:bg-pagina ${vendedor === v.id ? 'bg-roxo-50 dark:bg-roxo-700/20' : ''}`}>
                    <td className="px-3 py-2 font-medium">{v.nome}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-slate-100 sm:block dark:bg-marinho-700"><span className="block h-full rounded-full" style={{ width: `${(v.feitas / max) * 100}%`, background: 'var(--serie-1)' }} /></span>
                        <span className="w-6 font-semibold tabular-nums">{v.feitas}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{v.enviadas}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{v.aprovadas}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{v.reprovadas}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{v.conversao === null ? '—' : `${v.conversao}%`}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{moeda(v.emNegociacao)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{moeda(v.valorEnviado)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums">{moeda(v.valorAprovado)}</td>
                  </tr>
                );
              })}
              {vendedores.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-suave">Nenhuma proposta em {ano}.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="px-5 pb-4 text-xs text-suave">Conversão = aprovadas ÷ (aprovadas + reprovadas). Clique num vendedor para filtrar o painel inteiro.</p>
      </Cartao>
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
