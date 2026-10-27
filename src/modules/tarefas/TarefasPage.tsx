import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDownWideNarrow, CalendarDays, ChevronDown, ChevronRight, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, dataHoraBR, hojeISO, mensagemErro } from '@/shared/lib/formato';
import { Aviso, Botao, Cabecalho, Caixa, Campo, CampoData, Cartao, Entrada, EsqueletoPagina, Modal, Selecao, Selo, Vazio } from '@/shared/ui';
import { Avatar } from '@/modules/perfil/Avatar';
import { apagarTarefa, criarTarefa, editarTarefa, marcarTarefa, marcarVistas, ordenarTarefas, usePessoasTarefas, useTarefas, type PessoaTarefas, type Tarefa } from './api';
import { URGENCIAS, mover, porUrgencia, separar, situacaoPrazo, urgenciaInfo, type Urgencia } from './regras';

// Tarefas por pessoa (decisão 116). Cada pessoa com login tem a sua lista; todos veem a de todos. Só o dono marca,
// edita e reorganiza; o dono e quem criou podem apagar. O banco confere tudo isso de novo.
export function TarefasPage() {
  const { session } = useAuth();
  const eu = session?.user.id ?? '';
  const [params, setParams] = useSearchParams();
  const { data: pessoas, isLoading: carregandoPessoas } = usePessoasTarefas();
  const { data: tarefas = [], isLoading, error } = useTarefas();
  const escolhida = params.get('p') || eu;
  const escolher = (id: string) => setParams(id === eu ? {} : { p: id }, { replace: true });

  // Eu primeiro, depois os outros por nome.
  const lista = useMemo(() => {
    const todas = pessoas ?? [];
    return [...todas.filter((p) => p.id === eu), ...todas.filter((p) => p.id !== eu)];
  }, [pessoas, eu]);
  const pessoa = lista.find((p) => p.id === escolhida);

  if (isLoading || carregandoPessoas) return <EsqueletoPagina />;

  return (
    <div>
      <Cabecalho titulo="Tarefas" subtitulo="Cada pessoa tem a sua lista. Você pode passar uma tarefa para qualquer um." />
      {error && <div className="mb-3"><Aviso>{mensagemErro(error)}</Aviso></div>}
      <div className="mb-3 md:hidden">
        <Selecao value={escolhida} onChange={(e) => escolher(e.target.value)}>
          {lista.map((p) => <option key={p.id} value={p.id}>{p.id === eu ? `Minhas tarefas (${p.nome})` : p.nome}</option>)}
        </Selecao>
      </div>
      <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
        <Cartao className="hidden h-fit p-2 md:block">
          <ul className="space-y-0.5">
            {lista.map((p) => <ItemPessoa key={p.id} pessoa={p} eu={eu} ativa={p.id === escolhida} tarefas={tarefas} onClick={() => escolher(p.id)} />)}
          </ul>
        </Cartao>
        {pessoa ? <Lista key={pessoa.id} pessoa={pessoa} eu={eu} tarefas={tarefas.filter((t) => t.dono_id === pessoa.id)} />
          : <Cartao><Vazio>Escolha uma pessoa.</Vazio></Cartao>}
      </div>
    </div>
  );
}

function ItemPessoa({ pessoa, eu, ativa, tarefas, onClick }: { pessoa: PessoaTarefas; eu: string; ativa: boolean; tarefas: Tarefa[]; onClick: () => void }) {
  const abertas = tarefas.filter((t) => t.dono_id === pessoa.id && !t.feita_em);
  const altas = abertas.some((t) => t.urgencia === 'alta');
  return (
    <li>
      <button onClick={onClick} className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${ativa
        ? 'bg-roxo-50 font-medium text-roxo-700 dark:bg-roxo-500/20 dark:text-roxo-100' : 'hover:bg-pagina dark:hover:bg-marinho-700'}`}>
        <Avatar caminho={pessoa.foto_caminho} versao={pessoa.foto_atualizada_em} nome={pessoa.nome} tamanho={28} />
        <span className="min-w-0 flex-1">
          <span className="block truncate">{pessoa.id === eu ? 'Minhas tarefas' : pessoa.nome}</span>
          {pessoa.id === eu && <span className="block truncate text-xs font-normal text-suave">{pessoa.nome}</span>}
        </span>
        {altas && <span className="h-2 w-2 shrink-0 rounded-full bg-red-600" title="Tem tarefa de urgência alta" />}
        {abertas.length > 0 && <span className="shrink-0 text-xs tabular-nums text-suave">{abertas.length}</span>}
      </button>
    </li>
  );
}

function Lista({ pessoa, eu, tarefas }: { pessoa: PessoaTarefas; eu: string; tarefas: Tarefa[] }) {
  const qc = useQueryClient();
  const dono = pessoa.id === eu;
  const { abertas, feitas } = separar(tarefas);
  const [erro, setErro] = useState('');
  const [verFeitas, setVerFeitas] = useState(false);
  const [editando, setEditando] = useState<Tarefa | null>(null);
  // As que chegaram sem eu ter visto ficam com o selo "Nova" enquanto esta tela estiver aberta.
  const [novas] = useState(() => new Set(tarefas.filter((t) => dono && !t.vista_em && t.criado_por !== eu).map((t) => t.id)));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }));

  const recarregar = () => qc.invalidateQueries({ queryKey: ['tarefas', 'lista'] });
  const fazer = async (acao: () => Promise<unknown>) => {
    setErro('');
    try { await acao(); } catch (e) { setErro(mensagemErro(e)); }
    await recarregar();
  };

  const temNaoVista = dono && tarefas.some((t) => !t.vista_em);
  useEffect(() => {
    if (temNaoVista) marcarVistas().then(recarregar).catch(() => {});
  }, [temNaoVista]); // eslint-disable-line react-hooks/exhaustive-deps

  // Nova ordem: mostra na hora e grava (ordem = posição).
  async function reordenar(nova: Tarefa[]) {
    const posicao = new Map(nova.map((t, i) => [t.id, i + 1]));
    qc.setQueryData<Tarefa[]>(['tarefas', 'lista'], (old) => old?.map((t) => posicao.has(t.id) ? { ...t, ordem: posicao.get(t.id)! } : t));
    await fazer(() => ordenarTarefas(nova.map((t) => t.id)));
  }
  const aoSoltar = (e: DragEndEvent) => {
    if (e.over && e.active.id !== e.over.id) reordenar(mover(abertas, String(e.active.id), String(e.over.id)));
  };

  const primeiroNome = pessoa.nome.split(' ')[0];
  return (
    <Cartao className="p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Avatar caminho={pessoa.foto_caminho} versao={pessoa.foto_atualizada_em} nome={pessoa.nome} tamanho={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{dono ? 'Minhas tarefas' : `Tarefas de ${pessoa.nome}`}</div>
          <div className="text-xs text-suave">{abertas.length === 1 ? '1 aberta' : `${abertas.length} abertas`}
            {!dono && ' · só o dono pode marcar ou alterar'}</div>
        </div>
        {dono && abertas.length > 1 && (
          <Botao variante="secundario" tamanho="sm" onClick={() => reordenar(porUrgencia(abertas))} title="Coloca alta, média e baixa nessa ordem; depois você pode arrastar">
            <ArrowDownWideNarrow size={14} /> <span className="hidden sm:inline">Organizar por urgência</span><span className="sm:hidden">Urgência</span>
          </Botao>
        )}
      </div>

      <NovaTarefa dono={pessoa.id} placeholder={dono ? 'Nova tarefa…' : `Nova tarefa para ${primeiroNome}…`} onCriada={recarregar} />
      {erro && <div className="mt-3"><Aviso>{erro}</Aviso></div>}

      <div className="mt-4">
        {abertas.length === 0 ? <Vazio>{dono ? 'Nenhuma tarefa aberta.' : `${primeiroNome} não tem tarefas abertas.`}</Vazio> : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
            <SortableContext items={abertas.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <ul className="divide-y divide-borda">
                {abertas.map((t) => (
                  <LinhaTarefa key={t.id} tarefa={t} eu={eu} nova={novas.has(t.id)}
                    onMarcar={(v) => fazer(() => marcarTarefa(t.id, v))} onEditar={() => setEditando(t)}
                    onApagar={() => confirm('Apagar esta tarefa?') && fazer(() => apagarTarefa(t.id))} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {feitas.length > 0 && (
        <div className="mt-4 border-t border-borda pt-3">
          <button onClick={() => setVerFeitas(!verFeitas)} className="flex items-center gap-1 text-sm font-medium text-suave hover:text-texto">
            {verFeitas ? <ChevronDown size={16} /> : <ChevronRight size={16} />} Concluídas ({feitas.length})
          </button>
          {verFeitas && (
            <ul className="mt-2 divide-y divide-borda">
              {feitas.map((t) => (
                <LinhaTarefa key={t.id} tarefa={t} eu={eu} onMarcar={(v) => fazer(() => marcarTarefa(t.id, v))}
                  onApagar={() => confirm('Apagar esta tarefa?') && fazer(() => apagarTarefa(t.id))} />
              ))}
            </ul>
          )}
        </div>
      )}

      {editando && <EditarTarefa tarefa={editando} onFechar={() => setEditando(null)} onSalva={recarregar} />}
    </Cartao>
  );
}

function SeletorUrgencia({ valor, onChange }: { valor: Urgencia; onChange: (u: Urgencia) => void }) {
  const cores: Record<Urgencia, string> = {
    alta: 'bg-red-600 text-white', media: 'bg-amber-500 text-white', baixa: 'bg-slate-500 text-white',
  };
  return (
    <div className="inline-flex rounded-lg p-0.5 ring-1 ring-borda" role="radiogroup" aria-label="Urgência">
      {URGENCIAS.map((u) => (
        <button key={u.valor} type="button" role="radio" aria-checked={valor === u.valor} onClick={() => onChange(u.valor)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${valor === u.valor ? cores[u.valor] : 'text-suave hover:text-texto'}`}>
          {u.rotulo}
        </button>
      ))}
    </div>
  );
}

function NovaTarefa({ dono, placeholder, onCriada }: { dono: string; placeholder: string; onCriada: () => void }) {
  const [texto, setTexto] = useState('');
  const [urgencia, setUrgencia] = useState<Urgencia>('media');
  const [prazo, setPrazo] = useState('');
  const [comPrazo, setComPrazo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!texto.trim() || salvando) return;
    setSalvando(true); setErro('');
    try {
      await criarTarefa(dono, texto, urgencia, prazo || null);
      setTexto(''); setPrazo(''); setComPrazo(false); setUrgencia('media');
      onCriada();
    } catch (e) { setErro(mensagemErro(e)); }
    setSalvando(false);
  }

  return (
    <form onSubmit={salvar} className="rounded-xl bg-pagina p-3 ring-1 ring-borda dark:bg-marinho-800">
      <div className="flex gap-2">
        <Entrada value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={placeholder} maxLength={500} aria-label="Texto da tarefa" />
        <Botao type="submit" disabled={!texto.trim() || salvando} aria-label="Adicionar tarefa"><Plus size={16} /> <span className="hidden sm:inline">Adicionar</span></Botao>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <SeletorUrgencia valor={urgencia} onChange={setUrgencia} />
        {comPrazo ? (
          <div className="w-44"><CampoData value={prazo} onChange={setPrazo} /></div>
        ) : (
          <button type="button" onClick={() => setComPrazo(true)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-suave hover:bg-superficie hover:text-texto">
            <CalendarDays size={14} /> Prazo
          </button>
        )}
      </div>
      {erro && <div className="mt-2"><Aviso>{erro}</Aviso></div>}
    </form>
  );
}

function LinhaTarefa({ tarefa: t, eu, nova = false, onMarcar, onEditar, onApagar }: {
  tarefa: Tarefa; eu: string; nova?: boolean; onMarcar: (v: boolean) => void; onEditar?: () => void; onApagar: () => void;
}) {
  const dono = t.dono_id === eu;
  const feita = Boolean(t.feita_em);
  const podeApagar = dono || t.criado_por === eu;
  const arrastavel = dono && !feita;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: t.id, disabled: !arrastavel });
  const estilo = { transform: CSS.Transform.toString(transform), transition };
  const u = urgenciaInfo(t.urgencia);
  const prazo = situacaoPrazo(t.prazo, hojeISO());

  return (
    <li ref={setNodeRef} style={estilo} className={`group flex items-start gap-2 py-2.5 ${isDragging ? 'relative z-10 rounded-lg bg-superficie shadow-lg ring-1 ring-borda' : ''}`}>
      {arrastavel ? (
        <button ref={setActivatorNodeRef} {...attributes} {...listeners} className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-suave hover:text-texto active:cursor-grabbing" aria-label="Arrastar para mudar a ordem">
          <GripVertical size={16} />
        </button>
      ) : <span className="w-5 shrink-0" />}
      <div className="mt-0.5"><Caixa marcado={feita} onChange={onMarcar} disabled={!dono} /></div>
      <div className="min-w-0 flex-1">
        <div className={`whitespace-pre-wrap break-words text-sm ${feita ? 'text-suave line-through' : 'text-texto'}`}>{t.texto}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-suave">
          {!feita && <Selo cor={u.cor}>{u.rotulo}</Selo>}
          {nova && <Selo cor="roxo">Nova</Selo>}
          {t.prazo && !feita && (
            <span className={`inline-flex items-center gap-1 ${prazo === 'vencido' ? 'font-semibold text-red-600' : prazo === 'hoje' ? 'font-semibold text-amber-600' : ''}`}>
              <CalendarDays size={12} /> {prazo === 'vencido' ? 'Venceu ' : prazo === 'hoje' ? 'Hoje, ' : 'Até '}{dataBR(t.prazo)}
            </span>
          )}
          {t.criado_por !== t.dono_id && <span>Passada por <b className="font-medium text-texto">{t.criado_por === eu ? 'você' : t.criador?.nome ?? '—'}</b></span>}
          <span>{feita ? `Feita em ${dataHoraBR(t.feita_em)}` : `Criada em ${dataBR(t.criado_em)}`}</span>
        </div>
      </div>
      <div className="flex shrink-0 gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
        {dono && !feita && onEditar && (
          <button onClick={onEditar} className="rounded p-1.5 text-suave hover:bg-pagina hover:text-texto dark:hover:bg-marinho-700" aria-label="Editar tarefa"><Pencil size={15} /></button>
        )}
        {podeApagar && (
          <button onClick={onApagar} className="rounded p-1.5 text-suave hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/40" aria-label="Apagar tarefa"><Trash2 size={15} /></button>
        )}
      </div>
    </li>
  );
}

function EditarTarefa({ tarefa, onFechar, onSalva }: { tarefa: Tarefa; onFechar: () => void; onSalva: () => void }) {
  const [texto, setTexto] = useState(tarefa.texto);
  const [urgencia, setUrgencia] = useState<Urgencia>(tarefa.urgencia);
  const [prazo, setPrazo] = useState(tarefa.prazo ?? '');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true); setErro('');
    try { await editarTarefa(tarefa.id, texto, urgencia, prazo || null); onSalva(); onFechar(); }
    catch (e) { setErro(mensagemErro(e)); setSalvando(false); }
  }

  return (
    <Modal aberto titulo="Editar tarefa" onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <Campo rotulo="Tarefa"><Entrada value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={500} autoFocus /></Campo>
        <Campo rotulo="Urgência"><div><SeletorUrgencia valor={urgencia} onChange={setUrgencia} /></div></Campo>
        <Campo rotulo="Prazo (opcional)"><CampoData value={prazo} onChange={setPrazo} /></Campo>
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex justify-end gap-2">
          <Botao type="button" variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao type="submit" disabled={!texto.trim() || salvando}>Salvar</Botao>
        </div>
      </form>
    </Modal>
  );
}
