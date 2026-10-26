import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dataBR, moeda } from '@/shared/lib/formato';
import { Cabecalho, Entrada, EsqueletoTabela, Modal, Selecao, Selo, Vazio } from '@/shared/ui';
import { ChapasAba } from '@/modules/admin/predefinicoes/ChapasAba';
import { PerfisAba } from '@/modules/admin/predefinicoes/PerfisAba';
import { ItensAba, MateriaisBaseAba, RevisarAba } from '@/modules/admin/predefinicoes/OutrasAbas';
import { FixadoresAba } from '@/modules/admin/predefinicoes/FixadoresAba';
import { SubAbas } from '@/modules/admin/predefinicoes/comum';
import { listarHistorico, listarProdutos, type Historico } from './api';
import { GRUPOS, ROTULO_ORIGEM, fichasDeProdutos, type FichaProduto } from './regras';

const ABAS = ['Produtos e última compra', 'Chapas', 'Perfis', 'Itens comerciais', 'Fixadores', 'Consumíveis', 'Materiais e densidades', 'A revisar'] as const;

// Compras → Produtos (decisão 107): a Biblioteca de Materiais, a biblioteca geral de onde todos os setores puxam
// (Engenharia, propostas, Almoxarifado). Só Compras cadastra e organiza; a primeira aba mostra a ficha de cada produto
// com o histórico de compras.
export function ProdutosPage() {
  const [aba, setAba] = useState<(typeof ABAS)[number]>(ABAS[0]);
  return (
    <>
      <Cabecalho titulo="Produtos" subtitulo="A biblioteca geral de materiais: só Compras cadastra e organiza, e a Engenharia, as propostas e o Almoxarifado usam os mesmos itens." />
      <SubAbas abas={ABAS} ativa={aba} onTrocar={setAba} />
      <div key={aba} className="entrar">
        {aba === 'Produtos e última compra' && <Fichas />}
        {aba === 'Chapas' && <ChapasAba />}
        {aba === 'Perfis' && <PerfisAba />}
        {aba === 'Itens comerciais' && <ItensAba grupo="Comerciais" />}
        {aba === 'Fixadores' && <FixadoresAba />}
        {aba === 'Consumíveis' && <ItensAba grupo="Consumíveis" />}
        {aba === 'Materiais e densidades' && <MateriaisBaseAba />}
        {aba === 'A revisar' && <RevisarAba />}
      </div>
    </>
  );
}

function Fichas() {
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
        <Selecao value={grupo} onChange={(e) => setGrupo(e.target.value)} className="w-44">
          <option value="">Todos os grupos</option>
          {GRUPOS.map((g) => <option key={g} value={g}>{g}</option>)}
        </Selecao>
        <Selecao value={so} onChange={(e) => setSo(e.target.value as typeof so)} className="w-44">
          <option value="todos">Todos</option><option value="comprados">Já comprados</option><option value="nunca">Nunca comprados</option>
        </Selecao>
        <span className="self-center text-xs text-suave">{lista.length} produto(s){lista.length > visiveis.length && `, mostrando ${visiveis.length}`}</span>
      </div>
      {lista.length === 0 ? <Vazio>Nenhum produto encontrado. Cadastre nas abas ao lado.</Vazio> : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-borda">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-pagina text-left text-xs text-suave"><tr>
              <th className="px-3 py-2">Produto</th><th className="px-3 py-2">Grupo</th><th className="px-3 py-2">Última compra</th>
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
        {aberta && <FichaDetalhe f={aberta} />}
      </Modal>
    </>
  );
}

function FichaDetalhe({ f }: { f: FichaProduto<Historico> }) {
  const fornecedores = [...new Set(f.compras.map((c) => c.fornecedor_nome))];
  const precos = f.compras.map((c) => Number(c.valor_unit));
  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-2 sm:grid-cols-3">
        <Info rotulo="Grupo" valor={f.grupo} />
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
      <td className="px-3 py-2 text-right tabular-nums">{moeda(c.valor_unit)}</td>
    </tr>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return <div className="rounded-lg bg-pagina px-3 py-2"><p className="text-xs text-suave">{rotulo}</p><p className="font-medium">{valor}</p></div>;
}
