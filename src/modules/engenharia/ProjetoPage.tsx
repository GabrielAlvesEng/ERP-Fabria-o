import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, ListTree, Network, Settings2, Table2 } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Campo, CampoData, Cartao, Selecao, Selo, Vazio } from '@/shared/ui';
import { atualizarProjeto, listarConjuntos, listarPecas, obterProjeto } from './api';
import { ArvoreView } from './Arvore';
import { MapaView } from './Mapa';
import { COR_STATUS_PROJETO, NOME_STATUS_PROJETO } from './ProjetosPage';
import { COD_OPS, NOME_PASTA, listaMateriais, progresso, type CodOp, type Pasta, type Projeto } from './regras';

const abas = [
  { id: 'arvore', rotulo: 'Árvore', icone: ListTree },
  { id: 'mapa', rotulo: 'Mapa', icone: Network },
  { id: 'bom', rotulo: 'Lista de materiais', icone: Table2 },
  { id: 'dados', rotulo: 'Dados', icone: Settings2 },
] as const;
type Aba = (typeof abas)[number]['id'];

export function ProjetoPage() {
  const { id = '' } = useParams();
  const [aba, setAba] = useState<Aba>('arvore');
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const { data: projeto, error } = useQuery({ queryKey: ['eng', id, 'projeto'], queryFn: () => obterProjeto(id) });
  const { data: conjuntos = [] } = useQuery({ queryKey: ['eng', id, 'conjuntos'], queryFn: () => listarConjuntos(id) });
  const { data: pecas = [] } = useQuery({ queryKey: ['eng', id, 'pecas'], queryFn: () => listarPecas(id) });

  if (error) return <Aviso>{mensagemErro(error)}</Aviso>;
  if (!projeto) return <Vazio>Carregando…</Vazio>;
  const pct = progresso(conjuntos);

  return (
    <div className="space-y-4">
      <Link to="/engenharia" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-roxo-600"><ArrowLeft size={15} /> Projetos</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-mono text-2xl font-bold text-marinho-700 dark:text-white">{projeto.codigo}</h1>
            <Selo cor={COR_STATUS_PROJETO[projeto.status]}>{NOME_STATUS_PROJETO[projeto.status]}</Selo>
          </div>
          <div className="font-semibold">{projeto.titulo}</div>
          <div className="text-sm text-slate-500">{projeto.empresas?.nome_fantasia}</div>
        </div>
        <div className="flex gap-4 text-sm">
          <Indicador rotulo="Conjuntos" valor={String(conjuntos.length)} />
          <Indicador rotulo="Peças e itens" valor={String(pecas.length)} />
          <div>
            <div className="text-xs text-slate-500">Liberado</div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-24 rounded-full bg-slate-200 dark:bg-marinho-700"><div className="h-2 rounded-full bg-petroleo-500" style={{ width: `${pct}%` }} /></div>
              <span className="font-semibold tabular-nums">{pct}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-marinho-700">
        {abas.map((a) => (
          <button key={a.id} onClick={() => setAba(a.id)} className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${aba === a.id ? 'border-roxo-500 font-semibold text-roxo-600 dark:text-roxo-100' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <a.icone size={15} /> {a.rotulo}
          </button>
        ))}
      </div>

      {aba === 'arvore' && <ArvoreView projetoCodigo={projeto.codigo} conjuntos={conjuntos} pecas={pecas} selecionado={selecionado} onSelecionar={setSelecionado} />}
      {aba === 'mapa' && <MapaView projetoCodigo={projeto.codigo} conjuntos={conjuntos} pecas={pecas} onAbrir={(cid) => { setSelecionado(cid); setAba('arvore'); }} />}
      {aba === 'bom' && <ListaMateriais projeto={projeto} />}
      {aba === 'dados' && <DadosProjeto projeto={projeto} />}
    </div>
  );
}

function Indicador({ rotulo, valor }: { rotulo: string; valor: string }) {
  return <div><div className="text-xs text-slate-500">{rotulo}</div><div className="font-semibold tabular-nums">{valor}</div></div>;
}

function ListaMateriais({ projeto }: { projeto: Projeto }) {
  const { data: conjuntos = [] } = useQuery({ queryKey: ['eng', projeto.id, 'conjuntos'], queryFn: () => listarConjuntos(projeto.id) });
  const { data: pecas = [] } = useQuery({ queryKey: ['eng', projeto.id, 'pecas'], queryFn: () => listarPecas(projeto.id) });
  const [pasta, setPasta] = useState<Pasta | ''>('');
  const [op, setOp] = useState<CodOp | ''>('');
  const linhas = useMemo(() => listaMateriais(pecas, conjuntos).filter((l) => (!pasta || l.pasta === pasta) && (!op || l.cod_op.includes(op))), [pecas, conjuntos, pasta, op]);
  const pesoTotal = linhas.reduce((s, l) => s + (l.pesoTotal ?? 0), 0);
  const qtdTotal = linhas.reduce((s, l) => s + l.qtdTotal, 0);

  function exportarCsv() {
    const cab = ['Código', 'Descrição', 'Conjunto', 'COD_OP', 'Material', 'Espessura', 'Qtd no conjunto', 'Qtd total', 'Peso un. (kg)', 'Peso total (kg)'];
    const num = (n: number | null) => (n == null ? '' : String(n).replace('.', ','));
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const csv = [cab, ...linhas.map((l) => [l.codigo, l.descricao, l.conjunto, l.cod_op.join('/'), l.material, num(l.espessura), num(l.quantidade), num(l.qtdTotal), num(l.peso_unit), num(l.pesoTotal)])]
      .map((r) => r.map((c) => esc(String(c))).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `Lista de materiais ${projeto.codigo}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  }

  return (
    <Cartao className="p-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3 dark:border-marinho-700">
        <Selecao value={pasta} onChange={(e) => setPasta(e.target.value as Pasta | '')} className="w-48">
          <option value="">Todas as pastas</option>
          {(Object.keys(NOME_PASTA) as Pasta[]).map((p) => <option key={p} value={p}>{NOME_PASTA[p]}</option>)}
        </Selecao>
        <Selecao value={op} onChange={(e) => setOp(e.target.value as CodOp | '')} className="w-40">
          <option value="">Todas as operações</option>
          {COD_OPS.map((o) => <option key={o} value={o}>{o}</option>)}
        </Selecao>
        <span className="ml-auto text-sm text-slate-500">{linhas.length} itens · {qtdTotal.toLocaleString('pt-BR')} unidades · {pesoTotal.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg</span>
        <button onClick={exportarCsv} disabled={!linhas.length} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-roxo-600 hover:bg-roxo-50 disabled:opacity-40 dark:hover:bg-marinho-700"><Download size={15} /> Excel (CSV)</button>
      </div>
      {linhas.length === 0 ? <Vazio>Nenhuma peça lançada na árvore.</Vazio> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-marinho-700/50">
              <tr>
                <th className="px-3 py-2">Código</th><th className="px-3 py-2">Descrição</th><th className="px-3 py-2">COD_OP</th><th className="px-3 py-2">Material</th>
                <th className="px-3 py-2 text-right">Esp.</th><th className="px-3 py-2 text-right">Qtd/conj.</th><th className="px-3 py-2 text-right">Qtd total</th><th className="px-3 py-2 text-right">Peso total</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id} className="border-t border-slate-100 dark:border-marinho-700">
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs">{l.codigo}</td>
                  <td className="px-3 py-1.5">{l.descricao}<div className="text-[11px] text-slate-500">{NOME_PASTA[l.pasta]}</div></td>
                  <td className="px-3 py-1.5"><div className="flex flex-wrap gap-0.5">{l.cod_op.map((o) => <span key={o} className={`rounded px-1 font-mono text-[10px] font-semibold text-white ${o === 'CM' ? 'bg-amber-500' : 'bg-roxo-500'}`}>{o}</span>)}</div></td>
                  <td className="px-3 py-1.5">{l.material || '—'}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{l.espessura ?? '—'}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{Number(l.quantidade).toLocaleString('pt-BR')}</td>
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{l.qtdTotal.toLocaleString('pt-BR')}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{l.pesoTotal == null ? '—' : `${l.pesoTotal.toLocaleString('pt-BR')} kg`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Cartao>
  );
}

function DadosProjeto({ projeto }: { projeto: Projeto }) {
  const { pode } = useAuth();
  const qc = useQueryClient();
  const editavel = pode('engenharia', 'editar');
  const [erro, setErro] = useState('');
  const salvar = async (d: Partial<Projeto>) => {
    setErro('');
    try { await atualizarProjeto(projeto.id, d); qc.invalidateQueries({ queryKey: ['eng', projeto.id] }); qc.invalidateQueries({ queryKey: ['projetos'] }); } catch (e) { setErro(mensagemErro(e)); }
  };
  return (
    <Cartao className="max-w-2xl space-y-3">
      {erro && <Aviso>{erro}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Situação do projeto">
          <Selecao value={projeto.status} disabled={!editavel} onChange={(e) => salvar({ status: e.target.value as Projeto['status'] })}>
            {(Object.keys(NOME_STATUS_PROJETO) as Projeto['status'][]).map((s) => <option key={s} value={s}>{NOME_STATUS_PROJETO[s]}</option>)}
          </Selecao>
        </Campo>
        <Campo rotulo="Prazo da Engenharia"><CampoData value={projeto.prazo} disabled={!editavel} onChange={(v) => salvar({ prazo: v || null })} /></Campo>
      </div>
      <Campo rotulo="Observações">
        <AreaTexto defaultValue={projeto.observacoes} disabled={!editavel} rows={5} onBlur={(e) => e.target.value !== projeto.observacoes && salvar({ observacoes: e.target.value })} />
      </Campo>
      <div className="text-sm text-slate-500">
        Código do projeto = código da proposta (decisão 11). Proposta de origem: <Link to="/vendas/propostas" className="font-mono text-roxo-600 hover:underline">{projeto.codigo}</Link>
      </div>
    </Cartao>
  );
}
