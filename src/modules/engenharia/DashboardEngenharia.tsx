import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlarmClock, CircleCheck, CircleDashed, Factory, Hammer } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { dataBR, hojeISO } from '@/shared/lib/formato';
import { Cabecalho, Cartao, EsqueletoDashboard, Selecao, Selo, Vazio } from '@/shared/ui';
import { useContagem } from '@/shared/ui/graficos';
import { listarPainel, listarProjetos, listarUsuariosAtivos } from './api';
import { COLUNAS_PROJETO, COR_STATUS_PROJETO, NOME_STATUS_PROJETO, atrasado, avanco, pendencias, type PainelProjeto, type Projeto } from './regras';

// Ano do projeto: o início do código (26-01-001 → 2026); o projeto de exemplo usa o ano de abertura.
export function anoDoProjeto(p: Pick<Projeto, 'codigo' | 'criado_em'>): number {
  const m = /^(\d{2})-/.exec(p.codigo);
  return m ? 2000 + Number(m[1]) : Number(p.criado_em.slice(0, 4));
}

type Kpi = { id: string; rotulo: string; valor: number; icone: LucideIcon; alerta?: boolean; destaque?: boolean };

// Dashboard da Engenharia (decisão 96).
export function DashboardEngenharia() {
  const navegar = useNavigate();
  const hoje = hojeISO();
  const { data: projetos = [], isLoading: l1 } = useQuery({ queryKey: ['projetos'], queryFn: listarProjetos });
  const { data: painel = [], isLoading: l2 } = useQuery({ queryKey: ['painel_engenharia'], queryFn: listarPainel });
  const { data: usuarios = [] } = useQuery({ queryKey: ['usuarios_ativos'], queryFn: listarUsuariosAtivos, staleTime: 5 * 60_000 });
  const [ano, setAno] = useState('');
  const [cliente, setCliente] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [status, setStatus] = useState('');

  const porId = useMemo(() => new Map<string, PainelProjeto>(painel.map((p) => [p.id, p])), [painel]);
  const nomeUsuario = (id: string | null) => usuarios.find((u) => u.id === id)?.nome ?? '';
  const ativos = projetos.filter((p) => p.status !== 'cancelado');
  const anos = [...new Set(ativos.map(anoDoProjeto))].sort((a, b) => b - a);
  const clientes = [...new Set(ativos.map((p) => p.cliente_nome ?? ''))].filter(Boolean).sort();
  const responsaveis = [...new Set(ativos.map((p) => p.responsavel_id).filter(Boolean) as string[])].map((id) => [id, nomeUsuario(id)] as const).sort((a, b) => a[1].localeCompare(b[1]));

  const lista = ativos.filter((p) => (!ano || anoDoProjeto(p) === Number(ano)) && (!cliente || p.cliente_nome === cliente)
    && (!responsavel || (responsavel === 'sem' ? !p.responsavel_id : p.responsavel_id === responsavel))
    && (!status || (status === 'atrasado' ? atrasado(p, hoje) : p.status === status)));
  const conta = (s: string) => lista.filter((p) => p.status === s).length;
  const nAtrasados = lista.filter((p) => atrasado(p, hoje)).length;
  const kpis: Kpi[] = [
    { id: 'nao_iniciado', rotulo: 'Não iniciados', valor: conta('nao_iniciado'), icone: CircleDashed },
    { id: 'em_andamento', rotulo: 'Em andamento', valor: conta('em_andamento'), icone: Hammer },
    { id: 'liberado', rotulo: 'Liberados para fabricação', valor: conta('liberado'), icone: Factory },
    { id: 'finalizado', rotulo: 'Finalizados', valor: conta('finalizado'), icone: CircleCheck, destaque: true },
    { id: 'atrasado', rotulo: 'Atrasados', valor: nAtrasados, icone: AlarmClock, alerta: nAtrasados > 0 },
  ];
  // Ordem da tabela: atrasados primeiro, depois pelo prazo mais próximo; finalizados no fim.
  const ordenados = [...lista].sort((a, b) => Number(b.status !== 'finalizado') - Number(a.status !== 'finalizado')
    || Number(atrasado(b, hoje)) - Number(atrasado(a, hoje)) || (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999') || b.codigo.localeCompare(a.codigo));

  if (l1 || l2) return <><Cabecalho titulo="Dashboard da Engenharia" /><EsqueletoDashboard /></>;
  return (
    <>
      <Cabecalho titulo="Dashboard da Engenharia" subtitulo={`${lista.length} projetos${ano ? ` em ${ano}` : ''}`} />
      <div className="mb-4 flex flex-wrap gap-3">
        <Selecao className="w-32" value={ano} onChange={(e) => setAno(e.target.value)} aria-label="Ano">
          <option value="">Todos os anos</option>
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}
        </Selecao>
        <Selecao className="w-56" value={cliente} onChange={(e) => setCliente(e.target.value)} aria-label="Cliente">
          <option value="">Todos os clientes</option>
          {clientes.map((c) => <option key={c} value={c}>{c}</option>)}
        </Selecao>
        <Selecao className="w-56" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} aria-label="Responsável">
          <option value="">Todos os responsáveis</option>
          {responsaveis.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          {ativos.some((p) => !p.responsavel_id) && <option value="sem">Sem responsável</option>}
        </Selecao>
        <Selecao className="w-56" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">Todos os status</option>
          {COLUNAS_PROJETO.map((s) => <option key={s} value={s}>{NOME_STATUS_PROJETO[s]}</option>)}
          <option value="atrasado">Atrasados</option>
        </Selecao>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => <CartaoKpi key={k.id} k={k} ativo={status === k.id} onClick={() => setStatus(status === k.id ? '' : k.id)} />)}
      </div>

      <Cartao className="mt-4 p-0">
        <div className="flex items-center justify-between px-5 pb-2 pt-5 font-semibold">
          Execução dos projetos
          <Link to="/engenharia/projetos" className="text-xs font-normal text-roxo-600 hover:underline dark:text-roxo-100">Abrir Kanban</Link>
        </div>
        {ordenados.length === 0 ? <div className="p-4"><Vazio>Nenhum projeto com estes filtros.</Vazio></div> : (
          <div className="overflow-x-auto px-2 pb-3">
            <table className="w-full min-w-[60rem] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase text-suave">
                  <th className="px-3 py-2 font-medium">Projeto</th><th className="px-3 py-2 font-medium">Responsável</th><th className="px-3 py-2 font-medium">Prazo</th>
                  <th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Modelagem</th><th className="px-3 py-2 font-medium">Materiais</th>
                  <th className="px-3 py-2 font-medium">Detalhamento</th><th className="px-3 py-2 font-medium">Pendências</th>
                </tr>
              </thead>
              <tbody>
                {ordenados.map((p) => {
                  const d = porId.get(p.id);
                  const av = d ? avanco(d) : { modelagem: null, materiais: null, detalhamento: null };
                  const pend = pendencias(p, d);
                  const vencido = atrasado(p, hoje);
                  return (
                    <tr key={p.id} onClick={() => navegar(`/engenharia/projetos/${p.id}`)} className="cursor-pointer border-t border-borda align-top hover:bg-pagina">
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs font-semibold text-roxo-600 dark:text-roxo-100">{p.codigo}</span> {p.titulo}
                        <div className="text-xs text-suave">{p.cliente_nome}</div>
                      </td>
                      <td className="px-3 py-2">{nomeUsuario(p.responsavel_id) || <span className="text-suave">—</span>}</td>
                      <td className={`whitespace-nowrap px-3 py-2 tabular-nums ${vencido ? 'font-semibold text-red-600 dark:text-red-400' : ''}`}>{p.prazo ? dataBR(p.prazo) : <span className="text-suave">—</span>}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1"><Selo cor={COR_STATUS_PROJETO[p.status]}>{NOME_STATUS_PROJETO[p.status]}</Selo>{p.pausado && <Selo cor="amarelo">Pausado</Selo>}{vencido && <Selo cor="vermelho">Atrasado</Selo>}</div>
                      </td>
                      <td className="px-3 py-2"><Barra valor={av.modelagem} /></td>
                      <td className="px-3 py-2"><Barra valor={av.materiais} /></td>
                      <td className="px-3 py-2"><Barra valor={av.detalhamento} /></td>
                      <td className="px-3 py-2 text-xs">{pend.length ? <ul className="space-y-0.5 text-amber-700 dark:text-amber-400">{pend.map((x) => <li key={x}>{x}</li>)}</ul> : <span className="text-suave">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="px-3 pt-2 text-xs text-suave">
              Modelagem: conjuntos que já saíram de "Modelando". Materiais: peças com material definido e itens comerciais com o item da biblioteca confirmado.
              Detalhamento: conjuntos Liberados. Sem conjuntos, vale a montagem geral.
            </p>
          </div>
        )}
      </Cartao>
    </>
  );
}

function Barra({ valor }: { valor: number | null }) {
  if (valor == null) return <span className="text-xs text-suave">—</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 rounded-full bg-slate-200 dark:bg-marinho-700"><div className="h-2 rounded-full bg-petroleo-500" style={{ width: `${valor}%` }} /></div>
      <span className="text-xs font-semibold tabular-nums">{valor}%</span>
    </div>
  );
}

function CartaoKpi({ k, ativo, onClick }: { k: Kpi; ativo: boolean; onClick: () => void }) {
  const v = useContagem(k.valor);
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Cartao className={`p-4 transition-shadow duration-150 hover:shadow-md ${ativo ? 'ring-2 ring-roxo-400' : ''}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-suave">{k.rotulo}</span>
          <k.icone size={16} className={k.alerta ? 'text-red-500' : k.destaque ? 'text-petroleo-500 dark:text-teal-300' : 'text-suave'} />
        </div>
        <div className={`mt-1.5 text-xl font-semibold tabular-nums tracking-tight ${k.destaque ? 'text-petroleo-600 dark:text-teal-300' : k.alerta ? 'text-red-600 dark:text-red-400' : 'text-texto'}`}>{Math.round(v)}</div>
      </Cartao>
    </button>
  );
}
