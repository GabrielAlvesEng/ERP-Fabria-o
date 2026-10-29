import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Loader2, Plus, Upload } from 'lucide-react';
import { mensagemErro, moeda } from '@/shared/lib/formato';
import { Aviso, Botao, Campo, CampoNumero, Entrada, Modal, Selecao } from '@/shared/ui';
import { abrirArquivo, gravarOrcamento, lerOrcamento, listarCatalogo, listarFornecedores, salvarFornecedor, type OrcamentoLido } from './api';
import { ROTULO_TIPO, TIPOS_PRODUTO, UNIDADES_PRODUTO, casarProduto, comImpostos, type TipoProduto } from './regras';

// Compras → Produtos → "Ler orçamento" (decisão 121): o PDF do fornecedor vira um rascunho que o comprador corrige.
// Cada linha marcada atualiza o preço de um produto (ou cria o produto) como "Cotado", com o PDF no histórico.
interface Linha {
  chave: string; marcado: boolean; original: string; grupo: TipoProduto; descricao: string; unidade: string;
  quantidade: number; valor_unit: number; ipi: number; produto_id: string; escolhido: boolean;
}
const digitos = (s: string) => s.replace(/\D/g, '');
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export function LerOrcamentoModal({ onFechar }: { onFechar: () => void }) {
  const qc = useQueryClient();
  const { data: catalogo = [] } = useQuery({ queryKey: ['compras', 'catalogo'], queryFn: listarCatalogo });
  const { data: fornecedores = [] } = useQuery({ queryKey: ['compras', 'fornecedores'], queryFn: listarFornecedores });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState('');
  const [lido, setLido] = useState<{ caminho: string; orcamento: OrcamentoLido } | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [fornecedor, setFornecedor] = useState('');
  const [data, setData] = useState('');
  const [gravando, setGravando] = useState(false);
  const [feito, setFeito] = useState(0);

  const casar = (grupo: TipoProduto, descricao: string) => casarProduto(catalogo, grupo, descricao)?.id ?? '';

  async function ler() {
    if (!arquivo) return;
    setLendo(true); setErro('');
    try {
      const r = await lerOrcamento(arquivo);
      const o = r.orcamento;
      setLido(r);
      setData(/^\d{4}-\d{2}-\d{2}$/.test(o.data) ? o.data : '');
      const cnpj = digitos(o.cnpj);
      const achado = fornecedores.find((f) => cnpj && digitos(f.cnpj) === cnpj)
        ?? fornecedores.find((f) => o.fornecedor && (norm(o.fornecedor).includes(norm(f.nome)) || norm(f.nome).includes(norm(o.fornecedor))));
      setFornecedor(achado?.id ?? '');
      setLinhas(o.itens.map((i, n) => {
        const grupo = TIPOS_PRODUTO.includes(i.tipo) ? i.tipo : 'Comerciais';
        return {
          chave: String(n), marcado: true, original: i.descricao_original, grupo, descricao: i.descricao, unidade: i.unidade,
          quantidade: Number(i.quantidade) || 0, valor_unit: Number(i.valor_unit) || 0, ipi: Number(i.ipi) || 0,
          produto_id: casar(grupo, i.descricao), escolhido: false,
        };
      }));
    } catch (e) { setErro(mensagemErro(e)); }
    setLendo(false);
  }

  const mudar = (chave: string, m: Partial<Linha>) => setLinhas((ls) => ls.map((l) => {
    if (l.chave !== chave) return l;
    const n = { ...l, ...m };
    // Enquanto o comprador não escolhe o produto à mão, ele segue a descrição e o tipo.
    if (!n.escolhido && (m.descricao !== undefined || m.grupo !== undefined)) n.produto_id = casar(n.grupo, n.descricao);
    return n;
  }));

  async function cadastrarFornecedor() {
    if (!lido) return;
    try {
      await salvarFornecedor({ nome: lido.orcamento.fornecedor.trim(), cnpj: digitos(lido.orcamento.cnpj) });
      const lista = await qc.fetchQuery({ queryKey: ['compras', 'fornecedores'], queryFn: listarFornecedores });
      setFornecedor(lista.find((f) => norm(f.nome) === norm(lido.orcamento.fornecedor))?.id ?? '');
    } catch (e) { setErro(mensagemErro(e)); }
  }

  const marcadas = linhas.filter((l) => l.marcado);
  async function gravar() {
    if (!lido) return;
    if (!fornecedor) return setErro('Escolha o fornecedor do orçamento.');
    if (marcadas.some((l) => !l.produto_id && l.descricao.trim().length < 2)) return setErro('Há linha marcada sem descrição.');
    setGravando(true); setErro('');
    try {
      const n = await gravarOrcamento(fornecedor, data || null, lido.caminho, marcadas.map((l) => ({
        produto_id: l.produto_id || null, grupo: l.grupo, descricao: l.descricao.trim(), unidade: l.unidade, valor_unit: l.valor_unit, ipi: l.ipi,
      })));
      await qc.invalidateQueries({ queryKey: ['compras'] });
      setFeito(n);
    } catch (e) { setErro(mensagemErro(e)); }
    setGravando(false);
  }

  const novos = useMemo(() => marcadas.filter((l) => !l.produto_id).length, [marcadas]);
  const o = lido?.orcamento;
  return (
    <Modal aberto titulo="Ler orçamento do fornecedor" onFechar={onFechar} largura="max-w-7xl">
      <div className="space-y-4 text-sm">
        {erro && <Aviso>{erro}</Aviso>}
        {feito > 0 ? (
          <div className="space-y-3">
            <Aviso tipo="info">Pronto: {feito} preço(s) gravado(s) como "Cotado". Os produtos já mostram o valor novo, e o PDF ficou no histórico de cada um.</Aviso>
            <div className="flex justify-end"><Botao onClick={onFechar}>Fechar</Botao></div>
          </div>
        ) : !lido ? (
          <div className="space-y-3">
            <p className="text-suave">Envie o PDF do orçamento (com texto ou escaneado). A IA lê os itens e monta um rascunho; nada é gravado antes de você conferir.</p>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-borda px-4 py-8 text-center hover:border-roxo-300">
              <Upload size={22} className="text-roxo-600" />
              <span className="font-medium">{arquivo ? arquivo.name : 'Escolher o PDF do orçamento'}</span>
              <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
            </label>
            <div className="flex justify-end gap-2">
              <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
              <Botao disabled={!arquivo || lendo} onClick={ler}>{lendo ? <><Loader2 size={15} className="animate-spin" /> Lendo o orçamento…</> : <><FileText size={15} /> Ler orçamento</>}</Botao>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
              <Campo rotulo={`Fornecedor${o?.fornecedor ? ` (no PDF: ${o.fornecedor}${o.cnpj ? `, CNPJ ${o.cnpj}` : ''})` : ''}`}>
                <div className="flex gap-2">
                  <Selecao value={fornecedor} onChange={(e) => setFornecedor(e.target.value)}>
                    <option value="">Escolha…</option>
                    {fornecedores.filter((f) => f.ativo).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </Selecao>
                  {!fornecedor && o?.fornecedor && <Botao variante="secundario" onClick={cadastrarFornecedor} className="shrink-0"><Plus size={14} /> Cadastrar {o.fornecedor}</Botao>}
                </div>
              </Campo>
              <Campo rotulo="Data do orçamento"><Entrada type="date" value={data} onChange={(e) => setData(e.target.value)} /></Campo>
            </div>
            <p className="text-xs text-suave">
              {[o?.numero && `Orçamento ${o.numero}`, o?.condicao_pagamento && `Pagamento: ${o.condicao_pagamento}`, o?.prazo_entrega && `Prazo: ${o.prazo_entrega}`, o?.frete && `Frete: ${o.frete}`].filter(Boolean).join(' · ')}
              {' '}<button type="button" className="font-medium text-roxo-600 underline dark:text-roxo-100" onClick={() => abrirArquivo(lido.caminho)}>Abrir o PDF</button>
            </p>
            {linhas.length === 0 ? <Aviso>A IA não encontrou itens neste PDF. Confira se é o orçamento certo.</Aviso> : (
              <div className="overflow-x-auto rounded-xl ring-1 ring-borda">
                <table className="w-full min-w-[1150px] text-sm">
                  <thead className="bg-pagina text-left text-xs text-suave"><tr>
                    <th className="w-8 px-2 py-2"><input type="checkbox" checked={marcadas.length === linhas.length} onChange={(e) => setLinhas((ls) => ls.map((l) => ({ ...l, marcado: e.target.checked })))} aria-label="Marcar todos" /></th>
                    <th className="px-2 py-2">Tipo</th><th className="px-2 py-2">Descrição</th><th className="px-2 py-2">Un.</th>
                    <th className="px-2 py-2 text-right">Valor unit.</th><th className="px-2 py-2 text-right">IPI %</th><th className="px-2 py-2 text-right">Com impostos</th>
                    <th className="px-2 py-2">Produto</th>
                  </tr></thead>
                  <tbody className="divide-y divide-borda">
                    {linhas.map((l) => {
                      const opcoes = catalogo.filter((p) => p.grupo === l.grupo || p.id === l.produto_id);
                      return (
                        <tr key={l.chave} className={l.marcado ? '' : 'opacity-50'}>
                          <td className="px-2 py-1.5 align-top"><input type="checkbox" checked={l.marcado} onChange={(e) => mudar(l.chave, { marcado: e.target.checked })} aria-label="Gravar esta linha" /></td>
                          <td className="w-36 px-2 py-1.5 align-top">
                            <Selecao compacto value={l.grupo} onChange={(e) => mudar(l.chave, { grupo: e.target.value as TipoProduto })}>
                              {TIPOS_PRODUTO.map((t) => <option key={t} value={t}>{ROTULO_TIPO[t]}</option>)}
                            </Selecao>
                          </td>
                          <td className="min-w-[320px] px-2 py-1.5 align-top">
                            <Entrada value={l.descricao} onChange={(e) => mudar(l.chave, { descricao: e.target.value })} className="py-1" />
                            <p className="mt-0.5 text-[11px] text-suave">No PDF: {l.original}{l.quantidade ? ` · ${l.quantidade.toLocaleString('pt-BR')} ${l.unidade}` : ''}</p>
                          </td>
                          <td className="w-28 px-2 py-1.5 align-top">
                            <Selecao compacto value={l.unidade} onChange={(e) => mudar(l.chave, { unidade: e.target.value })}>
                              {UNIDADES_PRODUTO.map((u) => <option key={u.valor} value={u.valor}>{u.rotulo}</option>)}
                            </Selecao>
                          </td>
                          <td className="w-32 px-2 py-1.5 align-top"><CampoNumero moeda casas={4} valor={l.valor_unit} onConfirmar={(n) => mudar(l.chave, { valor_unit: n })} /></td>
                          <td className="w-20 px-2 py-1.5 align-top"><CampoNumero casas={2} valor={l.ipi} onConfirmar={(n) => mudar(l.chave, { ipi: Math.min(100, Math.max(0, n)) })} /></td>
                          <td className="w-28 px-2 py-1.5 text-right align-top tabular-nums">{moeda(comImpostos(l.valor_unit, l.ipi))}</td>
                          <td className="w-60 px-2 py-1.5 align-top">
                            <Selecao compacto value={l.produto_id} onChange={(e) => mudar(l.chave, { produto_id: e.target.value, escolhido: true })}>
                              <option value="">Produto novo</option>
                              {opcoes.map((p) => <option key={p.id} value={p.id}>Atualiza: {p.descricao}</option>)}
                            </Selecao>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="mr-auto text-xs text-suave">{marcadas.length} de {linhas.length} linha(s) marcada(s){novos ? `, ${novos} produto(s) novo(s)` : ''}. Confira descrição, unidade, valor e IPI antes de gravar.</span>
              <Botao variante="secundario" onClick={() => { setLido(null); setLinhas([]); }}>Ler outro PDF</Botao>
              <Botao disabled={gravando || marcadas.length === 0} onClick={gravar}>{gravando ? 'Gravando…' : `Gravar ${marcadas.length} preço(s)`}</Botao>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
