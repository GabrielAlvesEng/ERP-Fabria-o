import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Pencil, Plus, TableProperties } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, mensagemErro, moeda } from '@/shared/lib/formato';
import { Aviso, Botao, Cabecalho, Entrada, EsqueletoTabela, Modal, Selecao, Selo, Vazio } from '@/shared/ui';
import { atualizar } from '@/modules/biblioteca/api';
import { listarHistorico, listarProdutos, type Historico } from './api';
import { GRUPOS, ROTULO_ORIGEM, fichasDeProdutos, type FichaProduto } from './regras';
import { CadastroProdutoModal, TabelasApoioModal } from './CadastroProduto';

// Compras → Produtos (decisões 107 e 114): a Biblioteca de Materiais numa página só, a biblioteca geral de onde todos os
// setores puxam (Engenharia, propostas, Almoxarifado). Só Compras cadastra e organiza. Cada produto mostra o histórico de
// compras; "Cadastrar produto" abre o formulário do tipo escolhido (chapa, perfil, item comercial, fixador, consumível).
export function ProdutosPage() {
  const { pode } = useAuth();
  const [modal, setModal] = useState<null | 'novo' | 'apoio'>(null);
  const qc = useQueryClient();
  const podeEditar = pode('compras', 'editar');
  return (
    <>
      <Cabecalho titulo="Produtos" subtitulo="A biblioteca geral de materiais: só Compras cadastra e organiza, e a Engenharia, as propostas e o Almoxarifado usam os mesmos itens."
        acoes={podeEditar ? <>
          <Botao variante="secundario" onClick={() => setModal('apoio')}><TableProperties size={15} /> Tabelas de apoio</Botao>
          <Botao onClick={() => setModal('novo')}><Plus size={15} /> Cadastrar produto</Botao>
        </> : undefined} />
      <Fichas podeEditar={podeEditar} />
      {modal === 'novo' && <CadastroProdutoModal onFechar={() => setModal(null)} onSalvo={() => qc.invalidateQueries({ queryKey: ['compras'] })} />}
      {modal === 'apoio' && <TabelasApoioModal onFechar={() => { setModal(null); qc.invalidateQueries({ queryKey: ['compras'] }); }} />}
    </>
  );
}

function Fichas({ podeEditar }: { podeEditar: boolean }) {
  const produtos = useQuery({ queryKey: ['compras', 'produtos'], queryFn: listarProdutos });
  const historico = useQuery({ queryKey: ['compras', 'historico'], queryFn: listarHistorico });
  const [busca, setBusca] = useState('');
  const [grupo, setGrupo] = useState('');
  const [so, setSo] = useState<'todos' | 'comprados' | 'nunca'>('todos');
  const [aberta, setAberta] = useState<FichaProduto<Historico> | null>(null);

  const fichas = useMemo(() => fichasDeProdutos(produtos.data ?? [], historico.data ?? []), [produtos.data, historico.data]);
  const termo = busca.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const lista = fichas.filter((f) =>
    (!grupo || f.grupo === grupo) &&
    (so === 'todos' || (so === 'comprados' ? f.compras.length > 0 : f.compras.length === 0)) &&
    (!termo || f.busca.includes(termo)));
  const visiveis = lista.slice(0, 300);

  if (produtos.isLoading || historico.isLoading) return <EsqueletoTabela />;
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        <Entrada placeholder="Buscar produto, fornecedor ou OC" value={busca} onChange={(e) => setBusca(e.target.value)} className="w-72" />
        <Selecao value={grupo} onChange={(e) => setGrupo(e.target.value)} className="w-48">
          <option value="">Todas as categorias</option>
          {GRUPOS.map((g) => <option key={g} value={g}>{g}</option>)}
        </Selecao>
        <Selecao value={so} onChange={(e) => setSo(e.target.value as typeof so)} className="w-44">
          <option value="todos">Todos</option><option value="comprados">Já comprados</option><option value="nunca">Nunca comprados</option>
        </Selecao>
        <span className="self-center text-xs text-suave">{lista.length} produto(s){lista.length > visiveis.length && `, mostrando ${visiveis.length}`}</span>
      </div>
      {lista.length === 0 ? <Vazio>Nenhum produto encontrado.</Vazio> : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-borda">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-pagina text-left text-xs text-suave"><tr>
              <th className="px-3 py-2">Produto</th><th className="px-3 py-2">Categoria</th><th className="px-3 py-2">Última compra</th>
              <th className="px-3 py-2">Onde comprou</th><th className="px-3 py-2 text-right">Último preço</th><th className="px-3 py-2 text-right">Compras</th>
            </tr></thead>
            <tbody className="divide-y divide-borda">
              {visiveis.map((f) => {
                const u = f.compras[0];
                return (
                  <tr key={f.chave} className="cursor-pointer hover:bg-pagina" onClick={() => setAberta(f)}>
                    <td className="px-3 py-2">{f.descricao}{!f.cadastrado && <span className="ml-2"><Selo cor="amarelo">sem cadastro</Selo></span>}</td>
                    <td className="px-3 py-2">{f.grupo}</td>
                    <td className="px-3 py-2">{u ? dataBR(u.emitido_em) : <span className="text-suave">nunca</span>}</td>
                    <td className="px-3 py-2">{u?.fornecedor_nome ?? ''}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{u ? `${moeda(u.valor_unit)}/${u.unidade}` : ''}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{f.compras.length || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Modal aberto={!!aberta} titulo={aberta?.descricao ?? ''} onFechar={() => setAberta(null)} largura="max-w-3xl">
        {aberta && <FichaDetalhe f={aberta} podeEditar={podeEditar} onFechar={() => setAberta(null)} />}
      </Modal>
    </>
  );
}

const TABELA = { chapa: 'bib_chapas', perfil: 'bib_perfis', item: 'bib_itens' } as const;

function FichaDetalhe({ f, podeEditar, onFechar }: { f: FichaProduto<Historico>; podeEditar: boolean; onFechar: () => void }) {
  const qc = useQueryClient();
  const [editar, setEditar] = useState(false);
  const [erro, setErro] = useState('');
  async function desativar() {
    if (!f.tipo || !f.id || !confirm(`Desativar "${f.descricao}"? Ele some das listas de escolha, mas o histórico fica.`)) return;
    try {
      await atualizar(TABELA[f.tipo], { id: f.id }, { ativo: false });
      await qc.invalidateQueries({ queryKey: ['compras'] }); await qc.invalidateQueries({ queryKey: ['bib'] });
      onFechar();
    } catch (e) { setErro(mensagemErro(e)); }
  }
  const fornecedores = [...new Set(f.compras.map((c) => c.fornecedor_nome))];
  const precos = f.compras.map((c) => Number(c.valor_unit));
  return (
    <div className="space-y-3 text-sm">
      {podeEditar && f.cadastrado && (
        <div className="flex flex-wrap justify-end gap-2">
          <Botao tamanho="sm" variante="secundario" onClick={() => setEditar(true)}><Pencil size={14} /> Editar cadastro</Botao>
          <Botao tamanho="sm" variante="secundario" onClick={desativar}><Ban size={14} /> Desativar</Botao>
        </div>
      )}
      {erro && <Aviso>{erro}</Aviso>}
      {editar && f.tipo && f.id && (
        <CadastroProdutoModal editar={{ tipo: f.tipo, id: f.id, grupo: f.grupo }} onFechar={() => setEditar(false)}
          onSalvo={() => { qc.invalidateQueries({ queryKey: ['compras'] }); onFechar(); }} />
      )}
      <div className="grid gap-2 sm:grid-cols-3">
        <Info rotulo="Categoria" valor={f.grupo} />
        <Info rotulo="Unidade" valor={f.unidade} />
        <Info rotulo="Cadastro" valor={f.cadastrado ? 'Biblioteca de Materiais' : 'Sem cadastro (só descrição)'} />
        <Info rotulo="Última compra" valor={f.compras[0] ? `${dataBR(f.compras[0].emitido_em)} · ${f.compras[0].fornecedor_nome}` : 'Nunca comprado'} />
        <Info rotulo="Último preço" valor={f.compras[0] ? moeda(f.compras[0].valor_unit) : '—'} />
        <Info rotulo="Menor preço já pago" valor={precos.length ? moeda(Math.min(...precos)) : '—'} />
      </div>
      {fornecedores.length > 0 && <p><span className="text-suave">Fornecedores que já venderam:</span> {fornecedores.join(', ')}</p>}
      {f.compras.length === 0 ? <Vazio>Ainda não há ordem de compra deste produto.</Vazio> : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-borda">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-pagina text-left text-xs text-suave"><tr>
              <th className="px-3 py-2">Data</th><th className="px-3 py-2">OC</th><th className="px-3 py-2">Fornecedor</th><th className="px-3 py-2">Para</th>
              <th className="px-3 py-2 text-right">Qtd.</th><th className="px-3 py-2 text-right">Preço unit.</th>
            </tr></thead>
            <tbody className="divide-y divide-borda">
              {f.compras.map((c) => <LinhaHistorico key={`${c.pedido_id}-${c.item_id}`} c={c} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LinhaHistorico({ c }: { c: Historico }) {
  return (
    <tr>
      <td className="px-3 py-2">{dataBR(c.emitido_em)}</td>
      <td className="px-3 py-2 font-mono">{c.pedido_codigo}<span className="block text-xs text-suave">{c.requisicao_codigo}</span></td>
      <td className="px-3 py-2">{c.fornecedor_nome}</td>
      <td className="px-3 py-2">{c.projeto_codigo ? <span className="font-mono">{c.projeto_codigo}</span> : c.origem === 'almoxarifado' ? 'Estoque' : ROTULO_ORIGEM[c.origem]}</td>
      <td className="px-3 py-2 text-right tabular-nums">{Number(c.quantidade).toLocaleString('pt-BR')} {c.unidade}</td>
      <td className="px-3 py-2 text-right tabular-nums">{moeda(c.valor_unit)}{Number(c.ipi) > 0 && <span className="block text-[11px] text-suave">+ IPI {Number(c.ipi).toLocaleString('pt-BR')}%</span>}</td>
    </tr>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return <div className="rounded-lg bg-pagina px-3 py-2"><p className="text-xs text-suave">{rotulo}</p><p className="font-medium">{valor}</p></div>;
}
