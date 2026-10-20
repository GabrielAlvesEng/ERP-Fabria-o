import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { mensagemErro } from '@/shared/lib/formato';
import { Aviso, Botao, CampoArquivo, Modal } from '@/shared/ui';
import { atualizarSolidworks, importarSolidworks } from './api';
import { COR_ICONE, ICONE_TIPO, NOME_TIPO } from './Arvore';
import type { Conjunto, Peca, Projeto } from './regras';
import { compararRevisao, type Acao, type ResultadoComparacao } from './revisaoCad';
import { lerJsonMacro, type ResultadoLeitura } from './solidworks';

// Escolher o JSON da macro → prévia → confirmar. Nada é gravado antes da confirmação.
// Projeto ainda não importado: importação inicial. Já importado: nova revisão do CAD (decisão 38).
export function ImportarSolidworks({ projeto, conjuntos, pecas, onFechar }: { projeto: Projeto; conjuntos: Conjunto[]; pecas: Peca[]; onFechar: () => void }) {
  const qc = useQueryClient();
  const revisao = Boolean(projeto.importado_cad_em);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [leitura, setLeitura] = useState<ResultadoLeitura | null>(null);
  const [comparacao, setComparacao] = useState<ResultadoComparacao | null>(null);
  const [erro, setErro] = useState('');
  const [gravando, setGravando] = useState(false);
  const [feito, setFeito] = useState('');

  async function escolher(f: File | null) {
    setArquivo(f);
    setLeitura(null);
    setComparacao(null);
    setErro('');
    if (!f) return;
    try {
      const texto = await f.text();
      if (revisao) setComparacao(compararRevisao(texto, projeto.codigo, conjuntos, pecas, f.name));
      else setLeitura(lerJsonMacro(texto, projeto.codigo, [...conjuntos.map((c) => c.codigo), ...pecas.map((p) => p.codigo)]));
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }

  async function confirmar() {
    setErro('');
    setGravando(true);
    try {
      if (comparacao) {
        const r = await atualizarSolidworks(projeto.id, comparacao.plano);
        setFeito(`Revisão aplicada: ${r.novos} novo(s), ${r.alterados} alterado(s), ${r.removidos} marcado(s) como removido(s)${r.liberados_em_revisao ? `; ${r.liberados_em_revisao} conjunto(s) liberado(s) voltaram para Em revisão` : ''}.`);
      } else if (leitura) {
        const r = await importarSolidworks(projeto.id, leitura.plano);
        setFeito(`Importação concluída: ${r.nos} conjunto(s) e ${r.pecas} peça(s) criados na árvore.`);
      }
      qc.invalidateQueries({ queryKey: ['eng', projeto.id] });
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setGravando(false);
    }
  }

  const avisos = comparacao?.avisos ?? leitura?.avisos ?? [];
  const recusada = avisos.some((a) => a.includes('será recusada'));
  const semMudanca = comparacao && comparacao.resumo.novo + comparacao.resumo.alterado + comparacao.resumo.removido + comparacao.resumo.restaurado === 0;

  return (
    <Modal aberto titulo={`${revisao ? 'Atualizar do SolidWorks (nova revisão)' : 'Importar do SolidWorks'} · ${projeto.codigo}`} onFechar={onFechar} largura="max-w-4xl">
      {feito ? (
        <div className="space-y-4">
          <Aviso tipo="info">{feito}</Aviso>
          <div className="flex justify-end"><Botao onClick={onFechar}>Ver a árvore</Botao></div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {revisao
              ? 'Escolha o JSON novo da mesma montagem, exportado pela macro depois das alterações no SolidWorks. O ERP compara com a árvore atual e mostra o que muda. Itens que saíram do CAD ficam marcados como removidos (nada é apagado), e os códigos existentes não mudam.'
              : <>Escolha o arquivo <span className="font-mono">.json</span> gerado pela macro “Exportar Fabriaço” no SolidWorks. O ERP mostra a prévia antes de gravar. Os códigos ficam com o prefixo do projeto e o código CAD original é guardado; nenhum arquivo do SolidWorks é alterado.</>}
          </p>
          <CampoArquivo arquivo={arquivo} onChange={escolher} accept=".json,application/json" />
          {erro && <Aviso>{erro}</Aviso>}

          {avisos.length > 0 && (
            <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-100">
              <div className="mb-1 flex items-center gap-1.5 font-semibold"><AlertTriangle size={15} /> Avisos ({avisos.length})</div>
              <ul className="list-disc space-y-0.5 pl-5">{avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </div>
          )}

          {leitura && <PreviaInicial leitura={leitura} />}
          {comparacao && <PreviaRevisao comparacao={comparacao} />}

          {(leitura || comparacao) && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-slate-500">
                {leitura && `${leitura.plano.nos.length} conjunto(s) e ${leitura.plano.pecas.length} peça(s) serão criados. Os códigos finais são confirmados pelo banco.`}
                {comparacao && (semMudanca ? 'Nenhuma diferença em relação à árvore atual.' : 'Os códigos dos novos itens são confirmados pelo banco.')}
              </span>
              <div className="flex gap-2">
                <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
                <Botao onClick={confirmar} disabled={gravando || recusada || Boolean(semMudanca)}>
                  {gravando ? 'Gravando…' : revisao ? 'Aplicar revisão' : 'Confirmar importação'}
                </Botao>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function PreviaInicial({ leitura }: { leitura: ResultadoLeitura }) {
  return (
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
  );
}

const ESTILO_ACAO: Record<Acao, { rotulo: string; cor: string }> = {
  novo: { rotulo: 'Novos', cor: 'bg-petroleo-50 text-petroleo-600 dark:bg-petroleo-600/30 dark:text-teal-100' },
  alterado: { rotulo: 'Alterados', cor: 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200' },
  restaurado: { rotulo: 'Voltaram ao CAD', cor: 'bg-marinho-50 text-marinho-500 dark:bg-marinho-500/40 dark:text-slate-100' },
  removido: { rotulo: 'Removidos do CAD', cor: 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-200' },
  igual: { rotulo: 'Sem mudança', cor: 'bg-slate-100 text-slate-600 dark:bg-marinho-700 dark:text-slate-300' },
};

function PreviaRevisao({ comparacao }: { comparacao: ResultadoComparacao }) {
  const [verIguais, setVerIguais] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        {(Object.keys(ESTILO_ACAO) as Acao[]).map((a) => (
          <span key={a} className={`rounded-full px-2.5 py-1 font-semibold ${ESTILO_ACAO[a].cor}`}>{ESTILO_ACAO[a].rotulo}: {comparacao.resumo[a]}</span>
        ))}
      </div>
      <div className="max-h-[50vh] space-y-3 overflow-auto">
        {(['novo', 'alterado', 'restaurado', 'removido', 'igual'] as Acao[]).map((acao) => {
          const lista = comparacao.linhas.filter((l) => l.acao === acao);
          if (!lista.length) return null;
          const recolhido = acao === 'igual' && !verIguais;
          return (
            <div key={acao} className="rounded-xl ring-1 ring-slate-200 dark:ring-marinho-700">
              <button type="button" disabled={acao !== 'igual'} onClick={() => setVerIguais(!verIguais)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold">
                {acao === 'igual' && <ChevronRight size={14} className={`transition-transform ${verIguais ? 'rotate-90' : ''}`} />}
                <span className={`rounded-full px-2 py-0.5 text-xs ${ESTILO_ACAO[acao].cor}`}>{ESTILO_ACAO[acao].rotulo}</span>
                <span className="text-slate-500">{lista.length}</span>
              </button>
              {!recolhido && (
                <table className="w-full text-sm">
                  <tbody>
                    {lista.map((l, i) => {
                      const Icone = l.tipo === 'peca' ? null : ICONE_TIPO[l.tipo];
                      return (
                        <tr key={i} className="border-t border-slate-100 align-top dark:border-marinho-700">
                          <td className="w-56 whitespace-nowrap px-3 py-1.5 font-mono text-xs">{l.codigo}</td>
                          <td className="px-3 py-1.5">
                            <span className={`inline-flex items-center gap-1.5 ${acao === 'removido' ? 'line-through opacity-70' : ''}`}>
                              {Icone && <Icone size={14} className={COR_ICONE[l.tipo as keyof typeof COR_ICONE]} />}
                              {l.nome}
                              {l.tipo !== 'peca' && <span className="text-[11px] text-slate-500">({NOME_TIPO[l.tipo]})</span>}
                            </span>
                            {l.mudancas.length > 0 && <ul className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{l.mudancas.map((m, j) => <li key={j}>{m}</li>)}</ul>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
