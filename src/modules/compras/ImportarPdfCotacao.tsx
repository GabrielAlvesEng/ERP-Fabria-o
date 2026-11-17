import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, FileText, Loader2, Upload } from 'lucide-react';
import { mensagemErro, moeda } from '@/shared/lib/formato';
import { Aviso, Botao, CampoNumero, Modal, Selecao } from '@/shared/ui';
import { abrirArquivo, definirOrcamentoPdf, enviarOrcamentoPdf, lerOrcamentoPdf, salvarPreco, type Cotacao, type ItemComSolicitacao, type OrcamentoLido } from './api';
import { converterPreco, ligarLinhas, mesmaUnidade, valorComIpi } from './regras';

// Cotação → "Importar PDF" (decisão 135): a IA lê o orçamento do fornecedor e liga cada linha a um item do pacote, mesmo com o
// nome escrito de outro jeito. O comprador confere item a item (linha do PDF, preço e IPI), corrige, deixa de fora o que quiser
// e grava: os preços entram na comparação desta cotação, e o PDF fica anexado a ela.
interface Ligacao { linha: number; valor: number; ipi: number; gravar: boolean; nota: string }

export function ImportarPdfCotacao({ cotacao, itens, onFechar }: { cotacao: Cotacao; itens: ItemComSolicitacao[]; onFechar: () => void }) {
  const qc = useQueryClient();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState('');
  const [lido, setLido] = useState<{ caminho: string; novo: boolean; orcamento: OrcamentoLido } | null>(null);
  const [lig, setLig] = useState<Ligacao[]>([]);
  const [gravando, setGravando] = useState(false);
  const atuais = Object.fromEntries(cotacao.compras_cotacao_precos.map((p) => [p.item_id, p]));

  async function ler(anexado: boolean) {
    setLendo(true); setErro('');
    try {
      const caminho = anexado ? cotacao.orcamento_caminho! : await enviarOrcamentoPdf(arquivo!);
      const orcamento = await lerOrcamentoPdf(caminho, itens.map((i) => ({ descricao: i.descricao, quantidade: Number(i.quantidade), unidade: i.unidade })));
      const ligacao = ligarLinhas(itens.length, orcamento.itens);
      setLig(ligacao.map((n, k) => (orcamento.itens[n] ? daLinha(n, orcamento.itens[n], itens[k].unidade, Number(itens[k].quantidade)) : { linha: -1, valor: 0, ipi: 0, gravar: false, nota: '' })));
      setLido({ caminho, novo: !anexado, orcamento });
    } catch (e) { setErro(mensagemErro(e)); }
    setLendo(false);
  }

  // Preço da linha do PDF para o item; barra → metro é convertido pelo total do fornecedor e anotado (decisões 136 e 139).
  function daLinha(n: number, l: OrcamentoLido['itens'][number], unidadeItem: string, qtdItem: number): Ligacao {
    const c = converterPreco(l, unidadeItem, qtdItem);
    const valor = c?.valor ?? (Number(l.valor_unit) || 0);
    return { linha: n, valor, ipi: Number(l.ipi) || 0, gravar: valor > 0, nota: c?.nota ?? '' };
  }
  const mudar = (k: number, m: Partial<Ligacao>) => setLig((ls) => ls.map((x, n) => (n === k ? { ...x, ...m } : x)));
  function escolherLinha(k: number, linha: number) {
    const l = lido?.orcamento.itens[linha];
    mudar(k, l ? daLinha(linha, l, itens[k].unidade, Number(itens[k].quantidade)) : { linha: -1, gravar: false, nota: '' });
  }

  async function gravar() {
    if (!lido) return;
    const marcados = itens.map((i, k) => ({ i, l: lig[k] })).filter((x) => x.l.gravar && x.l.valor > 0);
    if (!marcados.length) return setErro('Nenhum item marcado com preço para gravar.');
    setGravando(true); setErro('');
    try {
      for (const { i, l } of marcados) await salvarPreco(cotacao.id, i.id, l.valor, Math.min(100, Math.max(0, l.ipi)), l.nota);
      if (lido.novo) await definirOrcamentoPdf(cotacao.id, lido.caminho);
      await qc.invalidateQueries({ queryKey: ['compras'] });
      onFechar();
    } catch (e) { setErro(mensagemErro(e)); setGravando(false); }
  }

  const linhas = lido?.orcamento.itens ?? [];
  const usadas = new Set(lig.map((x) => x.linha).filter((n) => n >= 0));
  const sobram = linhas.map((l, n) => ({ l, n })).filter((x) => !usadas.has(x.n));
  const marcados = lig.filter((x) => x.gravar && x.valor > 0).length;
  const o = lido?.orcamento;
  return (
    <Modal aberto titulo={`Importar PDF do orçamento · ${cotacao.fornecedores?.nome ?? ''}`} onFechar={onFechar} largura="max-w-7xl">
      <div className="space-y-4 text-sm">
        {erro && <Aviso>{erro}</Aviso>}
        {!lido ? (
          <div className="space-y-3">
            <p className="text-suave">A IA lê o PDF do fornecedor e liga cada linha a um item desta cotação, mesmo com o nome um pouco diferente. Você confere antes de gravar.</p>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-borda px-4 py-8 text-center hover:border-roxo-300">
              <Upload size={22} className="text-roxo-600" />
              <span className="font-medium">{arquivo ? arquivo.name : 'Escolher o PDF do orçamento'}</span>
              <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
              {cotacao.orcamento_caminho && !arquivo && <Botao variante="secundario" disabled={lendo} onClick={() => ler(true)}>Ler o PDF já anexado</Botao>}
              <Botao disabled={!arquivo || lendo} onClick={() => ler(false)}>{lendo ? <><Loader2 size={15} className="animate-spin" /> Lendo o orçamento…</> : <><FileText size={15} /> Ler e ligar aos itens</>}</Botao>
            </div>
            {lendo && <p className="text-right text-xs text-suave">Pode levar até um minuto em orçamentos longos.</p>}
          </div>
        ) : (
          <>
            <p className="text-xs text-suave">
              {[o?.fornecedor, o?.numero && `Orçamento ${o.numero}`, o?.condicao_pagamento && `Pagamento: ${o.condicao_pagamento}`, o?.prazo_entrega && `Prazo: ${o.prazo_entrega}`, o?.frete && `Frete: ${o.frete}`].filter(Boolean).join(' · ')}
              {' '}<button type="button" className="font-medium text-roxo-600 underline dark:text-roxo-100" onClick={() => abrirArquivo(lido.caminho).catch((e) => setErro(mensagemErro(e)))}>Abrir o PDF</button>
            </p>
            <div className="overflow-x-auto rounded-xl ring-1 ring-borda">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="bg-pagina text-left text-xs text-suave"><tr>
                  <th className="w-8 px-2 py-2" />
                  <th className="px-2 py-2">Item da cotação</th><th className="px-2 py-2">Linha do PDF</th>
                  <th className="px-2 py-2 text-right">Unitário sem IPI</th><th className="px-2 py-2 text-right">IPI %</th><th className="px-2 py-2 text-right">Total com IPI</th>
                </tr></thead>
                <tbody className="divide-y divide-borda">
                  {itens.map((i, k) => {
                    const x = lig[k];
                    const l = x.linha >= 0 ? linhas[x.linha] : null;
                    const unidade = l && !x.nota && !mesmaUnidade(l.unidade_original || l.unidade, i.unidade);
                    const qtd = l && !x.nota && Number(l.quantidade) > 0 && Number(l.quantidade) !== Number(i.quantidade);
                    const atual = atuais[i.id];
                    return (
                      <tr key={i.id} className={x.gravar ? '' : 'bg-pagina/60'}>
                        <td className="px-2 py-2 align-top"><input type="checkbox" checked={x.gravar} disabled={!l} onChange={(e) => mudar(k, { gravar: e.target.checked })} aria-label="Gravar o preço deste item" /></td>
                        <td className="min-w-[240px] px-2 py-2 align-top">
                          {i.descricao}
                          <span className="block text-xs text-suave">{Number(i.quantidade).toLocaleString('pt-BR')} {i.unidade}{atual && ` · hoje ${moeda(atual.valor_unit)}${Number(atual.ipi) ? ` + ${Number(atual.ipi).toLocaleString('pt-BR')}%` : ''}`}</span>
                        </td>
                        <td className="min-w-[340px] px-2 py-2 align-top">
                          <Selecao compacto value={x.linha} onChange={(e) => escolherLinha(k, Number(e.target.value))} aria-label="Linha do PDF">
                            <option value={-1}>Sem par no PDF</option>
                            {linhas.map((ln, n) => (
                              <option key={n} value={n} disabled={usadas.has(n) && n !== x.linha}>
                                {n + 1}. {ln.descricao_original} · {Number(ln.quantidade).toLocaleString('pt-BR')} {ln.unidade_original || ln.unidade} · {moeda(ln.valor_unit)}
                              </option>
                            ))}
                          </Selecao>
                          {l && x.nota && (
                            <p className="mt-1 flex items-start gap-1 rounded bg-amber-50 px-1.5 py-1 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                              <AlertTriangle size={12} className="mt-px shrink-0" />{x.nota}
                            </p>
                          )}
                          {(unidade || qtd) && (
                            <p className="mt-1 flex items-start gap-1 text-[11px] text-amber-600">
                              <AlertTriangle size={12} className="mt-px shrink-0" />
                              {[unidade && `PDF em ${l!.unidade_original || l!.unidade}, item em ${i.unidade}: confira o preço`, qtd && `PDF com ${Number(l!.quantidade).toLocaleString('pt-BR')}, item com ${Number(i.quantidade).toLocaleString('pt-BR')}`].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </td>
                        <td className="w-36 px-2 py-2 align-top">{l ? <CampoNumero moeda casas={4} valor={x.valor} onConfirmar={(n) => mudar(k, { valor: n, gravar: n > 0 })} /> : <span className="block text-right text-suave">—</span>}</td>
                        <td className="w-20 px-2 py-2 align-top">{l ? <CampoNumero casas={2} valor={x.ipi} onConfirmar={(n) => mudar(k, { ipi: Math.min(100, Math.max(0, n)) })} /> : null}</td>
                        <td className="w-32 px-2 py-2 text-right align-top tabular-nums">{l ? moeda(valorComIpi(Number(i.quantidade), x.valor, x.ipi)) : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {sobram.length > 0 && (
              <div className="rounded-xl bg-pagina px-3 py-2">
                <p className="text-xs font-medium text-suave">Linhas do PDF sem item na cotação ({sobram.length}): ficam de fora. Para usar uma delas, escolha-a na linha do item acima.</p>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {sobram.map(({ l, n }) => <li key={n}>{n + 1}. {l.descricao_original} · {Number(l.quantidade).toLocaleString('pt-BR')} {l.unidade_original || l.unidade} · {moeda(l.valor_unit)}{Number(l.ipi) ? ` + IPI ${Number(l.ipi).toLocaleString('pt-BR')}%` : ''}</li>)}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="mr-auto text-xs text-suave">{marcados} de {itens.length} item(ns) com preço para gravar. Itens sem par ficam como estão.</span>
              <Botao variante="secundario" onClick={() => { setLido(null); setLig([]); }}>Ler outro PDF</Botao>
              <Botao disabled={gravando || marcados === 0} onClick={gravar}>{gravando ? 'Gravando…' : `Gravar ${marcados} preço(s)`}</Botao>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
