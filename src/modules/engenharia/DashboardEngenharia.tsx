import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlarmClock, CircleCheck, CircleDashed, Factory, Hammer } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { dataBR, hojeISO } from '@/shared/lib/formato';
import { Cabecalho, Cartao, EsqueletoDashboard, Selecao, Selo, Vazio } from '@/shared/ui';
import { Linhas, Rosca, useContagem, type FatiaRosca } from '@/shared/ui/graficos';
import { listarEventosPainel, listarItensPainel, listarPainel, listarProjetos, listarUsuariosAtivos } from './api';
import { MESES, avancoMedio, seriePorMes } from './indicadores';
import { COLUNAS_PROJETO, COR_STATUS_PROJETO, NOME_STATUS_PROJETO, atrasado, avanco, pendencias, type PainelProjeto, type Projeto } from './regras';

// Ano do projeto: o início do código (26-01-001 → 2026); o projeto de exemplo usa o ano de abertura.
export function anoDoProjeto(p: Pick<Projeto, 'codigo' | 'criado_em'>): number {
  const m = /^(\d{2})-/.exec(p.codigo);
  return m ? 2000 + Number(m[1]) : Number(p.criado_em.slice(0, 4));
}

// Cores das colunas: paleta categórica do ERP (a mesma ordem fixa nos gráficos).
const COR_STATUS: Record<string, string> = { nao_iniciado: 'var(--serie-4)', em_andamento: 'var(--serie-1)', liberado: 'var(--serie-2)', finalizado: 'var(--serie-3)' };

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
  const { data: eventos = [] } = useQuery({ queryKey: ['painel_engenharia', 'eventos'], queryFn: listarEventosPainel });
  const { data: itens = [] } = useQuery({ queryKey: ['painel_engenharia', 'itens'], queryFn: listarItensPainel });

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

  // Gráficos por mês: o ano do filtro ou, sem filtro, o ano atual (até o mês atual).
  const anoAtual = Number(hoje.slice(0, 4));
  const anoGrafico = ano ? Number(ano) : anoAtual;
  const ate = anoGrafico === anoAtual ? Number(hoje.slice(5, 7)) : 12;
  const meses = seriePorMes(anoGrafico, eventos, itens, new Set(lista.map((p) => p.id))).slice(0, ate);
  const rotulosMes = MESES.slice(0, ate);
  const fatias: FatiaRosca[] = COLUNAS_PROJETO.map((s) => ({ id: s, rotulo: NOME_STATUS_PROJETO[s], valor: conta(s), cor: COR_STATUS[s] }));
  const naEngenharia = lista.filter((p) => p.status === 'nao_iniciado' || p.status === 'em_andamento');
  const medio = avancoMedio(naEngenharia.map((p) => porId.get(p.id)).filter((x): x is PainelProjeto => !!x));
  // Prazos: atrasados primeiro, depois os que vencem nos próximos 30 dias.
  const em30 = new Date(Date.parse(hoje) + 30 * 86_400_000).toISOString().slice(0, 10);
  const prazos = lista.filter((p) => p.prazo && p.status !== 'finalizado' && (atrasado(p, hoje) || p.prazo <= em30)).sort((a, b) => a.prazo!.localeCompare(b.prazo!));
  const dias = (iso: string) => Math.round((Date.parse(iso) - Date.parse(hoje)) / 86_400_000);

  if (l1 || l2) return <><Cabecalho titulo="Dashboard da Engenharia" /><EsqueletoDashboard /></>;
  return (
    <>
      <Cabecalho titulo="Dashboard da Engenharia" subtitulo={`${lista.length} projetos${ano ? ` em ${ano}` : ''}`} />
      <div className="mb-4 flex flex-wrap gap-3">
        <Selecao className="w-44" value={ano} onChange={(e) => setAno(e.target.value)} aria-label="Ano">
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

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Cartao>
          <div className="mb-3 font-semibold">Projetos por mês <span className="text-sm font-normal text-suave">· {anoGrafico}</span></div>
          <Linhas inteiro rotulosX={rotulosMes} formatar={(v) => String(v)}
            series={[
              { id: 'abertos', rotulo: 'Abertos', cor: 'var(--serie-1)', valores: meses.map((m) => m.abertos) },
              { id: 'liberados', rotulo: 'Liberados para fabricação', cor: 'var(--serie-2)', valores: meses.map((m) => m.liberados) },
              { id: 'finalizados', rotulo: 'Finalizados', cor: 'var(--serie-3)', valores: meses.map((m) => m.finalizados) },
            ]} />
          <p className="mt-2 text-xs text-suave">Pelo histórico do Kanban: cada projeto conta uma vez por mês em cada linha.</p>
        </Cartao>
        <Cartao>
          <div className="mb-3 font-semibold">Peças e itens lançados por mês <span className="text-sm font-normal text-suave">· {anoGrafico}</span></div>
          <Linhas inteiro rotulosX={rotulosMes} formatar={(v) => `${v} itens`} formatarEixo={(v) => String(v)}
            series={[{ id: 'itens', rotulo: 'Itens lançados (SolidWorks ou à mão)', cor: 'var(--serie-1)', valores: meses.map((m) => m.itens) }]} />
          <p className="mt-2 text-xs text-suave">Peças, perfis e itens comerciais cadastrados nas árvores e listas de materiais, no mês em que entraram.</p>
        </Cartao>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Cartao>
          <div className="mb-4 font-semibold">Projetos por status</div>
          <div className="flex flex-col items-center gap-4">
            <Rosca fatias={fatias} total={fatias.reduce((s, f) => s + f.valor, 0)} rotuloTotal="projetos" tamanho={180} />
            <table className="w-full text-sm">
              <tbody>
                {fatias.map((f) => (
                  <tr key={f.id} className="border-t border-borda">
                    <td className="py-1.5"><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: f.cor }} />{f.rotulo}</span></td>
                    <td className="py-1.5 pl-3 text-right font-semibold tabular-nums">{f.valor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Cartao>
        <Cartao>
          <div className="mb-1 font-semibold">Avanço médio</div>
          <div className="mb-4 text-xs text-suave">{naEngenharia.length} projeto(s) não iniciados ou em andamento</div>
          <div className="space-y-5">
            {([['Modelagem', medio.modelagem], ['Materiais', medio.materiais], ['Detalhamento', medio.detalhamento]] as const).map(([r, v]) => <Medidor key={r} rotulo={r} valor={v} />)}
          </div>
        </Cartao>
        <Cartao>
          <div className="mb-3 font-semibold">Prazos</div>
          {prazos.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-petroleo-50 text-petroleo-600 dark:bg-petroleo-500/15 dark:text-teal-300"><CircleCheck size={22} /></span>
              <div className="font-semibold">Tudo em dia</div>
              <div className="text-sm text-suave">Nenhum prazo vencido ou nos próximos 30 dias.</div>
            </div>
          ) : (
            <ul className="divide-y divide-borda text-sm">
              {prazos.slice(0, 8).map((p) => {
                const d = dias(p.prazo!);
                return (
                  <li key={p.id} onClick={() => navegar(`/engenharia/projetos/${p.id}`)} className="flex cursor-pointer items-center justify-between gap-3 py-2 hover:text-roxo-600">
                    <div className="min-w-0"><span className="font-mono text-xs font-semibold text-roxo-600 dark:text-roxo-100">{p.codigo}</span> <span className="truncate">{p.titulo}</span>
                      <div className="truncate text-xs text-suave">{nomeUsuario(p.responsavel_id) || 'Sem responsável'}</div></div>
                    <Selo cor={d < 0 ? 'vermelho' : d <= 7 ? 'amarelo' : 'cinza'}>{d < 0 ? `${-d} dia(s) atrasado` : d === 0 ? 'Vence hoje' : `${dataBR(p.prazo)} · ${d} dia(s)`}</Selo>
                  </li>
                );
              })}
            </ul>
          )}
        </Cartao>
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

function Medidor({ rotulo, valor }: { rotulo: string; valor: number | null }) {
  const v = useContagem(valor ?? 0);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm"><span>{rotulo}</span><span className="text-lg font-semibold tabular-nums">{valor == null ? '—' : `${Math.round(v)}%`}</span></div>
      <div className="h-2.5 rounded-full bg-slate-200 dark:bg-marinho-700"><div className="h-2.5 rounded-full bg-petroleo-500 transition-[width] duration-500" style={{ width: `${valor ?? 0}%` }} /></div>
    </div>
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
