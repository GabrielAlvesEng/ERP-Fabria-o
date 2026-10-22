import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Plus, Search } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, hojeISO, moeda } from '@/shared/lib/formato';
import { Botao, Cabecalho, Entrada, EsqueletoKanban, Selecao, Selo } from '@/shared/ui';
import { listarPedidos, listarRequisicoes, type Requisicao } from './api';
import { ETAPAS, pedidoAtrasado } from './regras';
import { NovaRequisicaoModal } from './NovaRequisicaoModal';

// Compras → Painel (decisão 101): indicadores e o quadro das requisições por etapa.
export function PainelCompras() {
  const { pode } = useAuth();
  const navegar = useNavigate();
  const { data: reqs = [], isLoading } = useQuery({ queryKey: ['compras', 'requisicoes'], queryFn: listarRequisicoes });
  const { data: pedidos = [] } = useQuery({ queryKey: ['compras', 'pedidos'], queryFn: listarPedidos });
  const [busca, setBusca] = useState('');
  const [projeto, setProjeto] = useState('');
  const [nova, setNova] = useState(false);
  const hoje = hojeISO();

  const projetos = useMemo(() => [...new Map(reqs.filter((r) => r.projeto_codigo).map((r) => [r.projeto_codigo, r.projeto_titulo])).entries()].sort(), [reqs]);
  const filtradas = reqs.filter((r) => (!projeto || r.projeto_codigo === projeto)
    && (!busca || `${r.codigo} ${r.titulo} ${r.projeto_codigo} ${r.projeto_titulo} ${r.setor}`.toLowerCase().includes(busca.toLowerCase())));
  const pedidoDe = new Map(pedidos.map((p) => [p.requisicao_id, p]));
  const abertos = pedidos.filter((p) => p.status !== 'entregue');
  const atrasados = abertos.filter((p) => pedidoAtrasado(p, hoje));
  const conta = (s: Requisicao['status']) => reqs.filter((r) => r.status === s).length;

  const indicadores: [string, string | number, string?][] = [
    ['Abertas', conta('aberta')],
    ['Em cotação', conta('em_cotacao')],
    ['Aguardando aprovação', conta('aguardando_aprovacao'), conta('aguardando_aprovacao') ? 'text-amber-600 dark:text-amber-300' : ''],
    ['Pedidos em aberto', abertos.length],
    ['Pedidos atrasados', atrasados.length, atrasados.length ? 'text-red-600 dark:text-red-300' : ''],
    ['Valor em pedidos abertos', moeda(abertos.reduce((s, p) => s + Number(p.valor_total), 0))],
  ];

  return (
    <>
      <Cabecalho titulo="Compras" subtitulo="Requisições, cotações, aprovação do Financeiro e ordens de compra."
        acoes={pode('compras', 'criar') ? <Botao onClick={() => setNova(true)}><Plus size={15} /> Nova requisição</Botao> : undefined} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {indicadores.map(([rot, val, cor]) => (
          <div key={rot} className="rounded-xl bg-superficie p-4 shadow-sm ring-1 ring-borda">
            <div className="text-xs text-suave">{rot}</div>
            <div className={`mt-1 text-xl font-semibold tabular-nums ${cor || 'text-texto'}`}>{val}</div>
          </div>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-suave" />
          <Entrada value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar código, título, projeto…" className="pl-9" />
        </div>
        <Selecao value={projeto} onChange={(e) => setProjeto(e.target.value)} className="w-64">
          <option value="">Todos os projetos</option>
          {projetos.map(([c, t]) => <option key={c} value={c}>{c} · {t}</option>)}
        </Selecao>
      </div>
      {isLoading ? <EsqueletoKanban /> : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {ETAPAS.map((e) => {
            const lista = filtradas.filter((r) => r.status === e.status);
            return (
              <div key={e.status} className="flex min-w-[200px] flex-1 flex-col rounded-xl bg-pagina p-2 ring-1 ring-borda">
                <div className="flex items-center justify-between px-1.5 pb-2 pt-1 text-sm font-semibold">{e.rotulo}<span className="text-xs font-normal text-suave">{lista.length}</span></div>
                <div className="space-y-2">
                  {lista.map((r) => {
                    const p = pedidoDe.get(r.id);
                    const atrasado = p && pedidoAtrasado(p, hoje);
                    return (
                      <Link key={r.id} to={`/compras/requisicoes/${r.id}`} className="block rounded-lg bg-superficie p-3 text-sm shadow-sm ring-1 ring-borda transition hover:ring-roxo-300">
                        <div className="flex items-center justify-between gap-2 text-xs text-suave"><span className="font-mono">{r.codigo}</span>{r.prioridade === 'urgente' && <Selo cor="vermelho">Urgente</Selo>}</div>
                        <div className="mt-1 font-medium text-texto">{r.titulo}</div>
                        <div className="mt-1 text-xs text-suave">{r.projeto_codigo ? `${r.projeto_codigo} · ${r.projeto_titulo}` : r.setor}</div>
                        {r.necessario_em && <div className={`mt-1 text-xs ${r.necessario_em < hoje && !['entregue', 'pedido_emitido'].includes(r.status) ? 'text-red-600' : 'text-suave'}`}>Precisa em {dataBR(r.necessario_em)}</div>}
                        {p && <div className="mt-2 flex items-center justify-between gap-2 text-xs"><span className="font-mono text-suave">{p.codigo}</span><span className="font-semibold tabular-nums">{moeda(p.valor_total)}</span></div>}
                        {atrasado && <div className="mt-1 flex items-center gap-1 text-xs text-red-600"><AlertTriangle size={12} /> Entrega atrasada ({dataBR(p.previsao_entrega)})</div>}
                      </Link>
                    );
                  })}
                  {lista.length === 0 && <div className="px-2 py-4 text-center text-xs text-suave">Nada aqui.</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {reqs.some((r) => r.status === 'cancelada') && (
        <p className="mt-3 text-xs text-suave">{reqs.filter((r) => r.status === 'cancelada').length} requisição(ões) cancelada(s) não aparecem no quadro.</p>
      )}
      {nova && <NovaRequisicaoModal onFechar={() => setNova(false)} onCriada={(id) => { setNova(false); navegar(`/compras/requisicoes/${id}`); }} />}
    </>
  );
}
