import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { AlertTriangle, FlaskConical, FolderOpen, FolderPlus, PauseCircle, Search } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, hojeISO, mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Cabecalho, Campo, CampoData, Cartao, Entrada, EsqueletoKanban, Modal, Selecao, Selo } from '@/shared/ui';
import { criarProjeto, criarProjetoExemplo, listarProjetos, listarUsuariosAtivos, moverProjeto, propostasSemProjeto } from './api';
import { COLUNAS_PROJETO, NOME_STATUS_PROJETO, atrasado, tipoMovimento, type ColunaProjeto, type Projeto } from './regras';

const corColuna: Record<ColunaProjeto, string> = {
  nao_iniciado: 'border-t-slate-400',
  em_andamento: 'border-t-roxo-500',
  liberado: 'border-t-marinho-500',
  finalizado: 'border-t-petroleo-500',
};

type Pendente = { projeto: Projeto; para: ColunaProjeto; tipo: 'liberar' | 'finalizar' | 'voltar' };

// Aba Projetos: Kanban da Engenharia (decisão 96).
export function ProjetosPage() {
  const { pode } = useAuth();
  const chefe = pode('engenharia', 'aprovar');
  const qc = useQueryClient();
  const navegar = useNavigate();
  const [busca, setBusca] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [erro, setErro] = useState('');
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [exemplo, setExemplo] = useState(false);
  const hoje = hojeISO();
  const { data: projetos = [], isLoading, error: erroLista } = useQuery({ queryKey: ['projetos'], queryFn: listarProjetos });
  const { data: aguardando = [] } = useQuery({ queryKey: ['propostas_sem_projeto'], queryFn: propostasSemProjeto });
  const { data: usuarios = [] } = useQuery({ queryKey: ['usuarios_ativos'], queryFn: listarUsuariosAtivos, staleTime: 5 * 60_000 });
  const nomeUsuario = (id: string | null) => usuarios.find((u) => u.id === id)?.nome ?? '';

  const atualizar = () => { qc.invalidateQueries({ queryKey: ['projetos'] }); qc.invalidateQueries({ queryKey: ['eng'] }); qc.invalidateQueries({ queryKey: ['painel_engenharia'] }); };
  const abrir = useMutation({
    mutationFn: criarProjeto,
    onSuccess: (p) => { atualizar(); qc.invalidateQueries({ queryKey: ['propostas_sem_projeto'] }); navegar(`/engenharia/projetos/${p.id}`); },
    onError: (e) => setErro(mensagemErro(e)),
  });
  const mover = useMutation({
    mutationFn: ({ id, para }: { id: string; para: ColunaProjeto }) => moverProjeto(id, para),
    onSuccess: atualizar,
    onError: (e) => setErro(mensagemErro(e)),
  });

  const t = busca.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const filtrados = useMemo(() => projetos.filter((p) => {
    const txt = `${p.codigo} ${p.titulo} ${p.cliente_nome ?? ''}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    return p.status !== 'cancelado' && (!t || txt.includes(t)) && (!responsavel || (responsavel === 'sem' ? !p.responsavel_id : p.responsavel_id === responsavel));
  }), [projetos, t, responsavel]);
  const responsaveis = useMemo(() => [...new Set(projetos.map((p) => p.responsavel_id).filter(Boolean) as string[])]
    .map((id) => [id, nomeUsuario(id)] as const).sort((a, b) => a[1].localeCompare(b[1])), [projetos, usuarios]); // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  function aoSoltar(ev: DragEndEvent) {
    setErro('');
    const projeto = projetos.find((p) => p.id === ev.active.id);
    const para = ev.over?.id as ColunaProjeto | undefined;
    if (!projeto || !para || projeto.status === para) return;
    if (!pode('engenharia', 'editar')) return setErro('Sem permissão para mover projetos.');
    const tipo = tipoMovimento(projeto.status, para, chefe);
    if (tipo === 'proibido') {
      return setErro(para === 'liberado' ? 'Só o Engenheiro Mecânico Chefe libera para fabricação.'
        : para === 'finalizado' ? 'Só o Engenheiro Mecânico Chefe finaliza o projeto.'
          : 'Só o Engenheiro Mecânico Chefe volta um projeto de coluna.');
    }
    if (tipo === 'simples') return mover.mutate({ id: projeto.id, para });
    setPendente({ projeto, para, tipo });
  }

  return (
    <>
      <Cabecalho
        titulo="Projetos"
        subtitulo={isLoading ? 'Carregando os projetos…' : `${filtrados.length} projetos · arraste os cards entre as colunas`}
        acoes={chefe && <Botao variante="secundario" onClick={() => setExemplo(true)}><FlaskConical size={16} /> Projeto de exemplo</Botao>}
      />
      {erro && <div className="mb-3"><Aviso>{erro}</Aviso></div>}
      {erroLista && <div className="mb-3"><Aviso>Não foi possível carregar os projetos: {mensagemErro(erroLista)}</Aviso></div>}

      {aguardando.length > 0 && (
        <Cartao className="mb-4 border-l-4 border-l-roxo-500">
          <div className="mb-2 flex items-center gap-2 font-semibold"><FolderPlus size={17} className="text-roxo-500" /> Propostas aprovadas aguardando projeto <Selo cor="roxo">{aguardando.length}</Selo></div>
          <div className="divide-y divide-borda">
            {aguardando.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div><span className="font-mono font-semibold text-roxo-600 dark:text-roxo-100">{p.codigo}</span> · {p.titulo} <span className="text-suave">· {p.cliente}</span></div>
                {pode('engenharia', 'criar') && <Botao onClick={() => abrir.mutate(p.id)} disabled={abrir.isPending}><FolderOpen size={15} /> Abrir projeto</Botao>}
              </div>
            ))}
          </div>
        </Cartao>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <Entrada placeholder="Código, projeto ou cliente" className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Selecao className="max-w-xs" value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
          <option value="">Todos os responsáveis</option>
          {responsaveis.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          {projetos.some((p) => !p.responsavel_id) && <option value="sem">Sem responsável</option>}
        </Selecao>
      </div>

      {isLoading ? <EsqueletoKanban /> : (
        <DndContext sensors={sensors} onDragEnd={aoSoltar}>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {COLUNAS_PROJETO.map((s) => (
              <Coluna key={s} status={s} projetos={filtrados.filter((p) => p.status === s)} hoje={hoje} nomeUsuario={nomeUsuario}
                onAbrir={(id) => navegar(`/engenharia/projetos/${id}`)} />
            ))}
          </div>
        </DndContext>
      )}

      {pendente && <MovimentoModal pendente={pendente} onFechar={() => setPendente(null)} onFeito={() => { setPendente(null); atualizar(); }} />}
      {exemplo && <ExemploModal onFechar={() => setExemplo(false)} onCriado={(id) => { setExemplo(false); atualizar(); navegar(`/engenharia/projetos/${id}`); }} />}
    </>
  );
}

function Coluna({ status, projetos, hoje, nomeUsuario, onAbrir }: { status: ColunaProjeto; projetos: Projeto[]; hoje: string; nomeUsuario: (id: string | null) => string; onAbrir: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const atrasados = projetos.filter((p) => atrasado(p, hoje)).length;
  return (
    <div ref={setNodeRef} className={`flex min-w-[17rem] flex-1 basis-0 flex-col rounded-xl border-t-[3px] bg-pagina p-2 ring-1 ring-borda transition-shadow duration-150 ${corColuna[status]} ${isOver ? 'ring-2 ring-roxo-400' : ''}`}>
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="text-sm font-semibold">{NOME_STATUS_PROJETO[status]}</span>
        <Selo>{projetos.length}</Selo>
      </div>
      <div className="px-2 pb-2 text-xs text-suave">{atrasados ? <span className="text-red-600 dark:text-red-400">{atrasados} atrasado(s)</span> : ' '}</div>
      <div className="flex min-h-24 flex-col gap-2">
        {projetos.map((p) => <Card key={p.id} p={p} hoje={hoje} responsavel={nomeUsuario(p.responsavel_id)} onAbrir={onAbrir} />)}
      </div>
    </div>
  );
}

function Card({ p, hoje, responsavel, onAbrir }: { p: Projeto; hoje: string; responsavel: string; onAbrir: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: p.id });
  const vencido = atrasado(p, hoje);
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onAbrir(p.id)}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={`cursor-grab rounded-lg bg-superficie p-3 text-sm shadow-sm ring-1 ring-borda transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-md hover:ring-roxo-300 active:cursor-grabbing dark:hover:ring-roxo-400 ${vencido ? 'ring-2 ring-red-400 dark:ring-red-500' : ''} ${isDragging ? 'z-50 opacity-80 shadow-lg' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-roxo-600 dark:text-roxo-100">{p.codigo}</span>
        <span className="flex items-center gap-1">
          {p.exemplo && <Selo cor="amarelo">Exemplo</Selo>}
          {p.pausado && <span title="Projeto pausado"><PauseCircle size={16} className="text-amber-500" /></span>}
          {vencido && <span title={`Prazo vencido em ${dataBR(p.prazo)}`}><AlertTriangle size={16} className="text-red-500" /></span>}
        </span>
      </div>
      <div className="mt-1 line-clamp-2 font-medium">{p.titulo}</div>
      <div className="mt-1 text-xs text-suave">{p.cliente_nome}</div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="truncate">{responsavel ? <>Resp.: <span className="font-medium">{responsavel}</span></> : <span className="text-suave">Sem responsável</span>}</span>
        {p.prazo ? (
          <span className={`shrink-0 rounded px-1.5 py-0.5 ${vencido ? 'bg-red-100 font-semibold text-red-700 dark:bg-red-900/50 dark:text-red-200' : 'bg-slate-100 text-suave dark:bg-marinho-600'}`}>Prazo {dataBR(p.prazo)}</span>
        ) : <span className="shrink-0 text-suave">Sem prazo</span>}
      </div>
      {p.status === 'finalizado' && p.fabricacao_concluida_em && <div className="mt-1 text-[11px] text-suave">Fabricação concluída em {dataBR(p.fabricacao_concluida_em)}</div>}
    </div>
  );
}

function MovimentoModal({ pendente, onFechar, onFeito }: { pendente: Pendente; onFechar: () => void; onFeito: () => void }) {
  const { projeto, para, tipo } = pendente;
  const [justificativa, setJustificativa] = useState('');
  const [data, setData] = useState(hojeISO());
  const [erro, setErro] = useState('');
  const enviar = useMutation({
    mutationFn: () => moverProjeto(projeto.id, para, justificativa, tipo === 'finalizar' ? data : null),
    onSuccess: onFeito,
    onError: (e) => setErro(mensagemErro(e)),
  });
  const titulo = tipo === 'liberar' ? 'Liberar para fabricação' : tipo === 'finalizar' ? 'Finalizar projeto' : `Voltar para ${NOME_STATUS_PROJETO[para]}`;
  const pronto = tipo === 'voltar' ? justificativa.trim().length >= 3 : tipo === 'finalizar' ? !!data : true;
  return (
    <Modal aberto titulo={titulo} onFechar={onFechar}>
      <div className="space-y-3 text-sm">
        <div><span className="font-mono font-semibold">{projeto.codigo}</span> · {projeto.titulo}</div>
        {tipo === 'liberar' && <p className="text-suave">Todos os conjuntos precisam estar Liberados na árvore. Se faltar algum, o ERP mostra quais.</p>}
        {tipo === 'finalizar' && (
          <>
            {projeto.status !== 'liberado' && <p className="text-suave">O projeto também passa pela liberação: todos os conjuntos precisam estar Liberados.</p>}
            <p className="text-suave">Enquanto o módulo de Fabricação não existe, o Chefe informa quando a fabricação terminou.</p>
            <Campo rotulo="Término da fabricação"><CampoData value={data} onChange={setData} required /></Campo>
          </>
        )}
        {(tipo === 'voltar' || tipo === 'liberar') && (
          <Campo rotulo={tipo === 'voltar' ? 'Justificativa (obrigatória)' : 'Observação (opcional)'}>
            <AreaTexto value={justificativa} onChange={(e) => setJustificativa(e.target.value)} rows={3} />
          </Campo>
        )}
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao onClick={() => enviar.mutate()} disabled={!pronto || enviar.isPending}>Confirmar</Botao>
        </div>
      </div>
    </Modal>
  );
}

function ExemploModal({ onFechar, onCriado }: { onFechar: () => void; onCriado: (id: string) => void }) {
  const [titulo, setTitulo] = useState('Projeto de exemplo');
  const [erro, setErro] = useState('');
  const criar = useMutation({ mutationFn: () => criarProjetoExemplo(titulo), onSuccess: (p) => onCriado(p.id), onError: (e) => setErro(mensagemErro(e)) });
  return (
    <Modal aberto titulo="Novo projeto de exemplo" onFechar={onFechar}>
      <div className="space-y-3 text-sm">
        <p className="text-suave">Projeto para testes, sem proposta nem cliente, com código EX-001, EX-002… Pode ser excluído depois pelo botão Excluir.</p>
        <Campo rotulo="Nome do projeto"><Entrada value={titulo} onChange={(e) => setTitulo(e.target.value)} /></Campo>
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao onClick={() => criar.mutate()} disabled={criar.isPending}>Criar</Botao>
        </div>
      </div>
    </Modal>
  );
}
