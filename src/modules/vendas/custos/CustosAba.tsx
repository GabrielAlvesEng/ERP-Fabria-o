import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Lock, Plus, Scale, Trash2 } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { mensagemErro, moeda } from '@/shared/lib/formato';
import { Aviso, Botao, CampoCelula, CampoNumero, Campo, Entrada, Modal, Selecao, Selo, Vazio } from '@/shared/ui';
import { atualizarRascunho, listarRevisoes } from '../api';
import type { Proposta } from '../types';
import {
  adicionarLinha, atualizarItem, atualizarLinha, criarItem, excluirItem, listarItens, listarLinhas, listarRefMateriais, removerLinha, type RefMaterial,
} from './api';
import { SECOES, pesoChapa, resumoItem, totalLinha, totalSecao, type CustoItem, type CustoLinha, type Secao } from './regras';

const celula = 'px-1 py-1 align-middle';

export function CustosAba({ proposta }: { proposta: Proposta }) {
  const { pode } = useAuth();
  const qc = useQueryClient();
  const [erro, setErro] = useState('');
  const { data: revisoes = [] } = useQuery({ queryKey: ['proposta', proposta.id, 'revisoes', proposta.revisao_atual, proposta.status], queryFn: () => listarRevisoes(proposta.id) });
  const [revId, setRevId] = useState<string | null>(null);
  const rev = revisoes.find((r) => r.id === revId) ?? revisoes.find((r) => r.numero === proposta.revisao_atual);
  useEffect(() => { if (rev && rev.id !== revId) setRevId(rev.id); }, [rev, revId]);
  const editavel = rev?.status === 'rascunho' && pode('custos', 'editar');

  const { data: itens = [] } = useQuery({ queryKey: ['custos', 'itens', rev?.id], queryFn: () => listarItens(rev!.id), enabled: Boolean(rev) });
  const { data: linhas = [] } = useQuery({ queryKey: ['custos', 'linhas', rev?.id, itens.map((i) => i.id).join()], queryFn: () => listarLinhas(itens.map((i) => i.id)), enabled: itens.length > 0 });
  const { data: refs = [] } = useQuery({ queryKey: ['ref_materiais'], queryFn: listarRefMateriais, staleTime: 5 * 60_000 });
  const [itemId, setItemId] = useState<string | null>(null);
  const item = itens.find((i) => i.id === itemId) ?? itens[0];

  const chaveLinhas = ['custos', 'linhas', rev?.id, itens.map((i) => i.id).join()];
  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ['custos', 'itens', rev?.id] });
    qc.invalidateQueries({ queryKey: ['custos', 'linhas', rev?.id] });
  };
  const trocarLinha = (nova: CustoLinha) => qc.setQueryData<CustoLinha[]>(chaveLinhas, (ant = []) => ant.map((l) => (l.id === nova.id ? nova : l)));

  const resumos = useMemo(() => new Map(itens.map((i) => [i.id, resumoItem(i, linhas.filter((l) => l.item_id === i.id))])), [itens, linhas]);
  const totalProposta = itens.reduce((s, i) => s + (resumos.get(i.id)?.precoTotal ?? 0), 0);

  const novoItem = useMutation({
    mutationFn: () => criarItem(rev!.id, itens.map((i) => i.letra), itens.length === 0 ? proposta.titulo : ''),
    onSuccess: (i) => { setItemId(i.id); recarregar(); },
    onError: (e) => setErro(mensagemErro(e)),
  });
  const usarValor = useMutation({
    mutationFn: () => atualizarRascunho(proposta.id, { valor: Math.round(totalProposta * 100) / 100 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['propostas'] }); qc.invalidateQueries({ queryKey: ['proposta', proposta.id] }); },
    onError: (e) => setErro(mensagemErro(e)),
  });

  if (!rev) return <Vazio>Carregando…</Vazio>;

  return (
    <div className="space-y-4">
      {erro && <Aviso>{erro}</Aviso>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <Campo rotulo="Revisão">
            <Selecao value={rev.id} onChange={(e) => { setRevId(e.target.value); setItemId(null); }} className="w-44">
              {revisoes.map((r) => <option key={r.id} value={r.id}>R{r.numero} · {r.status === 'enviada' ? 'enviada' : 'rascunho'}</option>)}
            </Selecao>
          </Campo>
          {!editavel && <span className="mb-2 inline-flex items-center gap-1 text-xs text-slate-500"><Lock size={13} /> {rev.status === 'enviada' ? 'Revisão enviada: custos congelados' : 'Somente leitura'}</span>}
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">Preço de venda da proposta ({itens.length} {itens.length === 1 ? 'item' : 'itens'})</div>
          <div className="text-xl font-bold text-petroleo-600 dark:text-teal-300">{moeda(totalProposta)}</div>
          {editavel && proposta.status === 'À enviar' && pode('vendas', 'editar') && itens.length > 0 && Math.abs(totalProposta - Number(proposta.valor)) > 0.005 && (
            <button className="text-xs text-roxo-600 hover:underline disabled:opacity-50" disabled={usarValor.isPending} onClick={() => usarValor.mutate()}>
              Usar como valor da proposta (hoje {moeda(proposta.valor)})
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 dark:border-marinho-700">
        {itens.map((i) => (
          <button key={i.id} onClick={() => setItemId(i.id)}
            className={`-mb-px rounded-t-lg border px-3 py-1.5 text-sm ${item?.id === i.id ? 'border-slate-200 border-b-white bg-white font-semibold text-roxo-600 dark:border-marinho-700 dark:border-b-marinho-800 dark:bg-marinho-800 dark:text-roxo-100' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            Item {i.letra}{i.descricao && <span className="font-normal"> · {i.descricao}</span>}
          </button>
        ))}
        {editavel && (
          <button onClick={() => novoItem.mutate()} disabled={novoItem.isPending} className="ml-1 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-roxo-600 hover:bg-roxo-50 disabled:opacity-50 dark:hover:bg-marinho-700">
            <Plus size={15} /> {novoItem.isPending ? 'Criando…' : 'Novo item'}
          </button>
        )}
      </div>

      {itens.length === 0 ? (
        <Vazio>{editavel ? 'Nenhum item de custo ainda. Clique em "Novo item" para começar (vem com o modelo da planilha).' : 'Esta revisão não tem custos lançados.'}</Vazio>
      ) : item && (
        <ItemCustos
          key={item.id}
          item={item}
          linhas={linhas.filter((l) => l.item_id === item.id)}
          refs={refs}
          editavel={editavel}
          onErro={(e) => setErro(mensagemErro(e))}
          onLinha={trocarLinha}
          onRecarregar={recarregar}
          onExcluido={() => { setItemId(null); recarregar(); }}
        />
      )}
    </div>
  );
}

function ItemCustos({ item, linhas, refs, editavel, onErro, onLinha, onRecarregar, onExcluido }: {
  item: CustoItem; linhas: CustoLinha[]; refs: RefMaterial[]; editavel: boolean;
  onErro: (e: unknown) => void; onLinha: (l: CustoLinha) => void; onRecarregar: () => void; onExcluido: () => void;
}) {
  const [it, setIt] = useState(item);
  useEffect(() => setIt(item), [item]);
  const [abertas, setAbertas] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SECOES.map((s) => [s.id, s.id === 'materiais' || totalSecao(linhas, s.id) > 0])));
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const r = resumoItem(it, linhas);

  async function salvarItem(dados: Partial<CustoItem>) {
    setIt({ ...it, ...dados });
    try { await atualizarItem(item.id, dados); onRecarregar(); } catch (e) { onErro(e); setIt(item); }
  }
  async function salvarLinha(l: CustoLinha, dados: Partial<CustoLinha>) {
    onLinha({ ...l, ...dados, total: totalLinha({ ...l, ...dados }) });
    try { onLinha(await atualizarLinha(l.id, dados)); } catch (e) { onErro(e); onRecarregar(); }
  }
  async function novaLinha(secao: Secao) {
    try { await adicionarLinha(item.id, { secao, grupo: secao === 'materiais' ? 'Chapas' : '', ordem: linhas.length + 1 }); onRecarregar(); setAbertas((a) => ({ ...a, [secao]: true })); } catch (e) { onErro(e); }
  }
  async function apagarLinha(l: CustoLinha) {
    try { await removerLinha(l.id); onRecarregar(); } catch (e) { onErro(e); }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
      <div className="min-w-0 space-y-3">
        <div className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-6 dark:bg-marinho-700/40">
          <Campo rotulo={`Descrição do item ${it.letra}`} className="sm:col-span-6">
            <Entrada defaultValue={it.descricao} disabled={!editavel} onBlur={(e) => e.target.value !== it.descricao && salvarItem({ descricao: e.target.value })} />
          </Campo>
          <CampoPct rotulo="Quantidade" valor={it.quantidade} casas={3} editavel={editavel} onConfirmar={(n) => n > 0 && salvarItem({ quantidade: n })} />
          <CampoPct rotulo="Lucro (%)" valor={it.lucro_pct} editavel={editavel} onConfirmar={(n) => salvarItem({ lucro_pct: n })} />
          <CampoPct rotulo="Negociação (%)" valor={it.negociacao_pct} editavel={editavel} onConfirmar={(n) => salvarItem({ negociacao_pct: n })} />
          <CampoPct rotulo="Imposto (%)" valor={it.imposto_pct} editavel={editavel} onConfirmar={(n) => n < 100 && salvarItem({ imposto_pct: n })} />
          <Campo rotulo="Imposto" className="sm:col-span-2">
            <Selecao value={it.imposto_modo} disabled={!editavel} onChange={(e) => salvarItem({ imposto_modo: e.target.value as CustoItem['imposto_modo'] })}>
              <option value="dentro">Por dentro (sobre o preço)</option>
              <option value="fora">Por fora (sobre o custo)</option>
            </Selecao>
          </Campo>
        </div>

        {SECOES.map((s) => {
          const doS = linhas.filter((l) => l.secao === s.id).sort((a, b) => a.ordem - b.ordem);
          const aberta = abertas[s.id];
          return (
            <div key={s.id} className="rounded-xl ring-1 ring-slate-200 dark:ring-marinho-700">
              <button type="button" onClick={() => setAbertas({ ...abertas, [s.id]: !aberta })} className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-marinho-700/40">
                <ChevronRight size={16} className={`text-slate-400 transition-transform ${aberta ? 'rotate-90' : ''}`} />
                <span className="w-5 font-mono text-xs font-bold text-roxo-600 dark:text-roxo-100">{s.letra}</span>
                <span className="font-semibold">{s.titulo}</span>
                <Selo>{doS.length}</Selo>
                <span className="ml-auto font-semibold tabular-nums">{moeda(r.porSecao[s.id])}</span>
              </button>
              {aberta && (
                <div className="overflow-x-auto border-t border-slate-100 px-2 pb-2 dark:border-marinho-700">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="text-left text-[11px] uppercase text-slate-500">
                      <tr>
                        {s.colunas.map((c) => <th key={c.campo} className={`px-2 py-1.5 font-medium ${c.largura ?? ''} ${c.tipo === 'numero' ? 'text-right' : ''}`}>{c.rotulo}</th>)}
                        <th className="w-32 px-2 py-1.5 text-right font-medium">Total</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {doS.map((l) => (
                        <LinhaCusto key={l.id} linha={l} secao={s.id} refs={refs} editavel={editavel} onSalvar={(d) => salvarLinha(l, d)} onRemover={() => apagarLinha(l)} />
                      ))}
                      {doS.length === 0 && <tr><td colSpan={s.colunas.length + 2} className="px-2 py-3 text-center text-xs text-slate-500">Sem linhas.</td></tr>}
                    </tbody>
                  </table>
                  {editavel && (
                    <button onClick={() => novaLinha(s.id)} className="mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-roxo-600 hover:bg-roxo-50 dark:hover:bg-marinho-700">
                      <Plus size={13} /> Adicionar linha
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {editavel && (
          <div className="flex justify-end">
            <Botao variante="secundario" className="text-red-600" onClick={() => setConfirmarExclusao(true)}><Trash2 size={15} /> Excluir item {it.letra}</Botao>
          </div>
        )}
      </div>

      <div className="xl:sticky xl:top-2 xl:self-start">
        <div className="rounded-xl bg-marinho-800 p-4 text-sm text-slate-100 dark:bg-marinho-900">
          <div className="mb-2 font-semibold text-white">Orçamento · Item {it.letra}</div>
          {SECOES.map((s) => (
            <div key={s.id} className="flex justify-between py-0.5"><span className="text-slate-300">{s.letra} · {s.titulo}</span><span className="tabular-nums">{moeda(r.porSecao[s.id])}</span></div>
          ))}
          <div className="my-2 border-t border-marinho-500" />
          <Linha r="Custos" v={r.custos} forte />
          <Linha r={`Lucro (${it.lucro_pct}%)`} v={r.lucro} />
          <Linha r={`Negociação (${it.negociacao_pct}%)`} v={r.negociacao} />
          <Linha r={`Imposto (${it.imposto_pct}% ${it.imposto_modo === 'dentro' ? 'por dentro' : 'por fora'})`} v={r.imposto} />
          <div className="my-2 border-t border-marinho-500" />
          <Linha r="Preço unitário" v={r.precoUnitario} forte />
          <div className="flex justify-between py-0.5 text-slate-300"><span>Quantidade</span><span className="tabular-nums">× {Number(it.quantidade).toLocaleString('pt-BR')}</span></div>
          <div className="mt-2 flex items-baseline justify-between rounded-lg bg-petroleo-600 px-3 py-2">
            <span className="font-semibold">Preço de venda</span>
            <span className="text-lg font-bold tabular-nums">{moeda(r.precoTotal)}</span>
          </div>
        </div>
      </div>

      <Modal aberto={confirmarExclusao} titulo={`Excluir item ${it.letra}?`} onFechar={() => setConfirmarExclusao(false)}>
        <p className="text-sm text-slate-600 dark:text-slate-300">O item e todas as linhas de custo dele serão removidos desta revisão (rascunho). A exclusão fica registrada na auditoria. Revisões enviadas não são afetadas.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Botao variante="secundario" onClick={() => setConfirmarExclusao(false)}>Cancelar</Botao>
          <Botao variante="perigo" onClick={async () => { try { await excluirItem(item.id); onExcluido(); } catch (e) { onErro(e); } setConfirmarExclusao(false); }}>Excluir</Botao>
        </div>
      </Modal>
    </div>
  );
}

function Linha({ r, v, forte }: { r: string; v: number; forte?: boolean }) {
  return <div className={`flex justify-between py-0.5 ${forte ? 'font-semibold text-white' : 'text-slate-300'}`}><span>{r}</span><span className="tabular-nums">{moeda(v)}</span></div>;
}

function CampoPct({ rotulo, valor, onConfirmar, editavel, casas = 2 }: { rotulo: string; valor: number; onConfirmar: (n: number) => void; editavel: boolean; casas?: number }) {
  return (
    <Campo rotulo={rotulo}>
      <div className="rounded-lg border border-slate-300 bg-white dark:border-marinho-500 dark:bg-marinho-800">
        <CampoNumero valor={valor} casas={casas} disabled={!editavel} onConfirmar={onConfirmar} className="py-1.5" />
      </div>
    </Campo>
  );
}

function LinhaCusto({ linha: l, secao, refs, editavel, onSalvar, onRemover }: {
  linha: CustoLinha; secao: Secao; refs: RefMaterial[]; editavel: boolean; onSalvar: (d: Partial<CustoLinha>) => void; onRemover: () => void;
}) {
  const cfg = SECOES.find((s) => s.id === secao)!;
  const [calc, setCalc] = useState(false);
  const listaId = `ref-${l.grupo || 'todos'}`;

  function escolherMaterial(desc: string) {
    const ref = refs.find((r) => r.descricao === desc && (!l.grupo || r.tipo === l.grupo));
    if (ref) onSalvar({ descricao: desc, unidade: ref.unidade, ...(Number(ref.preco) > 0 ? { valor_unitario: Number(ref.preco) } : {}) });
    else onSalvar({ descricao: desc });
  }

  return (
    <tr className="border-t border-slate-100 dark:border-marinho-700">
      {cfg.colunas.map((c) => (
        <td key={c.campo} className={celula}>
          {c.tipo === 'numero' ? (
            <div className="flex items-center gap-1">
              <CampoNumero valor={Number(l[c.campo])} casas={c.campo === 'valor_unitario' ? 4 : 3} disabled={!editavel} onConfirmar={(n) => onSalvar({ [c.campo]: n })} />
              {secao === 'materiais' && c.campo === 'fator' && (
                <>
                  <span className="w-7 text-[11px] text-slate-500">{l.unidade}</span>
                  {editavel && l.grupo === 'Chapas' && (
                    <button title="Calcular peso da chapa" onClick={() => setCalc(true)} className="rounded p-1 text-slate-400 hover:bg-roxo-50 hover:text-roxo-600 dark:hover:bg-marinho-700"><Scale size={14} /></button>
                  )}
                </>
              )}
            </div>
          ) : c.tipo === 'tipoMaterial' ? (
            <select value={l.grupo} disabled={!editavel} onChange={(e) => onSalvar({ grupo: e.target.value })}
              className="w-full cursor-pointer rounded-md border border-transparent bg-transparent px-1 py-1 text-sm outline-none hover:border-slate-300 focus:border-roxo-500 dark:bg-marinho-800">
              {['Chapas', 'Perfis', 'Comerciais'].map((t) => <option key={t}>{t}</option>)}
            </select>
          ) : c.tipo === 'simnao' ? (
            <select value={l.detalhe || 'Não'} disabled={!editavel} onChange={(e) => onSalvar({ detalhe: e.target.value })}
              className="w-full cursor-pointer rounded-md border border-transparent bg-transparent px-1 py-1 text-sm outline-none hover:border-slate-300 focus:border-roxo-500 dark:bg-marinho-800">
              <option>Sim</option><option>Não</option>
            </select>
          ) : c.tipo === 'material' ? (
            <>
              <CampoCelula valor={l.descricao} lista={listaId} disabled={!editavel} placeholder="Digite para buscar na lista de preços" onConfirmar={escolherMaterial} />
              <datalist id={listaId}>
                {refs.filter((r) => !l.grupo || r.tipo === l.grupo).map((r) => <option key={r.id} value={r.descricao} />)}
              </datalist>
            </>
          ) : (
            <CampoCelula valor={String(l[c.campo] ?? '')} disabled={!editavel} onConfirmar={(v) => onSalvar({ [c.campo]: v })} />
          )}
        </td>
      ))}
      <td className="px-2 py-1 text-right font-medium tabular-nums">{moeda(totalLinha(l))}</td>
      <td className="px-1">
        {editavel && <button onClick={onRemover} className="rounded p-1 text-slate-300 hover:text-red-600" aria-label="Remover linha"><Trash2 size={14} /></button>}
      </td>
      {calc && <CalculadoraPeso onFechar={() => setCalc(false)} onUsar={(kg) => { onSalvar({ fator: kg, unidade: 'Kg' }); setCalc(false); }} />}
    </tr>
  );
}

function CalculadoraPeso({ onFechar, onUsar }: { onFechar: () => void; onUsar: (kg: number) => void }) {
  const [esp, setEsp] = useState(3);
  const [larg, setLarg] = useState(1200);
  const [comp, setComp] = useState(3000);
  const [mat, setMat] = useState<'inox' | 'carbono'>('inox');
  const kg = pesoChapa(esp, larg, comp, mat);
  return createPortal(
      <Modal aberto titulo="Calcular peso da chapa" onFechar={onFechar} largura="max-w-md">
        <div className="grid grid-cols-3 gap-3">
          <Campo rotulo="Espessura (mm)"><div className="rounded-lg border border-slate-300 dark:border-marinho-500"><CampoNumero valor={esp} casas={2} onConfirmar={setEsp} /></div></Campo>
          <Campo rotulo="Largura (mm)"><div className="rounded-lg border border-slate-300 dark:border-marinho-500"><CampoNumero valor={larg} onConfirmar={setLarg} /></div></Campo>
          <Campo rotulo="Comprimento (mm)"><div className="rounded-lg border border-slate-300 dark:border-marinho-500"><CampoNumero valor={comp} onConfirmar={setComp} /></div></Campo>
          <Campo rotulo="Material" className="col-span-3">
            <Selecao value={mat} onChange={(e) => setMat(e.target.value as 'inox' | 'carbono')}>
              <option value="inox">Inox (8,00 g/cm³)</option>
              <option value="carbono">Aço carbono (7,85 g/cm³)</option>
            </Selecao>
          </Campo>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-lg bg-roxo-50 px-3 py-2 dark:bg-roxo-700/30">
          <span className="text-sm">Peso por chapa</span>
          <span className="text-lg font-bold tabular-nums">{kg.toLocaleString('pt-BR')} kg</span>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao onClick={() => onUsar(kg)}>Usar este peso</Botao>
        </div>
      </Modal>,
    document.body,
  );
}
