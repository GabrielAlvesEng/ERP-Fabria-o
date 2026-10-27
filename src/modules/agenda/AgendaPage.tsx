import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock, MapPin, Pencil, Plus, Repeat, Trash2, UserMinus, Users, X } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Cabecalho, Caixa, Campo, CampoData, CampoInteiro, Cartao, Entrada, EsqueletoPagina, Modal, Selecao, Selo, Vazio } from '@/shared/ui';
import { usePessoasTarefas } from '@/modules/tarefas/api';
import { cancelarCompromisso, marcarVistos, sairDoCompromisso, salvarCompromisso, useAgenda, useNovosAgenda, type Compromisso, type DadosCompromisso, type Modo } from './api';
import {
  CORES, DIAS_SEMANA, MESES, colunas, corInfo, deIsoDia, descreverRepeticao, doDia, hora, inicioDaSemana, inicioDoDia, isoDia, ocorrencias,
  quando, semanasDoMes, somarDias, type Cor, type Ocorrencia, type Repeticao,
} from './regras';

// Agenda de compromissos (decisão 118), "tipo a agenda do e-mail". Tela principal: o mês, com a hora de cada compromisso.
// Também semana e dia em grade de horários. Na agenda de outra pessoa, o que eu não participo aparece só como "Ocupado".
type Visao = 'mes' | 'semana' | 'dia';
type Oc = Ocorrencia<Compromisso>;
const ALTURA_HORA = 48;

export function AgendaPage() {
  const { session } = useAuth();
  const eu = session?.user.id ?? '';
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const pessoaId = params.get('p') || eu;
  const visao = (params.get('v') as Visao) || 'mes';
  const trocar = (k: string, v: string | null) => setParams((p) => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); return n; }, { replace: true });
  const [dia, setDia] = useState(() => params.get('d') || isoDia(new Date()));
  // Vindo de um lembrete ou do sino (?d=AAAA-MM-DD): abre nesse dia.
  const irPara = params.get('d');
  useEffect(() => { if (irPara) { setDia(irPara); trocar('d', null); } }, [irPara]); // eslint-disable-line react-hooks/exhaustive-deps
  const [novo, setNovo] = useState<Date | null>(null);
  const [aberto, setAberto] = useState<Oc | null>(null);
  const [editando, setEditando] = useState<Oc | null>(null);
  const { data: pessoas = [] } = usePessoasTarefas();
  const minha = pessoaId === eu;
  const pessoa = pessoas.find((p) => p.id === pessoaId);

  const cursor = deIsoDia(dia);
  const { de, ate } = useMemo(() => {
    if (visao === 'mes') { const s = semanasDoMes(cursor.getFullYear(), cursor.getMonth()); return { de: s[0]![0]!, ate: somarDias(s[5]![6]!, 1) }; }
    if (visao === 'semana') { const d = inicioDaSemana(cursor); return { de: d, ate: somarDias(d, 7) }; }
    return { de: cursor, ate: somarDias(cursor, 1) };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visao, dia]);
  const { data = [], isLoading, error } = useAgenda(pessoaId || undefined, de, ate);
  const ocs = useMemo(() => ocorrencias(data, de, ate), [data, de, ate]);

  // Ao abrir a minha agenda, os compromissos em que me chamaram deixam de contar como novos no menu
  // (mas ficam com o selo "Novo" enquanto esta tela estiver aberta).
  const [novos, setNovos] = useState<Set<string>>(new Set());
  const qtdNovos = useNovosAgenda();
  useEffect(() => {
    if (!minha || isLoading || (!qtdNovos && !data.some((c) => c.novo))) return;
    setNovos((s) => new Set([...s, ...data.filter((c) => c.novo).map((c) => c.id)]));
    marcarVistos().then(() => qc.invalidateQueries({ queryKey: ['agenda', 'lista'] })).catch(() => {});
  }, [minha, data, qtdNovos, isLoading, qc]);

  function andar(n: number) {
    if (visao === 'mes') setDia(isoDia(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1)));
    else setDia(isoDia(somarDias(cursor, visao === 'semana' ? 7 * n : n)));
  }
  const titulo = visao === 'mes' ? `${MESES[cursor.getMonth()]} de ${cursor.getFullYear()}`
    : visao === 'semana' ? tituloSemana(inicioDaSemana(cursor))
    : `${cursor.getDate()} de ${MESES[cursor.getMonth()]} de ${cursor.getFullYear()}`;
  const criarEm = (d: Date) => { if (minha) setNovo(d); };
  const abrir = (o: Oc) => { if (o.c.detalhes) setAberto(o); };

  if (!eu || (isLoading && !data.length && !error)) return <EsqueletoPagina />;

  return (
    <div>
      <Cabecalho titulo="Agenda" subtitulo={minha ? 'Seus compromissos. Clique num dia ou num horário para marcar.' : `Agenda de ${pessoa?.nome ?? '…'}: você vê os detalhes só dos compromissos em que está.`}
        acoes={<Botao onClick={() => setNovo(proximoHorario(deIsoDia(dia)))}><Plus size={16} /> Novo compromisso</Botao>} />
      {error && <div className="mb-3"><Aviso>{mensagemErro(error)}</Aviso></div>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Botao variante="secundario" onClick={() => setDia(isoDia(new Date()))}>Hoje</Botao>
        <div className="flex">
          <button onClick={() => andar(-1)} className="rounded-lg p-2 text-suave hover:bg-superficie hover:text-texto" aria-label="Anterior"><ChevronLeft size={18} /></button>
          <button onClick={() => andar(1)} className="rounded-lg p-2 text-suave hover:bg-superficie hover:text-texto" aria-label="Próximo"><ChevronRight size={18} /></button>
        </div>
        <h2 className="mr-auto text-lg font-semibold first-letter:uppercase">{titulo}</h2>
        <div className="w-full sm:w-56">
          <Selecao value={pessoaId} onChange={(e) => trocar('p', e.target.value === eu ? null : e.target.value)}>
            {[...pessoas.filter((p) => p.id === eu), ...pessoas.filter((p) => p.id !== eu)].map((p) =>
              <option key={p.id} value={p.id}>{p.id === eu ? 'Minha agenda' : p.nome}</option>)}
          </Selecao>
        </div>
        <div className="flex rounded-lg bg-superficie p-0.5 ring-1 ring-borda">
          {(['mes', 'semana', 'dia'] as const).map((v) => (
            <button key={v} onClick={() => trocar('v', v === 'mes' ? null : v)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${visao === v ? 'bg-roxo-500 font-medium text-white' : 'text-suave hover:text-texto'}`}>
              {v === 'mes' ? 'Mês' : v === 'semana' ? 'Semana' : 'Dia'}
            </button>
          ))}
        </div>
      </div>

      {visao === 'mes' ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <VisaoMes cursor={cursor} dia={dia} ocs={ocs} novos={novos} onDia={setDia} onCriar={(d) => criarEm(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9))} onAbrir={abrir} />
          <PainelDia dia={dia} ocs={doDia(ocs, dia)} novos={novos} minha={minha} onAbrir={abrir} onCriar={() => criarEm(proximoHorario(deIsoDia(dia)))} />
        </div>
      ) : (
        <VisaoGrade dias={visao === 'semana' ? Array.from({ length: 7 }, (_, i) => somarDias(inicioDaSemana(cursor), i)) : [cursor]}
          ocs={ocs} novos={novos} onCriar={criarEm} onAbrir={abrir} onDia={(d) => { setDia(isoDia(d)); trocar('v', 'dia'); }} />
      )}

      {novo && <FormCompromisso inicial={novo} eu={eu} onFechar={() => setNovo(null)} />}
      {editando && <FormCompromisso inicial={editando.inicio} editando={editando} eu={eu} onFechar={() => setEditando(null)} />}
      {aberto && <Detalhe o={aberto} eu={eu} onFechar={() => setAberto(null)} onEditar={() => { setEditando(aberto); setAberto(null); }} />}
    </div>
  );
}

function tituloSemana(d: Date) {
  const f = somarDias(d, 6);
  return d.getMonth() === f.getMonth() ? `${d.getDate()} a ${f.getDate()} de ${MESES[d.getMonth()]} de ${f.getFullYear()}`
    : `${d.getDate()} de ${MESES[d.getMonth()]} a ${f.getDate()} de ${MESES[f.getMonth()]} de ${f.getFullYear()}`;
}
// Hoje: a próxima hora cheia. Outro dia: 09:00.
function proximoHorario(d: Date) {
  const agora = new Date();
  if (isoDia(d) !== isoDia(agora)) return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9);
  return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), Math.min(23, agora.getHours() + 1));
}

function Chip({ o, novo, onAbrir, compacto = false }: { o: Oc; novo: boolean; onAbrir: (o: Oc) => void; compacto?: boolean }) {
  const cor = corInfo(o.c.cor);
  const nome = o.c.detalhes ? o.c.titulo : 'Ocupado';
  if (o.c.dia_inteiro) return (
    <button onClick={(e) => { e.stopPropagation(); onAbrir(o); }} title={nome ?? ''}
      className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium ${cor.fundo} ${o.c.detalhes ? '' : 'cursor-default italic'}`}>
      {nome}
    </button>
  );
  return (
    <button onClick={(e) => { e.stopPropagation(); onAbrir(o); }} title={`${hora(o.inicio)} ${nome}`}
      className={`flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] hover:bg-pagina dark:hover:bg-marinho-700 ${o.c.detalhes ? '' : 'cursor-default italic text-suave'}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cor.ponto}`} />
      <span className="shrink-0 tabular-nums text-suave">{hora(o.inicio)}</span>
      {!compacto && <span className="truncate">{nome}</span>}
      {novo && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-roxo-500" title="Novo" />}
    </button>
  );
}

function VisaoMes({ cursor, dia, ocs, novos, onDia, onCriar, onAbrir }: {
  cursor: Date; dia: string; ocs: Oc[]; novos: Set<string>; onDia: (d: string) => void; onCriar: (d: Date) => void; onAbrir: (o: Oc) => void;
}) {
  const hoje = isoDia(new Date());
  return (
    <Cartao className="overflow-hidden p-0">
      <div className="grid grid-cols-7 border-b border-borda text-center text-[11px] font-semibold uppercase tracking-wider text-suave">
        {DIAS_SEMANA.map((d) => <div key={d} className="py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {semanasDoMes(cursor.getFullYear(), cursor.getMonth()).flat().map((d, i) => {
          const iso = isoDia(d);
          const doMes = d.getMonth() === cursor.getMonth();
          const lista = doDia(ocs, iso);
          return (
            <div key={iso} onClick={() => onDia(iso)} onDoubleClick={() => onCriar(d)}
              className={`min-h-[64px] cursor-pointer border-borda p-1 sm:min-h-[104px] ${i % 7 ? 'border-l' : ''} ${i >= 7 ? 'border-t' : ''} ${iso === dia ? 'bg-roxo-50/60 dark:bg-roxo-500/10' : 'hover:bg-pagina/60'} ${doMes ? '' : 'opacity-50'}`}>
              <div className="mb-0.5 flex justify-center sm:justify-start">
                <span className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs tabular-nums ${iso === hoje ? 'bg-roxo-500 font-bold text-white' : 'text-texto'}`}>{d.getDate()}</span>
              </div>
              {/* No celular, só pontinhos; no computador, a hora e o nome. */}
              <div className="flex flex-wrap justify-center gap-0.5 sm:hidden">
                {lista.slice(0, 4).map((o) => <span key={o.c.id + o.dia} className={`h-1.5 w-1.5 rounded-full ${corInfo(o.c.cor).ponto}`} />)}
              </div>
              <div className="hidden space-y-0.5 sm:block">
                {lista.slice(0, 3).map((o) => <Chip key={o.c.id + o.inicio.toISOString()} o={o} novo={novos.has(o.c.id)} onAbrir={onAbrir} />)}
                {lista.length > 3 && <div className="px-1 text-[11px] font-medium text-suave">+{lista.length - 3}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </Cartao>
  );
}

function PainelDia({ dia, ocs, novos, minha, onAbrir, onCriar }: { dia: string; ocs: Oc[]; novos: Set<string>; minha: boolean; onAbrir: (o: Oc) => void; onCriar: () => void }) {
  const d = deIsoDia(dia);
  return (
    <Cartao className="h-fit p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-suave">{['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][d.getDay()]}</div>
          <div className="text-lg font-semibold">{d.getDate()} de {MESES[d.getMonth()]}</div>
        </div>
        {minha && <Botao variante="secundario" tamanho="sm" onClick={onCriar}><Plus size={14} /> Marcar</Botao>}
      </div>
      {ocs.length === 0 ? <Vazio>Nenhum compromisso.</Vazio> : (
        <ul className="space-y-2">
          {ocs.map((o) => (
            <li key={o.c.id + o.inicio.toISOString()}>
              <button onClick={() => onAbrir(o)} className={`flex w-full gap-3 rounded-lg p-2 text-left ring-1 ring-borda ${o.c.detalhes ? 'hover:bg-pagina dark:hover:bg-marinho-700' : 'cursor-default'}`}>
                <span className={`w-1 shrink-0 rounded-full ${corInfo(o.c.cor).ponto}`} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className={`truncate text-sm font-medium ${o.c.detalhes ? '' : 'italic text-suave'}`}>{o.c.detalhes ? o.c.titulo : 'Ocupado'}</span>
                    {novos.has(o.c.id) && <Selo cor="roxo">Novo</Selo>}
                  </span>
                  <span className="block text-xs tabular-nums text-suave">{o.c.dia_inteiro ? 'Dia inteiro' : `${hora(o.inicio)} às ${hora(o.fim)}`}{o.c.repeticao ? ' · se repete' : ''}</span>
                  {o.c.local && <span className="block truncate text-xs text-suave">{o.c.local}</span>}
                  {o.c.detalhes && o.c.participantes.length > 1 && <span className="block truncate text-xs text-suave">{o.c.participantes.map((p) => p.nome.split(' ')[0]).join(', ')}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}

// Semana e dia: grade de horários (rola sozinha até as 07:00), com os de dia inteiro numa faixa em cima.
function VisaoGrade({ dias, ocs, novos, onCriar, onAbrir, onDia }: {
  dias: Date[]; ocs: Oc[]; novos: Set<string>; onCriar: (d: Date) => void; onAbrir: (o: Oc) => void; onDia: (d: Date) => void;
}) {
  const rolagem = useRef<HTMLDivElement>(null);
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => { rolagem.current?.scrollTo({ top: ALTURA_HORA * 7 - 8 }); }, []);
  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 60_000); return () => clearInterval(t); }, []);
  const hoje = isoDia(agora);
  const cols = `52px repeat(${dias.length}, minmax(0, 1fr))`;
  const inteiros = dias.map((d) => doDia(ocs, isoDia(d)).filter((o) => o.c.dia_inteiro));
  const comInteiros = inteiros.some((l) => l.length);

  return (
    <Cartao className="overflow-hidden p-0">
      <div className="grid border-b border-borda" style={{ gridTemplateColumns: cols }}>
        <div />
        {dias.map((d) => (
          <button key={isoDia(d)} onClick={() => onDia(d)} className="border-l border-borda py-2 text-center hover:bg-pagina/60">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-suave">{DIAS_SEMANA[d.getDay()]}</div>
            <div className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-sm tabular-nums ${isoDia(d) === hoje ? 'bg-roxo-500 font-bold text-white' : ''}`}>{d.getDate()}</div>
          </button>
        ))}
      </div>
      {comInteiros && (
        <div className="grid border-b border-borda" style={{ gridTemplateColumns: cols }}>
          <div className="px-1 py-1 text-right text-[10px] text-suave">dia todo</div>
          {inteiros.map((l, i) => <div key={i} className="space-y-0.5 border-l border-borda p-0.5">{l.map((o) => <Chip key={o.c.id} o={o} novo={novos.has(o.c.id)} onAbrir={onAbrir} />)}</div>)}
        </div>
      )}
      <div ref={rolagem} className="max-h-[calc(100dvh-300px)] min-h-[360px] overflow-y-auto">
        <div className="relative grid" style={{ gridTemplateColumns: cols, height: ALTURA_HORA * 24 }}>
          <div>
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="relative text-right text-[10px] tabular-nums text-suave" style={{ height: ALTURA_HORA }}>
                {h > 0 && <span className="absolute -top-2 right-1.5">{String(h).padStart(2, '0')}:00</span>}
              </div>
            ))}
          </div>
          {dias.map((d) => {
            const iso = isoDia(d);
            const inicio = inicioDoDia(d).getTime();
            const lista = colunas(doDia(ocs, iso).filter((o) => !o.c.dia_inteiro));
            return (
              <div key={iso} className="relative border-l border-borda">
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} onClick={() => onCriar(new Date(d.getFullYear(), d.getMonth(), d.getDate(), h))}
                    className="cursor-pointer border-t border-borda/60 hover:bg-roxo-50/40 dark:hover:bg-roxo-500/10" style={{ height: ALTURA_HORA }} />
                ))}
                {lista.map(({ o, coluna, total }) => {
                  const topo = Math.max(0, (o.inicio.getTime() - inicio) / 3_600_000) * ALTURA_HORA;
                  const fim = Math.min(24, (o.fim.getTime() - inicio) / 3_600_000) * ALTURA_HORA;
                  const cor = corInfo(o.c.cor);
                  return (
                    <button key={o.c.id + o.inicio.toISOString()} onClick={() => onAbrir(o)}
                      className={`absolute overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm ${cor.fundo} ${o.c.detalhes ? '' : 'cursor-default italic'}`}
                      style={{ top: topo + 1, height: Math.max(18, fim - topo - 2), left: `calc(${(coluna / total) * 100}% + 2px)`, width: `calc(${100 / total}% - 4px)`, borderLeftColor: 'currentColor' }}>
                      <div className="truncate font-semibold">{o.c.detalhes ? o.c.titulo : 'Ocupado'}{novos.has(o.c.id) ? ' •' : ''}</div>
                      <div className="truncate tabular-nums opacity-80">{hora(o.inicio)} às {hora(o.fim)}</div>
                      {o.c.local && <div className="truncate opacity-80">{o.c.local}</div>}
                    </button>
                  );
                })}
                {iso === hoje && (
                  <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-red-500" style={{ top: ((agora.getTime() - inicio) / 3_600_000) * ALTURA_HORA }}>
                    <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-red-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Cartao>
  );
}

function Linha({ icone, children }: { icone: ReactNode; children: ReactNode }) {
  return <div className="flex gap-3 text-sm"><span className="mt-0.5 shrink-0 text-suave">{icone}</span><div className="min-w-0 flex-1">{children}</div></div>;
}

function Detalhe({ o, eu, onFechar, onEditar }: { o: Oc; eu: string; onFechar: () => void; onEditar: () => void }) {
  const c = o.c;
  const meu = c.criado_por === eu;
  const participo = c.participantes.some((p) => p.id === eu);
  const [perguntar, setPerguntar] = useState(false);
  const [erro, setErro] = useState('');
  const qc = useQueryClient();
  const feito = () => { qc.invalidateQueries({ queryKey: ['agenda', 'lista'] }); onFechar(); };

  async function cancelar(modo: Modo) {
    setErro('');
    try { await cancelarCompromisso(c.id, modo, o.dia); feito(); } catch (e) { setErro(mensagemErro(e)); }
  }
  async function sair() {
    if (!confirm('Sair deste compromisso? Ele some da sua agenda.')) return;
    try { await sairDoCompromisso(c.id); feito(); } catch (e) { setErro(mensagemErro(e)); }
  }

  return (
    <Modal aberto titulo={c.titulo ?? 'Compromisso'} onFechar={onFechar}>
      <div className="space-y-3">
        <Linha icone={<Clock size={16} />}><span className="first-letter:uppercase">{quando(o)}</span></Linha>
        {c.repeticao && <Linha icone={<Repeat size={16} />}>{descreverRepeticao(c)}</Linha>}
        {c.local && <Linha icone={<MapPin size={16} />}>{/^https?:\/\//.test(c.local) ? <a href={c.local} target="_blank" rel="noreferrer" className="break-all text-roxo-600 underline dark:text-roxo-200">{c.local}</a> : c.local}</Linha>}
        <Linha icone={<Users size={16} />}>
          {c.participantes.length <= 1 ? 'Só ' + (meu ? 'você' : c.participantes[0]?.nome ?? '') : (
            <ul className="space-y-0.5">{c.participantes.map((p) => <li key={p.id}>{p.id === eu ? `${p.nome} (você)` : p.nome}{p.id === c.criado_por && <span className="text-suave"> · marcou</span>}</li>)}</ul>
          )}
        </Linha>
        {c.descricao && <p className="whitespace-pre-wrap rounded-lg bg-pagina px-3 py-2 text-sm dark:bg-marinho-700">{c.descricao}</p>}
        {!meu && <p className="text-xs text-suave">Marcado por {c.criador_nome}.</p>}
        {erro && <Aviso>{erro}</Aviso>}
        {perguntar ? (
          <PerguntaModo acao="Cancelar" onEscolher={cancelar} onVoltar={() => setPerguntar(false)} perigo />
        ) : (
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            {meu && <Botao variante="secundario" onClick={() => (c.repeticao ? setPerguntar(true) : confirm('Cancelar este compromisso? Ele some da agenda de todos.') && cancelar('todos'))}><Trash2 size={15} /> Cancelar compromisso</Botao>}
            {!meu && participo && <Botao variante="secundario" onClick={sair}><UserMinus size={15} /> Sair</Botao>}
            {meu && <Botao onClick={onEditar}><Pencil size={15} /> Editar</Botao>}
          </div>
        )}
      </div>
    </Modal>
  );
}

// Num compromisso que se repete: "só este", "este e os seguintes" ou "todos".
function PerguntaModo({ acao, onEscolher, onVoltar, perigo = false }: { acao: string; onEscolher: (m: Modo) => void; onVoltar: () => void; perigo?: boolean }) {
  return (
    <div className="space-y-2 rounded-lg bg-pagina p-3 dark:bg-marinho-700">
      <div className="text-sm font-medium">{acao} qual?</div>
      <div className="flex flex-wrap gap-2">
        <Botao type="button" variante={perigo ? 'perigo' : 'primario'} tamanho="sm" onClick={() => onEscolher('este')}>Só este dia</Botao>
        <Botao type="button" variante={perigo ? 'perigo' : 'primario'} tamanho="sm" onClick={() => onEscolher('seguintes')}>Este e os seguintes</Botao>
        <Botao type="button" variante={perigo ? 'perigo' : 'primario'} tamanho="sm" onClick={() => onEscolher('todos')}>Todos</Botao>
        <Botao type="button" variante="fantasma" tamanho="sm" onClick={onVoltar}>Voltar</Botao>
      </div>
    </div>
  );
}

const REPETICOES: { valor: Repeticao | ''; rotulo: string; unidade: string }[] = [
  { valor: '', rotulo: 'Não se repete', unidade: '' },
  { valor: 'diaria', rotulo: 'Todo dia', unidade: 'dia(s)' },
  { valor: 'semanal', rotulo: 'Toda semana', unidade: 'semana(s)' },
  { valor: 'mensal', rotulo: 'Todo mês', unidade: 'mês(es)' },
  { valor: 'anual', rotulo: 'Todo ano', unidade: 'ano(s)' },
];
// Hora sempre em 24h (HH:MM), digitando só os números; vale quando chega a 4 dígitos.
function CampoHora({ valor, onChange }: { valor: string; onChange: (h: string) => void }) {
  const [texto, setTexto] = useState(valor);
  useEffect(() => setTexto(valor), [valor]);
  function digitar(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 4);
    setTexto(d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d);
    const h = Number(d.slice(0, 2)); const m = Number(d.slice(2));
    if (d.length === 4 && h < 24 && m < 60) onChange(`${d.slice(0, 2)}:${d.slice(2)}`);
  }
  return (
    <div className="w-[84px] shrink-0">
      <Entrada inputMode="numeric" placeholder="HH:MM" value={texto} onChange={(e) => digitar(e.target.value)} onBlur={() => setTexto(valor)} className="text-center tabular-nums" aria-label="Hora" />
    </div>
  );
}

const juntar = (dia: string, h: string) => { const d = deIsoDia(dia); const [hh, mm] = (h || '00:00').split(':').map(Number); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh!, mm!); };

function FormCompromisso({ inicial, editando, eu, onFechar }: { inicial: Date; editando?: Oc; eu: string; onFechar: () => void }) {
  const qc = useQueryClient();
  const { data: pessoas = [] } = usePessoasTarefas();
  const c = editando?.c;
  const ini0 = editando?.inicio ?? inicial;
  const fim0 = editando ? (c!.dia_inteiro ? somarDias(editando.fim, -1) : editando.fim) : new Date(inicial.getTime() + 3_600_000);
  const [titulo, setTitulo] = useState(c?.titulo ?? '');
  const [diaInteiro, setDiaInteiro] = useState(c?.dia_inteiro ?? false);
  const [diaIni, setDiaIni] = useState(isoDia(ini0));
  const [horaIni, setHoraIni] = useState(hora(ini0));
  const [diaFim, setDiaFim] = useState(isoDia(fim0));
  const [horaFim, setHoraFim] = useState(hora(fim0));
  const [repeticao, setRepeticao] = useState<Repeticao | ''>(c?.repeticao ?? '');
  const [intervalo, setIntervalo] = useState<number>(c?.repetir_intervalo ?? 1);
  const [diasSemana, setDiasSemana] = useState<number[]>(c?.repetir_dias ?? [ini0.getDay()]);
  const [ate, setAte] = useState(c?.repetir_ate ?? '');
  const [local, setLocal] = useState(c?.local ?? '');
  const [descricao, setDescricao] = useState(c?.descricao ?? '');
  const [cor, setCor] = useState<Cor>(c?.cor ?? 'roxo');
  const [participantes, setParticipantes] = useState<string[]>(c ? c.participantes.map((p) => p.id).filter((id) => id !== eu) : []);
  const [perguntar, setPerguntar] = useState(false);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const inicio = diaInteiro ? deIsoDia(diaIni) : juntar(diaIni, horaIni);
  const fim = diaInteiro ? somarDias(deIsoDia(diaFim || diaIni), 1) : juntar(diaFim || diaIni, horaFim);
  const invalido = !titulo.trim() || !diaIni || fim <= inicio || (repeticao === 'semanal' && !diasSemana.length);

  // Mudar o início leva o fim junto (mesma duração).
  function mudarInicio(dia: string, h: string) {
    const dur = fim.getTime() - inicio.getTime();
    const novoIni = diaInteiro ? deIsoDia(dia) : juntar(dia, h);
    const novoFim = new Date(novoIni.getTime() + Math.max(dur, diaInteiro ? 86_400_000 : 0));
    setDiaIni(dia); setHoraIni(h);
    if (dur > 0) { setDiaFim(isoDia(diaInteiro ? somarDias(novoFim, -1) : novoFim)); if (!diaInteiro) setHoraFim(hora(novoFim)); }
  }

  async function gravar(modo: Modo) {
    setSalvando(true); setErro('');
    // Mudar "todos" de uma série: a série inteira anda o mesmo tanto que este dia andou.
    let ini = inicio; let f = fim;
    if (c?.repeticao && modo === 'todos' && editando) {
      const delta = inicio.getTime() - editando.inicio.getTime();
      ini = new Date(new Date(c.inicio).getTime() + delta);
      f = new Date(ini.getTime() + (fim.getTime() - inicio.getTime()));
    }
    const dados: DadosCompromisso = {
      titulo, inicio: ini, fim: f, dia_inteiro: diaInteiro, local, descricao, cor,
      repeticao: repeticao || null, repetir_intervalo: intervalo || 1, repetir_dias: diasSemana, repetir_ate: ate || null, participantes,
    };
    try {
      await salvarCompromisso(c?.id ?? null, dados, modo, editando?.dia ?? null);
      qc.invalidateQueries({ queryKey: ['agenda', 'lista'] });
      onFechar();
    } catch (e) { setErro(mensagemErro(e)); setSalvando(false); }
  }
  function salvar(e: FormEvent) {
    e.preventDefault();
    if (c?.repeticao) setPerguntar(true);
    else gravar('todos');
  }

  const outros = pessoas.filter((p) => p.id !== eu && !participantes.includes(p.id));
  const unidade = REPETICOES.find((r) => r.valor === repeticao)?.unidade ?? '';

  return (
    <Modal aberto titulo={editando ? 'Editar compromisso' : 'Novo compromisso'} onFechar={onFechar} largura="max-w-xl">
      <form onSubmit={salvar} className="space-y-4">
        <Campo rotulo="Nome do compromisso"><Entrada value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} autoFocus placeholder="Ex.: Reunião com a Vale" /></Campo>
        <Caixa marcado={diaInteiro} onChange={setDiaInteiro}>Dia inteiro</Caixa>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Começa">
            <div className="flex gap-2">
              <div className="min-w-0 flex-1"><CampoData value={diaIni} onChange={(v) => v && mudarInicio(v, horaIni)} /></div>
              {!diaInteiro && <CampoHora valor={horaIni} onChange={(h) => mudarInicio(diaIni, h)} />}
            </div>
          </Campo>
          <Campo rotulo="Acaba">
            <div className="flex gap-2">
              <div className="min-w-0 flex-1"><CampoData value={diaFim} onChange={setDiaFim} /></div>
              {!diaInteiro && <CampoHora valor={horaFim} onChange={setHoraFim} />}
            </div>
          </Campo>
        </div>
        {fim <= inicio && <p className="-mt-2 text-xs text-red-600">O fim precisa ser depois do início.</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Repetir">
            <Selecao value={repeticao} onChange={(e) => setRepeticao(e.target.value as Repeticao | '')}>
              {REPETICOES.map((r) => <option key={r.valor} value={r.valor}>{r.rotulo}</option>)}
            </Selecao>
          </Campo>
          {repeticao && (
            <div className="grid grid-cols-2 gap-2">
              <Campo rotulo="A cada"><CampoInteiro valor={intervalo} onChange={(n) => setIntervalo(n ?? 1)} min={1} max={99} sufixo={unidade} /></Campo>
              <Campo rotulo="Até (opcional)"><CampoData value={ate} onChange={setAte} /></Campo>
            </div>
          )}
        </div>
        {repeticao === 'semanal' && (
          <div className="-mt-1 flex flex-wrap gap-1.5">
            {DIAS_SEMANA.map((d, i) => {
              const sel = diasSemana.includes(i);
              return <button key={d} type="button" onClick={() => setDiasSemana(sel ? diasSemana.filter((x) => x !== i) : [...diasSemana, i])}
                className={`h-8 w-11 rounded-full text-xs font-medium ring-1 transition-colors ${sel ? 'bg-roxo-500 text-white ring-roxo-500' : 'text-suave ring-borda hover:text-texto'}`}>{d}</button>;
            })}
          </div>
        )}

        <Campo rotulo="Local"><Entrada value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex.: Fábrica, cliente, ou o link da reunião online" /></Campo>

        <Campo rotulo="Participantes">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center rounded-full bg-roxo-50 px-2.5 py-1 text-xs font-medium text-roxo-700 dark:bg-roxo-500/25 dark:text-roxo-100">Você</span>
              {participantes.map((id) => (
                <span key={id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-2.5 pr-1 text-xs font-medium dark:bg-marinho-700">
                  {pessoas.find((p) => p.id === id)?.nome ?? '…'}
                  <button type="button" onClick={() => setParticipantes(participantes.filter((x) => x !== id))} className="rounded-full p-0.5 hover:bg-slate-200 dark:hover:bg-marinho-600" aria-label="Tirar"><X size={12} /></button>
                </span>
              ))}
            </div>
            {outros.length > 0 && (
              <Selecao value="" onChange={(e) => e.target.value && setParticipantes([...participantes, e.target.value])}>
                <option value="">{participantes.length ? 'Incluir mais alguém…' : 'Só eu (incluir pessoas…)'}</option>
                {outros.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </Selecao>
            )}
          </div>
        </Campo>

        <Campo rotulo="Observações (opcional)"><AreaTexto value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} /></Campo>

        <Campo rotulo="Cor">
          <div className="flex gap-2">
            {CORES.map((x) => (
              <button key={x.valor} type="button" onClick={() => setCor(x.valor)} title={x.rotulo} aria-label={x.rotulo}
                className={`h-7 w-7 rounded-full ${x.ponto} ring-offset-2 ring-offset-superficie transition ${cor === x.valor ? 'ring-2 ring-texto' : 'opacity-70 hover:opacity-100'}`} />
            ))}
          </div>
        </Campo>

        {erro && <Aviso>{erro}</Aviso>}
        {perguntar ? <PerguntaModo acao="Mudar" onEscolher={gravar} onVoltar={() => setPerguntar(false)} /> : (
          <div className="flex justify-end gap-2">
            <Botao type="button" variante="secundario" onClick={onFechar}>Cancelar</Botao>
            <Botao type="submit" disabled={invalido || salvando}>{editando ? 'Salvar' : 'Marcar compromisso'}</Botao>
          </div>
        )}
      </form>
    </Modal>
  );
}
