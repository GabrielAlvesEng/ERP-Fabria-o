import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, GripVertical, Lock, Map as IconeMapa, Plus, Route, Scale, Trash2 } from 'lucide-react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { listarCatalogo } from '@/modules/engenharia/api';
import type { MaterialCatalogo } from '@/modules/engenharia/regras';
import { useAuth } from '@/shared/auth/AuthProvider';
import { mensagemErro, moeda } from '@/shared/lib/formato';
import { useIndicadorAbas } from '@/shared/ui/AbasModulo';
import { Aviso, Botao, Caixa, Campo, CampoCelula, CampoEscolha, CampoNumero, Entrada, EsqueletoTabela, Modal, type OpcaoEscolha, Selecao, Selo, Vazio, Bolhas, PrefixoCampo, useIdCampo } from '@/shared/ui';
import { atualizarRascunho, listarRevisoes } from '../api';
import type { Proposta } from '../types';
import { useDigitandoAoVivo } from '../aoVivo';
import {
  adicionarLinha, atualizarItem, atualizarLinha, criarItem, excluirItem, listarItens, listarLinhas, listarReferencias, listarVeiculosECombustivel, removerLinha, reordenarLinhas,
  precoDoVeiculo, type Combustivel, type Referencias, type RefVeiculo,
} from './api';
import {
  LINK_QUALP, linkMapa, pesoChapa, pesoMateriais, reordenar, resumoItem, secoesVisiveis, totalLinha,
  type Bloco, type Coluna, type CustoItem, type CustoLinha, type DefSecao, type GrupoMaterial, type Secao,
} from './regras';
import { precosPerfil } from '@/modules/biblioteca/regras';

const celula = 'px-1 py-1 align-middle';
const NOME_COMB: Record<string, string> = { gasolina: 'gasolina', etanol: 'etanol', diesel: 'diesel', flex: 'flex (gasolina)' };
// Colunas em reais nas linhas de custo (preço, mão de obra/pedágio e combustível): mostram R$.
const CAMPOS_MOEDA: string[] = ['valor_unitario', 'adicional', 'combustivel'];

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
  const { data: refs = REF_VAZIA } = useQuery({ queryKey: ['ref_custos'], queryFn: listarReferencias, staleTime: 5 * 60_000 });
  const { data: catalogo = [] } = useQuery({ queryKey: ['catalogo_materiais'], queryFn: listarCatalogo, staleTime: 10 * 60_000 });
  const { data: frota } = useQuery({ queryKey: ['ref_veiculos'], queryFn: listarVeiculosECombustivel, staleTime: 10 * 60_000 });
  const [itemId, setItemId] = useState<string | null>(null);
  const item = itens.find((i) => i.id === itemId) ?? itens[0];
  const linhaAbas = useIndicadorAbas(`${item?.id}|${itens.length}|${item?.descricao}`);

  const chaveLinhas = ['custos', 'linhas', rev?.id, itens.map((i) => i.id).join()];
  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ['custos', 'itens', rev?.id] });
    qc.invalidateQueries({ queryKey: ['custos', 'linhas', rev?.id] });
  };
  const trocarLinha = (nova: CustoLinha) => qc.setQueryData<CustoLinha[]>(chaveLinhas, (ant = []) => ant.map((l) => (l.id === nova.id ? nova : l)));
  // Ao vivo (decisão 85): linha ou item alterado vai direto para quem está nos custos desta revisão, sem esperar o banco.
  const enviarAoVivo = useDigitandoAoVivo<{ linhas: CustoLinha[]; itens: CustoItem[] }>(proposta.id, `custos:${rev?.id ?? ''}`,
    (a, b) => ({ linhas: [...(a?.linhas ?? []).filter((x) => !b.linhas.some((y) => y.id === x.id)), ...b.linhas], itens: [...(a?.itens ?? []).filter((x) => !b.itens.some((y) => y.id === x.id)), ...b.itens] }),
    ({ linhas: ls, itens: is }) => {
      if (ls.length) qc.setQueriesData<CustoLinha[]>({ queryKey: ['custos', 'linhas', rev?.id] }, (ant) => ant?.map((l) => ls.find((n) => n.id === l.id) ?? l));
      if (is.length) qc.setQueriesData<CustoItem[]>({ queryKey: ['custos', 'itens', rev?.id] }, (ant) => ant?.map((i) => is.find((n) => n.id === i.id) ?? i));
    });
  const linhaAlterada = (nova: CustoLinha) => { trocarLinha(nova); if (editavel) enviarAoVivo({ linhas: [nova], itens: [] }); };
  const itemAlterado = (novo: CustoItem) => { if (editavel) enviarAoVivo({ linhas: [], itens: [novo] }); };

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
  // Decisão 70: o valor da proposta acompanha sozinho a soma dos itens (com os valores manuais), 1,5 s depois da última mudança.
  const podeSincronizar = Boolean(editavel && proposta.status === 'À enviar' && pode('vendas', 'editar') && itens.length > 0 && rev?.numero === proposta.revisao_atual);
  const diferente = Math.abs(totalProposta - Number(proposta.valor)) > 0.005;
  useEffect(() => {
    if (!podeSincronizar || !diferente || usarValor.isPending) return;
    const t = setTimeout(() => usarValor.mutate(), 1500);
    return () => clearTimeout(t);
  }, [podeSincronizar, diferente, totalProposta]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!rev) return <EsqueletoTabela />;

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
          {!editavel && <span className="mb-2 inline-flex items-center gap-1 text-xs text-suave"><Lock size={13} /> {rev.status === 'enviada' ? 'Revisão enviada: custos congelados' : 'Somente leitura'}</span>}
        </div>
        <div className="text-right">
          <div className="text-xs text-suave">Preço de venda da proposta ({itens.length} {itens.length === 1 ? 'item' : 'itens'})</div>
          <div className="text-xl font-bold text-petroleo-600 dark:text-teal-300">{moeda(totalProposta)}</div>
          {podeSincronizar && <div className="text-xs text-suave">{diferente ? 'Atualizando o valor da proposta…' : 'É o valor da proposta'}</div>}
        </div>
      </div>

      <div ref={linhaAbas} className="abas abas-indicador items-center gap-1 border-b border-borda" role="tablist">
        {itens.map((i) => (
          <button key={i.id} role="tab" aria-selected={item?.id === i.id} onClick={() => setItemId(i.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors duration-150 ${item?.id === i.id ? 'border-roxo-500 font-semibold text-roxo-600 dark:border-roxo-300 dark:text-roxo-100' : 'border-transparent text-suave hover:text-texto'}`}>
            Item {i.letra}{i.descricao && <span className="font-normal"> · {i.descricao}</span>}{item?.id !== i.id && <> <Bolhas campo={`Item ${i.letra} · `} inicio /></>}
          </button>
        ))}
        {editavel && (
          <button onClick={() => novoItem.mutate()} disabled={novoItem.isPending} className="ml-1 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-roxo-600 hover:bg-roxo-50 disabled:opacity-50 dark:hover:bg-marinho-700">
            <Plus size={15} /> {novoItem.isPending ? 'Criando…' : 'Novo item'}
          </button>
        )}
        <span className="abas-linha" />
      </div>

      {itens.length === 0 ? (
        <Vazio>{editavel ? 'Nenhum item de custo ainda. Clique em "Novo item" para começar (vem com o modelo da planilha).' : 'Esta revisão não tem custos lançados.'}</Vazio>
      ) : item && (
        <div key={item.id} className="entrar"><PrefixoCampo valor={`Item ${item.letra} · `}><ItemCustos
          item={item}
          linhas={linhas.filter((l) => l.item_id === item.id)}
          listas={{ catalogo, refs, veiculos: frota?.veiculos ?? [], precos: frota?.precos ?? {} }}
          editavel={editavel}
          onErro={(e) => setErro(mensagemErro(e))}
          onLinha={linhaAlterada}
          onItem={itemAlterado}
          onRecarregar={recarregar}
          onExcluido={() => { setItemId(null); recarregar(); }}
        /></PrefixoCampo></div>
      )}
    </div>
  );
}

// Blocos da seção; linhas com grupo que não existe mais (revisões antigas) aparecem num bloco "Outros".
const OUTROS = '__outros__';
function blocosDaSecao(s: DefSecao, linhas: CustoLinha[]): Bloco[] | null {
  if (!s.blocos) return null;
  const temOutros = linhas.some((l) => !s.blocos!.some((b) => b.grupo === l.grupo));
  return temOutros ? [...s.blocos, { grupo: OUTROS, adicionar: '', colunas: [{ campo: 'grupo', rotulo: 'Grupo', tipo: 'texto', largura: 'w-36' }, ...s.blocos[0].colunas] }] : s.blocos;
}

const REF_VAZIA: Referencias = { chapas: [], precosChapa: [], perfis: [], itens: [], servicos: [], maoObra: [], maquinas: [] };
// "w-24" vira largura mínima (96 px): a tabela rola de lado em vez de espremer os números.
const larguraMinima = (l?: string) => { const n = /^w-(\d+)$/.exec(l ?? '')?.[1]; return n ? { minWidth: Number(n) * 4 } : undefined; };

interface Listas { catalogo: MaterialCatalogo[]; refs: Referencias; veiculos: RefVeiculo[]; precos: Partial<Record<Combustivel, number>> }

function ItemCustos({ item, linhas, listas, editavel, onErro, onLinha, onItem, onRecarregar, onExcluido }: {
  item: CustoItem; linhas: CustoLinha[]; listas: Listas; editavel: boolean;
  onErro: (e: unknown) => void; onLinha: (l: CustoLinha) => void; onItem: (i: CustoItem) => void; onRecarregar: () => void; onExcluido: () => void;
}) {
  const [it, setIt] = useState(item);
  useEffect(() => setIt(item), [item]);
  // Decisão 74: os Custos abrem com todas as seções fechadas.
  const [abertas, setAbertas] = useState<Record<string, boolean>>({});
  // kg/m dos perfis da biblioteca (pelo item escolhido ou pela descrição), para o peso da galvanização e zincagem.
  const kgPorMetro = useMemo(() => {
    const porId = new Map(listas.refs.perfis.filter((x) => x.kg_m).map((x) => [x.id, Number(x.kg_m)]));
    const porDesc = new Map(listas.refs.perfis.filter((x) => x.kg_m).map((x) => [x.descricao, Number(x.kg_m)]));
    return (l: CustoLinha) => (l.bib_id ? porId.get(l.bib_id) : undefined) ?? porDesc.get(l.descricao) ?? null;
  }, [listas.refs.perfis]);
  const peso = useMemo(() => pesoMateriais(linhas, kgPorMetro), [linhas, kgPorMetro]);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const r = resumoItem(it, linhas);

  async function salvarItem(dados: Partial<CustoItem>) {
    setIt({ ...it, ...dados });
    onItem({ ...it, ...dados });
    try { await atualizarItem(item.id, dados); onRecarregar(); } catch (e) { onErro(e); setIt(item); }
  }
  async function salvarLinha(l: CustoLinha, dados: Partial<CustoLinha>) {
    onLinha({ ...l, ...dados, total: totalLinha({ ...l, ...dados }) });
    try { onLinha(await atualizarLinha(l.id, dados)); } catch (e) { onErro(e); onRecarregar(); }
  }
  async function novaLinha(secao: Secao, grupo = '') {
    const ordem = Math.max(0, ...linhas.map((l) => l.ordem)) + 1;
    const padrao = secao === 'viagem' && (grupo === 'Veículo próprio' || grupo === 'Veículo alugado') ? { quantidade: 1, fator: 0, combustivel: listas.precos.gasolina ?? null }
      : secao === 'maquinas' ? { detalhe: 'Não' }
      : secao === 'acabamentos' && grupo === 'Acabamento em inox' ? { quantidade: 1 } : {};
    try { await adicionarLinha(item.id, { secao, grupo, ordem, ...padrao }); onRecarregar(); setAbertas((a) => ({ ...a, [secao]: true })); } catch (e) { onErro(e); }
  }
  async function mover(lista: CustoLinha[], deId: string, paraId: string) {
    const mudancas = reordenar(lista, deId, paraId);
    if (!mudancas.length) return;
    mudancas.forEach((m) => { const l = lista.find((x) => x.id === m.id); if (l) onLinha({ ...l, ordem: m.ordem }); });
    try { await reordenarLinhas(mudancas); } catch (e) { onErro(e); }
    onRecarregar();
  }
  async function apagarLinha(l: CustoLinha) {
    try { await removerLinha(l.id); onRecarregar(); } catch (e) { onErro(e); }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
      <div className="min-w-0 space-y-3">
        <div className="grid items-end gap-3 rounded-xl bg-pagina p-3 sm:grid-cols-6">
          <Campo rotulo={`Descrição do item ${it.letra}`} className="sm:col-span-6">
            <Entrada key={it.descricao} defaultValue={it.descricao} disabled={!editavel} onBlur={(e) => e.target.value !== it.descricao && salvarItem({ descricao: e.target.value })} />
          </Campo>
          <CampoPct rotulo="Quantidade" valor={it.quantidade} casas={3} editavel={editavel} onConfirmar={(n) => n > 0 && salvarItem({ quantidade: n })} />
          <CampoPct rotulo="Margem (%)" valor={it.lucro_pct} editavel={editavel} onConfirmar={(n) => salvarItem({ lucro_pct: n })} />
          <CampoPct rotulo="Negociação (%)" valor={it.negociacao_pct} editavel={editavel} onConfirmar={(n) => salvarItem({ negociacao_pct: n })} />
          <CampoPct rotulo="Imposto (%)" valor={it.imposto_pct} editavel={editavel} onConfirmar={(n) => n < 100 && salvarItem({ imposto_pct: n })} />
        </div>

        {secoesVisiveis(linhas).map((s) => {
          const doS = linhas.filter((l) => l.secao === s.id).sort((a, b) => a.ordem - b.ordem);
          const aberta = abertas[s.id];
          const blocos = blocosDaSecao(s, doS);
          return (
            <div key={s.id} className="rounded-xl ring-1 ring-borda">
              <button type="button" onClick={() => setAbertas({ ...abertas, [s.id]: !aberta })} className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-pagina">
                <ChevronRight size={16} className={`text-slate-400 transition-transform ${aberta ? 'rotate-90' : ''}`} />
                <span className="w-5 font-mono text-xs font-bold text-roxo-600 dark:text-roxo-100">{s.letra}</span>
                <span className="font-semibold">{s.titulo}</span>
                <Selo>{doS.length}</Selo>
                <span className="ml-auto font-semibold tabular-nums">{moeda(r.porSecao[s.id])}</span>
              </button>
              {aberta && (
                <div className="border-t border-borda px-2 pb-2">
                  {blocos ? blocos.map((b) => {
                    const doG = doS.filter((l) => (b.grupo === OUTROS ? !s.blocos!.some((x) => x.grupo === l.grupo) : l.grupo === b.grupo));
                    return (
                      <div key={b.grupo} className="mt-2">
                        <div className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-suave">
                          {b.grupo === OUTROS ? 'Outros (grupo antigo)' : b.grupo} <Selo>{doG.length}</Selo>
                          <span className="ml-auto font-semibold normal-case tabular-nums text-slate-700 dark:text-slate-200">{moeda(doG.reduce((t, l) => t + totalLinha(l), 0))}</span>
                        </div>
                        <TabelaLinhas linhas={doG} colunas={b.colunas} secao={s.id} grupo={b.grupo as GrupoMaterial} listas={listas} peso={peso} editavel={editavel}
                          onSalvar={salvarLinha} onRemover={apagarLinha} onMover={(de, para) => mover(doG, de, para)} />
                        {editavel && b.grupo !== OUTROS && (
                          <button onClick={() => novaLinha(s.id, b.grupo)} className="mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-roxo-600 hover:bg-roxo-50 dark:hover:bg-marinho-700">
                            <Plus size={13} /> Adicionar {b.adicionar}
                          </button>
                        )}
                      </div>
                    );
                  }) : (
                    <>
                      <TabelaLinhas linhas={doS} colunas={s.colunas} secao={s.id} listas={listas} peso={peso} editavel={editavel}
                        onSalvar={salvarLinha} onRemover={apagarLinha} onMover={(de, para) => mover(doS, de, para)} />
                      {editavel && !s.legado && (
                        <button onClick={() => novaLinha(s.id)} className="mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-roxo-600 hover:bg-roxo-50 dark:hover:bg-marinho-700">
                          <Plus size={13} /> Adicionar linha
                        </button>
                      )}
                    </>
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
          {secoesVisiveis(linhas).map((s) => (
            <div key={s.id} className="flex justify-between py-0.5"><span className="text-slate-300">{s.letra} · {s.titulo}</span><span className="tabular-nums">{moeda(r.porSecao[s.id])}</span></div>
          ))}
          <div className="my-2 border-t border-marinho-500" />
          <Linha r="Custos" v={r.custos} forte />
          <Linha r={`Margem (${it.lucro_pct}%)`} v={r.margem} />
          <Linha r={`Negociação (${it.negociacao_pct}%)`} v={r.negociacao} />
          <Linha r={`Imposto (${it.imposto_pct}% sobre o preço)`} v={r.imposto} />
          <div className="my-2 border-t border-marinho-500" />
          <Linha r="Preço unitário" v={r.precoUnitario} forte />
          <div className="flex justify-between py-0.5 text-slate-300"><span>Quantidade</span><span className="tabular-nums">× {Number(it.quantidade).toLocaleString('pt-BR')}</span></div>
          <div className="mt-2 flex items-baseline justify-between rounded-lg bg-petroleo-600 px-3 py-2">
            <span className="font-semibold">Preço de venda{r.manual ? ' (manual)' : ''}</span>
            <span className="text-lg font-bold tabular-nums">{moeda(r.precoTotal)}</span>
          </div>
          {/* Valor manual (decisão 70): vale na proposta comercial e na soma do valor da proposta. */}
          <div className="mt-3 rounded-lg bg-marinho-700/60 p-2.5">
            <label className="flex items-center gap-2 text-xs text-slate-200">
              <input type="checkbox" className="accent-roxo-500" checked={r.manual} disabled={!editavel}
                onChange={(e) => salvarItem({ valor_manual: e.target.checked ? r.precoCalculadoUnitario : null })} />
              Digitar o valor unitário de venda à mão
            </label>
            {r.manual && (
              <div className="mt-2 space-y-1">
                <div className="rounded-lg bg-white text-texto dark:bg-marinho-800 dark:text-slate-100">
                  <CampoNumero moeda valor={Number(it.valor_manual ?? 0)} casas={2} disabled={!editavel} onConfirmar={(n) => n >= 0 && salvarItem({ valor_manual: n })} className="py-1.5" />
                </div>
                <div className="text-[11px] text-slate-300">Por unidade. × {Number(it.quantidade).toLocaleString('pt-BR')} = {moeda(r.precoTotal)}. Calculado pelos custos: {moeda(r.precoCalculadoUnitario)} por unidade.</div>
              </div>
            )}
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
      <div className="rounded-lg border border-slate-300 bg-superficie dark:border-marinho-500">
        <CampoNumero valor={valor} casas={casas} disabled={!editavel} onConfirmar={onConfirmar} className="py-1.5" />
      </div>
    </Campo>
  );
}

// Tabela de linhas de uma seção (ou de um bloco de Materiais), com a alça ⋮⋮ para arrastar (decisão 41).
function TabelaLinhas({ linhas, colunas, secao, grupo, listas, peso, editavel, onSalvar, onRemover, onMover }: {
  linhas: CustoLinha[]; colunas: Coluna[]; secao: Secao; grupo?: GrupoMaterial; listas: Listas; peso: Peso; editavel: boolean;
  onSalvar: (l: CustoLinha, d: Partial<CustoLinha>) => void; onRemover: (l: CustoLinha) => void; onMover: (de: string, para: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const ordenadas = [...linhas].sort((a, b) => a.ordem - b.ordem);
  const aoSoltar = (e: DragEndEvent) => { if (e.over && e.active.id !== e.over.id) onMover(String(e.active.id), String(e.over.id)); };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="text-left text-[11px] uppercase text-suave">
          <tr>
            <th className="w-6" />
            {colunas.map((c) => <th key={c.campo} style={larguraMinima(c.largura)} className={`px-2 py-1.5 font-medium ${c.largura ?? ''} ${c.tipo === 'numero' ? 'text-right' : ''}`}>{c.rotulo}</th>)}
            <th className="w-32 px-2 py-1.5 text-right font-medium">Total</th>
            <th className="w-8" />
          </tr>
        </thead>
          <SortableContext items={ordenadas.map((l) => l.id)} strategy={verticalListSortingStrategy}>
            <tbody>
              {ordenadas.map((l) => (
                <LinhaCusto key={l.id} linha={l} colunas={colunas} secao={secao} grupo={grupo} listas={listas} peso={peso} editavel={editavel}
                  onSalvar={(d) => onSalvar(l, d)} onRemover={() => onRemover(l)} />
              ))}
              {ordenadas.length === 0 && <tr><td colSpan={colunas.length + 3} className="px-2 py-3 text-center text-xs text-suave">Sem linhas.</td></tr>}
            </tbody>
          </SortableContext>
      </table>
    </div>
    </DndContext>
  );
}

// Na tela o material aparece só pelo nome. Linhas antigas gravaram "IN-001 — AISI 304": o código é tirado na exibição.
const rotuloCatalogo = (m: MaterialCatalogo) => m.nome;
const semCodigoMaterial = (texto: string) => texto.replace(/^[A-Z]{2}-\d{3}\s*[—-]\s*/i, '');
function codDoMaterial(texto: string, catalogo: MaterialCatalogo[]): string | null {
  const cod = texto.match(/^([A-Z]{2}-\d{3})/i)?.[1].toUpperCase();
  if (cod) return cod;
  const nome = texto.trim().toLowerCase();
  return nome ? catalogo.find((m) => m.nome.toLowerCase() === nome)?.cod_mat ?? null : null;
}

type Peso = { kg: number; perfisSemKgM: number };

function LinhaCusto({ linha: l, colunas, secao, grupo, listas, peso, editavel, onSalvar, onRemover }: {
  linha: CustoLinha; colunas: Coluna[]; secao: Secao; grupo?: GrupoMaterial; listas: Listas; peso: Peso; editavel: boolean;
  onSalvar: (d: Partial<CustoLinha>) => void; onRemover: () => void;
}) {
  const [calc, setCalc] = useState(false);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: l.id, disabled: !editavel });
  const estilo = { transform: CSS.Transform.toString(transform), transition };
  const idCampo = useIdCampo(`linha ${l.id}`);

  // Itens da Biblioteca de Materiais do bloco; com material escolhido, os daquele material vêm primeiro (decisão 48).
  const refs = listas.refs;
  const codLinha = codDoMaterial(l.material, listas.catalogo);
  const nomeMaterial = (cod: string | null) => listas.catalogo.find((m) => m.cod_mat === cod)?.nome ?? '';
  const valorKgChapa = (c: Referencias['chapas'][number]) =>
    c.valor_kg != null ? Number(c.valor_kg) : Number(refs.precosChapa.find((p) => p.cod_mat === c.cod_mat && p.tipo_id === c.tipo_id)?.valor_kg ?? 0);
  const primeiroDoMaterial = <T extends { cod_mat: string | null }>(lista: T[]) =>
    codLinha ? [...lista.filter((x) => x.cod_mat === codLinha), ...lista.filter((x) => x.cod_mat !== codLinha)] : lista;
  const servicoRotulo = (s: Referencias['servicos'][number]) => `${s.servico} — ${s.fornecedor}`;

  function opcoes(c: Coluna): OpcaoEscolha[] {
    if (c.tipo === 'catalogo') return listas.catalogo.map((m) => ({ valor: rotuloCatalogo(m), detalhe: m.categoria.replace(/^\d+ - /, '') }));
    if (c.tipo === 'material' && grupo === 'Chapas')
      return primeiroDoMaterial(refs.chapas).map((x) => ({ valor: x.descricao, detalhe: `${Number(x.peso_kg).toLocaleString('pt-BR')} kg · ${moeda(valorKgChapa(x))}/kg` }));
    if (c.tipo === 'material' && grupo === 'Perfis')
      return primeiroDoMaterial(refs.perfis).map((x) => {
        const p = precosPerfil(x.preco_modo, Number(x.valor), x.kg_m == null ? null : Number(x.kg_m));
        return { valor: x.descricao, detalhe: p.porMetro ? `${moeda(p.porMetro)}/m` : x.kg_m ? `${Number(x.kg_m).toLocaleString('pt-BR')} kg/m` : undefined };
      });
    if (c.tipo === 'material') return refs.itens.filter((x) => x.grupo === grupo).map((x) => ({ valor: x.descricao, detalhe: Number(x.valor) > 0 ? `${moeda(x.valor)}/${x.unidade}` : undefined }));
    if (secao === 'mao_obra' && c.campo === 'grupo') return [...new Set(refs.maoObra.map((m) => m.etapa))].map((v) => ({ valor: v }));
    if (secao === 'mao_obra') return refs.maoObra.filter((m) => !l.grupo || m.etapa === l.grupo).map((m) => ({ valor: m.funcao, detalhe: `${moeda(m.valor_hora)}/h` }));
    if (secao === 'maquinas' && l.detalhe === 'Sim') return refs.servicos.map((x) => ({ valor: servicoRotulo(x), detalhe: `${moeda(x.valor)}/h` }));
    if (secao === 'maquinas') return refs.maquinas.map((m) => ({ valor: m.nome, detalhe: `${moeda(m.valor_hora)}/h` }));
    if (c.tipo === 'veiculo') return listas.veiculos.map((v) => ({ valor: v.nome, detalhe: [v.placa, `${Number(v.consumo_km_l).toLocaleString('pt-BR')} km/l`, NOME_COMB[v.combustivel]].filter(Boolean).join(' · ') }));
    return [];
  }

  function escolher(c: Coluna, v: string) {
    if (c.tipo === 'material') {
      if (grupo === 'Chapas') {
        const x = refs.chapas.find((r) => r.descricao === v);
        if (!x) return onSalvar({ descricao: v, bib_id: null });
        return onSalvar({ descricao: v, bib_id: x.id, fator: Number(x.peso_kg), unidade: 'Kg', valor_unitario: valorKgChapa(x), material: nomeMaterial(x.cod_mat) || l.material });
      }
      if (grupo === 'Perfis') {
        const x = refs.perfis.find((r) => r.descricao === v);
        if (!x) return onSalvar({ descricao: v, bib_id: null });
        const p = precosPerfil(x.preco_modo, Number(x.valor), x.kg_m == null ? null : Number(x.kg_m));
        return onSalvar({ descricao: v, bib_id: x.id, unidade: 'Mts', ...(p.porMetro ? { valor_unitario: p.porMetro } : {}), material: nomeMaterial(x.cod_mat) || l.material });
      }
      const x = refs.itens.find((r) => r.descricao === v && r.grupo === grupo);
      if (!x) return onSalvar({ descricao: v, bib_id: null });
      return onSalvar({ descricao: v, bib_id: x.id, unidade: x.unidade, ...(Number(x.valor) > 0 ? { valor_unitario: Number(x.valor) } : {}) });
    }
    if (secao === 'mao_obra' && c.campo === 'descricao') {
      const ref = refs.maoObra.find((m) => m.funcao === v && (!l.grupo || m.etapa === l.grupo));
      return onSalvar({ descricao: v, ...(ref ? { valor_unitario: Number(ref.valor_hora), ...(l.grupo ? {} : { grupo: ref.etapa }) } : {}) });
    }
    if (c.tipo === 'veiculo') {
      const ref = listas.veiculos.find((x) => x.nome === v);
      const preco = ref ? precoDoVeiculo(ref, listas.precos) : null;
      return onSalvar({ descricao: v, ...(ref ? { consumo: Number(ref.consumo_km_l) } : {}), ...(preco ? { combustivel: preco } : {}) });
    }
    if (secao === 'maquinas' && l.detalhe === 'Sim') {
      const ref = refs.servicos.find((x) => servicoRotulo(x) === v);
      return onSalvar(ref ? { descricao: ref.servico, detalhe2: ref.fornecedor, valor_unitario: ref.valor } : { descricao: v });
    }
    if (secao === 'maquinas') {
      const ref = refs.maquinas.find((m) => m.nome === v);
      return onSalvar({ descricao: v, detalhe2: '', ...(ref ? { valor_unitario: Number(ref.valor_hora) } : {}) });
    }
    onSalvar({ [c.campo]: v });
  }

  return (
    <tr ref={setNodeRef} style={estilo} data-campo={idCampo} className={`border-t border-borda ${isDragging ? 'relative z-10 bg-superficie shadow-md' : ''}`}>
      <td className="relative w-6 px-0.5">
        {editavel && (
          <button ref={setActivatorNodeRef} {...attributes} {...listeners} type="button" title="Arrastar para mudar a posição" className="cursor-grab touch-none rounded p-0.5 text-slate-300 hover:text-slate-600 active:cursor-grabbing dark:text-slate-500">
            <GripVertical size={14} />
          </button>
        )}
        <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2"><Bolhas campo={idCampo} /></span>
      </td>
      {colunas.map((c) => (
        <td key={c.campo} className={celula}>
          {c.tipo === 'numero' ? (
            <div className="flex items-center gap-1">
              <CampoNumero moeda={CAMPOS_MOEDA.includes(c.campo)} valor={Number(l[c.campo] ?? 0)} casas={c.campo === 'valor_unitario' ? 4 : c.campo === 'adicional' ? 2 : 3} disabled={!editavel || (c.campo === 'quantidade' && grupo === ('Acabamento em inox' as GrupoMaterial))} onConfirmar={(n) => onSalvar({ [c.campo]: n })} />
              {c.pesoMateriais && editavel && peso.kg > 0 && (
                <button title={`Usar o peso dos materiais do item: ${peso.kg.toLocaleString('pt-BR')} kg${peso.perfisSemKgM ? ` (${peso.perfisSemKgM} perfil(is) sem kg/m na lista de preços ficaram de fora)` : ''}`}
                  onClick={() => onSalvar({ quantidade: peso.kg })} className="shrink-0 rounded p-1 text-slate-400 hover:bg-roxo-50 hover:text-roxo-600 dark:hover:bg-marinho-700"><Scale size={14} /></button>
              )}
              {secao === 'materiais' && c.campo === 'fator' && (
                <>
                  <span className="w-7 text-[11px] text-suave">{l.unidade}</span>
                  {editavel && grupo === 'Chapas' && (
                    <button title="Calcular peso da chapa" onClick={() => setCalc(true)} className="rounded p-1 text-slate-400 hover:bg-roxo-50 hover:text-roxo-600 dark:hover:bg-marinho-700"><Scale size={14} /></button>
                  )}
                </>
              )}
            </div>
          ) : c.tipo === 'simnao' ? (
            <Selecao compacto value={l.detalhe || 'Não'} disabled={!editavel} onChange={(e) => onSalvar({ detalhe: e.target.value, ...(e.target.value === 'Não' ? { detalhe2: '' } : {}) })}>
              <option>Sim</option><option>Não</option>
            </Selecao>
          ) : c.tipo === 'idavolta' ? (
            <div className="flex justify-center"><Caixa marcado={Boolean(l.ida_volta)} disabled={!editavel} onChange={(v) => onSalvar({ ida_volta: v })} /></div>
          ) : c.tipo === 'leitura' ? (
            <span className="px-2 text-sm text-suave" title={secao === 'maquinas' ? 'Escolha o serviço de um fornecedor (Terceirizada = Sim)' : undefined}>{String(l[c.campo] ?? '') || '—'}</span>
          ) : c.tipo === 'veiculo' ? (
            <div>
              <CampoEscolha valor={String(l.descricao ?? '')} opcoes={opcoes(c)} disabled={!editavel} placeholder="Escolha um veículo da frota" onConfirmar={(v) => escolher(c, v)} />
              <div className={`px-2 text-[11px] ${l.descricao && !(Number(l.consumo) > 0) ? 'text-amber-600 dark:text-amber-400' : 'text-suave'}`}>
                {!l.descricao ? '' : Number(l.consumo) > 0
                  ? `${Number(l.consumo).toLocaleString('pt-BR')} km/l · ${l.combustivel ? `${moeda(Number(l.combustivel))}/l` : 'sem preço do combustível'}`
                  : 'Sem cadastro na Frota: escolha da lista'}
              </div>
            </div>
          ) : c.tipo === 'catalogo' || c.tipo === 'material' || c.tipo === 'escolha' ? (
            <CampoEscolha valor={c.tipo === 'catalogo' ? semCodigoMaterial(l.material) : String(l[c.campo] ?? '')} opcoes={opcoes(c)} disabled={!editavel}
              placeholder={c.tipo === 'catalogo' ? 'Ex.: AISI 304' : c.tipo === 'material' ? 'Digite para buscar na biblioteca' : secao === 'maquinas' ? (l.detalhe === 'Sim' ? 'Serviço do fornecedor' : 'Máquina própria') : ''}
              onConfirmar={(v) => escolher(c, v)} />
          ) : c.rota ? (
            <div className="flex items-center gap-0.5">
              <CampoCelula valor={String(l[c.campo] ?? '')} disabled={!editavel} onConfirmar={(v) => onSalvar({ [c.campo]: v })} />
              <button title="Abrir o Qualp (a rota vai para a área de transferência: cole no site)" disabled={!l.detalhe || !l.detalhe2}
                onClick={() => { navigator.clipboard?.writeText(`${l.detalhe} → ${l.detalhe2}`); window.open(LINK_QUALP, '_blank', 'noopener'); }}
                className="shrink-0 rounded p-1 text-slate-400 hover:bg-roxo-50 hover:text-roxo-600 disabled:opacity-30 dark:hover:bg-marinho-700"><Route size={14} /></button>
              <button title="Ver a rota no Google Maps (conferir os km)" disabled={!l.detalhe || !l.detalhe2}
                onClick={() => window.open(linkMapa(l.detalhe, l.detalhe2), '_blank', 'noopener')}
                className="shrink-0 rounded p-1 text-slate-400 hover:bg-roxo-50 hover:text-roxo-600 disabled:opacity-30 dark:hover:bg-marinho-700"><IconeMapa size={14} /></button>
            </div>
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
