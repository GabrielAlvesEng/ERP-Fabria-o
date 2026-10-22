import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, Check, FileDown, ListPlus, Pencil, Plus, Send, Trash2, Truck, X } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, dataHoraBR, hojeISO, mensagemErro, moeda } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Caixa, Campo, CampoCelula, CampoData, CampoNumero, Cartao, Entrada, EsqueletoDetalhe, Modal, Selecao, Selo, Vazio } from '@/shared/ui';
import {
  adicionarItens, atualizarItem, atualizarPedido, atualizarRequisicao, cancelar, decidir, emitirPedido, enviarAprovacao, listarCotacoes, listarEventos,
  listarFornecedores, listarItens, obterRequisicao, pedidoDaRequisicao, registrarEntrega, removerCotacao, removerItem, salvarCotacao, salvarPreco,
  type Cotacao, type DadosCotacao, type Requisicao,
} from './api';
import { GRUPOS, ROTULO_PAGAMENTO, ROTULO_PEDIDO, ROTULO_STATUS, SETORES, UNIDADES, editavel, melhorCotacao, menoresPrecos, pedidoAtrasado, totalCotacao, type GrupoItem, type StatusRequisicao } from './regras';
import { ImportarListaModal } from './ImportarLista';
import { imprimirOrdem } from './ordemPdf';

const COR_STATUS: Record<StatusRequisicao, 'cinza' | 'roxo' | 'verde' | 'vermelho' | 'amarelo' | 'azul'> = {
  aberta: 'cinza', em_cotacao: 'azul', aguardando_aprovacao: 'amarelo', aprovada: 'roxo', pedido_emitido: 'roxo', entregue: 'verde', cancelada: 'vermelho',
};

// Compras → requisição (decisão 101): dados, itens, cotações com comparação, aprovação do Financeiro, ordem de compra e entrega.
export function RequisicaoPage() {
  const { id = '' } = useParams();
  const { pode } = useAuth();
  const qc = useQueryClient();
  const { data: r, isLoading, error } = useQuery({ queryKey: ['compras', 'requisicao', id], queryFn: () => obterRequisicao(id) });
  const { data: itens = [] } = useQuery({ queryKey: ['compras', 'itens', id], queryFn: () => listarItens(id) });
  const { data: cotacoes = [] } = useQuery({ queryKey: ['compras', 'cotacoes', id], queryFn: () => listarCotacoes(id) });
  const { data: pedido } = useQuery({ queryKey: ['compras', 'pedido', id], queryFn: () => pedidoDaRequisicao(id) });
  const { data: eventos = [] } = useQuery({ queryKey: ['compras', 'eventos', id], queryFn: () => listarEventos(id) });
  const { data: fornecedores = [] } = useQuery({ queryKey: ['compras', 'fornecedores'], queryFn: listarFornecedores });
  const [erro, setErro] = useState('');
  const [modal, setModal] = useState<null | 'importar' | 'cancelar' | 'reprovar' | 'pedido' | 'entrega' | { cotacao: Cotacao | null }>(null);

  const atualizar = () => qc.invalidateQueries({ queryKey: ['compras'] });
  async function agir(f: () => Promise<unknown>) {
    setErro('');
    try { await f(); await atualizar(); return true; } catch (e) { setErro(mensagemErro(e)); return false; }
  }

  if (isLoading) return <EsqueletoDetalhe />;
  if (error || !r) return <Aviso>{error ? mensagemErro(error) : 'Requisição não encontrada.'}</Aviso>;

  const podeItens = editavel(r.status) && (pode('compras', 'editar') || pode('compras', 'criar'));
  const podeCotar = editavel(r.status) && pode('compras', 'editar');
  const escolhida = cotacoes.find((c) => c.id === r.cotacao_escolhida_id) ?? (pedido ? cotacoes.find((c) => c.id === pedido.cotacao_id) : undefined);
  const nomeFornecedor = (fid: string) => fornecedores.find((f) => f.id === fid)?.nome ?? '';

  return (
    <div className="space-y-5">
      <div>
        <Link to="/compras" className="mb-2 inline-flex items-center gap-1 text-sm text-suave hover:text-texto"><ArrowLeft size={15} /> Painel de Compras</Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-suave"><span className="font-mono">{r.codigo}</span><Selo cor={COR_STATUS[r.status]}>{ROTULO_STATUS[r.status]}</Selo>{r.prioridade === 'urgente' && <Selo cor="vermelho">Urgente</Selo>}</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{r.titulo}</h1>
            <p className="mt-0.5 text-sm text-suave">
              {r.projeto_codigo ? `Projeto ${r.projeto_codigo} · ${r.projeto_titulo}` : 'Sem projeto'} · {r.setor} · pedida por {r.solicitante?.nome ?? '—'} em {dataBR(r.criado_em)}
              {r.necessario_em && ` · precisa em ${dataBR(r.necessario_em)}`}
            </p>
          </div>
          {pode('compras', 'editar') && ['aberta', 'em_cotacao', 'aguardando_aprovacao', 'aprovada'].includes(r.status) && (
            <Botao variante="secundario" onClick={() => setModal('cancelar')}><Ban size={15} /> Cancelar requisição</Botao>
          )}
        </div>
      </div>
      {erro && <Aviso>{erro}</Aviso>}

      {podeItens && <Dados r={r} agir={agir} />}
      {!podeItens && r.observacoes && <Cartao><div className="text-xs font-medium text-suave">Observações</div><p className="mt-1 whitespace-pre-wrap text-sm">{r.observacoes}</p></Cartao>}

      <Secao titulo={`Itens (${itens.length})`} acoes={podeItens && <>
        {r.projeto_id && <Botao tamanho="sm" variante="secundario" onClick={() => setModal('importar')}><ListPlus size={14} /> Lista do projeto</Botao>}
        <Botao tamanho="sm" variante="secundario" onClick={() => agir(() => adicionarItens(r.id, [{ grupo: 'Outros', descricao: 'Novo item', quantidade: 1, unidade: 'un', observacoes: '' }], itens.length))}><Plus size={14} /> Item</Botao>
      </>}>
        {itens.length === 0 ? <Vazio>Nenhum item. {podeItens && 'Adicione os itens ou traga a lista de materiais do projeto.'}</Vazio> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs text-suave"><tr><th className="px-2 py-2">Grupo</th><th className="px-2 py-2">Descrição</th><th className="w-28 px-2 py-2 text-right">Quantidade</th><th className="w-24 px-2 py-2">Unidade</th><th className="px-2 py-2">Observação</th><th className="w-8" /></tr></thead>
              <tbody className="divide-y divide-borda">
                {itens.map((i) => (
                  <tr key={i.id}>
                    <td className="px-1 py-1">{podeItens ? (
                      <Selecao compacto value={i.grupo} onChange={(e) => agir(() => atualizarItem(i.id, { grupo: e.target.value as GrupoItem }))}>{GRUPOS.map((g) => <option key={g}>{g}</option>)}</Selecao>
                    ) : <span className="px-2 text-xs text-suave">{i.grupo}</span>}</td>
                    <td className="px-1 py-1">{podeItens ? <CampoCelula valor={i.descricao} onConfirmar={(v) => v.trim() && agir(() => atualizarItem(i.id, { descricao: v.trim() }))} /> : <span className="px-2">{i.descricao}</span>}</td>
                    <td className="px-1 py-1">{podeItens ? <CampoNumero valor={Number(i.quantidade)} casas={3} onConfirmar={(n) => n > 0 && agir(() => atualizarItem(i.id, { quantidade: n }))} /> : <span className="block px-2 text-right tabular-nums">{Number(i.quantidade).toLocaleString('pt-BR')}</span>}</td>
                    <td className="px-1 py-1">{podeItens ? <CampoCelula valor={i.unidade} lista="compras-unidades" onConfirmar={(v) => v.trim() && agir(() => atualizarItem(i.id, { unidade: v.trim() }))} /> : <span className="px-2">{i.unidade}</span>}</td>
                    <td className="px-1 py-1">{podeItens ? <CampoCelula valor={i.observacoes} placeholder="—" onConfirmar={(v) => agir(() => atualizarItem(i.id, { observacoes: v }))} /> : <span className="px-2 text-xs text-suave">{i.observacoes}</span>}</td>
                    <td>{podeItens && <button type="button" title="Remover item" onClick={() => agir(() => removerItem(i.id))} className="rounded p-1 text-suave hover:bg-pagina hover:text-red-600"><Trash2 size={14} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <datalist id="compras-unidades">{UNIDADES.map((u) => <option key={u} value={u} />)}</datalist>
          </div>
        )}
      </Secao>

      <Secao titulo={`Cotações (${cotacoes.length})`} acoes={podeCotar && itens.length > 0 && <Botao tamanho="sm" onClick={() => setModal({ cotacao: null })}><Plus size={14} /> Cotação</Botao>}>
        {cotacoes.length === 0 ? <Vazio>{itens.length ? 'Nenhuma cotação ainda. Lance o preço de cada fornecedor para comparar.' : 'Adicione os itens antes de cotar.'}</Vazio> : (
          <Comparacao r={r} itens={itens} cotacoes={cotacoes} podeCotar={podeCotar} podeEnviar={r.status === 'em_cotacao' && pode('compras', 'editar')} agir={agir}
            editar={(c) => setModal({ cotacao: c })} />
        )}
      </Secao>

      {(r.status === 'aguardando_aprovacao' || r.status === 'aprovada' || pedido) && escolhida && (
        <Secao titulo="Aprovação e ordem de compra">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <div>Fornecedor escolhido: <b>{escolhida.fornecedores?.nome ?? nomeFornecedor(escolhida.fornecedor_id)}</b></div>
              <div className="text-suave">Total {moeda(totalCotacao(precosDe(escolhida), itens).total)} · {escolhida.prazo_dias != null ? `prazo ${escolhida.prazo_dias} dia(s)` : 'prazo não informado'}{escolhida.condicao_pagamento && ` · ${escolhida.condicao_pagamento}`}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {r.status === 'aguardando_aprovacao' && (pode('financeiro', 'editar') ? <>
                <Botao variante="secundario" onClick={() => setModal('reprovar')}><X size={15} /> Reprovar</Botao>
                <Botao onClick={() => agir(() => decidir(r.id, true, ''))}><Check size={15} /> Aprovar compra</Botao>
              </> : <Selo cor="amarelo">Aguardando o Financeiro aprovar</Selo>)}
              {r.status === 'aprovada' && pode('compras', 'editar') && <Botao onClick={() => setModal('pedido')}><Send size={15} /> Emitir ordem de compra</Botao>}
              {r.status === 'aprovada' && !pode('compras', 'editar') && <Selo cor="roxo">Aprovada · Compras emite a ordem</Selo>}
            </div>
          </div>
          {pedido && (
            <div className="mt-4 rounded-lg bg-pagina p-3 ring-1 ring-borda">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  <div className="flex items-center gap-2"><span className="font-mono font-semibold">{pedido.codigo}</span>
                    <Selo cor={pedido.status === 'entregue' ? 'verde' : pedidoAtrasado(pedido, hojeISO()) ? 'vermelho' : 'azul'}>{pedidoAtrasado(pedido, hojeISO()) ? 'Atrasado' : ROTULO_PEDIDO[pedido.status]}</Selo></div>
                  <div className="mt-1 text-suave">Emitida em {dataBR(pedido.emitido_em)} · {moeda(pedido.valor_total)} · previsão {dataBR(pedido.previsao_entrega)}{pedido.entregue_em && ` · entregue em ${dataBR(pedido.entregue_em)}`}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Botao variante="secundario" onClick={() => imprimirOrdem(pedido, r, itens, escolhida, fornecedores.find((f) => f.id === pedido.fornecedor_id))}><FileDown size={15} /> PDF da ordem</Botao>
                  {pedido.status !== 'entregue' && pode('compras', 'editar') && <Botao onClick={() => setModal('entrega')}><Truck size={15} /> Registrar entrega</Botao>}
                </div>
              </div>
              {pedido.status !== 'entregue' && pode('compras', 'editar') && (
                <div className="mt-3 grid gap-3 sm:grid-cols-[180px_1fr]">
                  <Campo rotulo="Previsão de entrega"><CampoData value={pedido.previsao_entrega} onChange={(v) => agir(() => atualizarPedido(pedido.id, { previsao_entrega: v || null }))} /></Campo>
                  <Campo rotulo="Observações da ordem"><Entrada defaultValue={pedido.observacoes} onBlur={(e) => e.target.value !== pedido.observacoes && agir(() => atualizarPedido(pedido.id, { observacoes: e.target.value }))} /></Campo>
                </div>
              )}
            </div>
          )}
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
      {modal === 'reprovar' && <Justificar titulo="Reprovar compra" rotulo="Motivo (volta para cotação)" botao="Reprovar" onFechar={() => setModal(null)} onConfirmar={(t) => agir(() => decidir(r.id, false, t))} />}
      {modal === 'pedido' && escolhida && <EmitirPedido cotacao={escolhida} onFechar={() => setModal(null)} onConfirmar={(prev, obs) => agir(() => emitirPedido(r.id, prev, obs))} />}
      {modal === 'entrega' && pedido && <Entrega onFechar={() => setModal(null)} onConfirmar={(total, data, obs) => agir(() => registrarEntrega(pedido.id, total, data, obs))} />}
      {modal && typeof modal === 'object' && (
        <CotacaoModal cotacao={modal.cotacao} fornecedores={fornecedores.filter((f) => f.ativo && (f.id === modal.cotacao?.fornecedor_id || !cotacoes.some((c) => c.fornecedor_id === f.id)))}
          onFechar={() => setModal(null)} onSalvar={(d) => agir(() => salvarCotacao(r.id, modal.cotacao?.id ?? null, d))} />
      )}
    </div>
  );
}

const precosDe = (c: Cotacao) => ({ id: c.id, frete: Number(c.frete), precos: Object.fromEntries(c.compras_cotacao_precos.map((p) => [p.item_id, Number(p.valor_unit)])) });

function descreverEvento(e: { tipo: string; de: string | null; para: string | null; dados: Record<string, unknown> }) {
  const st = (s: string | null) => (s ? ROTULO_STATUS[s as StatusRequisicao] ?? ROTULO_PEDIDO[s as keyof typeof ROTULO_PEDIDO] ?? s : '');
  if (e.tipo === 'criada') return 'criou a requisição';
  if (e.tipo === 'cotacao') return `lançou a cotação de ${e.dados.fornecedor ?? 'um fornecedor'}`;
  if (e.tipo === 'pedido') return `emitiu a ordem de compra ${e.dados.codigo} (${moeda(Number(e.dados.total))})`;
  if (e.tipo === 'entrega') return `registrou ${e.para === 'entregue' ? 'a entrega total' : 'uma entrega parcial'} em ${dataBR(String(e.dados.data))}`;
  if (e.para === 'aguardando_aprovacao') return `enviou para aprovação (${e.dados.fornecedor}, ${moeda(Number(e.dados.total))})`;
  if (e.para === 'aprovada') return 'aprovou a compra';
  if (e.de === 'aguardando_aprovacao' && e.para === 'em_cotacao') return 'reprovou a compra';
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
        <Campo rotulo="Setor que pede"><Selecao value={r.setor} onChange={(e) => salvar({ setor: e.target.value })}>{SETORES.map((s) => <option key={s}>{s}</option>)}</Selecao></Campo>
        <Campo rotulo="Precisa em"><CampoData value={r.necessario_em} onChange={(v) => salvar({ necessario_em: v || null })} /></Campo>
        <Campo rotulo="Prioridade"><Selecao value={r.prioridade} onChange={(e) => salvar({ prioridade: e.target.value as Requisicao['prioridade'] })}><option value="normal">Normal</option><option value="urgente">Urgente</option></Selecao></Campo>
      </div>
      <Campo rotulo="Observações" className="mt-3"><AreaTexto rows={2} defaultValue={r.observacoes} onBlur={(e) => e.target.value !== r.observacoes && salvar({ observacoes: e.target.value })} /></Campo>
    </Cartao>
  );
}

// Comparação item × fornecedor: menor preço de cada item em verde; a cotação completa mais barata ganha o selo.
function Comparacao({ r, itens, cotacoes, podeCotar, podeEnviar, agir, editar }: {
  r: Requisicao; itens: { id: string; descricao: string; quantidade: number; unidade: string }[]; cotacoes: Cotacao[]; podeCotar: boolean; podeEnviar: boolean;
  agir: (f: () => Promise<unknown>) => Promise<boolean>; editar: (c: Cotacao) => void;
}) {
  const cs = cotacoes.map(precosDe);
  const its = itens.map((i) => ({ id: i.id, quantidade: Number(i.quantidade) }));
  const menores = menoresPrecos(cs, its);
  const melhor = melhorCotacao(cs, its);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth: 320 + cotacoes.length * 170 }}>
        <thead>
          <tr className="align-bottom text-left text-xs text-suave">
            <th className="px-2 py-2">Item</th>
            {cotacoes.map((c) => (
              <th key={c.id} className={`w-[170px] px-2 py-2 ${c.id === r.cotacao_escolhida_id ? 'bg-roxo-50 dark:bg-roxo-500/20' : ''}`}>
                <div className="flex items-start justify-between gap-1">
                  <span className="text-sm font-semibold text-texto">{c.fornecedores?.nome}</span>
                  {podeCotar && <span className="flex shrink-0">
                    <button type="button" title="Editar cotação" onClick={() => editar(c)} className="rounded p-0.5 hover:text-texto"><Pencil size={13} /></button>
                    <button type="button" title="Remover cotação" onClick={() => confirm(`Remover a cotação de ${c.fornecedores?.nome}?`) && agir(() => removerCotacao(c.id))} className="rounded p-0.5 hover:text-red-600"><Trash2 size={13} /></button>
                  </span>}
                </div>
                {c.id === melhor && <Selo cor="verde">Menor total</Selo>}
                {c.id === r.cotacao_escolhida_id && <Selo cor="roxo">Escolhida</Selo>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-borda">
          {itens.map((i) => (
            <tr key={i.id}>
              <td className="px-2 py-1.5">{i.descricao}<span className="block text-xs text-suave">{Number(i.quantidade).toLocaleString('pt-BR')} {i.unidade}</span></td>
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
          {([
            ['Itens', (_c: Cotacao, n: number) => moeda(totalCotacao(cs[n], its).itens)],
            ['Frete', (c: Cotacao) => moeda(c.frete)],
            ['Total', (_c: Cotacao, n: number) => { const t = totalCotacao(cs[n], its); return <b>{moeda(t.total)}{t.faltam > 0 && <span className="block text-[11px] font-normal text-amber-600">faltam {t.faltam} preço(s)</span>}</b>; }],
            ['Prazo', (c: Cotacao) => (c.prazo_dias != null ? `${c.prazo_dias} dia(s)` : '—')],
            ['Pagamento', (c: Cotacao) => c.condicao_pagamento || '—'],
            ['Validade', (c: Cotacao) => dataBR(c.validade)],
          ] as [string, (c: Cotacao, n: number) => ReactNode][]).map(([rot, f]) => (
            <tr key={rot} className="border-t border-borda">
              <td className="px-2 py-1.5 text-xs font-medium text-suave">{rot}</td>
              {cotacoes.map((c, n) => <td key={c.id} className="px-2 py-1.5 text-right tabular-nums">{f(c, n)}</td>)}
            </tr>
          ))}
          {podeEnviar && (
            <tr>
              <td />
              {cotacoes.map((c, n) => (
                <td key={c.id} className="px-2 py-2 text-right">
                  <Botao tamanho="sm" variante={c.id === melhor ? 'primario' : 'secundario'} disabled={totalCotacao(cs[n], its).faltam > 0}
                    onClick={() => confirm(`Enviar a cotação de ${c.fornecedores?.nome} para o Financeiro aprovar? A requisição e as cotações ficam travadas.`) && agir(() => enviarAprovacao(r.id, c.id))}>
                    <Send size={13} /> Escolher e enviar
                  </Botao>
                </td>
              ))}
            </tr>
          )}
        </tfoot>
      </table>
    </div>
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
  cotacao: Cotacao | null; fornecedores: { id: string; nome: string; condicao_pagamento: string }[]; onFechar: () => void; onSalvar: (d: DadosCotacao) => Promise<boolean>;
}) {
  const [d, setD] = useState<DadosCotacao>({
    fornecedor_id: cotacao?.fornecedor_id ?? '', frete: Number(cotacao?.frete ?? 0), prazo_dias: cotacao?.prazo_dias ?? null,
    condicao_pagamento: cotacao?.condicao_pagamento ?? '', validade: cotacao?.validade ?? null, observacoes: cotacao?.observacoes ?? '',
  });
  const [erro, setErro] = useState('');
  const set = <K extends keyof DadosCotacao>(k: K, v: DadosCotacao[K]) => setD((x) => ({ ...x, [k]: v }));
  return (
    <Modal aberto titulo={cotacao ? 'Editar cotação' : 'Nova cotação'} onFechar={onFechar}>
      <div className="space-y-3">
        <Campo rotulo="Fornecedor">
          <Selecao value={d.fornecedor_id} onChange={(e) => {
            const f = fornecedores.find((x) => x.id === e.target.value);
            setD((x) => ({ ...x, fornecedor_id: e.target.value, condicao_pagamento: x.condicao_pagamento || (f && f.condicao_pagamento !== 'a_combinar' ? ROTULO_PAGAMENTO[f.condicao_pagamento] : '') }));
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
        <Campo rotulo="Condição de pagamento"><Entrada value={d.condicao_pagamento} onChange={(e) => set('condicao_pagamento', e.target.value)} placeholder="Ex.: 28 dias, boleto · antecipado" /></Campo>
        <Campo rotulo="Observações"><AreaTexto rows={2} value={d.observacoes} onChange={(e) => set('observacoes', e.target.value)} /></Campo>
        <p className="text-xs text-suave">Os preços de cada item são lançados na tabela de comparação.</p>
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao onClick={async () => { if (!d.fornecedor_id) return setErro('Escolha o fornecedor.'); if (await onSalvar(d)) onFechar(); }}>Salvar</Botao>
        </div>
      </div>
    </Modal>
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

function EmitirPedido({ cotacao, onFechar, onConfirmar }: { cotacao: Cotacao; onFechar: () => void; onConfirmar: (previsao: string | null, obs: string) => Promise<boolean> }) {
  const sugestao = cotacao.prazo_dias != null ? new Date(Date.parse(`${hojeISO()}T12:00:00`) + cotacao.prazo_dias * 864e5).toISOString().slice(0, 10) : null;
  const [prev, setPrev] = useState<string | null>(sugestao);
  const [obs, setObs] = useState('');
  return (
    <Modal aberto titulo="Emitir ordem de compra" onFechar={onFechar}>
      <div className="space-y-3">
        <p className="text-sm text-suave">A ordem sai com os itens e preços da cotação aprovada de <b className="text-texto">{cotacao.fornecedores?.nome}</b> e recebe o número OC.</p>
        <Campo rotulo="Previsão de entrega"><CampoData value={prev} onChange={(v) => setPrev(v || null)} /></Campo>
        <Campo rotulo="Observações para o fornecedor"><AreaTexto rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao onClick={async () => { if (await onConfirmar(prev, obs)) onFechar(); }}><Send size={15} /> Emitir</Botao>
        </div>
      </div>
    </Modal>
  );
}

function Entrega({ onFechar, onConfirmar }: { onFechar: () => void; onConfirmar: (total: boolean, data: string, obs: string) => Promise<boolean> }) {
  const [total, setTotal] = useState(true);
  const [data, setData] = useState(hojeISO());
  const [obs, setObs] = useState('');
  return (
    <Modal aberto titulo="Registrar entrega" onFechar={onFechar}>
      <div className="space-y-3">
        <Caixa marcado={total} onChange={setTotal}>Entrega total (tudo chegou)</Caixa>
        <Campo rotulo="Data"><CampoData value={data} onChange={setData} /></Campo>
        <Campo rotulo={total ? 'Observação' : 'O que chegou'}><AreaTexto rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
        <p className="text-xs text-suave">A conferência no recebimento e o estoque ficam com o Almoxarifado quando ele for liberado.</p>
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao disabled={!data} onClick={async () => { if (await onConfirmar(total, data, obs)) onFechar(); }}><Truck size={15} /> Registrar</Botao>
        </div>
      </div>
    </Modal>
  );
}
