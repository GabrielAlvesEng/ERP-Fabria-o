import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, FileText, Pencil, Plus } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, mensagemErro, moeda } from '@/shared/lib/formato';
import { Aviso, Botao, Cabecalho, Entrada, EsqueletoTabela, Modal, Selecao, Selo, Vazio } from '@/shared/ui';
import { abrirArquivo, desativarProduto, listarCatalogo, precosDoProduto, type ProdutoCompras } from './api';
import { ROTULO_PRECO, ROTULO_TIPO, TIPOS_PRODUTO, comImpostos, type OrigemPreco } from './regras';
import { CadastroProdutoModal } from './CadastroProduto';
import { LerOrcamentoModal } from './LerOrcamento';

// Compras → Produtos (decisões 107, 114 e 121): a lista única de produtos de onde todos os setores puxam.
// Cada produto é tipo + descrição (material entre parênteses) + unidade + preço atual; o preço atual é o último cotado ou
// comprado (o estimado só vale enquanto não há preço real) e a ficha mostra o histórico inteiro.
const COR_PRECO: Record<OrigemPreco, 'amarelo' | 'azul' | 'verde'> = { estimado: 'amarelo', cotado: 'azul', comprado: 'verde' };
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function ProdutosPage() {
  const { pode } = useAuth();
  const [modal, setModal] = useState<null | 'novo' | 'ler'>(null);
  const qc = useQueryClient();
  const podeEditar = pode('compras', 'editar');
  return (
    <>
      <Cabecalho titulo="Produtos" subtitulo="A lista de produtos de todos os setores: só Compras cadastra. O valor é o da última cotação ou compra."
        acoes={podeEditar ? <>
          <Botao variante="secundario" onClick={() => setModal('ler')}><FileText size={15} /> Ler orçamento</Botao>
          <Botao onClick={() => setModal('novo')}><Plus size={15} /> Cadastrar produto</Botao>
        </> : undefined} />
      <Lista podeEditar={podeEditar} />
      {modal === 'novo' && <CadastroProdutoModal onFechar={() => setModal(null)} onSalvo={() => qc.invalidateQueries({ queryKey: ['compras'] })} />}
      {modal === 'ler' && <LerOrcamentoModal onFechar={() => setModal(null)} />}
    </>
  );
}

function Lista({ podeEditar }: { podeEditar: boolean }) {
  const { data: produtos = [], isLoading } = useQuery({ queryKey: ['compras', 'catalogo'], queryFn: listarCatalogo });
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const termo = norm(busca);
  const lista = produtos.filter((p) => (!tipo || p.grupo === tipo) && (!termo || norm(`${p.descricao} ${p.fornecedores?.nome ?? ''}`).includes(termo)));
  const visiveis = lista.slice(0, 500);
  const produto = produtos.find((p) => p.id === aberto) ?? null;

  if (isLoading) return <EsqueletoTabela />;
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        <Entrada placeholder="Buscar produto ou fornecedor" value={busca} onChange={(e) => setBusca(e.target.value)} className="w-72" />
        <Selecao value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-48">
          <option value="">Todos os tipos</option>
          {TIPOS_PRODUTO.map((t) => <option key={t} value={t}>{ROTULO_TIPO[t]}</option>)}
        </Selecao>
        <span className="self-center text-xs text-suave">{lista.length} produto(s){lista.length > visiveis.length && `, mostrando ${visiveis.length}`}</span>
      </div>
      {lista.length === 0 ? <Vazio>{produtos.length ? 'Nenhum produto encontrado.' : 'Nenhum produto cadastrado. Use "Cadastrar produto" ou "Ler orçamento".'}</Vazio> : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-borda">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-pagina text-left text-xs text-suave"><tr>
              <th className="px-3 py-2">Produto</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Un.</th>
              <th className="px-3 py-2 text-right">Valor unit.</th><th className="px-3 py-2 text-right">IPI</th><th className="px-3 py-2 text-right">Com impostos</th>
              <th className="px-3 py-2">Fornecedor</th><th className="px-3 py-2">Data</th><th className="px-3 py-2">Origem</th>
            </tr></thead>
            <tbody className="divide-y divide-borda">
              {visiveis.map((p) => (
                <tr key={p.id} className="cursor-pointer hover:bg-pagina" onClick={() => setAberto(p.id)}>
                  <td className="px-3 py-2">{p.descricao}</td>
                  <td className="px-3 py-2">{ROTULO_TIPO[p.grupo] ?? p.grupo}</td>
                  <td className="px-3 py-2">{p.unidade}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.preco_origem ? moeda(p.valor) : ''}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.preco_origem && Number(p.ipi) > 0 ? `${Number(p.ipi).toLocaleString('pt-BR')}%` : ''}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{p.preco_origem ? moeda(comImpostos(p.valor, p.ipi)) : ''}</td>
                  <td className="px-3 py-2">{p.fornecedores?.nome ?? ''}</td>
                  <td className="px-3 py-2">{dataBR(p.preco_data)}</td>
                  <td className="px-3 py-2">{p.preco_origem ? <Selo cor={COR_PRECO[p.preco_origem]}>{ROTULO_PRECO[p.preco_origem]}</Selo> : <span className="text-xs text-suave">sem preço</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal aberto={!!produto} titulo={produto?.descricao ?? ''} onFechar={() => setAberto(null)} largura="max-w-4xl">
        {produto && <Ficha p={produto} podeEditar={podeEditar} onFechar={() => setAberto(null)} />}
      </Modal>
    </>
  );
}

function Ficha({ p, podeEditar, onFechar }: { p: ProdutoCompras; podeEditar: boolean; onFechar: () => void }) {
  const qc = useQueryClient();
  const [editar, setEditar] = useState(false);
  const [erro, setErro] = useState('');
  const { data: precos = [], isLoading } = useQuery({ queryKey: ['compras', 'precos', p.id], queryFn: () => precosDoProduto(p.id) });
  async function desativar() {
    if (!confirm(`Desativar "${p.descricao}"? Ele some das listas de escolha, mas o histórico fica.`)) return;
    try {
      await desativarProduto(p.id);
      await qc.invalidateQueries({ queryKey: ['compras'] }); await qc.invalidateQueries({ queryKey: ['bib'] });
      onFechar();
    } catch (e) { setErro(mensagemErro(e)); }
  }
  const reais = precos.filter((x) => x.origem !== 'estimado').map((x) => comImpostos(x.valor_unit, x.ipi));
  return (
    <div className="space-y-3 text-sm">
      {podeEditar && (
        <div className="flex flex-wrap justify-end gap-2">
          <Botao tamanho="sm" variante="secundario" onClick={() => setEditar(true)}><Pencil size={14} /> Editar</Botao>
          <Botao tamanho="sm" variante="secundario" onClick={desativar}><Ban size={14} /> Desativar</Botao>
        </div>
      )}
      {erro && <Aviso>{erro}</Aviso>}
      {editar && <CadastroProdutoModal produto={p} onFechar={() => setEditar(false)} onSalvo={() => qc.invalidateQueries({ queryKey: ['compras'] })} />}
      <div className="grid gap-2 sm:grid-cols-4">
        <Info rotulo="Tipo" valor={ROTULO_TIPO[p.grupo] ?? p.grupo} />
        <Info rotulo="Unidade" valor={p.unidade} />
        <Info rotulo="Valor unitário" valor={p.preco_origem ? `${moeda(p.valor)}${Number(p.ipi) > 0 ? ` + IPI ${Number(p.ipi).toLocaleString('pt-BR')}%` : ''}` : '—'} />
        <Info rotulo="Valor com impostos" valor={p.preco_origem ? moeda(comImpostos(p.valor, p.ipi)) : '—'} />
        <Info rotulo="Fornecedor" valor={p.fornecedores?.nome ?? (p.preco_origem === 'estimado' ? 'Estimado (sem fornecedor)' : '—')} />
        <Info rotulo="Data" valor={dataBR(p.preco_data) || '—'} />
        <Info rotulo="Origem do valor" valor={p.preco_origem ? ROTULO_PRECO[p.preco_origem] : 'Sem preço'} />
        <Info rotulo="Menor preço real (com impostos)" valor={reais.length ? moeda(Math.min(...reais)) : '—'} />
      </div>
      <h3 className="pt-1 font-semibold">Histórico de preços</h3>
      {isLoading ? <EsqueletoTabela linhas={3} colunas={6} /> : precos.length === 0 ? <Vazio>Ainda não há preço lançado para este produto.</Vazio> : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-borda">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-pagina text-left text-xs text-suave"><tr>
              <th className="px-3 py-2">Data</th><th className="px-3 py-2">Origem</th><th className="px-3 py-2">Fornecedor</th>
              <th className="px-3 py-2 text-right">Valor unit.</th><th className="px-3 py-2 text-right">IPI</th><th className="px-3 py-2 text-right">Com impostos</th>
              <th className="px-3 py-2">Documento</th><th className="px-3 py-2">Lançado por</th>
            </tr></thead>
            <tbody className="divide-y divide-borda">
              {precos.map((x) => (
                <tr key={x.id}>
                  <td className="px-3 py-2">{dataBR(x.data)}</td>
                  <td className="px-3 py-2"><Selo cor={COR_PRECO[x.origem]}>{ROTULO_PRECO[x.origem]}</Selo></td>
                  <td className="px-3 py-2">{x.fornecedores?.nome ?? ''}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{moeda(x.valor_unit)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{Number(x.ipi) > 0 ? `${Number(x.ipi).toLocaleString('pt-BR')}%` : ''}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{moeda(comImpostos(x.valor_unit, x.ipi))}</td>
                  <td className="px-3 py-2">
                    {x.compras_pedidos?.codigo && <span className="mr-2 font-mono">{x.compras_pedidos.codigo}</span>}
                    {x.documento && <button type="button" className="text-roxo-600 underline dark:text-roxo-100" onClick={() => abrirArquivo(x.documento).catch((e) => setErro(mensagemErro(e)))}>PDF</button>}
                  </td>
                  <td className="px-3 py-2 text-xs text-suave">{x.usuarios?.nome ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return <div className="rounded-lg bg-pagina px-3 py-2"><p className="text-xs text-suave">{rotulo}</p><p className="font-medium">{valor}</p></div>;
}
