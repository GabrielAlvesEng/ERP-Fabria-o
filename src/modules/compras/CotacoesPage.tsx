import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, FileDown, Paperclip, Pencil, Plus, Send, Trash2, Undo2 } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, mensagemErro, moeda } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Cabecalho, Campo, CampoData, Entrada, EsqueletoDetalhe, EsqueletoTabela, Modal, Selecao, Selo, Vazio } from '@/shared/ui';
import {
  anexarOrcamento, abrirArquivo, atualizarPacote, cancelarPacote, cancelarPedido, gerarPedidoPacote, itensDoPacote, listarCotacoes, listarEventos,
  listarFornecedores, listarPacotes, obterPacote, pedidosDoPacote, removerCotacao, retirarDoPacote, salvarCotacao, salvarPreco,
  type Cotacao, type Fornecedor, type ItemComSolicitacao, type Pedido,
} from './api';
import { ROTULO_ITEM, ROTULO_PACOTE, descreverCondicao, melhorCotacao, menoresPrecos, rotuloDestino, totalCotacao, type StatusPacote } from './regras';
import { COR_ITEM, CotacaoModal, Historico, Justificar, OrdemCartao, PrecoCelula, Secao, type Cor } from './comum';
import { imprimirPedidoCotacao } from './ordemPdf';

const COR_PACOTE: Record<StatusPacote, Cor> = { aberto: 'azul', comprado: 'verde', cancelado: 'vermelho' };
const precosDe = (c: Cotacao) => ({ id: c.id, frete: Number(c.frete), precos: Object.fromEntries(c.compras_cotacao_precos.map((p) => [p.item_id, Number(p.valor_unit)])) });

// Compras → Cotações (decisão 111): os pacotes de cotação. Cada pacote é um conjunto de itens que o comprador quer comprar
// de um único fornecedor.
export function CotacoesPage() {
  const { data: pacotes = [], isLoading } = useQuery({ queryKey: ['compras', 'pacotes'], queryFn: listarPacotes });
  const [filtro, setFiltro] = useState<StatusPacote | 'todos'>('aberto');
  const lista = pacotes.filter((p) => filtro === 'todos' || p.status === filtro);
  return (
    <>
      <Cabecalho titulo="Cotações" subtitulo="Pacotes de itens para cotar com os fornecedores. Gere o PDF, lance os orçamentos, compare e gere a ordem de compra do fornecedor escolhido."
        acoes={<Selecao value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)} className="w-44">
          <option value="aberto">Em cotação</option><option value="comprado">Comprados</option><option value="cancelado">Cancelados</option><option value="todos">Todos</option>
        </Selecao>} />
      {isLoading ? <EsqueletoTabela /> : lista.length === 0 ? (
        <Vazio>{filtro === 'aberto' ? <>Nenhum pacote em cotação. Selecione os itens em <Link to="/compras" className="text-roxo-600 hover:underline dark:text-roxo-100">À comprar</Link> e crie um pacote.</> : 'Nenhum pacote aqui.'}</Vazio>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((p) => {
            const itens = p.compras_requisicao_itens.filter((i) => i.status !== 'cancelado');
            const ocs = p.compras_pedidos.filter((o) => o.status !== 'cancelada');
            return (
              <Link key={p.id} to={`/compras/cotacoes/${p.id}`} className="block rounded-xl bg-superficie p-4 shadow-sm ring-1 ring-borda transition hover:ring-roxo-300">
                <div className="flex items-center justify-between gap-2 text-xs text-suave"><span className="font-mono">{p.codigo}</span><Selo cor={COR_PACOTE[p.status]}>{ROTULO_PACOTE[p.status]}</Selo></div>
                <div className="mt-1 font-semibold text-texto">{p.titulo}</div>
                <div className="mt-2 text-xs text-suave">
                  {itens.length} item(ns) · {p.compras_cotacoes.length} orçamento(s){ocs.length > 0 && ` · ${ocs.map((o) => `${o.codigo} ${moeda(o.valor_total)}`).join(', ')}`}
                </div>
                <div className="mt-1 text-xs text-suave">Criado em {dataBR(p.criado_em)}{p.criador?.nome && ` por ${p.criador.nome}`}</div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

// Um pacote: itens, pedido de cotação em PDF, orçamentos dos fornecedores, comparação e a ordem de compra.
export function PacotePage() {
  const { id = '' } = useParams();
  const { pode } = useAuth();
  const qc = useQueryClient();
  const { data: pacote, isLoading, error } = useQuery({ queryKey: ['compras', 'pacote', id], queryFn: () => obterPacote(id) });
  const { data: itens = [] } = useQuery({ queryKey: ['compras', 'pacote-itens', id], queryFn: () => itensDoPacote(id) });
  const { data: cotacoes = [] } = useQuery({ queryKey: ['compras', 'cotacoes', id], queryFn: () => listarCotacoes(id) });
  const { data: pedidos = [] } = useQuery({ queryKey: ['compras', 'pedidos', 'pacote', id], queryFn: () => pedidosDoPacote(id) });
  const { data: eventos = [] } = useQuery({ queryKey: ['compras', 'eventos', 'pacote', id], queryFn: () => listarEventos({ pacote: id }) });
  const { data: fornecedores = [] } = useQuery({ queryKey: ['compras', 'fornecedores'], queryFn: listarFornecedores });
  const [erro, setErro] = useState('');
  const [modal, setModal] = useState<null | 'cancelar' | 'pdf' | { cotacao: Cotacao | null } | { gerar: Cotacao } | { cancelarOc: Pedido }>(null);

  async function agir(f: () => Promise<unknown>) {
    setErro('');
    try { await f(); await qc.invalidateQueries({ queryKey: ['compras'] }); return true; } catch (e) { setErro(mensagemErro(e)); return false; }
  }

  if (isLoading) return <EsqueletoDetalhe />;
  if (error || !pacote) return <Aviso>{error ? mensagemErro(error) : 'Pacote não encontrado.'}</Aviso>;

  const aberto = pacote.status === 'aberto';
  const podeCotar = aberto && pode('compras', 'editar');
  const ativos = itens.filter((i) => i.status !== 'cancelado');
  const aComprar = itens.filter((i) => i.status === 'a_comprar');
  const comparar = aberto ? aComprar : ativos;
  // Padrão do pagamento (decisão 107): a combinar quando o pacote é só de itens do Almoxarifado; senão, antecipado.
  const origem = ativos.length > 0 && ativos.every((i) => i.compras_requisicoes.origem === 'almoxarifado') ? 'almoxarifado' : 'engenharia';

  return (
    <div className="space-y-5">
      <div>
        <Link to="/compras/cotacoes" className="mb-2 inline-flex items-center gap-1 text-sm text-suave hover:text-texto"><ArrowLeft size={15} /> Cotações</Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-sm text-suave">
              <span className="font-mono">{pacote.codigo}</span><Selo cor={COR_PACOTE[pacote.status]}>{ROTULO_PACOTE[pacote.status]}</Selo>
              <span>criado em {dataBR(pacote.criado_em)}{pacote.criador?.nome && ` por ${pacote.criador.nome}`}</span>
            </div>
            {podeCotar ? (
              <input defaultValue={pacote.titulo} key={pacote.titulo} aria-label="Nome do pacote"
                onBlur={(e) => e.target.value.trim().length >= 2 && e.target.value.trim() !== pacote.titulo && agir(() => atualizarPacote(pacote.id, { titulo: e.target.value.trim() }))}
                className="mt-1 w-full max-w-xl rounded-md border border-transparent bg-transparent px-1 text-2xl font-semibold tracking-tight outline-none hover:border-slate-300 focus:border-roxo-500 dark:hover:border-marinho-500" />
            ) : <h1 className="mt-1 text-2xl font-semibold tracking-tight">{pacote.titulo}</h1>}
          </div>
          <div className="flex flex-wrap gap-2">
            {ativos.length > 0 && <Botao variante="secundario" onClick={() => setModal('pdf')}><FileDown size={15} /> PDF para o fornecedor</Botao>}
            {podeCotar && <Botao variante="secundario" onClick={() => setModal('cancelar')}><Ban size={15} /> Cancelar pacote</Botao>}
          </div>
        </div>
      </div>
      {erro && <Aviso>{erro}</Aviso>}

      {podeCotar ? (
        <Campo rotulo="Observações para os fornecedores (vão no PDF)">
          <AreaTexto rows={2} defaultValue={pacote.observacoes} key={pacote.observacoes} onBlur={(e) => e.target.value !== pacote.observacoes && agir(() => atualizarPacote(pacote.id, { observacoes: e.target.value }))} />
        </Campo>
      ) : pacote.observacoes && <p className="whitespace-pre-wrap text-sm text-suave">{pacote.observacoes}</p>}

      <Secao titulo={`Itens (${ativos.length})`} acoes={podeCotar && <Link to="/compras"><Botao tamanho="sm" variante="secundario"><Plus size={14} /> Adicionar itens do À comprar</Botao></Link>}>
        {itens.length === 0 ? <Vazio>Nenhum item neste pacote.</Vazio> : <ItensPacote itens={itens} podeCotar={podeCotar} retirar={(i) => agir(() => retirarDoPacote(pacote.id, [i.id]))} />}
      </Secao>

      <Secao titulo={`Orçamentos e comparação (${cotacoes.length})`} acoes={podeCotar && aComprar.length > 0 && (
        <Botao tamanho="sm" variante="secundario" onClick={() => setModal({ cotacao: null })}><Plus size={14} /> Orçamento de fornecedor</Botao>
      )}>
        {cotacoes.length === 0 ? (
          <Vazio>{aberto ? 'Gere o PDF, mande aos fornecedores e lance aqui o orçamento de cada um para comparar.' : 'Nenhum orçamento lançado.'}</Vazio>
        ) : comparar.length === 0 ? <Vazio>Nenhum item à comprar neste pacote.</Vazio> : (
          <Comparacao itens={comparar} cotacoes={cotacoes} podeCotar={podeCotar} agir={agir} pedidos={pedidos}
            editar={(c) => setModal({ cotacao: c })} gerar={(c) => setModal({ gerar: c })}
            pdf={(c) => imprimirPedidoCotacao(pacote, ativos, fornecedores.find((f) => f.id === c.fornecedor_id))} />
        )}
      </Secao>

      {pedidos.length > 0 && (
        <Secao titulo={`Ordens de compra (${pedidos.length})`}>
          <div className="space-y-3">
            {pedidos.map((p) => (
              <OrdemCartao key={p.id} p={p} fornecedor={fornecedores.find((f) => f.id === p.fornecedor_id)} podeEditar={pode('compras', 'editar')} agir={agir}
                cancelar={() => setModal({ cancelarOc: p })} />
            ))}
          </div>
        </Secao>
      )}

      <Secao titulo="Histórico"><Historico eventos={eventos} /></Secao>

      {modal === 'pdf' && <EscolherFornecedorPdf fornecedores={fornecedores} cotacoes={cotacoes} onFechar={() => setModal(null)} onGerar={(f) => { imprimirPedidoCotacao(pacote, ativos, f); setModal(null); }} />}
      {modal === 'cancelar' && <Justificar titulo={`Cancelar ${pacote.codigo}`} rotulo="Motivo (os itens voltam para À comprar)" botao="Cancelar pacote" onFechar={() => setModal(null)} onConfirmar={(t) => agir(() => cancelarPacote(pacote.id, t))} />}
      {modal && typeof modal === 'object' && 'cancelarOc' in modal && (
        <Justificar titulo={`Cancelar ${modal.cancelarOc.codigo}`} rotulo="Motivo (os itens voltam para À comprar e o Financeiro é avisado)" botao="Cancelar ordem de compra"
          onFechar={() => setModal(null)} onConfirmar={(t) => agir(() => cancelarPedido(modal.cancelarOc.id, t))} />
      )}
      {modal && typeof modal === 'object' && 'cotacao' in modal && (
        <CotacaoModal cotacao={modal.cotacao} origem={origem} fornecedores={fornecedores.filter((f) => f.ativo && (f.id === modal.cotacao?.fornecedor_id || !cotacoes.some((c) => c.fornecedor_id === f.id)))}
          onFechar={() => setModal(null)}
          onSalvar={(d, arquivo) => agir(async () => { const cid = await salvarCotacao(pacote.id, modal.cotacao?.id ?? null, d); if (arquivo) await anexarOrcamento(cid, arquivo); })} />
      )}
      {modal && typeof modal === 'object' && 'gerar' in modal && (
        <GerarOrdem cotacao={modal.gerar} itens={aComprar} onFechar={() => setModal(null)}
          onConfirmar={(previsao, obs) => agir(() => gerarPedidoPacote(pacote.id, modal.gerar.id, previsao, obs))} />
      )}
    </div>
  );
}

function ItensPacote({ itens, podeCotar, retirar }: { itens: ItemComSolicitacao[]; podeCotar: boolean; retirar: (i: ItemComSolicitacao) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="text-left text-xs text-suave"><tr>
          <th className="px-2 py-2">Produto</th><th className="w-28 px-2 py-2">Categoria</th><th className="w-28 px-2 py-2 text-right">Quantidade</th>
          <th className="w-36 px-2 py-2">Para</th><th className="w-32 px-2 py-2">Solicitação</th><th className="w-28 px-2 py-2">Situação</th><th className="w-8" />
        </tr></thead>
        <tbody className="divide-y divide-borda">
          {itens.map((i) => (
            <tr key={i.id} className={i.status === 'cancelado' ? 'opacity-50' : ''}>
              <td className="px-2 py-1.5">{i.descricao}{!i.bib_id && <span className="block text-[11px] text-amber-600">sem cadastro de produto</span>}{i.observacoes && <span className="block text-[11px] text-suave">{i.observacoes}</span>}</td>
              <td className="px-2 py-1.5 text-xs">{i.grupo}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{Number(i.quantidade).toLocaleString('pt-BR')} {i.unidade}</td>
              <td className="px-2 py-1.5 text-xs">{rotuloDestino(i.compras_requisicoes)}</td>
              <td className="px-2 py-1.5 text-xs"><Link to={`/compras/requisicoes/${i.requisicao_id}`} className="font-mono text-roxo-600 hover:underline dark:text-roxo-100">{i.compras_requisicoes.codigo}</Link></td>
              <td className="px-2 py-1.5"><Selo cor={COR_ITEM[i.status]}>{i.status === 'a_comprar' ? 'Em cotação' : ROTULO_ITEM[i.status]}</Selo></td>
              <td>{podeCotar && i.status === 'a_comprar' && (
                <button type="button" title="Tirar do pacote (volta para À comprar)" onClick={() => retirar(i)} className="rounded p-1 text-suave hover:bg-pagina hover:text-texto"><Undo2 size={14} /></button>
              )}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Comparação item × fornecedor: menor preço por item em verde, menor total (com todos os itens) destacado. O comprador
// escolhe UM fornecedor para o pacote e gera a ordem de compra dele.
function Comparacao({ itens, cotacoes, podeCotar, agir, pedidos, editar, gerar, pdf }: {
  itens: ItemComSolicitacao[]; cotacoes: Cotacao[]; podeCotar: boolean; agir: (f: () => Promise<unknown>) => Promise<boolean>; pedidos: Pedido[];
  editar: (c: Cotacao) => void; gerar: (c: Cotacao) => void; pdf: (c: Cotacao) => void;
}) {
  const cs = cotacoes.map(precosDe);
  const its = itens.map((i) => ({ id: i.id, quantidade: Number(i.quantidade) }));
  const menores = menoresPrecos(cs, its);
  const melhor = cotacoes.length > 1 ? melhorCotacao(cs, its) : null;
  const comprouDe = new Set(pedidos.filter((p) => p.status !== 'cancelada').map((p) => p.cotacao_id));
  const linhas: [string, (c: Cotacao, n: number) => ReactNode][] = [
    ['Itens', (_c, n) => { const t = totalCotacao(cs[n], its); return <>{moeda(t.itens)}{t.faltam > 0 && <span className="block text-[11px] text-amber-600">sem preço em {t.faltam}</span>}</>; }],
    ['Frete', (c) => moeda(c.frete)],
    ['Total', (_c, n) => <b>{moeda(totalCotacao(cs[n], its).total)}</b>],
    ['Prazo', (c) => (c.prazo_dias != null ? `${c.prazo_dias} dia(s)` : '—')],
    ['Pagamento', (c) => <>{descreverCondicao(c.condicao_tipo, c.condicao_dias ?? [])}{c.condicao_pagamento && <span className="block text-[11px] text-suave">{c.condicao_pagamento}</span>}</>],
    ['Validade', (c) => dataBR(c.validade)],
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth: 320 + cotacoes.length * 180 }}>
        <thead>
          <tr className="align-bottom text-left text-xs text-suave">
            <th className="px-2 py-2">Item</th>
            {cotacoes.map((c) => (
              <th key={c.id} className={`w-[180px] px-2 py-2 ${melhor === c.id ? 'bg-petroleo-50 dark:bg-petroleo-600/20' : ''}`}>
                <div className="flex items-start justify-between gap-1">
                  <span className="text-sm font-semibold text-texto">{c.fornecedores?.nome}{melhor === c.id && <span className="block text-[11px] font-normal text-petroleo-600 dark:text-petroleo-100">menor total</span>}</span>
                  <span className="flex shrink-0">
                    <button type="button" title="PDF do pedido de cotação para este fornecedor" onClick={() => pdf(c)} className="rounded p-0.5 hover:text-texto"><FileDown size={13} /></button>
                    {c.orcamento_caminho && <button type="button" title="Abrir o orçamento anexado" onClick={() => agir(() => abrirArquivo(c.orcamento_caminho!))} className="rounded p-0.5 hover:text-texto"><Paperclip size={13} /></button>}
                    {podeCotar && <>
                      <button type="button" title="Editar orçamento" onClick={() => editar(c)} className="rounded p-0.5 hover:text-texto"><Pencil size={13} /></button>
                      <button type="button" title="Remover orçamento" onClick={() => confirm(`Remover o orçamento de ${c.fornecedores?.nome}?`) && agir(() => removerCotacao(c.id))} className="rounded p-0.5 hover:text-red-600"><Trash2 size={13} /></button>
                    </>}
                  </span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-borda">
          {itens.map((i) => (
            <tr key={i.id}>
              <td className="px-2 py-1.5">{i.descricao}<span className="block text-xs text-suave">{Number(i.quantidade).toLocaleString('pt-BR')} {i.unidade} · {i.grupo}</span></td>
              {cotacoes.map((c, n) => {
                const v = cs[n].precos[i.id];
                const menor = v != null && menores[i.id] === v && cotacoes.length > 1;
                return (
                  <td key={c.id} className={`px-1 py-1 ${menor ? 'bg-petroleo-50 dark:bg-petroleo-600/20' : ''}`}>
                    {podeCotar ? <PrecoCelula valor={v} onConfirmar={(x) => agir(() => salvarPreco(c.id, i.id, x))} /> : <span className="block px-2 text-right tabular-nums">{v == null ? '—' : moeda(v)}</span>}
                    {v != null && <span className="block px-2 text-right text-[11px] text-suave tabular-nums">{moeda(Math.round(v * Number(i.quantidade) * 100) / 100)}</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot className="text-sm">
          {linhas.map(([rot, f]) => (
            <tr key={rot} className="border-t border-borda">
              <td className="px-2 py-1.5 text-xs font-medium text-suave">{rot}</td>
              {cotacoes.map((c, n) => <td key={c.id} className="px-2 py-1.5 text-right tabular-nums">{f(c, n)}</td>)}
            </tr>
          ))}
          <tr className="border-t border-borda">
            <td className="px-2 py-2 text-xs text-suave">{podeCotar && 'Comprar o pacote deste fornecedor'}</td>
            {cotacoes.map((c, n) => (
              <td key={c.id} className="px-2 py-2 text-right">
                {comprouDe.has(c.id) ? <Selo cor="verde">Ordem gerada</Selo>
                  : podeCotar && <Botao tamanho="sm" variante={melhor === c.id ? 'primario' : 'secundario'} disabled={totalCotacao(cs[n], its).faltam === its.length} onClick={() => gerar(c)}><Send size={13} /> Gerar OC</Botao>}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function GerarOrdem({ cotacao, itens, onFechar, onConfirmar }: {
  cotacao: Cotacao; itens: ItemComSolicitacao[]; onFechar: () => void; onConfirmar: (previsao: string | null, obs: string) => Promise<boolean>;
}) {
  const p = precosDe(cotacao);
  const com = itens.filter((i) => p.precos[i.id] != null);
  const sem = itens.filter((i) => p.precos[i.id] == null);
  const total = totalCotacao(p, com.map((i) => ({ id: i.id, quantidade: Number(i.quantidade) }))).total;
  const sugerida = cotacao.prazo_dias != null ? new Date(Date.now() + cotacao.prazo_dias * 864e5).toISOString().slice(0, 10) : null;
  const [previsao, setPrevisao] = useState<string | null>(sugerida);
  const [obs, setObs] = useState('');
  const [enviando, setEnviando] = useState(false);
  return (
    <Modal aberto titulo={`Gerar ordem de compra · ${cotacao.fornecedores?.nome ?? ''}`} onFechar={onFechar}>
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between rounded-lg bg-pagina px-3 py-2 ring-1 ring-borda">
          <span>{com.length} item(ns) · {descreverCondicao(cotacao.condicao_tipo, cotacao.condicao_dias ?? [])}{!cotacao.orcamento_caminho && <span className="block text-xs text-amber-600">sem orçamento anexado</span>}</span>
          <span className="text-base font-semibold tabular-nums">{moeda(total)}</span>
        </div>
        {sem.length > 0 && (
          <p className="text-xs text-amber-600">Sem preço deste fornecedor, {sem.length} item(ns) voltam para À comprar: {sem.map((i) => i.descricao).join(', ')}.</p>
        )}
        <p className="text-xs text-suave">A ordem vai para o Financeiro pagar, com o orçamento anexado, e para o Almoxarifado receber. O pacote fica como comprado.</p>
        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <Campo rotulo="Previsão de entrega"><CampoData value={previsao} onChange={(v) => setPrevisao(v || null)} /></Campo>
          <Campo rotulo="Observações para o fornecedor"><Entrada value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
        </div>
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao disabled={enviando || !com.length} onClick={async () => { setEnviando(true); if (await onConfirmar(previsao, obs)) onFechar(); setEnviando(false); }}><Send size={15} /> Gerar ordem de compra</Botao>
        </div>
      </div>
    </Modal>
  );
}

// O PDF pode sair em branco (para qualquer fornecedor) ou já endereçado a um fornecedor cadastrado.
function EscolherFornecedorPdf({ fornecedores, cotacoes, onFechar, onGerar }: { fornecedores: Fornecedor[]; cotacoes: Cotacao[]; onFechar: () => void; onGerar: (f: Fornecedor | undefined) => void }) {
  const [id, setId] = useState('');
  const ja = new Set(cotacoes.map((c) => c.fornecedor_id));
  return (
    <Modal aberto titulo="PDF do pedido de cotação" onFechar={onFechar}>
      <div className="space-y-3 text-sm">
        <p className="text-suave">Sai a lista dos itens do pacote, sem preços, para o fornecedor preencher. Imprima ou salve em PDF e mande por e-mail ou WhatsApp.</p>
        <Campo rotulo="Endereçar a">
          <Selecao value={id} onChange={(e) => setId(e.target.value)}>
            <option value="">Sem fornecedor (em branco)</option>
            {fornecedores.filter((f) => f.ativo).map((f) => <option key={f.id} value={f.id}>{f.nome}{ja.has(f.id) ? ' (já orçou)' : ''}</option>)}
          </Selecao>
        </Campo>
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao onClick={() => onGerar(fornecedores.find((f) => f.id === id))}><FileDown size={15} /> Gerar PDF</Botao>
        </div>
      </div>
    </Modal>
  );
}

