import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, FileDown, ListPlus, Paperclip, Pencil, Plus, Send, Sparkles, Trash2, Truck } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, dataHoraBR, hojeISO, mensagemErro, moeda } from '@/shared/lib/formato';
import {
  AreaTexto, Aviso, Botao, Caixa, Campo, CampoArquivo, CampoCelula, CampoData, CampoEscolha, CampoNumero, Cartao, Entrada, EsqueletoDetalhe, Modal, Selecao, Selo, Vazio,
} from '@/shared/ui';
import {
  abrirArquivo, adicionarItens, anexarOrcamento, atualizarItem, atualizarPedido, atualizarRequisicao, cancelar, cancelarPedido, gerarPedidos, listarCotacoes,
  listarEventos, listarFornecedores, listarItens, listarProdutos, obterRequisicao, pedidosDaRequisicao, registrarEntrega, removerCotacao, removerItem,
  salvarCotacao, salvarPreco, situacaoPagamento, type Cotacao, type DadosCotacao, type Fornecedor, type ItemRequisicao, type Pedido, type Produto, type Requisicao,
} from './api';
import {
  GRUPOS, ROTULO_CONDICAO, ROTULO_ITEM, ROTULO_ORIGEM, ROTULO_PEDIDO, ROTULO_STATUS, SETORES, UNIDADES, descreverCondicao, lerDias, menoresPrecos,
  pedidoAtrasado, sugerirEscolhas, totalCotacao, type CondicaoTipo, type GrupoItem, type StatusItem, type StatusRequisicao,
} from './regras';
import { ImportarListaModal } from './ImportarLista';
import { imprimirOrdem } from './ordemPdf';

type Cor = 'cinza' | 'roxo' | 'verde' | 'vermelho' | 'amarelo' | 'azul';
const COR_STATUS: Record<StatusRequisicao, Cor> = { aberta: 'azul', concluida: 'verde', cancelada: 'vermelho' };
const COR_ITEM: Record<StatusItem, Cor> = { a_comprar: 'cinza', comprado: 'roxo', recebido: 'verde', cancelado: 'vermelho' };
const PAGAMENTO: Record<string, [string, Cor]> = { a_pagar: ['A pagar', 'amarelo'], paga_parcial: ['Paga em parte', 'azul'], paga: ['Paga', 'verde'], cancelada: ['Conta cancelada', 'cinza'] };

// Compras → solicitação (decisões 101 e 103): itens ligados aos produtos, cotações com orçamento anexado,
// comparação com o fornecedor escolhido por item, uma ordem de compra por fornecedor e a entrega por item.
export function RequisicaoPage() {
  const { id = '' } = useParams();
  const { pode } = useAuth();
  const qc = useQueryClient();
  const { data: r, isLoading, error } = useQuery({ queryKey: ['compras', 'requisicao', id], queryFn: () => obterRequisicao(id) });
  const { data: itens = [] } = useQuery({ queryKey: ['compras', 'itens', id], queryFn: () => listarItens(id) });
  const { data: cotacoes = [] } = useQuery({ queryKey: ['compras', 'cotacoes', id], queryFn: () => listarCotacoes(id) });
  const { data: pedidos = [] } = useQuery({ queryKey: ['compras', 'pedidos', 'req', id], queryFn: () => pedidosDaRequisicao(id) });
  const { data: eventos = [] } = useQuery({ queryKey: ['compras', 'eventos', id], queryFn: () => listarEventos(id) });
  const { data: fornecedores = [] } = useQuery({ queryKey: ['compras', 'fornecedores'], queryFn: listarFornecedores });
  const { data: produtos = [] } = useQuery({ queryKey: ['compras', 'produtos'], queryFn: listarProdutos });
  const [erro, setErro] = useState('');
  const [modal, setModal] = useState<null | 'importar' | 'cancelar' | 'gerar' | { cotacao: Cotacao | null } | { entrega: Pedido } | { cancelarOc: Pedido }>(null);

  const atualizar = () => qc.invalidateQueries({ queryKey: ['compras'] });
  async function agir(f: () => Promise<unknown>) {
    setErro('');
    try { await f(); await atualizar(); return true; } catch (e) { setErro(mensagemErro(e)); return false; }
  }

  if (isLoading) return <EsqueletoDetalhe />;
  if (error || !r) return <Aviso>{error ? mensagemErro(error) : 'Requisição não encontrada.'}</Aviso>;

  const aberta = r.status === 'aberta';
  const podeItens = aberta && (pode('compras', 'editar') || pode('compras', 'criar'));
  const podeCotar = aberta && pode('compras', 'editar');
  const temOcAtiva = pedidos.some((p) => p.status !== 'cancelada');

  return (
    <div className="space-y-5">
      <div>
        <Link to="/compras" className="mb-2 inline-flex items-center gap-1 text-sm text-suave hover:text-texto"><ArrowLeft size={15} /> Painel de Compras</Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-suave">
              <span className="font-mono">{r.codigo}</span><Selo cor={COR_STATUS[r.status]}>{ROTULO_STATUS[r.status]}</Selo>
              <Selo cor={r.origem === 'engenharia' ? 'roxo' : r.origem === 'almoxarifado' ? 'amarelo' : 'cinza'}>{ROTULO_ORIGEM[r.origem]}</Selo>
              {r.prioridade === 'urgente' && <Selo cor="vermelho">Urgente</Selo>}
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{r.titulo}</h1>
            <p className="mt-0.5 text-sm text-suave">
              {r.projeto_codigo ? `Projeto ${r.projeto_codigo} · ${r.projeto_titulo}` : r.origem === 'almoxarifado' ? 'Estoque (sem projeto)' : 'Sem projeto'} · {r.setor} · pedida por {r.solicitante?.nome ?? '—'} em {dataBR(r.criado_em)}
              {r.necessario_em && ` · precisa em ${dataBR(r.necessario_em)}`}
            </p>
          </div>
          {pode('compras', 'editar') && aberta && !temOcAtiva && (
            <Botao variante="secundario" onClick={() => setModal('cancelar')}><Ban size={15} /> Cancelar requisição</Botao>
          )}
        </div>
      </div>
      {erro && <Aviso>{erro}</Aviso>}

      {podeItens && <Dados r={r} agir={agir} />}
      {!podeItens && r.observacoes && <Cartao><div className="text-xs font-medium text-suave">Observações</div><p className="mt-1 whitespace-pre-wrap text-sm">{r.observacoes}</p></Cartao>}

      <Secao titulo={`Itens (${itens.length})`} acoes={podeItens && <>
        {r.projeto_id && r.origem === 'compras' && <Botao tamanho="sm" variante="secundario" onClick={() => setModal('importar')}><ListPlus size={14} /> Lista do projeto</Botao>}
        <Botao tamanho="sm" variante="secundario" onClick={() => agir(() => adicionarItens(r.id, [{ grupo: 'Outros', descricao: 'Novo item', quantidade: 1, unidade: 'un', observacoes: '' }], itens.length))}><Plus size={14} /> Item</Botao>
      </>}>
        {r.origem === 'engenharia' && aberta && <p className="mb-2 text-xs text-suave">Lista enviada pela Engenharia. Se o projeto mudar, chega uma nova revisão: ela substitui esta enquanto nada foi comprado; depois disso, vem só o complemento.</p>}
        {itens.length === 0 ? <Vazio>Nenhum item. {podeItens && 'Adicione os itens ou traga a lista de materiais do projeto.'}</Vazio> : (
          <Itens itens={itens} produtos={produtos} podeItens={podeItens} agir={agir} />
        )}
      </Secao>

      <Secao titulo={`Orçamentos e comparação (${cotacoes.length})`} acoes={podeCotar && itens.some((i) => i.status === 'a_comprar') && <>
        <Botao tamanho="sm" variante="secundario" onClick={() => setModal({ cotacao: null })}><Plus size={14} /> Orçamento de fornecedor</Botao>
      </>}>
        {cotacoes.length === 0 ? <Vazio>{itens.length ? 'Nenhum orçamento ainda. Lance o orçamento de cada fornecedor para comparar.' : 'Adicione os itens antes de cotar.'}</Vazio> : (
          <Comparacao itens={itens} cotacoes={cotacoes} podeCotar={podeCotar} agir={agir} editar={(c) => setModal({ cotacao: c })} gerar={() => setModal('gerar')} />
        )}
      </Secao>

      {pedidos.length > 0 && (
        <Secao titulo={`Ordens de compra (${pedidos.length})`}>
          <div className="space-y-3">
            {pedidos.map((p) => (
              <OrdemCartao key={p.id} p={p} r={r} itens={itens} fornecedor={fornecedores.find((f) => f.id === p.fornecedor_id)} podeEditar={pode('compras', 'editar')} agir={agir}
                entrega={() => setModal({ entrega: p })} cancelar={() => setModal({ cancelarOc: p })} />
            ))}
          </div>
        </Secao>
      )}

      <Secao titulo="Histórico">
        {eventos.length === 0 ? <Vazio>Sem registros.</Vazio> : (
          <ul className="space-y-2 text-sm">
            {eventos.map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className="w-32 shrink-0 text-xs text-suave">{dataHoraBR(e.criado_em)}</span>
                <span><b className="font-medium">{e.usuarios?.nome ?? 'Sistema'}</b> {descreverEvento(e)}{e.justificativa && <span className="text-suave"> · {e.justificativa}</span>}</span>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      {modal === 'importar' && r.projeto_id && (
        <ImportarListaModal projetoId={r.projeto_id} projetoNome={`${r.projeto_codigo} ${r.projeto_titulo}`} onFechar={() => setModal(null)}
          onConfirmar={async (novos) => { await adicionarItens(r.id, novos, itens.length); await atualizar(); setModal(null); }} />
      )}
      {modal === 'cancelar' && <Justificar titulo="Cancelar requisição" rotulo="Motivo do cancelamento" botao="Cancelar requisição" onFechar={() => setModal(null)} onConfirmar={(t) => agir(() => cancelar(r.id, t))} />}
      {modal === 'gerar' && <GerarOrdens itens={itens} cotacoes={cotacoes} onFechar={() => setModal(null)} onConfirmar={(obs) => agir(() => gerarPedidos(r.id, obs))} />}
      {modal && typeof modal === 'object' && 'entrega' in modal && (
        <Entrega p={modal.entrega} itens={itens} onFechar={() => setModal(null)} onConfirmar={(data, its, obs) => agir(() => registrarEntrega(modal.entrega.id, data, its, obs))} />
      )}
      {modal && typeof modal === 'object' && 'cancelarOc' in modal && (
        <Justificar titulo={`Cancelar ${modal.cancelarOc.codigo}`} rotulo="Motivo (os itens voltam para à comprar e o Financeiro é avisado)" botao="Cancelar ordem de compra"
          onFechar={() => setModal(null)} onConfirmar={(t) => agir(() => cancelarPedido(modal.cancelarOc.id, t))} />
      )}
      {modal && typeof modal === 'object' && 'cotacao' in modal && (
        <CotacaoModal cotacao={modal.cotacao} fornecedores={fornecedores.filter((f) => f.ativo && (f.id === modal.cotacao?.fornecedor_id || !cotacoes.some((c) => c.fornecedor_id === f.id)))}
          onFechar={() => setModal(null)}
          onSalvar={(d, arquivo) => agir(async () => { const cid = await salvarCotacao(r.id, modal.cotacao?.id ?? null, d); if (arquivo) await anexarOrcamento(cid, arquivo); })} />
      )}
    </div>
  );
}

const precosDe = (c: Cotacao) => ({ id: c.id, frete: Number(c.frete), precos: Object.fromEntries(c.compras_cotacao_precos.map((p) => [p.item_id, Number(p.valor_unit)])) });

function descreverEvento(e: { tipo: string; de: string | null; para: string | null; dados: Record<string, unknown> }) {
  if (e.tipo === 'criada') return 'criou a requisição';
  if (e.tipo === 'cotacao') return `lançou o orçamento de ${e.dados.fornecedor ?? 'um fornecedor'}`;
  if (e.tipo === 'pedido') return `gerou a ordem de compra ${e.dados.codigo} para ${e.dados.fornecedor ?? 'o fornecedor'} (${moeda(Number(e.dados.total))})`;
  if (e.tipo === 'entrega') return `registrou ${e.para === 'entregue' ? 'a entrega total' : 'uma entrega parcial'} da ${e.dados.codigo ?? 'ordem'} em ${dataBR(String(e.dados.data))}`;
  if (e.tipo === 'cancelamento') return `cancelou a ordem de compra ${e.dados.codigo}`;
  if (e.dados?.origem) return `enviou a solicitação pela ${ROTULO_ORIGEM[e.dados.origem as keyof typeof ROTULO_ORIGEM] ?? e.dados.origem} (${e.dados.itens} item(ns))`;
  if (e.para === 'cancelada') return 'cancelou a requisição';
  const st = (s: string | null) => (s ? ROTULO_STATUS[s as StatusRequisicao] ?? s : '');
  return `mudou de ${st(e.de)} para ${st(e.para)}`;
}

function Secao({ titulo, acoes, children }: { titulo: string; acoes?: ReactNode; children: ReactNode }) {
  return (
    <Cartao>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{titulo}</h2><div className="flex flex-wrap gap-2">{acoes}</div></div>
      {children}
    </Cartao>
  );
}

function Dados({ r, agir }: { r: Requisicao; agir: (f: () => Promise<unknown>) => Promise<boolean> }) {
  const salvar = (d: Parameters<typeof atualizarRequisicao>[1]) => agir(() => atualizarRequisicao(r.id, d));
  return (
    <Cartao>
      <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <Campo rotulo="Título"><Entrada defaultValue={r.titulo} onBlur={(e) => e.target.value.trim().length >= 2 && e.target.value !== r.titulo && salvar({ titulo: e.target.value.trim() })} /></Campo>
        <Campo rotulo="Setor que pede"><Selecao value={r.setor} onChange={(e) => salvar({ setor: e.target.value })}>{[...new Set([r.setor, ...SETORES, 'Almoxarifado', 'Compras'])].map((s) => <option key={s}>{s}</option>)}</Selecao></Campo>
        <Campo rotulo="Precisa em"><CampoData value={r.necessario_em} onChange={(v) => salvar({ necessario_em: v || null })} /></Campo>
        <Campo rotulo="Prioridade"><Selecao value={r.prioridade} onChange={(e) => salvar({ prioridade: e.target.value as Requisicao['prioridade'] })}><option value="normal">Normal</option><option value="urgente">Urgente</option></Selecao></Campo>
      </div>
      <Campo rotulo="Observações" className="mt-3"><AreaTexto rows={2} defaultValue={r.observacoes} onBlur={(e) => e.target.value !== r.observacoes && salvar({ observacoes: e.target.value })} /></Campo>
    </Cartao>
  );
}

// Itens: a descrição escolhe um produto do cadastro (Biblioteca); texto livre fica "sem cadastro".
function Itens({ itens, produtos, podeItens, agir }: { itens: ItemRequisicao[]; produtos: Produto[]; podeItens: boolean; agir: (f: () => Promise<unknown>) => Promise<boolean> }) {
  const opcoes = useMemo(() => produtos.map((p) => ({ valor: p.descricao, detalhe: p.grupo })), [produtos]);
  const porDescricao = useMemo(() => new Map(produtos.map((p) => [p.descricao, p])), [produtos]);
  function trocarDescricao(i: ItemRequisicao, v: string) {
    const t = v.trim();
    if (!t) return;
    const p = porDescricao.get(t);
    agir(() => atualizarItem(i.id, p ? { descricao: p.descricao, bib_tipo: p.tipo, bib_id: p.id, grupo: p.grupo, unidade: p.unidade } : { descricao: t, bib_tipo: null, bib_id: null }));
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="text-left text-xs text-suave"><tr>
          <th className="px-2 py-2">Produto</th><th className="w-32 px-2 py-2">Grupo</th><th className="w-28 px-2 py-2 text-right">Quantidade</th><th className="w-24 px-2 py-2">Unidade</th>
          <th className="px-2 py-2">Observação</th><th className="w-28 px-2 py-2">Situação</th><th className="w-8" />
        </tr></thead>
        <tbody className="divide-y divide-borda">
          {itens.map((i) => {
            const ed = podeItens && i.status === 'a_comprar';
            return (
              <tr key={i.id}>
                <td className="px-1 py-1">
                  {ed ? <CampoEscolha valor={i.descricao} opcoes={opcoes} placeholder="Produto" onConfirmar={(v) => trocarDescricao(i, v)} /> : <span className="px-2">{i.descricao}</span>}
                  {!i.bib_id && <span className="block px-2 text-[11px] text-amber-600">sem cadastro de produto</span>}
                </td>
                <td className="px-1 py-1">{ed ? (
                  <Selecao compacto value={i.grupo} onChange={(e) => agir(() => atualizarItem(i.id, { grupo: e.target.value as GrupoItem }))}>{GRUPOS.map((g) => <option key={g}>{g}</option>)}</Selecao>
                ) : <span className="px-2 text-xs text-suave">{i.grupo}</span>}</td>
                <td className="px-1 py-1">{ed ? <CampoNumero valor={Number(i.quantidade)} casas={3} onConfirmar={(n) => n > 0 && agir(() => atualizarItem(i.id, { quantidade: n }))} /> : <span className="block px-2 text-right tabular-nums">{Number(i.quantidade).toLocaleString('pt-BR')}</span>}</td>
                <td className="px-1 py-1">{ed ? <CampoCelula valor={i.unidade} lista="compras-unidades" onConfirmar={(v) => v.trim() && agir(() => atualizarItem(i.id, { unidade: v.trim() }))} /> : <span className="px-2">{i.unidade}</span>}</td>
                <td className="px-1 py-1">{ed ? <CampoCelula valor={i.observacoes} placeholder="—" onConfirmar={(v) => agir(() => atualizarItem(i.id, { observacoes: v }))} /> : <span className="px-2 text-xs text-suave">{i.observacoes}</span>}</td>
                <td className="px-2 py-1"><Selo cor={COR_ITEM[i.status]}>{ROTULO_ITEM[i.status]}</Selo></td>
                <td>{ed && <button type="button" title="Remover item" onClick={() => agir(() => removerItem(i.id))} className="rounded p-1 text-suave hover:bg-pagina hover:text-red-600"><Trash2 size={14} /></button>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <datalist id="compras-unidades">{UNIDADES.map((u) => <option key={u} value={u} />)}</datalist>
    </div>
  );
}

// Planilha de comparação item × fornecedor: menor preço em verde; o comprador escolhe o fornecedor de cada item
// (o ERP sugere o menor) e gera uma ordem de compra por fornecedor (decisão 103).
function Comparacao({ itens, cotacoes, podeCotar, agir, editar, gerar }: {
  itens: ItemRequisicao[]; cotacoes: Cotacao[]; podeCotar: boolean; agir: (f: () => Promise<unknown>) => Promise<boolean>; editar: (c: Cotacao) => void; gerar: () => void;
}) {
  const cs = cotacoes.map(precosDe);
  const abertos = itens.filter((i) => i.status === 'a_comprar');
  const its = abertos.map((i) => ({ id: i.id, quantidade: Number(i.quantidade) }));
  const menores = menoresPrecos(cs, its);
  const escolhidos = abertos.filter((i) => i.cotacao_escolhida_id && cs.find((c) => c.id === i.cotacao_escolhida_id)?.precos[i.id] != null);

  async function sugerir() {
    const s = sugerirEscolhas(cs, its);
    await agir(() => Promise.all(abertos.filter((i) => s[i.id] && s[i.id] !== i.cotacao_escolhida_id).map((i) => atualizarItem(i.id, { cotacao_escolhida_id: s[i.id] }))));
  }
  const escolher = (i: ItemRequisicao, c: string | null) => agir(() => atualizarItem(i.id, { cotacao_escolhida_id: c }));

  return (
    <>
      {podeCotar && abertos.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-pagina px-3 py-2 text-sm ring-1 ring-borda">
          <span className="text-suave">{escolhidos.length} de {abertos.length} item(ns) à comprar com fornecedor escolhido.</span>
          <span className="flex flex-wrap gap-2">
            <Botao tamanho="sm" variante="secundario" onClick={sugerir}><Sparkles size={13} /> Escolher os menores preços</Botao>
            <Botao tamanho="sm" disabled={!escolhidos.length} onClick={gerar}><Send size={13} /> Gerar ordens de compra</Botao>
          </span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 320 + cotacoes.length * 170 }}>
          <thead>
            <tr className="align-bottom text-left text-xs text-suave">
              <th className="px-2 py-2">Item</th>
              {cotacoes.map((c) => (
                <th key={c.id} className="w-[170px] px-2 py-2">
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-sm font-semibold text-texto">{c.fornecedores?.nome}</span>
                    <span className="flex shrink-0">
                      {c.orcamento_caminho && <button type="button" title="Abrir o orçamento anexado" onClick={() => agir(() => abrirArquivo(c.orcamento_caminho!))} className="rounded p-0.5 hover:text-texto"><Paperclip size={13} /></button>}
                      {podeCotar && <>
                        <button type="button" title="Editar orçamento" onClick={() => editar(c)} className="rounded p-0.5 hover:text-texto"><Pencil size={13} /></button>
                        <button type="button" title="Remover orçamento" onClick={() => confirm(`Remover o orçamento de ${c.fornecedores?.nome}?`) && agir(() => removerCotacao(c.id))} className="rounded p-0.5 hover:text-red-600"><Trash2 size={13} /></button>
                      </>}
                    </span>
                  </div>
                </th>
              ))}
              <th className="w-[180px] px-2 py-2">Comprar de</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {itens.filter((i) => i.status !== 'cancelado').map((i) => {
              const aberto = i.status === 'a_comprar';
              const comPreco = cotacoes.filter((_c, n) => cs[n].precos[i.id] != null);
              return (
                <tr key={i.id} className={aberto ? '' : 'opacity-60'}>
                  <td className="px-2 py-1.5">{i.descricao}<span className="block text-xs text-suave">{Number(i.quantidade).toLocaleString('pt-BR')} {i.unidade}{!aberto && ` · ${ROTULO_ITEM[i.status]}`}</span></td>
                  {cotacoes.map((c, n) => {
                    const v = cs[n].precos[i.id];
                    const menor = aberto && v != null && menores[i.id] === v && cotacoes.length > 1;
                    const escolhido = i.cotacao_escolhida_id === c.id;
                    return (
                      <td key={c.id} className={`px-1 py-1 ${menor ? 'bg-petroleo-50 dark:bg-petroleo-600/20' : ''} ${escolhido ? 'ring-2 ring-inset ring-roxo-400' : ''}`}>
                        {podeCotar && aberto ? <PrecoCelula valor={v} onConfirmar={(x) => agir(() => salvarPreco(c.id, i.id, x))} /> : <span className="block px-2 text-right tabular-nums">{v == null ? '—' : moeda(v)}</span>}
                        {v != null && <span className="block px-2 text-right text-[11px] text-suave tabular-nums">{moeda(Math.round(v * Number(i.quantidade) * 100) / 100)}</span>}
                      </td>
                    );
                  })}
                  <td className="px-1 py-1">
                    {podeCotar && aberto ? (
                      <Selecao compacto value={i.cotacao_escolhida_id ?? ''} onChange={(e) => escolher(i, e.target.value || null)}>
                        <option value="">{comPreco.length ? 'Escolha…' : 'Sem preço'}</option>
                        {comPreco.map((c) => <option key={c.id} value={c.id}>{c.fornecedores?.nome}</option>)}
                      </Selecao>
                    ) : <span className="px-2 text-xs">{cotacoes.find((c) => c.id === i.cotacao_escolhida_id)?.fornecedores?.nome ?? '—'}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="text-sm">
            {([
              ['Itens à comprar', (_c: Cotacao, n: number) => { const t = totalCotacao(cs[n], its); return <>{moeda(t.itens)}{t.faltam > 0 && <span className="block text-[11px] text-amber-600">sem preço em {t.faltam}</span>}</>; }],
              ['Frete', (c: Cotacao) => moeda(c.frete)],
              ['Escolhidos', (c: Cotacao, n: number) => { const sel = abertos.filter((i) => i.cotacao_escolhida_id === c.id); return sel.length ? <b>{moeda(totalCotacao(cs[n], sel.map((i) => ({ id: i.id, quantidade: Number(i.quantidade) }))).total)}<span className="block text-[11px] font-normal text-suave">{sel.length} item(ns)</span></b> : '—'; }],
              ['Prazo', (c: Cotacao) => (c.prazo_dias != null ? `${c.prazo_dias} dia(s)` : '—')],
              ['Pagamento', (c: Cotacao) => <>{descreverCondicao(c.condicao_tipo, c.condicao_dias ?? [])}{c.condicao_pagamento && <span className="block text-[11px] text-suave">{c.condicao_pagamento}</span>}</>],
              ['Validade', (c: Cotacao) => dataBR(c.validade)],
            ] as [string, (c: Cotacao, n: number) => ReactNode][]).map(([rot, f]) => (
              <tr key={rot} className="border-t border-borda">
                <td className="px-2 py-1.5 text-xs font-medium text-suave">{rot}</td>
                {cotacoes.map((c, n) => <td key={c.id} className="px-2 py-1.5 text-right tabular-nums">{f(c, n)}</td>)}
                <td />
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
    </>
  );
}

// Preço unitário em reais; vazio tira o preço (fornecedor não cotou o item).
function PrecoCelula({ valor, onConfirmar }: { valor: number | undefined; onConfirmar: (v: number | null) => void }) {
  const mostrar = (v: number | undefined) => (v == null ? '' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }));
  const [texto, setTexto] = useState(mostrar(valor));
  const [focado, setFocado] = useState(false);
  const atual = focado ? texto : mostrar(valor);
  function confirmar() {
    setFocado(false);
    const t = texto.replace(/R\$/i, '').trim();
    if (!t) { if (valor != null) onConfirmar(null); return; }
    const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
    if (Number.isNaN(n) || n < 0) return;
    if (n !== valor) onConfirmar(n);
  }
  return (
    <input inputMode="decimal" value={atual} placeholder="R$ —" onFocus={(e) => { setFocado(true); setTexto(mostrar(valor)); const el = e.target; requestAnimationFrame(() => el.select()); }}
      onChange={(e) => setTexto(e.target.value)} onBlur={confirmar} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-right text-sm tabular-nums outline-none placeholder:text-slate-400 hover:border-slate-300 focus:border-roxo-500 focus:bg-superficie dark:hover:border-marinho-500" />
  );
}

function CotacaoModal({ cotacao, fornecedores, onFechar, onSalvar }: {
  cotacao: Cotacao | null; fornecedores: Fornecedor[]; onFechar: () => void; onSalvar: (d: DadosCotacao, arquivo: File | null) => Promise<boolean>;
}) {
  const [d, setD] = useState<DadosCotacao>({
    fornecedor_id: cotacao?.fornecedor_id ?? '', frete: Number(cotacao?.frete ?? 0), prazo_dias: cotacao?.prazo_dias ?? null,
    condicao_pagamento: cotacao?.condicao_pagamento ?? '', condicao_tipo: cotacao?.condicao_tipo ?? 'a_combinar', condicao_dias: cotacao?.condicao_dias ?? [],
    validade: cotacao?.validade ?? null, observacoes: cotacao?.observacoes ?? '',
  });
  const [dias, setDias] = useState((cotacao?.condicao_dias ?? []).join('/'));
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const set = <K extends keyof DadosCotacao>(k: K, v: DadosCotacao[K]) => setD((x) => ({ ...x, [k]: v }));
  const comDias = d.condicao_tipo === 'apos_recebimento' || d.condicao_tipo === 'parcelado';

  async function salvar() {
    if (!d.fornecedor_id) return setErro('Escolha o fornecedor.');
    const ds = comDias ? lerDias(dias) : [];
    if (comDias && !ds.length) return setErro('Informe os dias do pagamento (ex.: 28 ou 30/60/90).');
    if (arquivo && arquivo.size > 15 * 1024 * 1024) return setErro('O arquivo do orçamento passa de 15 MB.');
    setSalvando(true); setErro('');
    if (await onSalvar({ ...d, condicao_dias: ds }, arquivo)) onFechar();
    setSalvando(false);
  }

  return (
    <Modal aberto titulo={cotacao ? 'Editar orçamento' : 'Orçamento de fornecedor'} onFechar={onFechar}>
      <div className="space-y-3">
        <Campo rotulo="Fornecedor">
          <Selecao value={d.fornecedor_id} onChange={(e) => {
            const f = fornecedores.find((x) => x.id === e.target.value);
            setD((x) => ({ ...x, fornecedor_id: e.target.value, condicao_tipo: !cotacao && f ? f.condicao_pagamento : x.condicao_tipo }));
          }}>
            <option value="">Escolha…</option>
            {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </Selecao>
        </Campo>
        {!fornecedores.length && <p className="text-xs text-suave">Cadastre o fornecedor na aba Fornecedores.</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo rotulo="Frete (R$)"><div className="rounded-lg border border-slate-300 dark:border-marinho-500"><CampoNumero valor={d.frete} moeda onConfirmar={(n) => set('frete', n)} /></div></Campo>
          <Campo rotulo="Prazo de entrega (dias)"><Entrada type="number" min={0} value={d.prazo_dias ?? ''} onChange={(e) => set('prazo_dias', e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value))))} /></Campo>
          <Campo rotulo="Validade"><CampoData value={d.validade} onChange={(v) => set('validade', v || null)} /></Campo>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <Campo rotulo="Pagamento">
            <Selecao value={d.condicao_tipo} onChange={(e) => set('condicao_tipo', e.target.value as CondicaoTipo)}>
              {(Object.keys(ROTULO_CONDICAO) as CondicaoTipo[]).map((k) => <option key={k} value={k}>{ROTULO_CONDICAO[k]}</option>)}
            </Selecao>
          </Campo>
          {comDias && <Campo rotulo={d.condicao_tipo === 'parcelado' ? 'Dias da emissão' : 'Dias após receber'}><Entrada value={dias} onChange={(e) => setDias(e.target.value)} placeholder={d.condicao_tipo === 'parcelado' ? '30/60/90' : '28'} /></Campo>}
        </div>
        <Campo rotulo="Forma de pagamento e detalhes"><Entrada value={d.condicao_pagamento} onChange={(e) => set('condicao_pagamento', e.target.value)} placeholder="Ex.: boleto, PIX, 5% de desconto à vista" /></Campo>
        <Campo rotulo={cotacao?.orcamento_caminho ? 'Trocar o orçamento anexado (PDF ou imagem)' : 'Orçamento do fornecedor (PDF ou imagem)'}>
          <CampoArquivo arquivo={arquivo} onChange={setArquivo} accept="application/pdf,image/jpeg,image/png,image/webp" />
        </Campo>
        <Campo rotulo="Observações"><AreaTexto rows={2} value={d.observacoes} onChange={(e) => set('observacoes', e.target.value)} /></Campo>
        <p className="text-xs text-suave">Os preços de cada item são lançados na planilha de comparação. O orçamento anexado vai junto com a ordem de compra para o Financeiro.</p>
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
        </div>
      </div>
    </Modal>
  );
}

// Resumo do que vai virar ordem de compra, por fornecedor.
function GerarOrdens({ itens, cotacoes, onFechar, onConfirmar }: { itens: ItemRequisicao[]; cotacoes: Cotacao[]; onFechar: () => void; onConfirmar: (obs: string) => Promise<boolean> }) {
  const [obs, setObs] = useState('');
  const [enviando, setEnviando] = useState(false);
  const grupos = cotacoes.map((c) => {
    const p = precosDe(c);
    const sel = itens.filter((i) => i.status === 'a_comprar' && i.cotacao_escolhida_id === c.id && p.precos[i.id] != null);
    return { c, sel, total: totalCotacao(p, sel.map((i) => ({ id: i.id, quantidade: Number(i.quantidade) }))).total };
  }).filter((g) => g.sel.length);
  const semEscolha = itens.filter((i) => i.status === 'a_comprar' && !i.cotacao_escolhida_id).length;
  return (
    <Modal aberto titulo="Gerar ordens de compra" onFechar={onFechar}>
      <div className="space-y-3 text-sm">
        <p className="text-suave">Sai uma ordem de compra para cada fornecedor, com os itens escolhidos dele. Cada ordem vai para o Financeiro pagar, com o orçamento anexado.</p>
        <ul className="divide-y divide-borda rounded-lg ring-1 ring-borda">
          {grupos.map((g) => (
            <li key={g.c.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span><b>{g.c.fornecedores?.nome}</b><span className="block text-xs text-suave">{g.sel.length} item(ns) · {descreverCondicao(g.c.condicao_tipo, g.c.condicao_dias ?? [])}{!g.c.orcamento_caminho && ' · sem orçamento anexado'}</span></span>
              <span className="font-semibold tabular-nums">{moeda(g.total)}</span>
            </li>
          ))}
        </ul>
        {semEscolha > 0 && <p className="text-xs text-amber-600">{semEscolha} item(ns) sem fornecedor escolhido continuam à comprar.</p>}
        <Campo rotulo="Observações para os fornecedores"><AreaTexto rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao disabled={enviando || !grupos.length} onClick={async () => { setEnviando(true); if (await onConfirmar(obs)) onFechar(); setEnviando(false); }}><Send size={15} /> Gerar {grupos.length} ordem(ns)</Botao>
        </div>
      </div>
    </Modal>
  );
}

function OrdemCartao({ p, r, itens, fornecedor, podeEditar, agir, entrega, cancelar: cancelarOc }: {
  p: Pedido; r: Requisicao; itens: ItemRequisicao[]; fornecedor: Fornecedor | undefined; podeEditar: boolean;
  agir: (f: () => Promise<unknown>) => Promise<boolean>; entrega: () => void; cancelar: () => void;
}) {
  const { data: pagamento } = useQuery({ queryKey: ['compras', 'pagamento', p.id], queryFn: () => situacaoPagamento(p.id), enabled: p.status !== 'cancelada' });
  const atrasado = pedidoAtrasado(p, hojeISO());
  const pi = p.compras_pedido_itens ?? [];
  const nome = (id: string) => itens.find((i) => i.id === id);
  const aberta = p.status === 'aguardando_entrega' || p.status === 'entregue_parcial';
  return (
    <div className={`rounded-lg bg-pagina p-3 ring-1 ring-borda ${p.status === 'cancelada' ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <div className="flex flex-wrap items-center gap-2"><span className="font-mono font-semibold">{p.codigo}</span><b>{p.fornecedores?.nome}</b>
            <Selo cor={p.status === 'entregue' ? 'verde' : p.status === 'cancelada' ? 'vermelho' : atrasado ? 'vermelho' : 'azul'}>{atrasado ? 'Atrasada' : ROTULO_PEDIDO[p.status]}</Selo>
            {pagamento && PAGAMENTO[pagamento] && <Selo cor={PAGAMENTO[pagamento][1]}>{PAGAMENTO[pagamento][0]}</Selo>}
          </div>
          <div className="mt-1 text-suave">
            Emitida em {dataBR(p.emitido_em)} · {moeda(p.valor_total)} · {descreverCondicao(p.condicao_tipo, p.condicao_dias ?? [])} · previsão {dataBR(p.previsao_entrega)}{p.entregue_em && ` · entregue em ${dataBR(p.entregue_em)}`}
          </div>
          {p.status === 'cancelada' && p.cancelado_motivo && <div className="mt-1 text-xs text-red-600">Cancelada: {p.cancelado_motivo}</div>}
        </div>
        <div className="flex flex-wrap gap-2">
          {p.orcamento_caminho && <Botao tamanho="sm" variante="secundario" onClick={() => agir(() => abrirArquivo(p.orcamento_caminho!))}><Paperclip size={14} /> Orçamento</Botao>}
          <Botao tamanho="sm" variante="secundario" onClick={() => imprimirOrdem(p, r, itens, fornecedor)}><FileDown size={14} /> PDF</Botao>
          {aberta && podeEditar && <Botao tamanho="sm" onClick={entrega}><Truck size={14} /> Registrar entrega</Botao>}
          {p.status === 'aguardando_entrega' && podeEditar && <Botao tamanho="sm" variante="secundario" onClick={cancelarOc}><Ban size={14} /> Cancelar</Botao>}
        </div>
      </div>
      <ul className="mt-2 text-xs text-suave">
        {pi.map((x) => (
          <li key={x.item_id}>{nome(x.item_id)?.descricao ?? 'Item'}: {Number(x.quantidade).toLocaleString('pt-BR')} {nome(x.item_id)?.unidade} × {moeda(x.valor_unit)}
            {Number(x.quantidade_recebida) > 0 && <span className={Number(x.quantidade_recebida) >= Number(x.quantidade) ? 'text-petroleo-600' : 'text-amber-600'}> · recebido {Number(x.quantidade_recebida).toLocaleString('pt-BR')}</span>}
          </li>
        ))}
      </ul>
      {aberta && podeEditar && (
        <div className="mt-3 grid gap-3 sm:grid-cols-[180px_1fr]">
          <Campo rotulo="Previsão de entrega"><CampoData value={p.previsao_entrega} onChange={(v) => agir(() => atualizarPedido(p.id, { previsao_entrega: v || null }))} /></Campo>
          <Campo rotulo="Observações da ordem"><Entrada defaultValue={p.observacoes} onBlur={(e) => e.target.value !== p.observacoes && agir(() => atualizarPedido(p.id, { observacoes: e.target.value }))} /></Campo>
        </div>
      )}
    </div>
  );
}

function Justificar({ titulo, rotulo, botao, onFechar, onConfirmar }: { titulo: string; rotulo: string; botao: string; onFechar: () => void; onConfirmar: (t: string) => Promise<boolean> }) {
  const [t, setT] = useState('');
  return (
    <Modal aberto titulo={titulo} onFechar={onFechar}>
      <Campo rotulo={rotulo}><AreaTexto value={t} onChange={(e) => setT(e.target.value)} autoFocus /></Campo>
      <div className="mt-4 flex justify-end gap-2">
        <Botao variante="secundario" onClick={onFechar}>Voltar</Botao>
        <Botao variante="perigo" disabled={t.trim().length < 3} onClick={async () => { if (await onConfirmar(t.trim())) onFechar(); }}>{botao}</Botao>
      </div>
    </Modal>
  );
}

// Entrega: tudo o que falta, ou a quantidade que chegou de cada item.
function Entrega({ p, itens, onFechar, onConfirmar }: {
  p: Pedido; itens: ItemRequisicao[]; onFechar: () => void; onConfirmar: (data: string, itens: { item_id: string; quantidade: number }[] | null, obs: string) => Promise<boolean>;
}) {
  const pi = p.compras_pedido_itens ?? [];
  const falta = (x: (typeof pi)[number]) => Math.max(0, Number(x.quantidade) - Number(x.quantidade_recebida));
  const [total, setTotal] = useState(true);
  const [qtd, setQtd] = useState<Record<string, number>>(() => Object.fromEntries(pi.map((x) => [x.item_id, falta(x)])));
  const [data, setData] = useState(hojeISO());
  const [obs, setObs] = useState('');
  const parcial = pi.filter((x) => falta(x) > 0).map((x) => ({ item_id: x.item_id, quantidade: Math.min(qtd[x.item_id] ?? 0, falta(x)) })).filter((x) => x.quantidade > 0);
  return (
    <Modal aberto titulo={`Registrar entrega · ${p.codigo}`} onFechar={onFechar}>
      <div className="space-y-3">
        <Caixa marcado={total} onChange={setTotal}>Chegou tudo o que falta</Caixa>
        {!total && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-suave"><tr><th className="py-1">Item</th><th className="py-1 text-right">Falta</th><th className="w-32 py-1 text-right">Chegou</th></tr></thead>
            <tbody className="divide-y divide-borda">
              {pi.filter((x) => falta(x) > 0).map((x) => {
                const i = itens.find((y) => y.id === x.item_id);
                return (
                  <tr key={x.item_id}>
                    <td className="py-1">{i?.descricao}</td>
                    <td className="py-1 text-right tabular-nums">{falta(x).toLocaleString('pt-BR')} {i?.unidade}</td>
                    <td className="py-1"><div className="rounded-lg border border-slate-300 dark:border-marinho-500"><CampoNumero valor={qtd[x.item_id] ?? 0} casas={3} onConfirmar={(n) => setQtd((q) => ({ ...q, [x.item_id]: Math.max(0, n) }))} /></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <Campo rotulo="Data"><CampoData value={data} onChange={setData} /></Campo>
        <Campo rotulo="Observação"><AreaTexto rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
        <p className="text-xs text-suave">Quando o Almoxarifado estiver liberado, a conferência do recebimento passa a ser dele.</p>
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao disabled={!data || (!total && !parcial.length)} onClick={async () => { if (await onConfirmar(data, total ? null : parcial, obs)) onFechar(); }}><Truck size={15} /> Registrar</Botao>
        </div>
      </div>
    </Modal>
  );
}
