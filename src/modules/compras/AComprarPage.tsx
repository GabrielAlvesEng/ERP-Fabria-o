import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, PackagePlus, Plus, Search, X } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, hojeISO, mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Cabecalho, Caixa, Campo, CampoCelula, CampoEscolha, CampoNumero, Entrada, EsqueletoTabela, Modal, Selecao, Selo, Vazio } from '@/shared/ui';
import {
  adicionarAoPacote, atualizarItem, cadastrarItemBiblioteca, criarPacote, listarAComprar, listarProdutos, pacotesAbertos, type ItemComSolicitacao,
} from './api';
import { GRUPOS, ROTULO_DESTINO, ROTULO_TIPO, TIPOS_PRODUTO, UNIDADES, agruparAComprar, destinoDe, rotuloDestino, type Destino, type GrupoItem, type TipoProduto } from './regras';
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
  const [busca, setBusca] = useState('');
  const [destino, setDestino] = useState<Destino | ''>('');
  const [grupo, setGrupo] = useState<GrupoItem | ''>('');
  const [soUrgente, setSoUrgente] = useState(false);
  const [soSemCadastro, setSoSemCadastro] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState('');
  const [modal, setModal] = useState<null | 'nova' | 'pacote' | { cadastrar: ItemComSolicitacao }>(null);
  const [pacoteDestino, setPacoteDestino] = useState('');
  const podeEditar = pode('compras', 'editar');
  const hoje = hojeISO();

  async function agir(f: () => Promise<unknown>) {
    setErro('');
    try { await f(); await qc.invalidateQueries({ queryKey: ['compras'] }); return true; } catch (e) { setErro(mensagemErro(e)); return false; }
  }

  const termo = norm(busca.trim());
  const visiveis = itens.filter((i) => {
    const r = i.compras_requisicoes;
    return (!destino || destinoDe(r) === destino) && (!grupo || i.grupo === grupo) && (!soUrgente || r.prioridade === 'urgente')
      && (!soSemCadastro || !i.bib_id)
      && (!termo || norm(`${i.descricao} ${r.codigo} ${r.titulo} ${r.projeto_codigo} ${r.setor}`).includes(termo));
  });
  const grupos = agruparAComprar(visiveis);
  // Itens que saíram da lista (foram para pacote por outra tela) deixam de contar na seleção.
  const selecionados = itens.filter((i) => sel.has(i.id));
  const semCadastroSel = selecionados.filter((i) => !i.bib_id).length;

  const marcar = (ids: string[], v: boolean) => setSel((s) => { const n = new Set(s); ids.forEach((id) => (v ? n.add(id) : n.delete(id))); return n; });

  async function adicionarEmPacote() {
    if (!pacoteDestino) return;
    if (await agir(() => adicionarAoPacote(pacoteDestino, selecionados.map((i) => i.id)))) { setSel(new Set()); navegar(`/compras/cotacoes/${pacoteDestino}`); }
  }

  const indicadores: [string, number, string?][] = [
    ['Itens à comprar', itens.length],
    ['Sem cadastro de produto', itens.filter((i) => !i.bib_id).length, 'text-amber-600'],
    ['Urgentes', itens.filter((i) => i.compras_requisicoes.prioridade === 'urgente').length, 'text-red-600 dark:text-red-300'],
    ['Atrasados', itens.filter((i) => i.compras_requisicoes.necessario_em && i.compras_requisicoes.necessario_em < hoje).length, 'text-red-600 dark:text-red-300'],
    ['Pacotes em cotação', abertos.length],
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
        <Caixa marcado={soSemCadastro} onChange={setSoSemCadastro}>Só sem cadastro</Caixa>
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
                    </tr></thead>
                    <tbody className="divide-y divide-borda">
                      {g.itens.map((i) => (
                        <LinhaItem key={i.id} i={i} produtos={produtos} hoje={hoje} podeEditar={podeEditar} marcado={sel.has(i.id)}
                          onMarcar={(v) => marcar([i.id], v)} agir={agir} cadastrar={() => setModal({ cadastrar: i })} />
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

      {podeEditar && selecionados.length > 0 && (
        <div className="sticky bottom-3 z-20 mt-3 rounded-xl bg-superficie/95 px-4 py-3 shadow-lg ring-1 ring-roxo-200 backdrop-blur dark:ring-roxo-700">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">{selecionados.length} item(ns) selecionado(s)</span>
            {semCadastroSel > 0 && <span className="flex items-center gap-1 text-xs text-amber-600"><AlertTriangle size={13} /> {semCadastroSel} sem cadastro</span>}
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
      {modal && typeof modal === 'object' && (
        <CadastrarProduto item={modal.cadastrar} onFechar={() => setModal(null)}
          onSalvar={(d) => agir(async () => {
            const bib = await cadastrarItemBiblioteca(d);
            await atualizarItem(modal.cadastrar.id, { descricao: d.descricao.trim(), grupo: d.grupo, unidade: d.unidade, bib_tipo: 'item', bib_id: bib });
          })} />
      )}
    </>
  );
}

function LinhaItem({ i, produtos, hoje, podeEditar, marcado, onMarcar, agir, cadastrar }: {
  i: ItemComSolicitacao; produtos: Awaited<ReturnType<typeof listarProdutos>>; hoje: string; podeEditar: boolean; marcado: boolean;
  onMarcar: (v: boolean) => void; agir: (f: () => Promise<unknown>) => Promise<boolean>; cadastrar: () => void;
}) {
  const r = i.compras_requisicoes;
  const opcoes = useMemo(() => produtos.map((p) => ({ valor: p.descricao, detalhe: p.grupo })), [produtos]);
  const porDescricao = useMemo(() => new Map(produtos.map((p) => [p.descricao, p])), [produtos]);
  const d = destinoDe(r);
  const atrasado = !!r.necessario_em && r.necessario_em < hoje;
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
      <td className="px-1 py-1">
        {podeEditar ? <CampoEscolha valor={i.descricao} opcoes={opcoes} placeholder="Produto" onConfirmar={trocarDescricao} /> : <span className="px-2">{i.descricao}</span>}
        {!i.bib_id && (
          <span className="flex items-center gap-2 px-2 text-[11px] text-amber-600">sem cadastro de produto
            {podeEditar && <button type="button" onClick={cadastrar} className="font-medium text-roxo-600 hover:underline dark:text-roxo-100">Cadastrar</button>}
          </span>
        )}
        {i.observacoes && <span className="block px-2 text-[11px] text-suave">{i.observacoes}</span>}
        <Referencia link={i.referencia_link} imagem={i.referencia_imagem} />
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
    </tr>
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
  const semCadastro = itens.filter((i) => !i.bib_id).length;
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
        {semCadastro > 0 && <p className="text-xs text-amber-600">{semCadastro} item(ns) ainda sem cadastro de produto. Dá para seguir, mas o histórico de preço só fica ligado ao produto quando ele está cadastrado.</p>}
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao disabled={salvando} onClick={criar}><PackagePlus size={15} /> {salvando ? 'Criando…' : 'Criar pacote'}</Botao>
        </div>
      </div>
    </Modal>
  );
}

// Cadastro rápido do produto (decisão 121): o item fica ligado a ele. O preço vem depois, pela cotação ou em Produtos.
function CadastrarProduto({ item, onFechar, onSalvar }: {
  item: ItemComSolicitacao; onFechar: () => void; onSalvar: (d: { grupo: TipoProduto; descricao: string; unidade: string }) => Promise<boolean>;
}) {
  const [d, setD] = useState({ grupo: ((TIPOS_PRODUTO as string[]).includes(item.grupo) ? item.grupo : 'Comerciais') as TipoProduto, descricao: item.descricao, unidade: item.unidade || 'un' });
  const [salvando, setSalvando] = useState(false);
  return (
    <Modal aberto titulo="Cadastrar produto" onFechar={onFechar}>
      <div className="space-y-3 text-sm">
        <Campo rotulo="Descrição no cadastro (com o material entre parênteses)"><Entrada value={d.descricao} onChange={(e) => setD({ ...d, descricao: e.target.value })} autoFocus /></Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Tipo"><Selecao value={d.grupo} onChange={(e) => setD({ ...d, grupo: e.target.value as TipoProduto })}>{TIPOS_PRODUTO.map((t) => <option key={t} value={t}>{ROTULO_TIPO[t]}</option>)}</Selecao></Campo>
          <Campo rotulo="Unidade"><Entrada list="compras-unidades" value={d.unidade} onChange={(e) => setD({ ...d, unidade: e.target.value })} /></Campo>
        </div>
        <p className="text-xs text-suave">O produto entra em Produtos, sem preço, e este item fica ligado a ele.</p>
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao disabled={salvando || d.descricao.trim().length < 2} onClick={async () => { setSalvando(true); if (await onSalvar({ ...d, unidade: d.unidade.trim() || 'un' })) onFechar(); setSalvando(false); }}>Cadastrar</Botao>
        </div>
      </div>
    </Modal>
  );
}
