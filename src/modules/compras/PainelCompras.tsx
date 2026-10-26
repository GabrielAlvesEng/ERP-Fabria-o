import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Plus, Search } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, hojeISO, moeda } from '@/shared/lib/formato';
import { Botao, Cabecalho, Entrada, EsqueletoKanban, Selecao, Selo } from '@/shared/ui';
import { SubAbas } from '@/modules/admin/predefinicoes/comum';
import { listarPedidos, listarPrecosLancados, listarRequisicoes, listarTodosItens, type ItemDoQuadro } from './api';
import { ETAPAS, ROTULO_ORIGEM, etapaDoItem, pedidoAtrasado, type EtapaItem, type Origem } from './regras';
import { NovaRequisicaoModal } from './NovaRequisicaoModal';

const VISOES = ['Por item', 'Por solicitação'] as const;
// "Recebido" mostra só o último mês, para o quadro não crescer sem fim.
const DIAS_RECEBIDO = 30;

// Compras → Painel (decisões 101 e 103): indicadores e o quadro dos itens por etapa
// (à comprar, em cotação, comprado, recebido), mesmo quando a solicitação foi dividida entre fornecedores.
export function PainelCompras() {
  const { pode } = useAuth();
  const navegar = useNavigate();
  const { data: itens = [], isLoading } = useQuery({ queryKey: ['compras', 'quadro'], queryFn: listarTodosItens });
  const { data: precos = [] } = useQuery({ queryKey: ['compras', 'precos-lancados'], queryFn: listarPrecosLancados });
  const { data: reqs = [] } = useQuery({ queryKey: ['compras', 'requisicoes'], queryFn: listarRequisicoes });
  const { data: pedidos = [] } = useQuery({ queryKey: ['compras', 'pedidos'], queryFn: listarPedidos });
  const [visao, setVisao] = useState<(typeof VISOES)[number]>('Por item');
  const [busca, setBusca] = useState('');
  const [projeto, setProjeto] = useState('');
  const [origem, setOrigem] = useState<Origem | ''>('');
  const [nova, setNova] = useState(false);
  const hoje = hojeISO();
  const limiteRecebido = new Date(Date.now() - DIAS_RECEBIDO * 864e5).toISOString();

  const comPreco = useMemo(() => new Set(precos.map((p) => p.item_id)), [precos]);
  const projetos = useMemo(() => [...new Set(reqs.filter((r) => r.projeto_codigo).map((r) => `${r.projeto_codigo}|${r.projeto_titulo}`))].sort().map((x) => x.split('|') as [string, string]), [reqs]);
  const termo = busca.toLowerCase();
  const passa = (r: { codigo: string; titulo: string; projeto_codigo: string; setor: string; origem: Origem }, extra = '') =>
    (!projeto || r.projeto_codigo === projeto) && (!origem || r.origem === origem)
    && (!termo || `${r.codigo} ${r.titulo} ${r.projeto_codigo} ${r.setor} ${extra}`.toLowerCase().includes(termo));

  const porEtapa = useMemo(() => {
    const m: Record<EtapaItem, ItemDoQuadro[]> = { a_comprar: [], em_cotacao: [], comprado: [], recebido: [] };
    for (const i of itens) {
      const e = etapaDoItem(i.status, comPreco.has(i.id));
      if (!e) continue;
      if (e === 'recebido' && i.compras_requisicoes.atualizado_em < limiteRecebido) continue;
      m[e].push(i);
    }
    return m;
  }, [itens, comPreco, limiteRecebido]);

  const abertos = pedidos.filter((p) => p.status === 'aguardando_entrega' || p.status === 'entregue_parcial');
  const atrasados = abertos.filter((p) => pedidoAtrasado(p, hoje));
  const indicadores: [string, string | number, string?][] = [
    ['Itens à comprar', porEtapa.a_comprar.length],
    ['Em cotação', porEtapa.em_cotacao.length],
    ['Comprados aguardando entrega', porEtapa.comprado.length],
    ['Solicitações abertas', reqs.filter((r) => r.status === 'aberta').length],
    ['Ordens atrasadas', atrasados.length, atrasados.length ? 'text-red-600 dark:text-red-300' : ''],
    ['Valor em ordens abertas', moeda(abertos.reduce((s, p) => s + Number(p.valor_total), 0))],
  ];

  return (
    <>
      <Cabecalho titulo="Compras" subtitulo="Solicitações da Engenharia, do Almoxarifado e de Compras, orçamentos, comparação e ordens de compra."
        acoes={pode('compras', 'criar') ? <Botao onClick={() => setNova(true)}><Plus size={15} /> Nova requisição</Botao> : undefined} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {indicadores.map(([rot, val, cor]) => (
          <div key={rot} className="rounded-xl bg-superficie p-4 shadow-sm ring-1 ring-borda">
            <div className="text-xs text-suave">{rot}</div>
            <div className={`mt-1 text-xl font-semibold tabular-nums ${cor || 'text-texto'}`}>{val}</div>
          </div>
        ))}
      </div>
      <SubAbas abas={VISOES} ativa={visao} onTrocar={setVisao} />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-suave" />
          <Entrada value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar item, código, projeto…" className="pl-9" />
        </div>
        <Selecao value={origem} onChange={(e) => setOrigem(e.target.value as Origem | '')} className="w-48">
          <option value="">Todas as origens</option>
          {(Object.keys(ROTULO_ORIGEM) as Origem[]).map((o) => <option key={o} value={o}>{ROTULO_ORIGEM[o]}</option>)}
        </Selecao>
        <Selecao value={projeto} onChange={(e) => setProjeto(e.target.value)} className="w-64">
          <option value="">Todos os projetos</option>
          {projetos.map(([c, t]) => <option key={c} value={c}>{c} · {t}</option>)}
        </Selecao>
      </div>

      {isLoading ? <EsqueletoKanban /> : visao === 'Por item' ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {ETAPAS.map((e) => {
            const lista = porEtapa[e.etapa].filter((i) => passa(i.compras_requisicoes, `${i.descricao} ${i.escolhida?.fornecedores?.nome ?? ''}`));
            return (
              <div key={e.etapa} className="flex min-w-[220px] flex-1 flex-col rounded-xl bg-pagina p-2 ring-1 ring-borda">
                <div className="flex items-center justify-between px-1.5 pb-2 pt-1 text-sm font-semibold">{e.rotulo}<span className="text-xs font-normal text-suave">{lista.length}</span></div>
                <div className="space-y-2">
                  {lista.slice(0, 200).map((i) => {
                    const r = i.compras_requisicoes;
                    const atrasado = e.etapa !== 'recebido' && e.etapa !== 'comprado' && r.necessario_em && r.necessario_em < hoje;
                    return (
                      <Link key={i.id} to={`/compras/requisicoes/${i.requisicao_id}`} className="block rounded-lg bg-superficie p-3 text-sm shadow-sm ring-1 ring-borda transition hover:ring-roxo-300">
                        <div className="flex items-center justify-between gap-2 text-xs text-suave"><span className="font-mono">{r.codigo}</span>{r.prioridade === 'urgente' && <Selo cor="vermelho">Urgente</Selo>}</div>
                        <div className="mt-1 font-medium text-texto">{i.descricao}</div>
                        <div className="mt-0.5 text-xs tabular-nums">{Number(i.quantidade).toLocaleString('pt-BR')} {i.unidade}</div>
                        <div className="mt-1 text-xs text-suave">{r.projeto_codigo ? `Pedido ${r.projeto_codigo}` : r.origem === 'almoxarifado' ? 'Estoque' : r.setor}</div>
                        {i.escolhida?.fornecedores?.nome && <div className="mt-1 text-xs text-roxo-600 dark:text-roxo-100">{i.escolhida.fornecedores.nome}</div>}
                        {r.necessario_em && e.etapa !== 'recebido' && <div className={`mt-1 flex items-center gap-1 text-xs ${atrasado ? 'text-red-600' : 'text-suave'}`}>{atrasado && <AlertTriangle size={12} />}Precisa em {dataBR(r.necessario_em)}</div>}
                      </Link>
                    );
                  })}
                  {lista.length > 200 && <div className="px-2 py-2 text-center text-xs text-suave">E mais {lista.length - 200}. Use a busca.</div>}
                  {lista.length === 0 && <div className="px-2 py-4 text-center text-xs text-suave">Nada aqui.</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <PorSolicitacao reqs={reqs.filter((r) => r.status !== 'cancelada' && passa(r))} itens={itens} pedidos={pedidos} hoje={hoje} />
      )}
      {nova && <NovaRequisicaoModal onFechar={() => setNova(false)} onCriada={(id) => { setNova(false); navegar(`/compras/requisicoes/${id}`); }} />}
    </>
  );
}

function PorSolicitacao({ reqs, itens, pedidos, hoje }: {
  reqs: Awaited<ReturnType<typeof listarRequisicoes>>; itens: ItemDoQuadro[]; pedidos: Awaited<ReturnType<typeof listarPedidos>>; hoje: string;
}) {
  const [concluidas, setConcluidas] = useState(false);
  const lista = reqs.filter((r) => concluidas || r.status === 'aberta');
  return (
    <>
      <label className="mb-2 flex items-center gap-2 text-xs text-suave"><input type="checkbox" checked={concluidas} onChange={(e) => setConcluidas(e.target.checked)} /> Mostrar concluídas</label>
      <div className="overflow-x-auto rounded-xl ring-1 ring-borda">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-pagina text-left text-xs text-suave"><tr>
            <th className="px-3 py-2">Solicitação</th><th className="px-3 py-2">Origem</th><th className="px-3 py-2">Para</th><th className="px-3 py-2">Precisa em</th>
            <th className="px-3 py-2">Itens</th><th className="px-3 py-2">Ordens</th>
          </tr></thead>
          <tbody className="divide-y divide-borda">
            {lista.map((r) => {
              const its = itens.filter((i) => i.requisicao_id === r.id);
              const n = (s: string) => its.filter((i) => i.status === s).length;
              const ocs = pedidos.filter((p) => p.requisicao_id === r.id && p.status !== 'cancelada');
              return (
                <tr key={r.id} className="hover:bg-pagina">
                  <td className="px-3 py-2"><Link to={`/compras/requisicoes/${r.id}`} className="font-medium text-roxo-600 hover:underline dark:text-roxo-100">{r.titulo}</Link><span className="block font-mono text-xs text-suave">{r.codigo}</span></td>
                  <td className="px-3 py-2">{ROTULO_ORIGEM[r.origem]}</td>
                  <td className="px-3 py-2">{r.projeto_codigo ? `${r.projeto_codigo} · ${r.projeto_titulo}` : r.origem === 'almoxarifado' ? 'Estoque' : r.setor}</td>
                  <td className={`px-3 py-2 ${r.status === 'aberta' && r.necessario_em && r.necessario_em < hoje ? 'text-red-600' : ''}`}>{dataBR(r.necessario_em)}</td>
                  <td className="px-3 py-2 text-xs">{its.length} · {n('a_comprar')} à comprar · {n('comprado')} comprado(s) · {n('recebido')} recebido(s)</td>
                  <td className="px-3 py-2 font-mono text-xs">{ocs.map((p) => p.codigo).join(', ') || '—'}</td>
                </tr>
              );
            })}
            {lista.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-suave">Nenhuma solicitação aberta.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
