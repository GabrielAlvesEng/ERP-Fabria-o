import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, ListPlus, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Campo, CampoCelula, CampoData, CampoEscolha, CampoNumero, Cartao, Entrada, EsqueletoDetalhe, Selecao, Selo, Vazio } from '@/shared/ui';
import {
  adicionarItens, atualizarItem, atualizarRequisicao, cancelar, cancelarPedido, listarEventos, listarFornecedores, listarItens, listarPacotes, listarProdutos,
  obterRequisicao, pedidosDosItens, removerItem, type ItemRequisicao, type Pedido, type Produto, type Requisicao,
} from './api';
import { GRUPOS, ROTULO_ITEM, ROTULO_ORIGEM, ROTULO_STATUS, SETORES, UNIDADES, type GrupoItem, type StatusRequisicao } from './regras';
import { COR_ITEM, Historico, Justificar, OrdemCartao, Referencia, Secao, type Cor } from './comum';
import { ImportarListaModal } from './ImportarLista';

const COR_STATUS: Record<StatusRequisicao, Cor> = { aberta: 'azul', concluida: 'verde', cancelada: 'vermelho' };

// Compras → solicitação (decisões 107 e 111): o que o setor pediu, a situação de cada item (à comprar, em cotação num
// pacote, comprado, recebido) e as ordens de compra que levaram os itens. A cotação é feita nos pacotes (aba Cotações).
export function RequisicaoPage() {
  const { id = '' } = useParams();
  const { pode } = useAuth();
  const qc = useQueryClient();
  const { data: r, isLoading, error } = useQuery({ queryKey: ['compras', 'requisicao', id], queryFn: () => obterRequisicao(id) });
  const { data: itens = [] } = useQuery({ queryKey: ['compras', 'itens', id], queryFn: () => listarItens(id) });
  const ids = itens.map((i) => i.id);
  const { data: pedidos = [] } = useQuery({ queryKey: ['compras', 'pedidos', 'req', id, ids.length], queryFn: () => pedidosDosItens(ids), enabled: ids.length > 0 });
  const { data: eventos = [] } = useQuery({ queryKey: ['compras', 'eventos', id], queryFn: () => listarEventos({ requisicao: id }) });
  const { data: fornecedores = [] } = useQuery({ queryKey: ['compras', 'fornecedores'], queryFn: listarFornecedores });
  const { data: produtos = [] } = useQuery({ queryKey: ['compras', 'produtos'], queryFn: listarProdutos });
  const { data: pacotes = [] } = useQuery({ queryKey: ['compras', 'pacotes'], queryFn: listarPacotes });
  const nomesPacotes = useMemo(() => new Map(pacotes.map((p) => [p.id, p.codigo])), [pacotes]);
  const [erro, setErro] = useState('');
  const [modal, setModal] = useState<null | 'importar' | 'cancelar' | { cancelarOc: Pedido }>(null);

  const atualizar = () => qc.invalidateQueries({ queryKey: ['compras'] });
  async function agir(f: () => Promise<unknown>) {
    setErro('');
    try { await f(); await atualizar(); return true; } catch (e) { setErro(mensagemErro(e)); return false; }
  }

  if (isLoading) return <EsqueletoDetalhe />;
  if (error || !r) return <Aviso>{error ? mensagemErro(error) : 'Requisição não encontrada.'}</Aviso>;

  const aberta = r.status === 'aberta';
  const podeItens = aberta && (pode('compras', 'editar') || pode('compras', 'criar'));
  const temOcAtiva = pedidos.some((p) => p.status !== 'cancelada');

  return (
    <div className="space-y-5">
      <div>
        <Link to="/compras" className="mb-2 inline-flex items-center gap-1 text-sm text-suave hover:text-texto"><ArrowLeft size={15} /> À comprar</Link>
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
        {aberta && itens.some((i) => i.status === 'a_comprar' && !i.pacote_id) && <p className="mb-2 text-xs text-suave">Os itens à comprar aparecem na aba <Link to="/compras" className="text-roxo-600 hover:underline dark:text-roxo-100">À comprar</Link>, onde entram num pacote de cotação.</p>}
        {itens.length === 0 ? <Vazio>Nenhum item. {podeItens && 'Adicione os itens ou traga a lista de materiais do projeto.'}</Vazio> : (
          <Itens itens={itens} produtos={produtos} pacotes={nomesPacotes} podeItens={podeItens} agir={agir} />
        )}
      </Secao>

      {pedidos.length > 0 && (
        <Secao titulo={`Ordens de compra (${pedidos.length})`}>
          <div className="space-y-3">
            {pedidos.map((p) => (
              <OrdemCartao key={p.id} p={p} fornecedor={fornecedores.find((f) => f.id === p.fornecedor_id)} podeEditar={pode('compras', 'editar')} agir={agir}
                cancelar={() => setModal({ cancelarOc: p })} mostrarOrigem />
            ))}
          </div>
        </Secao>
      )}

      <Secao titulo="Histórico"><Historico eventos={eventos} /></Secao>

      {modal === 'importar' && r.projeto_id && (
        <ImportarListaModal projetoId={r.projeto_id} projetoNome={`${r.projeto_codigo} ${r.projeto_titulo}`} onFechar={() => setModal(null)}
          onConfirmar={async (novos) => { await adicionarItens(r.id, novos, itens.length); await atualizar(); setModal(null); }} />
      )}
      {modal === 'cancelar' && <Justificar titulo="Cancelar requisição" rotulo="Motivo do cancelamento" botao="Cancelar requisição" onFechar={() => setModal(null)} onConfirmar={(t) => agir(() => cancelar(r.id, t))} />}
      {modal && typeof modal === 'object' && (
        <Justificar titulo={`Cancelar ${modal.cancelarOc.codigo}`} rotulo="Motivo (os itens voltam para à comprar e o Financeiro é avisado)" botao="Cancelar ordem de compra"
          onFechar={() => setModal(null)} onConfirmar={(t) => agir(() => cancelarPedido(modal.cancelarOc.id, t))} />
      )}
    </div>
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
function Itens({ itens, produtos, pacotes, podeItens, agir }: { itens: ItemRequisicao[]; produtos: Produto[]; pacotes: Map<string, string>; podeItens: boolean; agir: (f: () => Promise<unknown>) => Promise<boolean> }) {
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
          <th className="px-2 py-2">Observação</th><th className="w-36 px-2 py-2">Situação</th><th className="w-8" />
        </tr></thead>
        <tbody className="divide-y divide-borda">
          {itens.map((i) => {
            const ed = podeItens && i.status === 'a_comprar';
            return (
              <tr key={i.id}>
                <td className="px-1 py-1">
                  {ed ? <CampoEscolha valor={i.descricao} opcoes={opcoes} placeholder="Produto" onConfirmar={(v) => trocarDescricao(i, v)} /> : <span className="px-2">{i.descricao}</span>}
                  {!i.bib_id && <span className="block px-2 text-[11px] text-amber-600">sem cadastro de produto</span>}
                  <Referencia link={i.referencia_link} imagem={i.referencia_imagem} />
                </td>
                <td className="px-1 py-1">{ed ? (
                  <Selecao compacto value={i.grupo} onChange={(e) => agir(() => atualizarItem(i.id, { grupo: e.target.value as GrupoItem }))}>{GRUPOS.map((g) => <option key={g}>{g}</option>)}</Selecao>
                ) : <span className="px-2 text-xs text-suave">{i.grupo}</span>}</td>
                <td className="px-1 py-1">{ed ? <CampoNumero valor={Number(i.quantidade)} casas={3} onConfirmar={(n) => n > 0 && agir(() => atualizarItem(i.id, { quantidade: n }))} /> : <span className="block px-2 text-right tabular-nums">{Number(i.quantidade).toLocaleString('pt-BR')}</span>}</td>
                <td className="px-1 py-1">{ed ? <CampoCelula valor={i.unidade} lista="compras-unidades" onConfirmar={(v) => v.trim() && agir(() => atualizarItem(i.id, { unidade: v.trim() }))} /> : <span className="px-2">{i.unidade}</span>}</td>
                <td className="px-1 py-1">{ed ? <CampoCelula valor={i.observacoes} placeholder="—" onConfirmar={(v) => agir(() => atualizarItem(i.id, { observacoes: v }))} /> : <span className="px-2 text-xs text-suave">{i.observacoes}</span>}</td>
                <td className="px-2 py-1">{i.pacote_id && i.status === 'a_comprar'
                  ? <Link to={`/compras/cotacoes/${i.pacote_id}`} className="hover:underline"><Selo cor="azul">Em cotação {pacotes.get(i.pacote_id) ?? ''}</Selo></Link>
                  : <Selo cor={COR_ITEM[i.status]}>{ROTULO_ITEM[i.status]}</Selo>}</td>
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

