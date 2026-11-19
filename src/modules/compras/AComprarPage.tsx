import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PackagePlus, Plus, Search, Trash2, Undo2, Warehouse, X } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, dataHoraBR, hojeISO, mensagemErro, moeda } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Cabecalho, Caixa, Campo, CampoCelula, CampoEscolha, CampoNumero, Entrada, EsqueletoTabela, Modal, Selecao, Selo, Vazio } from '@/shared/ui';
import {
  adicionarAoPacote, atenderPeloEstoque, atualizarItem, cancelarItem, criarPacote, desfazerAtendimentoEstoque, listarAComprar, listarAtendidosEstoque,
  listarEstoqueDisponivel, listarProdutos, pacotesAbertos, type AtendidoEstoque, type EstoqueDisponivel, type ItemComSolicitacao,
} from './api';
import { GRUPOS, ROTULO_DESTINO, UNIDADES, agruparAComprar, destinoDe, estoqueParaItem, rotuloDestino, type Destino, type GrupoItem } from './regras';
import { NovaRequisicaoModal } from './NovaRequisicaoModal';
import { Referencia } from './comum';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Compras → À comprar (decisão 111): tudo o que falta comprar, de todas as solicitações abertas (Engenharia, Almoxarifado
// e Compras), separado por categoria e marcando se é de pedido ou de estoque. O comprador acerta o cadastro dos itens,
// seleciona os que quer comprar de um mesmo fornecedor (de qualquer categoria) e cria o pacote de cotação.
export function AComprarPage() {
  const { pode } = useAuth();
  const navegar = useNavigate();
  const qc = useQueryClient();
  const { data: itens = [], isLoading, error } = useQuery({ queryKey: ['compras', 'a-comprar'], queryFn: listarAComprar });
  const { data: produtos = [] } = useQuery({ queryKey: ['compras', 'produtos'], queryFn: listarProdutos });
  const { data: abertos = [] } = useQuery({ queryKey: ['compras', 'pacotes-abertos'], queryFn: pacotesAbertos });
  const { data: estoque = [] } = useQuery({ queryKey: ['compras', 'estoque-disponivel'], queryFn: listarEstoqueDisponivel });
  const { data: atendidos = [] } = useQuery({ queryKey: ['compras', 'atendidos-estoque'], queryFn: listarAtendidosEstoque });
  const [busca, setBusca] = useState('');
  const [destino, setDestino] = useState<Destino | ''>('');
  const [grupo, setGrupo] = useState<GrupoItem | ''>('');
  const [soUrgente, setSoUrgente] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState('');
  const [modal, setModal] = useState<null | 'nova' | 'pacote' | { excluir: ItemComSolicitacao } | { estoque: ItemComSolicitacao } | { desfazer: AtendidoEstoque }>(null);
  const [pacoteDestino, setPacoteDestino] = useState('');
  const podeEditar = pode('compras', 'editar');
  const hoje = hojeISO();

  async function agir(f: () => Promise<unknown>) {
    setErro('');
    try { await f(); await qc.invalidateQueries({ queryKey: ['compras'] }); await qc.invalidateQueries({ queryKey: ['almoxarifado'] }); return true; } catch (e) { setErro(mensagemErro(e)); return false; }
  }

  const termo = norm(busca.trim());
  const visiveis = itens.filter((i) => {
    const r = i.compras_requisicoes;
    return (!destino || destinoDe(r) === destino) && (!grupo || i.grupo === grupo) && (!soUrgente || r.prioridade === 'urgente')
      && (!termo || norm(`${i.descricao} ${r.codigo} ${r.titulo} ${r.projeto_codigo} ${r.setor}`).includes(termo));
  });
  const grupos = agruparAComprar(visiveis);
  // Itens que saíram da lista (foram para pacote por outra tela) deixam de contar na seleção.
  const selecionados = itens.filter((i) => sel.has(i.id));

  const marcar = (ids: string[], v: boolean) => setSel((s) => { const n = new Set(s); ids.forEach((id) => (v ? n.add(id) : n.delete(id))); return n; });

  async function adicionarEmPacote() {
    if (!pacoteDestino) return;
    if (await agir(() => adicionarAoPacote(pacoteDestino, selecionados.map((i) => i.id)))) { setSel(new Set()); navegar(`/compras/cotacoes/${pacoteDestino}`); }
  }

  const indicadores: [string, number, string?][] = [
    ['Itens à comprar', itens.length],
    ['Urgentes', itens.filter((i) => i.compras_requisicoes.prioridade === 'urgente').length, 'text-red-600 dark:text-red-300'],
    ['Atrasados', itens.filter((i) => i.compras_requisicoes.necessario_em && i.compras_requisicoes.necessario_em < hoje).length, 'text-red-600 dark:text-red-300'],
    ['Pacotes em cotação', abertos.length],
    ['Atender pelo estoque', itens.filter((i) => i.compras_requisicoes.origem !== 'almoxarifado' && !!estoqueParaItem(i, estoque).mesmo).length, 'text-petroleo-600 dark:text-petroleo-100'],
  ];

  return (
    <>
      <Cabecalho titulo="À comprar" subtitulo="Tudo o que falta comprar, de pedidos (Engenharia) e de estoque (Almoxarifado). Selecione os itens que vai cotar com os mesmos fornecedores e crie um pacote de cotação."
        acoes={pode('compras', 'criar') ? <Botao variante="secundario" onClick={() => setModal('nova')}><Plus size={15} /> Nova requisição</Botao> : undefined} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {indicadores.map(([rot, val, cor]) => (
          <div key={rot} className="rounded-xl bg-superficie p-4 shadow-sm ring-1 ring-borda">
            <div className="text-xs text-suave">{rot}</div>
            <div className={`mt-1 text-xl font-semibold tabular-nums ${val && cor ? cor : 'text-texto'}`}>{val}</div>
          </div>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-suave" />
          <Entrada value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar item, solicitação, projeto…" className="pl-9" />
        </div>
        <Selecao value={destino} onChange={(e) => setDestino(e.target.value as Destino | '')} className="w-52">
          <option value="">Pedido e estoque</option>
          {(Object.keys(ROTULO_DESTINO) as Destino[]).map((d) => <option key={d} value={d}>{ROTULO_DESTINO[d]}</option>)}
        </Selecao>
        <Selecao value={grupo} onChange={(e) => setGrupo(e.target.value as GrupoItem | '')} className="w-44">
          <option value="">Todas as categorias</option>
          {GRUPOS.map((g) => <option key={g} value={g}>{g}</option>)}
        </Selecao>
        <Caixa marcado={soUrgente} onChange={setSoUrgente}>Só urgentes</Caixa>
      </div>
      {erro && <div className="mb-3"><Aviso>{erro}</Aviso></div>}
      {error && <Aviso>{mensagemErro(error)}</Aviso>}

      {isLoading ? <EsqueletoTabela /> : grupos.length === 0 ? (
        <Vazio>{itens.length ? 'Nenhum item com esses filtros.' : 'Nada à comprar. Quando a Engenharia, o Almoxarifado ou um setor pedir, os itens aparecem aqui.'}</Vazio>
      ) : (
        <div className="space-y-4">
          {grupos.map((g) => {
            const ids = g.itens.map((i) => i.id);
            const todos = ids.every((id) => sel.has(id));
            return (
              <section key={g.grupo} className="rounded-xl bg-superficie shadow-sm ring-1 ring-borda">
                <div className="flex items-center justify-between gap-2 border-b border-borda px-3 py-2">
                  <div className="flex items-center gap-2">
                    {podeEditar && <Caixa marcado={todos} onChange={(v) => marcar(ids, v)} />}
                    <h2 className="font-semibold">{g.grupo}</h2>
                    <span className="text-xs text-suave">{g.itens.length} item(ns)</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead className="text-left text-xs text-suave"><tr>
                      {podeEditar && <th className="w-9 px-3 py-2" />}
                      <th className="px-2 py-2">Produto</th><th className="w-32 px-2 py-2">Categoria</th><th className="w-28 px-2 py-2 text-right">Quantidade</th>
                      <th className="w-20 px-2 py-2">Unidade</th><th className="w-40 px-2 py-2">Para</th><th className="w-40 px-2 py-2">Solicitação</th><th className="w-28 px-2 py-2">Precisa em</th>
                      {podeEditar && <th className="w-10 px-2 py-2" />}
                    </tr></thead>
                    <tbody className="divide-y divide-borda">
                      {g.itens.map((i) => (
                        <LinhaItem key={i.id} i={i} produtos={produtos} estoque={estoque} hoje={hoje} podeEditar={podeEditar} marcado={sel.has(i.id)}
                          onMarcar={(v) => marcar([i.id], v)} agir={agir} excluir={() => setModal({ excluir: i })} atender={() => setModal({ estoque: i })} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
          <datalist id="compras-unidades">{UNIDADES.map((u) => <option key={u} value={u} />)}</datalist>
        </div>
      )}

      <AtendidosPeloEstoque lista={atendidos} podeEditar={podeEditar} desfazer={(a) => setModal({ desfazer: a })} />

      {podeEditar && selecionados.length > 0 && (
        <div className="sticky bottom-3 z-20 mt-3 rounded-xl bg-superficie/95 px-4 py-3 shadow-lg ring-1 ring-roxo-200 backdrop-blur dark:ring-roxo-700">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">{selecionados.length} item(ns) selecionado(s)</span>
            <button type="button" onClick={() => setSel(new Set())} className="inline-flex items-center gap-1 text-xs text-suave hover:text-texto"><X size={13} /> Limpar</button>
            <span className="flex-1" />
            {abertos.length > 0 && (
              <span className="flex items-center gap-2">
                <Selecao compacto value={pacoteDestino} onChange={(e) => setPacoteDestino(e.target.value)} className="w-56">
                  <option value="">Adicionar a um pacote…</option>
                  {abertos.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.titulo}</option>)}
                </Selecao>
                <Botao tamanho="sm" variante="secundario" disabled={!pacoteDestino} onClick={adicionarEmPacote}>Adicionar</Botao>
              </span>
            )}
            <Botao tamanho="sm" onClick={() => setModal('pacote')}><PackagePlus size={14} /> Criar pacote de cotação</Botao>
          </div>
        </div>
      )}

      {modal === 'nova' && <NovaRequisicaoModal onFechar={() => setModal(null)} onCriada={(id) => { setModal(null); navegar(`/compras/requisicoes/${id}`); }} />}
      {modal === 'pacote' && (
        <NovoPacote itens={selecionados} onFechar={() => setModal(null)}
          onCriar={async (titulo, obs) => {
            try {
              const id = await criarPacote(titulo, selecionados.map((i) => i.id), obs);
              await qc.invalidateQueries({ queryKey: ['compras'] });
              setSel(new Set());
              navegar(`/compras/cotacoes/${id}`);
              return '';
            } catch (e) { return mensagemErro(e); }
          }} />
      )}
      {modal && typeof modal === 'object' && 'estoque' in modal && (
        <AtenderEstoque item={modal.estoque} estoque={estoque} onFechar={() => setModal(null)}
          onAtender={async (estoqueId, quantidade) => {
            try {
              await atenderPeloEstoque(modal.estoque.id, estoqueId, quantidade);
              await qc.invalidateQueries({ queryKey: ['compras'] }); await qc.invalidateQueries({ queryKey: ['almoxarifado'] });
              setSel((s) => { const n = new Set(s); n.delete(modal.estoque.id); return n; });
              setModal(null);
              return '';
            } catch (e) { return mensagemErro(e); }
          }} />
      )}
      {modal && typeof modal === 'object' && 'desfazer' in modal && (
        <DesfazerEstoque atendido={modal.desfazer} onFechar={() => setModal(null)}
          onDesfazer={async (motivo) => { if (await agir(() => desfazerAtendimentoEstoque(modal.desfazer.item_id, motivo))) setModal(null); }} />
      )}
      {modal && typeof modal === 'object' && 'excluir' in modal && (
        <ExcluirItem item={modal.excluir} onFechar={() => setModal(null)}
          onExcluir={async (motivo) => {
            const ok = await agir(() => cancelarItem(modal.excluir.id, motivo));
            if (ok) { setSel((s) => { const n = new Set(s); n.delete(modal.excluir.id); return n; }); setModal(null); }
          }} />
      )}
    </>
  );
}

function LinhaItem({ i, produtos, estoque, hoje, podeEditar, marcado, onMarcar, agir, excluir, atender }: {
  i: ItemComSolicitacao; produtos: Awaited<ReturnType<typeof listarProdutos>>; estoque: EstoqueDisponivel[]; hoje: string; podeEditar: boolean; marcado: boolean;
  onMarcar: (v: boolean) => void; agir: (f: () => Promise<unknown>) => Promise<boolean>; excluir: () => void; atender: () => void;
}) {
  const r = i.compras_requisicoes;
  const opcoes = useMemo(() => produtos.map((p) => ({ valor: p.descricao, detalhe: p.grupo })), [produtos]);
  const porDescricao = useMemo(() => new Map(produtos.map((p) => [p.descricao, p])), [produtos]);
  const d = destinoDe(r);
  const atrasado = !!r.necessario_em && r.necessario_em < hoje;
  // Decisão 145: o que o estoque tem para este item. Pedido do próprio Almoxarifado (reposição) não se atende pelo estoque.
  const noEstoque = useMemo(() => (r.origem === 'almoxarifado' ? { mesmo: undefined, parecidos: [] } : estoqueParaItem(i, estoque)), [i, estoque, r.origem]);
  // Escolher um produto do cadastro liga o item a ele (descrição, categoria e unidade do cadastro); texto livre fica sem cadastro.
  function trocarDescricao(v: string) {
    const t = v.trim();
    if (!t || t === i.descricao) return;
    const p = porDescricao.get(t);
    agir(() => atualizarItem(i.id, p ? { descricao: p.descricao, bib_tipo: p.tipo, bib_id: p.id, grupo: p.grupo, unidade: p.unidade } : { descricao: t, bib_tipo: null, bib_id: null }));
  }
  return (
    <tr className={marcado ? 'bg-roxo-50/60 dark:bg-roxo-700/10' : ''}>
      {podeEditar && <td className="px-3 py-1"><Caixa marcado={marcado} onChange={onMarcar} /></td>}
      <td className="min-w-[13rem] px-1 py-1">
        {podeEditar ? <CampoEscolha valor={i.descricao} opcoes={opcoes} placeholder="Produto" onConfirmar={trocarDescricao} /> : <span className="px-2">{i.descricao}</span>}
        {i.observacoes && <span className="block px-2 text-[11px] text-suave">{i.observacoes}</span>}
        <Referencia link={i.referencia_link} imagem={i.referencia_imagem} />
        {(noEstoque.mesmo || noEstoque.parecidos.length > 0) && (
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 px-2 text-[11px] [&>*]:whitespace-nowrap">
            {noEstoque.mesmo
              ? <span className="text-petroleo-600 dark:text-petroleo-100">Estoque: {Number(noEstoque.mesmo.disponivel).toLocaleString('pt-BR')} {noEstoque.mesmo.unidade} disponível</span>
              : <span className="max-w-[14rem] truncate text-suave" title={noEstoque.parecidos[0].descricao}>Parecido no estoque: {noEstoque.parecidos[0].descricao}</span>}
            {podeEditar && (
              <button type="button" onClick={atender} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-petroleo-600 ring-1 ring-petroleo-500/40 hover:bg-petroleo-50 dark:text-petroleo-100 dark:hover:bg-petroleo-700/30">
                <Warehouse size={12} /> Atender pelo estoque
              </button>
            )}
          </span>
        )}
      </td>
      <td className="px-1 py-1">{podeEditar ? (
        <Selecao compacto value={i.grupo} onChange={(e) => agir(() => atualizarItem(i.id, { grupo: e.target.value as GrupoItem }))}>{GRUPOS.map((g) => <option key={g}>{g}</option>)}</Selecao>
      ) : <span className="px-2 text-xs">{i.grupo}</span>}</td>
      <td className="px-1 py-1">{podeEditar ? <CampoNumero valor={Number(i.quantidade)} casas={3} onConfirmar={(n) => n > 0 && agir(() => atualizarItem(i.id, { quantidade: n }))} /> : <span className="block px-2 text-right tabular-nums">{Number(i.quantidade).toLocaleString('pt-BR')}</span>}</td>
      <td className="px-1 py-1">{podeEditar ? <CampoCelula valor={i.unidade} lista="compras-unidades" onConfirmar={(v) => v.trim() && agir(() => atualizarItem(i.id, { unidade: v.trim() }))} /> : <span className="px-2">{i.unidade}</span>}</td>
      <td className="px-2 py-1"><Selo cor={d === 'pedido' ? 'roxo' : d === 'estoque' ? 'amarelo' : 'cinza'}>{rotuloDestino(r)}</Selo></td>
      <td className="px-2 py-1 text-xs">
        <Link to={`/compras/requisicoes/${i.requisicao_id}`} className="font-mono text-roxo-600 hover:underline dark:text-roxo-100">{r.codigo}</Link>
        <span className="block truncate text-suave" title={r.titulo}>{r.titulo}</span>
      </td>
      <td className="px-2 py-1 text-xs">
        {r.prioridade === 'urgente' && <Selo cor="vermelho">Urgente</Selo>}
        <span className={`block ${atrasado ? 'font-medium text-red-600' : 'text-suave'}`}>{r.necessario_em ? dataBR(r.necessario_em) : '—'}</span>
      </td>
      {podeEditar && (
        <td className="px-2 py-1 text-right">
          <button type="button" title="Excluir item" aria-label="Excluir item" onClick={excluir} className="rounded p-1 text-slate-400 hover:bg-pagina hover:text-red-600"><Trash2 size={14} /></button>
        </td>
      )}
    </tr>
  );
}

// Exclusão lógica (decisão 132): o item fica "cancelado" na requisição, com o motivo no histórico.
function ExcluirItem({ item, onFechar, onExcluir }: { item: ItemComSolicitacao; onFechar: () => void; onExcluir: (motivo: string) => Promise<void> }) {
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  return (
    <Modal aberto titulo="Excluir item" onFechar={onFechar}>
      <div className="space-y-3 text-sm">
        <p><span className="font-medium">{item.descricao}</span> · {Number(item.quantidade).toLocaleString('pt-BR')} {item.unidade}
          <span className="block text-xs text-suave">{item.compras_requisicoes.codigo} · {item.compras_requisicoes.titulo}</span></p>
        <p className="text-suave">O item sai do À comprar e fica como cancelado na requisição, com o motivo no histórico. Nada é apagado.</p>
        <Campo rotulo="Motivo (opcional)"><Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: já tem no estoque, pedido em duplicidade…" autoFocus /></Campo>
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Voltar</Botao>
          <Botao variante="perigo" disabled={salvando} onClick={async () => { setSalvando(true); await onExcluir(motivo.trim()); setSalvando(false); }}><Trash2 size={14} /> Excluir item</Botao>
        </div>
      </div>
    </Modal>
  );
}

// Título sugerido pelas categorias dos itens (o comprador pode trocar).
function tituloSugerido(itens: ItemComSolicitacao[]): string {
  const gs = [...new Set(itens.map((i) => i.grupo))];
  return gs.length <= 3 ? gs.join(' e ') : `${gs.slice(0, 2).join(', ')} e outros`;
}

function NovoPacote({ itens, onFechar, onCriar }: { itens: ItemComSolicitacao[]; onFechar: () => void; onCriar: (titulo: string, obs: string) => Promise<string> }) {
  const [titulo, setTitulo] = useState(tituloSugerido(itens));
  const [obs, setObs] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  async function criar() {
    if (titulo.trim().length < 2) return setErro('Dê um nome ao pacote.');
    setSalvando(true); setErro('');
    const e = await onCriar(titulo.trim(), obs);
    if (e) { setErro(e); setSalvando(false); }
  }
  return (
    <Modal aberto titulo="Criar pacote de cotação" onFechar={onFechar}>
      <div className="space-y-3 text-sm">
        <p className="text-suave">Os {itens.length} item(ns) saem do À comprar e vão para a aba Cotações. Lá você gera o PDF para os fornecedores, lança os orçamentos, compara e gera a ordem de compra com o fornecedor escolhido.</p>
        <Campo rotulo="Nome do pacote"><Entrada value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus placeholder="Ex.: Chapas de inox urgentes" /></Campo>
        <Campo rotulo="Observações para os fornecedores (vão no PDF)"><AreaTexto rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: entrega em Mococa/SP, enviar certificado de material" /></Campo>
        <ul className="max-h-48 divide-y divide-borda overflow-y-auto rounded-lg text-xs ring-1 ring-borda">
          {itens.map((i) => (
            <li key={i.id} className="flex justify-between gap-2 px-3 py-1.5">
              <span>{i.descricao}<span className="text-suave"> · {i.grupo} · {rotuloDestino(i.compras_requisicoes)}</span></span>
              <span className="shrink-0 tabular-nums">{Number(i.quantidade).toLocaleString('pt-BR')} {i.unidade}</span>
            </li>
          ))}
        </ul>
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao disabled={salvando} onClick={criar}><PackagePlus size={15} /> {salvando ? 'Criando…' : 'Criar pacote'}</Botao>
        </div>
      </div>
    </Modal>
  );
}

// Decisão 145: venda interna. O comprador escolhe o produto do estoque e quanto atende; a reserva vale na hora e o resto
// (se for parcial) continua no À comprar. O custo é o da última compra do produto.
function AtenderEstoque({ item, estoque, onFechar, onAtender }: {
  item: ItemComSolicitacao; estoque: EstoqueDisponivel[]; onFechar: () => void; onAtender: (estoque: string, quantidade: number) => Promise<string>;
}) {
  const sugestao = useMemo(() => estoqueParaItem(item, estoque), [item, estoque]);
  const [busca, setBusca] = useState('');
  const [escolhido, setEscolhido] = useState(sugestao.mesmo?.id ?? sugestao.parecidos[0]?.id ?? '');
  const e = estoque.find((x) => x.id === escolhido);
  const pede = Number(item.quantidade);
  const [quantidade, setQuantidade] = useState(() => String(Math.min(pede, Number((sugestao.mesmo ?? sugestao.parecidos[0])?.disponivel ?? pede))).replace('.', ','));
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const termo = norm(busca.trim());
  const outros = termo ? estoque.filter((x) => x.disponivel > 0 && norm(`${x.descricao} ${x.local}`).includes(termo)).slice(0, 20) : [];
  const opcoes = [...(sugestao.mesmo ? [sugestao.mesmo] : []), ...sugestao.parecidos, ...outros.filter((x) => x.id !== sugestao.mesmo?.id && !sugestao.parecidos.includes(x))];
  const q = Number(quantidade.replace(/\./g, '').replace(',', '.'));
  const parcial = q > 0 && q < pede;
  async function confirmar() {
    if (!e) return setErro('Escolha o produto do estoque.');
    if (!(q > 0)) return setErro('Informe a quantidade.');
    if (q > pede) return setErro(`O item pede só ${pede.toLocaleString('pt-BR')} ${item.unidade}.`);
    if (q > e.disponivel) return setErro(`No estoque há só ${e.disponivel.toLocaleString('pt-BR')} ${e.unidade} disponível.`);
    setSalvando(true); setErro('');
    const m = await onAtender(e.id, q);
    if (m) { setErro(m); setSalvando(false); }
  }
  return (
    <Modal aberto titulo="Atender pelo estoque" onFechar={onFechar} largura="max-w-2xl">
      <div className="space-y-3 text-sm">
        <p><span className="font-medium">{item.descricao}</span> · {pede.toLocaleString('pt-BR')} {item.unidade}
          <span className="block text-xs text-suave">{item.compras_requisicoes.codigo} · {rotuloDestino(item.compras_requisicoes)}</span></p>
        <p className="text-suave">O material fica reservado na hora para {item.compras_requisicoes.projeto_codigo || item.compras_requisicoes.setor || 'o destino da requisição'}. O Almoxarifado separa e entrega, e aí sai do saldo. O projeto recebe o custo da última compra.</p>
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-suave" />
          <Entrada value={busca} onChange={(ev) => setBusca(ev.target.value)} placeholder="Buscar outro produto no estoque…" className="pl-9" />
        </div>
        {opcoes.length === 0 ? <Vazio>Nada parecido com saldo disponível. Busque pelo nome do produto.</Vazio> : (
          <ul className="max-h-60 divide-y divide-borda overflow-y-auto rounded-lg ring-1 ring-borda">
            {opcoes.map((x) => (
              <li key={x.id}>
                <label className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${x.id === escolhido ? 'bg-petroleo-50 dark:bg-petroleo-700/20' : 'hover:bg-pagina'}`}>
                  <input type="radio" name="estoque" checked={x.id === escolhido} onChange={() => { setEscolhido(x.id); setQuantidade(String(Math.min(pede, x.disponivel)).replace('.', ',')); }} />
                  <span className="flex-1">
                    {x.descricao}
                    {x.id === sugestao.mesmo?.id && <span className="ml-1.5"><Selo cor="verde">Mesmo produto</Selo></span>}
                    <span className="block text-xs text-suave">{x.grupo}{x.local ? ` · ${x.local}` : ''} · saldo {x.saldo.toLocaleString('pt-BR')}{x.reservado > 0 ? `, reservado ${x.reservado.toLocaleString('pt-BR')}` : ''}</span>
                  </span>
                  <span className="text-right tabular-nums">
                    <span className="block font-medium">{x.disponivel.toLocaleString('pt-BR')} {x.unidade}</span>
                    <span className="block text-xs text-suave">{x.custo > 0 ? `${moeda(x.custo)}/${x.unidade}` : 'sem custo'}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo={`Quantidade (${e?.unidade ?? item.unidade})`}><Entrada value={quantidade} onChange={(ev) => setQuantidade(ev.target.value)} inputMode="decimal" /></Campo>
          <div className="self-end pb-2 text-right text-xs text-suave">
            {e && q > 0 && <span className="block text-sm font-medium text-texto">Custo para o projeto: {moeda(q * e.custo)}</span>}
            {e && e.custo === 0 && <span className="block text-amber-600">Este produto não tem custo de compra registrado.</span>}
          </div>
        </div>
        {parcial && <Aviso tipo="info">Atendimento parcial: {(pede - q).toLocaleString('pt-BR')} {item.unidade} continuam no À comprar.</Aviso>}
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao disabled={salvando || !e} onClick={confirmar}><Warehouse size={15} /> {salvando ? 'Reservando…' : 'Reservar do estoque'}</Botao>
        </div>
      </div>
    </Modal>
  );
}

function AtendidosPeloEstoque({ lista, podeEditar, desfazer }: { lista: AtendidoEstoque[]; podeEditar: boolean; desfazer: (a: AtendidoEstoque) => void }) {
  const [todos, setTodos] = useState(false);
  if (!lista.length) return null;
  const aguardando = lista.filter((a) => a.reserva_status === 'reservado');
  const mostrar = todos ? lista : aguardando;
  return (
    <section className="mt-6 rounded-xl bg-superficie shadow-sm ring-1 ring-borda">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borda px-3 py-2">
        <div className="flex items-center gap-2"><Warehouse size={15} className="text-petroleo-600 dark:text-petroleo-100" /><h2 className="font-semibold">Atendidos pelo estoque</h2>
          <span className="text-xs text-suave">{aguardando.length} aguardando o Almoxarifado entregar</span></div>
        <Caixa marcado={todos} onChange={setTodos}>Mostrar os já entregues</Caixa>
      </div>
      {mostrar.length === 0 ? <p className="px-3 py-3 text-sm text-suave">Tudo o que foi atendido pelo estoque já foi entregue.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="text-left text-xs text-suave"><tr>
              <th className="px-3 py-2">Item</th><th className="w-28 px-2 py-2 text-right">Quantidade</th><th className="w-32 px-2 py-2 text-right">Custo</th>
              <th className="w-40 px-2 py-2">Para</th><th className="w-48 px-2 py-2">Situação</th>{podeEditar && <th className="w-24 px-2 py-2" />}
            </tr></thead>
            <tbody className="divide-y divide-borda">
              {mostrar.map((a) => (
                <tr key={a.item_id}>
                  <td className="px-3 py-1.5">{a.descricao}
                    {a.estoque_descricao && a.estoque_descricao !== a.descricao && <span className="block text-[11px] text-suave">do estoque: {a.estoque_descricao}</span>}
                    <Link to={`/compras/requisicoes/${a.requisicao_id}`} className="block font-mono text-[11px] text-roxo-600 hover:underline dark:text-roxo-100">{a.requisicao_codigo}</Link></td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{a.quantidade.toLocaleString('pt-BR')} {a.unidade}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{a.custo_unit != null ? moeda(a.quantidade * a.custo_unit) : '—'}
                    {a.custo_unit != null && <span className="block text-[11px] text-suave">{moeda(a.custo_unit)}/{a.unidade}</span>}</td>
                  <td className="px-2 py-1.5 text-xs">{a.destino || '—'}</td>
                  <td className="px-2 py-1.5 text-xs">{a.reserva_status === 'entregue'
                    ? <><Selo cor="verde">Entregue</Selo><span className="block text-suave">{a.entregue_para} · {dataHoraBR(a.entregue_em)}</span></>
                    : <><Selo cor="amarelo">Reservado</Selo><span className="block text-suave">desde {dataHoraBR(a.criado_em)}</span></>}</td>
                  {podeEditar && <td className="px-2 py-1.5 text-right">{a.reserva_status === 'reservado' && (
                    <Botao tamanho="sm" variante="secundario" onClick={() => desfazer(a)}><Undo2 size={13} /> Desfazer</Botao>)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DesfazerEstoque({ atendido, onFechar, onDesfazer }: { atendido: AtendidoEstoque; onFechar: () => void; onDesfazer: (motivo: string) => Promise<void> }) {
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  return (
    <Modal aberto titulo="Desfazer atendimento pelo estoque" onFechar={onFechar}>
      <div className="space-y-3 text-sm">
        <p><span className="font-medium">{atendido.descricao}</span> · {atendido.quantidade.toLocaleString('pt-BR')} {atendido.unidade}
          <span className="block text-xs text-suave">{atendido.requisicao_codigo} · {atendido.destino}</span></p>
        <p className="text-suave">A reserva é cancelada (o material fica livre no estoque) e o item volta para o À comprar. Fica registrado no histórico da requisição.</p>
        <Campo rotulo="Motivo (opcional)"><Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus placeholder="Ex.: material do estoque não serve" /></Campo>
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Voltar</Botao>
          <Botao disabled={salvando} onClick={async () => { setSalvando(true); await onDesfazer(motivo.trim()); setSalvando(false); }}><Undo2 size={14} /> Desfazer</Botao>
        </div>
      </div>
    </Modal>
  );
}
