import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, Printer } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, dataHoraBR, hojeISO, mensagemErro } from '@/shared/lib/formato';
import { Aviso, Botao, Cabecalho, EsqueletoTabela, Selo, Vazio } from '@/shared/ui';
import { decidirAjuste, listarAjustes, listarMarcacoes, listarPessoas, useConfigPonto, type PessoaPonto } from '../api';
import { hhmm, horaDoMomento, minutos, minutosDoMomento, SITUACAO_DIA } from '../calculo';
import { Saldo, SeletorMes } from '../Espelho';
import { mesAtual, useMesPonto } from '../useMes';
import { DiaModal } from './DiaModal';
import { ConfigPontoRh } from './ConfigPontoRh';

const ABAS = [['hoje', 'Hoje'], ['pendencias', 'Aguardando aprovação'], ['ajustes', 'Pedidos de ajuste'], ['mes', 'Resumo do mês'], ['config', 'Configurações']] as const;
type Aba = (typeof ABAS)[number][0];

// RH → Ponto (decisão 115). Só o RH vê o ponto de todos.
export function RhPontoPage() {
  const [busca, setBusca] = useSearchParams();
  const aba = (busca.get('aba') as Aba) || 'hoje';
  const mes = busca.get('mes') ?? mesAtual();
  const ir = (a: Aba, m = mes) => setBusca({ aba: a, mes: m });
  const { data: todas = [], error } = useQuery({ queryKey: ['ponto', 'pessoas'], queryFn: listarPessoas });
  const pessoas = useMemo(() => todas.filter((p) => p.bate_ponto && p.situacao !== 'desligado'), [todas]);
  const { data: ajustes = [] } = useQuery({ queryKey: ['ponto', 'ajustes', 'pendentes'], queryFn: () => listarAjustes({ pendentes: true }) });

  return (
    <>
      <Cabecalho titulo="Ponto" subtitulo="Batidas, aprovações e saldo de horas de quem bate ponto. Os sócios ficam fora." />
      <div className="mb-4 flex flex-wrap gap-1 rounded-xl bg-superficie p-1 shadow-sm ring-1 ring-borda">
        {ABAS.map(([a, r]) => (
          <button key={a} type="button" onClick={() => ir(a)}
            className={`rounded-lg px-3 py-1.5 text-sm ${aba === a ? 'bg-roxo-50 font-medium text-roxo-600 dark:bg-roxo-500/20 dark:text-roxo-100' : 'text-suave hover:bg-pagina hover:text-texto'}`}>
            {r}{a === 'ajustes' && ajustes.length > 0 && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-700">{ajustes.length}</span>}
          </button>
        ))}
      </div>
      {error ? <Aviso>{mensagemErro(error)}</Aviso>
        : aba === 'hoje' ? <Hoje pessoas={pessoas} />
        : aba === 'pendencias' ? <Pendencias pessoas={pessoas} mes={mes} setMes={(m) => ir('pendencias', m)} />
        : aba === 'ajustes' ? <Ajustes pessoas={todas} />
        : aba === 'mes' ? <ResumoMes pessoas={pessoas} mes={mes} setMes={(m) => ir('mes', m)} />
        : <ConfigPontoRh pessoas={todas} />}
    </>
  );
}

function Hoje({ pessoas }: { pessoas: PessoaPonto[] }) {
  const hoje = hojeISO();
  const navegar = useNavigate();
  const { data: config } = useConfigPonto();
  const { data: marc = [], isLoading } = useQuery({ queryKey: ['ponto', 'hoje', 'todos', hoje], queryFn: () => listarMarcacoes(hoje, hoje), refetchInterval: 60_000 });
  if (isLoading || !config) return <EsqueletoTabela />;
  if (!pessoas.length) return <Vazio>Ninguém bate ponto ainda. Ligue os funcionários em Configurações.</Vazio>;
  const agora = minutosDoMomento(new Date().toISOString());
  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-borda">
      <table className="w-full text-sm">
        <thead className="bg-pagina text-left text-xs uppercase text-suave">
          <tr><th className="px-4 py-2">Funcionário</th><th className="px-4 py-2">Batidas de hoje</th><th className="px-4 py-2">Agora</th><th /></tr>
        </thead>
        <tbody>
          {pessoas.map((p) => {
            const bs = marc.filter((m) => m.funcionario_id === p.id && !m.desconsiderada_em);
            const n = bs.length;
            const atrasado = n === 0 && agora > minutos(config.manha_inicio) + config.tolerancia_batida_min;
            const st = n === 0 ? (atrasado ? ['Não chegou', 'vermelho'] : ['Ainda não chegou', 'cinza'])
              : n === 1 ? ['Trabalhando', 'verde'] : n === 2 ? ['No almoço', 'azul'] : n === 3 ? ['Trabalhando', 'verde'] : ['Saiu', 'cinza'];
            return (
              <tr key={p.id} className="cursor-pointer border-t border-borda hover:bg-pagina" onClick={() => navegar(`/rh/ponto/${p.id}`)}>
                <td className="px-4 py-2 font-medium">{p.nome}</td>
                <td className="px-4 py-2 tabular-nums">{bs.map((b) => horaDoMomento(b.momento)).join(' · ') || '—'}</td>
                <td className="px-4 py-2"><Selo cor={st[1] as 'cinza'}>{st[0]}</Selo></td>
                <td className="px-4 py-2 text-right text-suave"><ChevronRight size={16} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Pendencias({ pessoas, mes, setMes }: { pessoas: PessoaPonto[]; mes: string; setMes: (m: string) => void }) {
  const { resultado, erro, carregando } = useMesPonto(mes, pessoas);
  const { pode } = useAuth();
  const [aberto, setAberto] = useState<{ p: string; d: string } | null>(null);
  const lista = resultado.flatMap((m) => m.dias.filter((d) => d.pendente).map((d) => ({ m, d })));
  const atual = aberto && resultado.find((m) => m.pessoa.id === aberto.p);
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <SeletorMes mes={mes} onChange={setMes} />
        <span className="text-sm text-suave">Dias fora da tolerância que só entram no relatório oficial depois que o RH aprova ou abona.</span>
      </div>
      {erro ? <Aviso>{mensagemErro(erro)}</Aviso> : carregando ? <EsqueletoTabela /> : !lista.length ? <Vazio>Nada aguardando aprovação neste mês.</Vazio> : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-borda">
          <table className="w-full text-sm">
            <thead className="bg-pagina text-left text-xs uppercase text-suave">
              <tr><th className="px-4 py-2">Funcionário</th><th className="px-4 py-2">Dia</th><th className="px-4 py-2">Batidas</th><th className="px-4 py-2">O que houve</th><th className="px-4 py-2 text-right">Saldo</th><th /></tr>
            </thead>
            <tbody>
              {lista.map(({ m, d }) => (
                <tr key={`${m.pessoa.id}-${d.dia}`} className="border-t border-borda align-top">
                  <td className="px-4 py-2 font-medium">{m.pessoa.nome}</td>
                  <td className="whitespace-nowrap px-4 py-2 tabular-nums">{dataBR(d.dia)}</td>
                  <td className="px-4 py-2 tabular-nums">{d.batidas.map((b) => horaDoMomento(b.momento)).join(' · ') || '—'}</td>
                  <td className="px-4 py-2"><Selo cor={SITUACAO_DIA[d.situacao].cor}>{SITUACAO_DIA[d.situacao].rotulo}</Selo><div className="mt-1 text-xs text-suave">{d.alertas.join(' · ')}</div></td>
                  <td className="px-4 py-2 text-right"><Saldo min={d.saldo} /></td>
                  <td className="px-4 py-2 text-right"><Botao tamanho="sm" onClick={() => setAberto({ p: m.pessoa.id, d: d.dia })}>Decidir</Botao></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {atual && <DiaModal pessoa={atual.pessoa} dia={atual.dias.find((d) => d.dia === aberto!.d) ?? null} onFechar={() => setAberto(null)} editavel={pode('rh', 'editar')} />}
    </>
  );
}

function Ajustes({ pessoas }: { pessoas: PessoaPonto[] }) {
  const qc = useQueryClient();
  const { pode } = useAuth();
  const [todos, setTodos] = useState(false);
  const { data: ajustes = [], isLoading } = useQuery({ queryKey: ['ponto', 'ajustes', todos ? 'todos' : 'pendentes'], queryFn: () => listarAjustes({ pendentes: !todos }) });
  const nome = new Map(pessoas.map((p) => [p.id, p.nome]));
  const [erro, setErro] = useState('');
  const decidir = useMutation({
    mutationFn: (p: { id: string; aprovar: boolean; resposta: string }) => decidirAjuste(p.id, p.aprovar, p.resposta),
    onSuccess: () => { setErro(''); void qc.invalidateQueries({ queryKey: ['ponto'] }); },
    onError: (e) => setErro(mensagemErro(e)),
  });
  const cor = { pendente: 'amarelo', aprovado: 'verde', recusado: 'vermelho' } as const;
  return (
    <>
      <div className="mb-3 flex items-center gap-3">
        <Botao variante="secundario" tamanho="sm" onClick={() => setTodos(!todos)}>{todos ? 'Só os pendentes' : 'Ver também os já decididos'}</Botao>
      </div>
      {erro && <div className="mb-3"><Aviso>{erro}</Aviso></div>}
      {isLoading ? <EsqueletoTabela /> : !ajustes.length ? <Vazio>Nenhum pedido de ajuste {todos ? '' : 'pendente'}.</Vazio> : (
        <div className="space-y-2">
          {ajustes.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-superficie px-4 py-3 text-sm shadow-sm ring-1 ring-borda">
              <div className="min-w-[12rem]">
                <div className="font-medium">{nome.get(a.funcionario_id) ?? '—'}</div>
                <div className="text-xs text-suave">pedido em {dataHoraBR(a.criado_em)}</div>
              </div>
              <span className="font-semibold tabular-nums">{dataBR(a.dia)} às {a.hora.slice(0, 5)}</span>
              <span className="flex-1 text-suave">{a.motivo}{a.resposta && <> · RH: {a.resposta}</>}</span>
              {a.situacao === 'pendente' && pode('rh', 'editar') ? (
                <div className="flex gap-2">
                  <Botao tamanho="sm" variante="secundario" disabled={decidir.isPending} onClick={() => {
                    const r = window.prompt('Motivo da recusa (o funcionário vai ver):');
                    if (r !== null) decidir.mutate({ id: a.id, aprovar: false, resposta: r });
                  }}>Recusar</Botao>
                  <Botao tamanho="sm" disabled={decidir.isPending} onClick={() => decidir.mutate({ id: a.id, aprovar: true, resposta: '' })}>Aprovar</Botao>
                </div>
              ) : <Selo cor={cor[a.situacao]}>{a.situacao === 'pendente' ? 'Pendente' : a.situacao === 'aprovado' ? 'Aprovado' : 'Recusado'}</Selo>}
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-suave">Ao aprovar, a batida entra no dia com a hora pedida. Se o dia ficar fora da tolerância, ele ainda aparece em "Aguardando aprovação".</p>
    </>
  );
}

function ResumoMes({ pessoas, mes, setMes }: { pessoas: PessoaPonto[]; mes: string; setMes: (m: string) => void }) {
  const navegar = useNavigate();
  const { resultado, erro, carregando } = useMesPonto(mes, pessoas);
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <SeletorMes mes={mes} onChange={setMes} />
        <Link to={`/ponto/relatorio?mes=${mes}`} target="_blank" className="inline-flex h-9 items-center gap-2 rounded-lg bg-superficie px-3.5 text-sm font-medium shadow-sm ring-1 ring-borda hover:bg-pagina">
          <Printer size={16} /> Imprimir relatório para assinar
        </Link>
        <span className="text-xs text-suave">O saldo zera todo mês (resposta 6).</span>
      </div>
      {erro ? <Aviso>{mensagemErro(erro)}</Aviso> : carregando ? <EsqueletoTabela /> : !resultado.length ? <Vazio>Ninguém bate ponto.</Vazio> : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-borda">
          <table className="w-full text-sm">
            <thead className="bg-pagina text-left text-xs uppercase text-suave">
              <tr>
                <th className="px-4 py-2">Funcionário</th><th className="px-4 py-2 text-right">Previsto</th><th className="px-4 py-2 text-right">Trabalhado</th>
                <th className="px-4 py-2 text-right">Hora extra</th><th className="px-4 py-2 text-right">Devendo</th><th className="px-4 py-2 text-right">Saldo oficial</th>
                <th className="px-4 py-2 text-right">Faltas</th><th className="px-4 py-2 text-right">Aguardando</th><th />
              </tr>
            </thead>
            <tbody>
              {resultado.map(({ pessoa, resumo: r }) => (
                <tr key={pessoa.id} className="cursor-pointer border-t border-borda hover:bg-pagina" onClick={() => navegar(`/rh/ponto/${pessoa.id}?mes=${mes}`)}>
                  <td className="px-4 py-2 font-medium">{pessoa.nome}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{hhmm(r.previsto)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{hhmm(r.trabalhado)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.extrasAprovadas ? hhmm(r.extrasAprovadas) : '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.deficitAprovado ? hhmm(r.deficitAprovado) : '—'}</td>
                  <td className="px-4 py-2 text-right font-semibold"><Saldo min={r.saldoOficial} /></td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.faltas || '—'}</td>
                  <td className="px-4 py-2 text-right">{r.pendentes ? <Selo cor="amarelo">{r.pendentes}</Selo> : '—'}</td>
                  <td className="px-4 py-2 text-right text-suave"><ChevronRight size={16} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
