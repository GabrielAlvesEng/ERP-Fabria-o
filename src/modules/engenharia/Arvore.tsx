import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Boxes, ChevronRight, Component, Copy, Flame, Folder, Nut, Package, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { mensagemErro } from '@/shared/lib/formato';
import { Aviso, Botao, CampoCelula, CampoNumero, Selo } from '@/shared/ui';
import { adicionarConjunto, adicionarPeca, atualizarConjunto, atualizarPeca, excluirItem, listarCatalogo } from './api';
import {
  COD_OPS, NOME_OP, NOME_PASTA, NOME_STATUS, lerMaterial, montarArvore, multiplicador, pastaDaPeca, rotuloMaterial,
  type CodOp, type Conjunto, type No, type Pasta, type Peca, type StatusConjunto,
} from './regras';

export const ICONE_TIPO = { geral: Boxes, submontagem: Box, conjunto: Component, soldado: Flame };
export const NOME_TIPO = { geral: 'Montagem geral', submontagem: 'Submontagem', conjunto: 'Conjunto secundário', soldado: 'Conjunto soldado' };
// Cor do ícone por tipo (o conjunto soldado em âmbar, para destacar que é uma peça soldada única).
export const COR_ICONE = { geral: 'text-marinho-500 dark:text-slate-200', submontagem: 'text-roxo-500', conjunto: 'text-petroleo-500', soldado: 'text-amber-500' };
export const COR_STATUS: Record<StatusConjunto, string> = {
  modelando: 'bg-slate-400', detalhando: 'bg-amber-500', revisao: 'bg-roxo-500', liberado: 'bg-petroleo-500',
};
const ICONE_PASTA: Record<Pasta, typeof Folder> = { fabricada: Folder, fixador: Nut, comercial: Package };

// Código curto para a árvore: só a parte depois do código do projeto (00-00-000, 0A-01-000).
export const codigoCurto = (codigo: string, projeto: string) => (codigo.startsWith(projeto + '-') ? codigo.slice(projeto.length + 1) : codigo);

export function ArvoreView({ projetoCodigo, conjuntos, pecas, selecionado, onSelecionar }: {
  projetoCodigo: string; conjuntos: Conjunto[]; pecas: Peca[]; selecionado: string | null; onSelecionar: (id: string) => void;
}) {
  const raiz = useMemo(() => montarArvore(conjuntos), [conjuntos]);
  const [fechados, setFechados] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState('');
  const sel = conjuntos.find((c) => c.id === selecionado) ?? (raiz ? conjuntos.find((c) => c.id === raiz.id) : undefined);
  const qtdPecas = useMemo(() => {
    const m = new Map<string, number>();
    pecas.forEach((p) => m.set(p.conjunto_id, (m.get(p.conjunto_id) ?? 0) + 1));
    return m;
  }, [pecas]);

  const t = busca.toLowerCase();
  const casa = (n: No): boolean => !t || `${n.codigo} ${n.nome}`.toLowerCase().includes(t) || n.filhos.some(casa);

  function alternar(id: string) {
    const novo = new Set(fechados);
    if (novo.has(id)) novo.delete(id); else novo.add(id);
    setFechados(novo);
  }

  const renderNo = (n: No, nivel: number) => {
    if (!casa(n)) return null;
    const Icone = ICONE_TIPO[n.tipo];
    const aberto = !fechados.has(n.id) || Boolean(t);
    const ativo = sel?.id === n.id;
    return (
      <div key={n.id}>
        <div
          onClick={() => onSelecionar(n.id)}
          className={`group flex cursor-pointer items-center gap-1.5 rounded-lg py-1.5 pr-2 text-sm transition ${ativo ? 'bg-roxo-500 text-white shadow-sm' : 'hover:bg-white dark:hover:bg-marinho-700'}`}
          style={{ paddingLeft: 6 + nivel * 18 }}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); alternar(n.id); }}
            className={`flex h-4 w-4 items-center justify-center rounded ${n.filhos.length ? '' : 'invisible'} ${ativo ? 'text-white/80' : 'text-slate-400'}`}
            aria-label={aberto ? 'Recolher' : 'Expandir'}
          >
            <ChevronRight size={14} className={`transition-transform ${aberto ? 'rotate-90' : ''}`} />
          </button>
          <Icone size={15} className={ativo ? 'text-white' : COR_ICONE[n.tipo]} />
          <span className={`font-mono text-[11px] ${ativo ? 'text-white/80' : 'text-slate-500'}`}>{codigoCurto(n.codigo, projetoCodigo)}</span>
          <span className="min-w-0 flex-1 truncate">{n.nome}</span>
          {Number(n.quantidade) !== 1 && <span className={`rounded px-1 text-[10px] font-semibold ${ativo ? 'bg-white/20' : 'bg-slate-200 text-slate-600 dark:bg-marinho-600 dark:text-slate-200'}`}>×{Number(n.quantidade).toLocaleString('pt-BR')}</span>}
          {(qtdPecas.get(n.id) ?? 0) > 0 && <span className={`text-[10px] ${ativo ? 'text-white/80' : 'text-slate-400'}`}>{qtdPecas.get(n.id)} pç</span>}
          <span className={`h-2 w-2 shrink-0 rounded-full ${COR_STATUS[n.status]}`} title={NOME_STATUS[n.status]} />
        </div>
        {aberto && n.filhos.length > 0 && (
          <div className="relative">
            <span className="absolute bottom-2 top-0 border-l border-slate-200 dark:border-marinho-600" style={{ left: 13 + nivel * 18 }} />
            {n.filhos.map((f) => renderNo(f, nivel + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200 lg:sticky lg:top-2 lg:max-h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto dark:bg-marinho-900/60 dark:ring-marinho-700">
        <div className="relative mb-2">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar conjunto" className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2 text-sm outline-none focus:border-roxo-500 dark:border-marinho-600 dark:bg-marinho-800" />
        </div>
        <div className="mb-1 flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <span>Estrutura</span>
          <span className="flex gap-2 normal-case tracking-normal">
            <button className="hover:text-roxo-600" onClick={() => setFechados(new Set())}>expandir</button>
            <button className="hover:text-roxo-600" onClick={() => setFechados(new Set(conjuntos.filter((c) => c.tipo !== 'geral').map((c) => c.id)))}>recolher</button>
          </span>
        </div>
        {raiz ? renderNo(raiz, 0) : <div className="p-3 text-sm text-slate-500">Sem estrutura.</div>}
        <div className="mt-3 flex flex-wrap gap-3 border-t border-slate-200 px-2 pt-2 text-[11px] text-slate-500 dark:border-marinho-700">
          {(Object.keys(NOME_STATUS) as StatusConjunto[]).map((s) => <span key={s} className="inline-flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${COR_STATUS[s]}`} />{NOME_STATUS[s]}</span>)}
        </div>
      </aside>
      {sel ? <PainelConjunto key={sel.id} projetoCodigo={projetoCodigo} conjunto={sel} conjuntos={conjuntos} pecas={pecas.filter((p) => p.conjunto_id === sel.id)} onSelecionar={onSelecionar} /> : <div />}
    </div>
  );
}

function PainelConjunto({ projetoCodigo, conjunto: c, conjuntos, pecas, onSelecionar }: {
  projetoCodigo: string; conjunto: Conjunto; conjuntos: Conjunto[]; pecas: Peca[]; onSelecionar: (id: string) => void;
}) {
  const { pode } = useAuth();
  const qc = useQueryClient();
  const editavel = pode('engenharia', 'editar');
  const [erro, setErro] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [copiado, setCopiado] = useState(false);
  const filhos = conjuntos.filter((x) => x.pai_id === c.id).sort((a, b) => a.codigo.localeCompare(b.codigo));
  const mult = multiplicador(c.id, conjuntos);
  const Icone = ICONE_TIPO[c.tipo];
  const recarregar = () => { qc.invalidateQueries({ queryKey: ['eng', c.projeto_id] }); };
  const tentar = async (fn: () => Promise<unknown>) => { setErro(''); try { await fn(); recarregar(); } catch (e) { setErro(mensagemErro(e)); } };
  useEffect(() => setCopiado(false), [c.id]);

  async function criarFilho(e: FormEvent) {
    e.preventDefault();
    if (!novoNome.trim()) return;
    await tentar(async () => { const n = await adicionarConjunto(c.id, novoNome.trim()); setNovoNome(''); onSelecionar(n.id); });
  }

  return (
    <div className="min-w-0 space-y-4">
      {erro && <Aviso>{erro}</Aviso>}
      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-marinho-800 dark:ring-marinho-700">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className={`rounded-xl p-2.5 ${c.tipo === 'geral' ? 'bg-marinho-50 text-marinho-500 dark:bg-marinho-700 dark:text-slate-100' : c.tipo === 'submontagem' ? 'bg-roxo-50 text-roxo-600 dark:bg-roxo-700/30 dark:text-roxo-100' : c.tipo === 'soldado' ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-200' : 'bg-petroleo-50 text-petroleo-600 dark:bg-petroleo-600/30 dark:text-teal-100'}`}>
              <Icone size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold">{c.codigo}</span>
                <button title="Copiar código" onClick={() => { navigator.clipboard?.writeText(c.codigo); setCopiado(true); }} className="text-slate-400 hover:text-roxo-600"><Copy size={13} /></button>
                {copiado && <span className="text-[11px] text-petroleo-600">copiado</span>}
              </div>
              <div className="text-xs text-slate-500">{NOME_TIPO[c.tipo]} · aparece {mult.toLocaleString('pt-BR')}× no projeto{c.codigo_cad && c.codigo_cad !== c.codigo && <> · CAD <span className="font-mono">{c.codigo_cad}</span></>}</div>
              <div className="mt-1 text-lg font-semibold">
                {editavel ? <CampoCelula valor={c.nome} onConfirmar={(v) => v.trim() && tentar(() => atualizarConjunto(c.id, { nome: v.trim() }))} /> : c.nome}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3 text-sm">
            <label className="block"><span className="mb-1 block text-[11px] text-slate-500">Qtd no pai</span>
              <div className="w-20 rounded-lg border border-slate-300 dark:border-marinho-500"><CampoNumero valor={c.quantidade} casas={3} disabled={!editavel || c.tipo === 'geral'} onConfirmar={(n) => n > 0 && tentar(() => atualizarConjunto(c.id, { quantidade: n }))} /></div>
            </label>
            <label className="block"><span className="mb-1 block text-[11px] text-slate-500">Revisão</span>
              <div className="w-16 rounded-lg border border-slate-300 dark:border-marinho-500"><CampoCelula valor={c.revisao} disabled={!editavel} onConfirmar={(v) => tentar(() => atualizarConjunto(c.id, { revisao: v || 'R0' }))} /></div>
            </label>
            <label className="block"><span className="mb-1 block text-[11px] text-slate-500">Situação</span>
              <select value={c.status} disabled={!editavel} onChange={(e) => tentar(() => atualizarConjunto(c.id, { status: e.target.value as StatusConjunto }))}
                className="cursor-pointer rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-marinho-500 dark:bg-marinho-800">
                {(Object.keys(NOME_STATUS) as StatusConjunto[]).map((s) => <option key={s} value={s}>{NOME_STATUS[s]}</option>)}
              </select>
            </label>
          </div>
        </div>
        <div className="mt-3">
          {editavel ? <CampoCelula valor={c.descricao} placeholder="Descrição / observações do conjunto" onConfirmar={(v) => tentar(() => atualizarConjunto(c.id, { descricao: v }))} /> : <p className="text-sm text-slate-600">{c.descricao}</p>}
        </div>
      </div>

      {(c.tipo === 'geral' || c.tipo === 'submontagem') && (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-marinho-800 dark:ring-marinho-700">
          <div className="mb-2 flex items-center gap-2 font-semibold">{c.tipo === 'geral' ? (filhos.some((f) => f.tipo === 'soldado') ? 'Submontagens e conjuntos soldados' : 'Submontagens') : 'Conjuntos secundários'} <Selo>{filhos.length}</Selo></div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {filhos.map((f) => {
              const I = ICONE_TIPO[f.tipo];
              return (
                <button key={f.id} onClick={() => onSelecionar(f.id)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ring-1 ring-slate-200 transition hover:ring-roxo-500 dark:ring-marinho-600">
                  <I size={16} className={COR_ICONE[f.tipo]} />
                  <span className="font-mono text-[11px] text-slate-500">{codigoCurto(f.codigo, projetoCodigo)}</span>
                  <span className="min-w-0 flex-1 truncate">{f.nome}</span>
                  <span className={`h-2 w-2 rounded-full ${COR_STATUS[f.status]}`} />
                </button>
              );
            })}
          </div>
          {editavel && (
            <form onSubmit={criarFilho} className="mt-3 flex gap-2">
              <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder={c.tipo === 'geral' ? 'Nome da nova submontagem (ex.: Estrutura)' : 'Nome do novo conjunto (ex.: Coluna)'}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-roxo-500 dark:border-marinho-500 dark:bg-marinho-800" />
              <Botao type="submit" disabled={!novoNome.trim()}><Plus size={15} /> {c.tipo === 'geral' ? 'Submontagem' : 'Conjunto'}</Botao>
            </form>
          )}
        </div>
      )}

      <PecasDoConjunto conjunto={c} pecas={pecas} mult={mult} editavel={editavel} onErro={setErro} onRecarregar={recarregar} />

      {editavel && c.tipo !== 'geral' && (
        <div className="flex justify-end">
          <Botao variante="secundario" className="text-red-600" onClick={() => tentar(async () => { await excluirItem('conjunto', c.id); if (c.pai_id) onSelecionar(c.pai_id); })}>
            <Trash2 size={15} /> Excluir {NOME_TIPO[c.tipo].toLowerCase()}
          </Botao>
        </div>
      )}
    </div>
  );
}

function PecasDoConjunto({ conjunto, pecas, mult, editavel, onErro, onRecarregar }: {
  conjunto: Conjunto; pecas: Peca[]; mult: number; editavel: boolean; onErro: (m: string) => void; onRecarregar: () => void;
}) {
  const [abertas, setAbertas] = useState<Record<Pasta, boolean>>({ fabricada: true, fixador: true, comercial: true });
  const [nova, setNova] = useState({ descricao: '', quantidade: 1, cod_op: [] as CodOp[] });
  const tentar = async (fn: () => Promise<unknown>) => { try { await fn(); onRecarregar(); } catch (e) { onErro(mensagemErro(e)); } };
  const { data: catalogo = [] } = useQuery({ queryKey: ['catalogo_materiais'], queryFn: listarCatalogo, staleTime: 10 * 60_000 });
  const porPasta = (p: Pasta) => pecas.filter((x) => pastaDaPeca(x) === p).sort((a, b) => a.seq - b.seq);

  async function adicionar(e: FormEvent) {
    e.preventDefault();
    if (!nova.descricao.trim()) return;
    await tentar(() => adicionarPeca(conjunto.id, { ...nova, descricao: nova.descricao.trim() }));
    setNova({ descricao: '', quantidade: 1, cod_op: nova.cod_op });
  }

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-marinho-800 dark:ring-marinho-700">
      <div className="mb-2 flex items-center gap-2 font-semibold">Peças e itens {conjunto.tipo === 'geral' ? 'da montagem geral' : conjunto.tipo === 'submontagem' ? 'desta submontagem' : conjunto.tipo === 'soldado' ? 'deste conjunto soldado (lista de corte)' : 'deste conjunto'} <Selo>{pecas.length}</Selo></div>

      {(['fabricada', 'fixador', 'comercial'] as Pasta[]).map((pasta) => {
        const lista = porPasta(pasta);
        if (!lista.length) return null;
        const I = ICONE_PASTA[pasta];
        return (
          <div key={pasta} className="mb-2 rounded-xl ring-1 ring-slate-100 dark:ring-marinho-700">
            <button onClick={() => setAbertas({ ...abertas, [pasta]: !abertas[pasta] })} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-marinho-700/40">
              <ChevronRight size={14} className={`text-slate-400 transition-transform ${abertas[pasta] ? 'rotate-90' : ''}`} />
              <I size={15} className="text-slate-500" /> <span className="font-medium">{NOME_PASTA[pasta]}</span> <Selo>{lista.length}</Selo>
            </button>
            {abertas[pasta] && (
              <div className="overflow-x-auto px-2 pb-2">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="text-left text-[11px] uppercase text-slate-500">
                    <tr>
                      <th className="w-24 px-2 py-1">Código</th><th className="min-w-[220px] px-2 py-1">Descrição</th><th className="w-20 px-2 py-1 text-right">Qtd</th>
                      <th className="w-32 px-2 py-1">COD_OP</th><th className="w-40 px-2 py-1">Material</th><th className="w-20 px-2 py-1 text-right">Esp.</th>
                      <th className="w-24 px-2 py-1 text-right">Peso un. (kg)</th><th className="w-20 px-2 py-1 text-right">Total</th><th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((p) => (
                      <tr key={p.id} className="border-t border-slate-100 dark:border-marinho-700">
                        <td className="whitespace-nowrap px-2 py-1 font-mono text-[11px] text-slate-500" title={p.codigo}>{p.codigo.replace(/^\d{2}-\d{2,}-\d{3}-/, '')}</td>
                        <td className="px-1"><CampoCelula valor={p.descricao} disabled={!editavel} onConfirmar={(v) => tentar(() => atualizarPeca(p.id, { descricao: v }))} /></td>
                        <td className="px-1"><CampoNumero valor={p.quantidade} casas={3} disabled={!editavel} onConfirmar={(n) => n > 0 && tentar(() => atualizarPeca(p.id, { quantidade: n }))} /></td>
                        <td className="px-1"><SeletorOps valor={p.cod_op} disabled={!editavel} onChange={(ops) => tentar(() => atualizarPeca(p.id, { cod_op: ops }))} /></td>
                        <td className="px-1"><CampoCelula valor={rotuloMaterial(p)} lista="lista-cod-mat" disabled={!editavel} placeholder="COD_MAT (ex.: IN-001)" onConfirmar={(v) => tentar(() => atualizarPeca(p.id, lerMaterial(v, catalogo)))} /></td>
                        <td className="px-1"><CampoNumero valor={p.espessura ?? 0} casas={2} disabled={!editavel} onConfirmar={(n) => tentar(() => atualizarPeca(p.id, { espessura: n || null }))} /></td>
                        <td className="px-1"><CampoNumero valor={p.peso_unit ?? 0} casas={3} disabled={!editavel} onConfirmar={(n) => tentar(() => atualizarPeca(p.id, { peso_unit: n || null }))} /></td>
                        <td className="px-2 text-right font-medium tabular-nums" title="Quantidade total no projeto">{(Number(p.quantidade) * mult).toLocaleString('pt-BR')}</td>
                        <td>{editavel && <button onClick={() => tentar(() => excluirItem('peca', p.id))} className="rounded p-1 text-slate-300 hover:text-red-600" aria-label="Excluir peça"><Trash2 size={14} /></button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
      <datalist id="lista-cod-mat">{catalogo.map((c) => <option key={c.cod_mat} value={`${c.cod_mat} — ${c.nome}`}>{c.categoria}</option>)}</datalist>
      {pecas.length === 0 && <div className="py-3 text-center text-sm text-slate-500">Nenhuma peça neste {conjunto.tipo === 'geral' ? 'nível' : 'conjunto'}.</div>}

      {editavel && (
        <form onSubmit={adicionar} className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2 dark:bg-marinho-700/40">
          <input value={nova.descricao} onChange={(e) => setNova({ ...nova, descricao: e.target.value })} placeholder="Nova peça ou item (ex.: Chapa base 300x300)"
            className="min-w-[220px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-roxo-500 dark:border-marinho-500 dark:bg-marinho-800" />
          <div className="w-20 rounded-lg border border-slate-300 bg-white dark:border-marinho-500 dark:bg-marinho-800"><CampoNumero valor={nova.quantidade} casas={3} onConfirmar={(n) => setNova({ ...nova, quantidade: n > 0 ? n : 1 })} /></div>
          <SeletorOps valor={nova.cod_op} onChange={(ops) => setNova({ ...nova, cod_op: ops })} />
          <Botao type="submit" disabled={!nova.descricao.trim()}><Plus size={15} /> Adicionar</Botao>
        </form>
      )}
    </div>
  );
}

function SeletorOps({ valor, onChange, disabled }: { valor: CodOp[]; onChange: (ops: CodOp[]) => void; disabled?: boolean }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const aberto = pos !== null;
  const setAberto = (v: boolean) => { if (!v) setPos(null); };
  const ordenados = COD_OPS.filter((o) => valor.includes(o));
  const chip = (op: CodOp, on: boolean) =>
    `rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${on ? (op === 'CM' ? 'bg-amber-500 text-white' : 'bg-roxo-500 text-white') : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-marinho-700 dark:text-slate-300'}`;
  return (
    <div className="relative">
      <button type="button" disabled={disabled} onClick={(e) => { if (aberto) return setPos(null); const r = e.currentTarget.getBoundingClientRect(); setPos({ top: Math.min(r.bottom + 4, window.innerHeight - 280), left: Math.min(r.left, window.innerWidth - 240) }); }} title={ordenados.map((o) => NOME_OP[o]).join(', ') || 'Escolher operações'}
        className={`flex min-h-[26px] flex-nowrap items-center gap-0.5 rounded-md border border-transparent px-1 py-0.5 ${disabled ? 'cursor-default' : 'hover:border-slate-300 dark:hover:border-marinho-500'}`}>
        {ordenados.length ? ordenados.map((o) => <span key={o} className={chip(o, true)}>{o}</span>) : <span className="px-1 text-xs text-slate-400">{disabled ? '—' : '+ operação'}</span>}
      </button>
      {aberto && !disabled && (
        <>
          <div className="fixed inset-0 z-20" onMouseDown={() => setAberto(false)} />
          <div style={{ top: pos!.top, left: pos!.left }} className="fixed z-30 w-56 rounded-lg bg-white p-2 shadow-lg ring-1 ring-slate-200 dark:bg-marinho-800 dark:ring-marinho-600">
            {COD_OPS.map((op) => {
              const on = valor.includes(op);
              return (
                <button key={op} type="button" onClick={() => onChange(on ? valor.filter((v) => v !== op) : [...valor, op])}
                  className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-slate-50 dark:hover:bg-marinho-700">
                  <span className={chip(op, on)}>{op}</span><span className="text-slate-600 dark:text-slate-300">{NOME_OP[op]}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
