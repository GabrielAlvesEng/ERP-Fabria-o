import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { mensagemErro } from '@/shared/lib/formato';
import { Aviso, Botao, CampoArquivo, Modal } from '@/shared/ui';
import { importarSolidworks } from './api';
import { COR_ICONE, ICONE_TIPO, NOME_TIPO } from './Arvore';
import type { Conjunto, Peca, Projeto } from './regras';
import { lerJsonMacro, type ResultadoLeitura } from './solidworks';

// Escolher o JSON da macro → prévia → confirmar. Nada é gravado antes da confirmação.
export function ImportarSolidworks({ projeto, conjuntos, pecas, onFechar }: { projeto: Projeto; conjuntos: Conjunto[]; pecas: Peca[]; onFechar: () => void }) {
  const qc = useQueryClient();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [leitura, setLeitura] = useState<ResultadoLeitura | null>(null);
  const [erro, setErro] = useState('');
  const [gravando, setGravando] = useState(false);
  const [feito, setFeito] = useState<{ nos: number; pecas: number } | null>(null);

  async function escolher(f: File | null) {
    setArquivo(f);
    setLeitura(null);
    setErro('');
    if (!f) return;
    try {
      const existentes = [...conjuntos.map((c) => c.codigo), ...pecas.map((p) => p.codigo)];
      setLeitura(lerJsonMacro(await f.text(), projeto.codigo, existentes));
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }

  async function confirmar() {
    if (!leitura) return;
    setErro('');
    setGravando(true);
    try {
      setFeito(await importarSolidworks(projeto.id, leitura.plano));
      qc.invalidateQueries({ queryKey: ['eng', projeto.id] });
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setGravando(false);
    }
  }

  const recusada = leitura?.avisos.some((a) => a.includes('será recusada'));

  return (
    <Modal aberto titulo={`Importar do SolidWorks · ${projeto.codigo}`} onFechar={onFechar} largura="max-w-4xl">
      {feito ? (
        <div className="space-y-4">
          <Aviso tipo="info">Importação concluída: {feito.nos} conjunto(s) e {feito.pecas} peça(s) criados na árvore.</Aviso>
          <div className="flex justify-end"><Botao onClick={onFechar}>Ver a árvore</Botao></div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Escolha o arquivo <span className="font-mono">.json</span> gerado pela macro “Exportar Fabriaço” no SolidWorks. O ERP mostra a prévia antes de gravar.
            Os códigos ficam com o prefixo do projeto e o código CAD original é guardado; nenhum arquivo do SolidWorks é alterado.
          </p>
          <CampoArquivo arquivo={arquivo} onChange={escolher} accept=".json,application/json" />
          {erro && <Aviso>{erro}</Aviso>}

          {leitura && (
            <>
              {leitura.avisos.length > 0 && (
                <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-100">
                  <div className="mb-1 flex items-center gap-1.5 font-semibold"><AlertTriangle size={15} /> Avisos ({leitura.avisos.length})</div>
                  <ul className="list-disc space-y-0.5 pl-5">{leitura.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>
                </div>
              )}
              <div className="max-h-[50vh] overflow-auto rounded-xl ring-1 ring-slate-200 dark:ring-marinho-700">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase text-slate-500 dark:bg-marinho-800">
                    <tr><th className="px-3 py-2">Item</th><th className="px-3 py-2">Código no ERP</th><th className="px-3 py-2">Código CAD</th><th className="px-3 py-2 text-right">Qtd</th><th className="px-3 py-2">COD_OP</th><th className="px-3 py-2">COD_MAT</th><th className="px-3 py-2 text-right">Peso (kg)</th></tr>
                  </thead>
                  <tbody>
                    {leitura.previa.map((l, i) => {
                      const Icone = l.tipo === 'peca' ? null : ICONE_TIPO[l.tipo];
                      return (
                        <tr key={i} className="border-t border-slate-100 dark:border-marinho-700">
                          <td className="px-3 py-1.5" style={{ paddingLeft: 12 + l.nivel * 18 }}>
                            <span className="inline-flex items-center gap-1.5">
                              {Icone ? <Icone size={14} className={COR_ICONE[l.tipo as keyof typeof COR_ICONE]} /> : <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />}
                              <span className={l.tipo === 'peca' ? '' : 'font-medium'}>{l.nome}</span>
                              {l.tipo !== 'peca' && <span className="text-[11px] text-slate-500">({NOME_TIPO[l.tipo]})</span>}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs">{l.codigo}</td>
                          <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[11px] text-slate-500">{l.codigoCad || '—'}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{l.quantidade.toLocaleString('pt-BR')}</td>
                          <td className="px-3 py-1.5">
                            {l.tipo !== 'peca' ? '' : l.pendente ? <span className="text-xs font-semibold text-amber-600">pendente</span> : (
                              <div className="flex gap-0.5">{l.codOp.map((o) => <span key={o} className={`rounded px-1 font-mono text-[10px] font-semibold text-white ${o === 'CM' ? 'bg-amber-500' : 'bg-roxo-500'}`}>{o}</span>)}</div>
                            )}
                          </td>
                          <td className="px-3 py-1.5 font-mono text-xs">{l.codMat ?? ''}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{l.peso == null ? '' : l.peso.toLocaleString('pt-BR')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-slate-500">{leitura.plano.nos.length} conjunto(s) e {leitura.plano.pecas.length} peça(s) serão criados. Os códigos finais são confirmados pelo banco.</span>
                <div className="flex gap-2">
                  <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
                  <Botao onClick={confirmar} disabled={gravando || recusada}>{gravando ? 'Importando…' : 'Confirmar importação'}</Botao>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
