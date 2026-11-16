import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Plus } from 'lucide-react';
import { mensagemErro, moeda } from '@/shared/lib/formato';
import { Aviso, Botao, CampoEscolha, Entrada, Selecao } from '@/shared/ui';
import { listarProdutos, salvarProduto, vincularProduto, type ItemComSolicitacao } from './api';
import { ROTULO_TIPO, TIPOS_PRODUTO, UNIDADES_PRODUTO, produtosParecidos, unidadeDoProduto, type TipoProduto } from './regras';

// Decisão 133: o produto do cadastro é escolhido (ou criado) na emissão da OC. Para cada item ainda sem produto,
// mostra os produtos parecidos que já existem, para não duplicar; "Cadastrar novo" cria o produto já ligado ao item.
// Itens do grupo Serviços ficam de fora.
export const precisaProduto = (i: ItemComSolicitacao) => !i.bib_id && i.grupo !== 'Serviços';

export function ProdutosDaOrdem({ itens, precos }: { itens: ItemComSolicitacao[]; precos: Record<string, number | undefined> }) {
  const qc = useQueryClient();
  const { data: todos = [] } = useQuery({ queryKey: ['compras', 'produtos'], queryFn: listarProdutos });
  const produtos = useMemo(() => todos.filter((p) => p.tipo === 'item'), [todos]);
  const [erro, setErro] = useState('');

  async function agir(f: () => Promise<unknown>) {
    setErro('');
    try { await f(); await qc.invalidateQueries({ queryKey: ['compras'] }); return true; } catch (e) { setErro(mensagemErro(e)); return false; }
  }

  return (
    <div className="space-y-2 rounded-lg bg-amber-50/60 p-3 ring-1 ring-amber-200 dark:bg-amber-500/5 dark:ring-amber-500/30">
      <div>
        <div className="font-medium">Produtos desta OC</div>
        <p className="text-xs text-suave">Ligue cada item a um produto do cadastro antes de gerar a ordem. Use um parecido que já existe ou cadastre um novo.</p>
      </div>
      {erro && <Aviso>{erro}</Aviso>}
      {itens.map((i) => <ItemSemProduto key={i.id} item={i} preco={precos[i.id]} produtos={produtos} agir={agir} />)}
    </div>
  );
}

function ItemSemProduto({ item, preco, produtos, agir }: {
  item: ItemComSolicitacao; preco: number | undefined; produtos: Awaited<ReturnType<typeof listarProdutos>>;
  agir: (f: () => Promise<unknown>) => Promise<boolean>;
}) {
  const parecidos = useMemo(() => produtosParecidos(produtos, item.descricao, item.grupo, 3), [produtos, item.descricao, item.grupo]);
  const opcoes = useMemo(() => produtos.map((p) => ({ valor: p.descricao, detalhe: p.grupo })), [produtos]);
  const [novo, setNovo] = useState(false);
  const [d, setD] = useState({
    grupo: ((TIPOS_PRODUTO as string[]).includes(item.grupo) ? item.grupo : 'Comerciais') as TipoProduto,
    descricao: item.descricao, unidade: unidadeDoProduto(item.unidade) as string,
  });
  const [salvando, setSalvando] = useState(false);

  const usar = (id: string) => agir(() => vincularProduto(item.id, id));
  function escolher(texto: string) {
    const p = produtos.find((x) => x.descricao === texto.trim());
    if (p) usar(p.id);
  }
  async function cadastrar() {
    setSalvando(true);
    await agir(async () => {
      const id = await salvarProduto(null, { grupo: d.grupo, descricao: d.descricao.trim(), unidade: d.unidade, valor: 0, ipi: 0, fornecedor_id: null, data: null });
      await vincularProduto(item.id, id);
    });
    setSalvando(false);
  }

  return (
    <div className="space-y-2 rounded-md bg-superficie p-2.5 ring-1 ring-borda">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">{item.descricao}</span>
        <span className="text-xs text-suave tabular-nums">{Number(item.quantidade).toLocaleString('pt-BR')} {item.unidade}{preco != null && ` · ${moeda(preco)}`} · {item.grupo}</span>
      </div>
      {parecidos.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-suave">Parecidos no cadastro:</span>
          {parecidos.map((p) => (
            <button key={p.id} type="button" onClick={() => usar(p.id)} title="Usar este produto"
              className="inline-flex items-center gap-1 rounded-full bg-pagina px-2 py-0.5 ring-1 ring-borda hover:text-roxo-600 hover:ring-roxo-300">
              <Check size={12} /> {p.descricao}
            </button>
          ))}
        </div>
      )}
      {novo ? (
        <div className="grid gap-2 sm:grid-cols-[1fr_140px_110px_auto]">
          <Entrada aria-label="Descrição do produto" value={d.descricao} onChange={(e) => setD({ ...d, descricao: e.target.value })} placeholder="Descrição (material entre parênteses)" />
          <Selecao aria-label="Tipo" value={d.grupo} onChange={(e) => setD({ ...d, grupo: e.target.value as TipoProduto })}>{TIPOS_PRODUTO.map((t) => <option key={t} value={t}>{ROTULO_TIPO[t]}</option>)}</Selecao>
          <Selecao aria-label="Unidade" value={d.unidade} onChange={(e) => setD({ ...d, unidade: e.target.value })}>{UNIDADES_PRODUTO.map((u) => <option key={u.valor} value={u.valor}>{u.rotulo}</option>)}</Selecao>
          <div className="flex gap-1">
            <Botao tamanho="sm" disabled={salvando || d.descricao.trim().length < 2} onClick={cadastrar}>Cadastrar</Botao>
            <Botao tamanho="sm" variante="fantasma" onClick={() => setNovo(false)}>Voltar</Botao>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[220px] flex-1"><CampoEscolha valor="" opcoes={opcoes} placeholder="Buscar outro produto no cadastro…" celula={false} onConfirmar={escolher} /></div>
          <Botao tamanho="sm" variante="secundario" onClick={() => setNovo(true)}><Plus size={13} /> Cadastrar novo</Botao>
        </div>
      )}
    </div>
  );
}
