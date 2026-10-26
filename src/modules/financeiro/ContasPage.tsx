import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Columns3, List, Search } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, hojeISO, moeda } from '@/shared/lib/formato';
import { Cabecalho, Entrada, EsqueletoKanban, Selecao, Vazio } from '@/shared/ui';
import { listarContas, type Conta } from './api';
import { COLUNAS, colunaConta, emAberto, prazoConta, proximaParcela, saldo, textoCondicao, type Coluna } from './regras';
import { PagamentoModal, SeloPrazo } from './componentes';

type Filtro = 'abertas' | Coluna | 'canceladas' | 'todas';
const FILTROS: [Filtro, string][] = [
  ['abertas', 'Em aberto'], ['vencida', 'Vencidas'], ['em_breve', 'Vencem em breve'], ['a_pagar', 'A pagar'],
  ['definir', 'Definir vencimento'], ['aguardando_entrega', 'Aguardando entrega'], ['paga', 'Pagas'], ['canceladas', 'Canceladas'], ['todas', 'Todas'],
];
const LER_VISAO = () => { try { return localStorage.getItem('fin_visao') === 'lista' ? 'lista' : 'quadro'; } catch { return 'quadro'; } };

// Financeiro → Contas a pagar (decisão 105): quadro por prazo (as colunas mudam sozinhas pela data) e lista com filtros.
// Arrastar um cartão para "Paga" abre o registro do pagamento.
export function ContasPage() {
  const { pode } = useAuth();
  const { data: contas = [], isLoading } = useQuery({ queryKey: ['financeiro', 'contas'], queryFn: listarContas });
  const [params, setParams] = useSearchParams();
  const filtro = (params.get('filtro') as Filtro) || 'abertas';
  const [visao, setVisao] = useState<'quadro' | 'lista'>(LER_VISAO);
  const [busca, setBusca] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [projeto, setProjeto] = useState('');
  const [pagar, setPagar] = useState<Conta | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const hoje = hojeISO();
  const editar = pode('financeiro', 'editar');

  function mudarVisao(v: 'quadro' | 'lista') {
    setVisao(v);
    try { localStorage.setItem('fin_visao', v); } catch { /* sem armazenamento: só nesta tela */ }
  }

  const fornecedores = useMemo(() => [...new Set(contas.map((c) => c.fornecedor_nome).filter(Boolean))].sort(), [contas]);
  const projetos = useMemo(() => [...new Map(contas.filter((c) => c.projeto_codigo).map((c) => [c.projeto_codigo, c.projeto_titulo])).entries()].sort(), [contas]);
  const base = contas.filter((c) => (!fornecedor || c.fornecedor_nome === fornecedor) && (!projeto || c.projeto_codigo === projeto)
    && (!busca || `${c.pedido_codigo} ${c.fornecedor_nome} ${c.descricao} ${c.projeto_codigo} ${c.projeto_titulo}`.toLowerCase().includes(busca.toLowerCase())));
  const coluna = (c: Conta) => colunaConta(c, c.fin_parcelas, hoje);
  const lista = base.filter((c) => filtro === 'todas' || (filtro === 'canceladas' ? c.status === 'cancelada'
    : filtro === 'abertas' ? c.status === 'aberta' : coluna(c) === filtro))
    .sort((a, b) => (proximaParcela(a.fin_parcelas)?.vencimento ?? '9999').localeCompare(proximaParcela(b.fin_parcelas)?.vencimento ?? '9999'));

  const emAbertoConta = (c: Conta) => emAberto(c.fin_parcelas).reduce((s, p) => s + saldo(p), 0);

  return (
    <>
      <Cabecalho titulo="Contas a pagar" subtitulo="Cada ordem de compra emitida vira uma conta, com o orçamento do fornecedor anexado."
        acoes={<div className="inline-flex rounded-lg ring-1 ring-borda">
          <button onClick={() => mudarVisao('quadro')} className={`inline-flex items-center gap-1.5 rounded-l-lg px-3 py-1.5 text-sm ${visao === 'quadro' ? 'bg-roxo-50 font-medium text-roxo-700 dark:bg-roxo-500/20 dark:text-roxo-100' : 'text-suave'}`}><Columns3 size={15} /> Quadro</button>
          <button onClick={() => mudarVisao('lista')} className={`inline-flex items-center gap-1.5 rounded-r-lg px-3 py-1.5 text-sm ${visao === 'lista' ? 'bg-roxo-50 font-medium text-roxo-700 dark:bg-roxo-500/20 dark:text-roxo-100' : 'text-suave'}`}><List size={15} /> Lista</button>
        </div>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-suave" />
          <Entrada value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar OC, fornecedor, projeto…" className="pl-9" />
        </div>
        {visao === 'lista' && (
          <Selecao value={filtro} onChange={(e) => setParams(e.target.value === 'abertas' ? {} : { filtro: e.target.value })} className="w-52">
            {FILTROS.map(([f, r]) => <option key={f} value={f}>{r}</option>)}
          </Selecao>
        )}
        <Selecao value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} className="w-56">
          <option value="">Todos os fornecedores</option>
          {fornecedores.map((f) => <option key={f} value={f}>{f}</option>)}
        </Selecao>
        <Selecao value={projeto} onChange={(e) => setProjeto(e.target.value)} className="w-56">
          <option value="">Todos os projetos</option>
          {projetos.map(([c, t]) => <option key={c} value={c}>{c} · {t}</option>)}
        </Selecao>
      </div>

      {isLoading ? <EsqueletoKanban /> : visao === 'quadro' ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {COLUNAS.map((col) => {
            const doQuadro = base.filter((c) => coluna(c) === col.id);
            const pagas = col.id === 'paga';
            // Pagas: só as do mês, para o quadro não crescer sem fim (as outras ficam na lista).
            const itens = pagas ? doQuadro.filter((c) => c.fin_parcelas.some((p) => p.ativa && p.pago_em?.slice(0, 7) === hoje.slice(0, 7))) : doQuadro;
            const alvo = pagas && arrastando && editar;
            return (
              <div key={col.id}
                onDragOver={(e) => { if (pagas && arrastando) e.preventDefault(); }}
                onDrop={() => { const c = contas.find((x) => x.id === arrastando); setArrastando(null); if (pagas && c && editar) setPagar(c); }}
                className={`flex min-w-[210px] flex-1 flex-col rounded-xl p-2 ring-1 transition ${alvo ? 'bg-petroleo-50 ring-petroleo-500 dark:bg-petroleo-600/20' : 'bg-pagina ring-borda'}`}>
                <div className="flex items-center justify-between px-1.5 pb-2 pt-1 text-sm font-semibold">{col.rotulo}<span className="text-xs font-normal text-suave">{itens.length}</span></div>
                {!pagas && itens.length > 0 && <div className="px-1.5 pb-2 text-xs tabular-nums text-suave">{moeda(itens.reduce((s, c) => s + emAbertoConta(c), 0))}</div>}
                {pagas && <div className="px-1.5 pb-2 text-xs text-suave">Pagas neste mês</div>}
                <div className="space-y-2">
                  {itens.map((c) => <CartaoConta key={c.id} conta={c} hoje={hoje} arrastavel={editar && !pagas} onArrastar={setArrastando} />)}
                  {itens.length === 0 && <div className="px-2 py-4 text-center text-xs text-suave">{alvo ? 'Solte aqui para pagar' : 'Nada aqui.'}</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : lista.length === 0 ? <Vazio>Nenhuma conta aqui.</Vazio> : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-borda">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-pagina text-left text-xs text-suave"><tr>
              <th className="px-3 py-2">Ordem</th><th className="px-3 py-2">Fornecedor</th><th className="px-3 py-2">Projeto</th><th className="px-3 py-2">Condição</th>
              <th className="px-3 py-2">Próximo vencimento</th><th className="px-3 py-2 text-right">Em aberto</th><th className="px-3 py-2 text-right">Total</th>
            </tr></thead>
            <tbody className="divide-y divide-borda">
              {lista.map((c) => {
                const p = proximaParcela(c.fin_parcelas);
                return (
                  <tr key={c.id} className="hover:bg-pagina">
                    <td className="px-3 py-2"><Link to={`/financeiro/contas/${c.id}`} className="font-mono font-medium text-roxo-600 hover:underline dark:text-roxo-100">{c.pedido_codigo || 'Conta'}</Link></td>
                    <td className="px-3 py-2">{c.fornecedor_nome}</td>
                    <td className="px-3 py-2">{c.projeto_codigo ? <>{c.projeto_codigo}<span className="block text-xs text-suave">{c.projeto_titulo}</span></> : <span className="text-suave">—</span>}</td>
                    <td className="px-3 py-2 text-xs">{textoCondicao(c.condicao_tipo, c.condicao_dias)}</td>
                    <td className="px-3 py-2">{c.status === 'cancelada' ? <span className="text-xs text-suave">Cancelada</span> : <SeloPrazo prazo={prazoConta(c, c.fin_parcelas, hoje)} data={p?.vencimento} />}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.status === 'aberta' ? moeda(emAbertoConta(c)) : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{moeda(c.valor_total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pagar && <PagamentoModal conta={pagar} onFechar={() => setPagar(null)} />}
    </>
  );
}

function CartaoConta({ conta: c, hoje, arrastavel, onArrastar }: { conta: Conta; hoje: string; arrastavel: boolean; onArrastar: (id: string | null) => void }) {
  const p = proximaParcela(c.fin_parcelas);
  const prazo = prazoConta(c, c.fin_parcelas, hoje);
  const n = c.fin_parcelas.filter((x) => x.ativa).length;
  return (
    <Link to={`/financeiro/contas/${c.id}`} draggable={arrastavel}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onArrastar(c.id); }} onDragEnd={() => onArrastar(null)}
      className="block rounded-lg bg-superficie p-3 text-sm shadow-sm ring-1 ring-borda transition hover:ring-roxo-300">
      <div className="flex items-center justify-between gap-2 text-xs text-suave"><span className="font-mono">{c.pedido_codigo}</span>{n > 1 && p && <span>parcela {p.numero}/{n}</span>}</div>
      <div className="mt-1 font-medium text-texto">{c.fornecedor_nome}</div>
      {c.projeto_codigo && <div className="mt-0.5 truncate text-xs text-suave">{c.projeto_codigo} · {c.projeto_titulo}</div>}
      <div className="mt-2 font-semibold tabular-nums">{moeda(prazo === 'paga' ? c.valor_total : p ? saldo(p) : 0)}</div>
      <div className="mt-1"><SeloPrazo prazo={prazo} data={p?.vencimento} /></div>
      {prazo === 'sem_data' && c.condicao_tipo === 'apos_recebimento' && !c.entregue_em && <div className="mt-1 text-xs text-suave">Vence {c.condicao_dias.join('/')} dias depois da entrega</div>}
      {prazo === 'paga' && p == null && <div className="mt-1 text-xs text-suave">Paga em {dataBR(c.fin_parcelas.filter((x) => x.ativa).map((x) => x.pago_em ?? '').sort().at(-1))}</div>}
    </Link>
  );
}
