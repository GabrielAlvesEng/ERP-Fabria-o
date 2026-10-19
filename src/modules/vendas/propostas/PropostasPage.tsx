import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { AlarmClock, Plus, Search } from 'lucide-react';
import { useAno } from '@/app/AnoContext';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, hojeISO, mensagemErro, moeda } from '@/shared/lib/formato';
import { Aviso, Botao, Cabecalho, Caixa, Entrada, Selecao, Selo } from '@/shared/ui';
import { listarPropostas, moverProposta } from '../api';
import { STATUS, type Proposta, type StatusProposta } from '../types';
import { followupVencido, rotuloRevisao, tipoTransicao } from './regras';
import { NovaPropostaModal } from './NovaPropostaModal';
import { PropostaDetalhe } from './PropostaDetalhe';
import { AprovarModal, EnviarModal, ReabrirModal, ReprovarModal, VoltarAdminModal } from './TransicaoModais';

const corColuna: Record<StatusProposta, string> = {
  'À enviar': 'border-t-slate-400',
  Enviados: 'border-t-marinho-500',
  'Follow-up': 'border-t-amber-500',
  Aprovado: 'border-t-petroleo-500',
  Reprovado: 'border-t-red-500',
  Finalizado: 'border-t-roxo-500',
  'Emitido NF': 'border-t-roxo-600',
  Pago: 'border-t-petroleo-600',
};

export type Pendente = { proposta: Proposta; para: StatusProposta; tipo: ReturnType<typeof tipoTransicao> };

export function PropostasPage() {
  const { ano } = useAno();
  const { pode } = useAuth();
  const qc = useQueryClient();
  const [busca, setBusca] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [soVencidos, setSoVencidos] = useState(false);
  const [nova, setNova] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [erro, setErro] = useState('');
  const hoje = hojeISO();

  const { data: propostas = [], isLoading } = useQuery({ queryKey: ['propostas', ano], queryFn: () => listarPropostas(ano) });

  const filtradas = useMemo(() => {
    const t = busca.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    return propostas.filter((p) => {
      const txt = `${p.codigo} ${p.titulo} ${p.empresas?.nome_fantasia ?? ''} ${p.contatos?.nome ?? ''}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      return (!t || txt.includes(t)) && (!empresa || p.empresa_id === empresa) && (!soVencidos || (['Enviados', 'Follow-up'].includes(p.status) && followupVencido(p.proximo_followup, hoje)));
    });
  }, [propostas, busca, empresa, soVencidos, hoje]);

  const empresasDoAno = useMemo(() => {
    const m = new Map<string, string>();
    propostas.forEach((p) => m.set(p.empresa_id, p.empresas?.nome_fantasia ?? ''));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [propostas]);

  const mover = useMutation({
    mutationFn: ({ id, para }: { id: string; para: StatusProposta }) => moverProposta(id, para),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['propostas'] }),
    onError: (e) => setErro(mensagemErro(e)),
  });

  // Arrastar só começa depois de 6px: cliques em botões e links do card continuam funcionando.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function aoSoltar(ev: DragEndEvent) {
    setErro('');
    const proposta = propostas.find((p) => p.id === ev.active.id);
    const para = ev.over?.id as StatusProposta | undefined;
    if (!proposta || !para || proposta.status === para) return;
    const tipo = tipoTransicao(proposta.status, para);
    if (tipo === 'proibida') return setErro(`Não é permitido mover de "${proposta.status}" para "${para}".`);
    if (tipo === 'financeiro' && !pode('financeiro', 'editar')) return setErro(`Somente o Financeiro move para ${para}.`);
    if (tipo === 'simples' || tipo === 'financeiro') return mover.mutate({ id: proposta.id, para });
    setPendente({ proposta, para, tipo });
  }

  const fecharPendente = () => setPendente(null);

  return (
    <>
      <Cabecalho
        titulo="Propostas"
        subtitulo={`${propostas.length} propostas em ${ano} · arraste os cards entre as colunas`}
        acoes={pode('vendas', 'criar') && <Botao onClick={() => setNova(true)}><Plus size={16} /> Nova proposta</Botao>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <Entrada placeholder="Código, título, empresa, contato" className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Selecao className="max-w-xs" value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
          <option value="">Todas as empresas</option>
          {empresasDoAno.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
        </Selecao>
        <Caixa marcado={soVencidos} onChange={setSoVencidos}>Só follow-up vencido</Caixa>
      </div>
      {erro && <div className="mb-3"><Aviso>{erro}</Aviso></div>}
      {isLoading ? <div className="text-sm text-slate-500">Carregando…</div> : (
        <DndContext sensors={sensors} onDragEnd={aoSoltar}>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {STATUS.map((s) => (
              <Coluna key={s} status={s} propostas={filtradas.filter((p) => p.status === s)} hoje={hoje} onAbrir={setAberta} />
            ))}
          </div>
        </DndContext>
      )}

      {nova && <NovaPropostaModal ano={ano} onFechar={() => setNova(false)} onCriada={(id) => { setNova(false); setAberta(id); }} />}
      {aberta && <PropostaDetalhe id={aberta} onFechar={() => setAberta(null)} onTransicao={setPendente} />}
      {pendente?.tipo === 'enviar' && <EnviarModal proposta={pendente.proposta} onFechar={fecharPendente} />}
      {pendente?.tipo === 'aprovar' && <AprovarModal proposta={pendente.proposta} onFechar={fecharPendente} />}
      {pendente?.tipo === 'reprovar' && <ReprovarModal proposta={pendente.proposta} onFechar={fecharPendente} />}
      {pendente?.tipo === 'reabrir' && <ReabrirModal proposta={pendente.proposta} onFechar={fecharPendente} />}
      {pendente?.tipo === 'voltar_admin' && <VoltarAdminModal proposta={pendente.proposta} para={pendente.para} onFechar={fecharPendente} />}
    </>
  );
}

function Coluna({ status, propostas, hoje, onAbrir }: { status: StatusProposta; propostas: Proposta[]; hoje: string; onAbrir: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const total = propostas.reduce((s, p) => s + Number(p.valor), 0);
  return (
    <div ref={setNodeRef} className={`flex w-72 shrink-0 flex-col rounded-2xl border-t-4 bg-slate-200/60 p-2 dark:bg-marinho-800/60 ${corColuna[status]} ${isOver ? 'ring-2 ring-roxo-500' : ''}`}>
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="text-sm font-semibold">{status}</span>
        <Selo>{propostas.length}</Selo>
      </div>
      <div className="px-2 pb-2 text-xs text-slate-500">{moeda(total)}</div>
      <div className="flex min-h-24 flex-col gap-2">
        {propostas.map((p) => <Card key={p.id} p={p} hoje={hoje} onAbrir={onAbrir} />)}
      </div>
    </div>
  );
}

function Card({ p, hoje, onAbrir }: { p: Proposta; hoje: string; onAbrir: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: p.id });
  const vencido = ['Enviados', 'Follow-up'].includes(p.status) && followupVencido(p.proximo_followup, hoje);
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onAbrir(p.id)}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={`cursor-grab rounded-xl bg-white p-3 text-sm shadow-sm ring-1 ring-slate-200 hover:ring-roxo-500 active:cursor-grabbing dark:bg-marinho-700 dark:ring-marinho-500 ${isDragging ? 'z-50 opacity-80 shadow-lg' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-roxo-600 dark:text-roxo-100">{p.codigo}</span>
        <Selo cor="azul">{rotuloRevisao(p.revisao_atual)}</Selo>
      </div>
      <div className="mt-1 line-clamp-2 font-medium">{p.titulo}</div>
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-300">{p.empresas?.nome_fantasia} · {p.contatos?.nome}</div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="font-semibold">{moeda(p.valor)}</span>
        {vencido ? (
          <span className="inline-flex items-center gap-1 font-semibold text-amber-600"><AlarmClock size={13} /> {dataBR(p.proximo_followup)}</span>
        ) : p.proximo_followup && ['Enviados', 'Follow-up'].includes(p.status) ? (
          <span className="text-slate-500">Retorno {dataBR(p.proximo_followup)}</span>
        ) : null}
      </div>
    </div>
  );
}
