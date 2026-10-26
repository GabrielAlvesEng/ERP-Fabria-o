import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ClipboardList, History, Settings2, Table2, Trash2 } from 'lucide-react';
import { ExcluirProjetoModal } from './ExcluirProjetoModal';
import { KickoffAba } from '@/modules/vendas/kickoff/KickoffAba';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataHoraBR, mensagemErro } from '@/shared/lib/formato';
import { useIndicadorAbas } from '@/shared/ui/AbasModulo';
import { AreaTexto, Aviso, Botao, Campo, CampoData, EsqueletoDetalhe, Modal, Selecao, Selo, Vazio } from '@/shared/ui';
import { atualizarProjeto, listarEventos, listarImportacoesCad, listarUsuariosAtivos, obterProjeto, pausarProjeto } from './api';
import { ListaRevisoes } from './ListaRevisoes';
import { COR_STATUS_PROJETO, NOME_STATUS_PROJETO, type Projeto } from './regras';

// Dentro do projeto, por enquanto, só Kick-off e Lista de materiais (decisão 113: árvore pausada).
const abas = [
  { id: 'kickoff', rotulo: 'Kick-off', icone: ClipboardList },
  { id: 'bom', rotulo: 'Lista de materiais', icone: Table2 },
] as const;
type Aba = (typeof abas)[number]['id'];

export function ProjetoPage() {
  const { id = '' } = useParams();
  const [aba, setAba] = useState<Aba>('bom');
  const [excluindo, setExcluindo] = useState(false);
  const [dados, setDados] = useState(false);
  const navegar = useNavigate();
  const { pode } = useAuth();
  const { data: projeto, error } = useQuery({ queryKey: ['eng', id, 'projeto'], queryFn: () => obterProjeto(id) });
  const { data: usuarios = [] } = useQuery({ queryKey: ['usuarios_ativos'], queryFn: listarUsuariosAtivos, staleTime: 5 * 60_000 });
  const linhaAbas = useIndicadorAbas(`${aba}|${projeto ? 1 : 0}`);

  if (error) return <Aviso>{mensagemErro(error)}</Aviso>;
  if (!projeto) return <EsqueletoDetalhe />;
  const responsavel = usuarios.find((u) => u.id === projeto.responsavel_id)?.nome;

  return (
    <div className="space-y-4">
      <Link to="/engenharia/projetos" className="inline-flex items-center gap-1 text-sm text-suave hover:text-roxo-600"><ArrowLeft size={15} /> Projetos</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-2xl font-bold text-texto">{projeto.codigo}</h1>
            <Selo cor={COR_STATUS_PROJETO[projeto.status]}>{NOME_STATUS_PROJETO[projeto.status]}</Selo>
            {projeto.pausado && <Selo cor="amarelo">Pausado</Selo>}
            {projeto.exemplo && <Selo cor="amarelo">Exemplo</Selo>}
          </div>
          <div className="font-semibold">{projeto.titulo}</div>
          <div className="text-sm text-suave">{projeto.cliente_nome}{responsavel && ` · Resp.: ${responsavel}`}{projeto.prazo && ` · prazo ${projeto.prazo.split('-').reverse().join('/')}`}</div>
        </div>
        <div className="flex flex-wrap items-end gap-4 text-sm">
          <Botao variante="secundario" onClick={() => setDados(true)}><Settings2 size={15} /> Dados e histórico</Botao>
          {pode('engenharia', 'excluir') && (
            <Botao variante="secundario" onClick={() => setExcluindo(true)}><Trash2 size={15} /> Excluir</Botao>
          )}
        </div>
      </div>

      <div ref={linhaAbas} className="abas abas-indicador gap-x-1 border-b border-borda" role="tablist">
        {abas.map((a) => (
          <button key={a.id} role="tab" aria-selected={aba === a.id} onClick={() => setAba(a.id)} className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${aba === a.id ? 'border-roxo-500 font-semibold text-roxo-600 dark:border-roxo-300 dark:text-roxo-100' : 'border-transparent text-suave hover:text-texto'} transition-colors duration-150`}>
            <a.icone size={15} /> {a.rotulo}
          </button>
        ))}
        <span className="abas-linha" />
      </div>
      <div key={aba} className="entrar">
        {aba === 'kickoff' && (projeto.proposta_id
          ? <KickoffAba propostaId={projeto.proposta_id} statusProposta="Aprovado" somenteLeitura />
          : <Vazio>O Kick-off vem da proposta aprovada. Este projeto de exemplo não tem proposta, então não tem Kick-off.</Vazio>)}
        {aba === 'bom' && <ListaRevisoes projeto={projeto} />}
      </div>
      {excluindo && <ExcluirProjetoModal projeto={projeto} onFechar={() => setExcluindo(false)} onExcluido={() => navegar('/engenharia/projetos')} />}
      {dados && <DadosModal projeto={projeto} onFechar={() => setDados(false)} />}
    </div>
  );
}

function DadosModal({ projeto, onFechar }: { projeto: Projeto; onFechar: () => void }) {
  const { pode } = useAuth();
  const qc = useQueryClient();
  const editavel = pode('engenharia', 'editar');
  const chefe = pode('engenharia', 'aprovar');
  const { data: usuarios = [] } = useQuery({ queryKey: ['usuarios_ativos'], queryFn: listarUsuariosAtivos, staleTime: 5 * 60_000 });
  const { data: eventos = [] } = useQuery({ queryKey: ['eng', projeto.id, 'eventos'], queryFn: () => listarEventos(projeto.id) });
  const [erro, setErro] = useState('');
  const atualizar = () => { qc.invalidateQueries({ queryKey: ['eng', projeto.id] }); qc.invalidateQueries({ queryKey: ['projetos'] }); qc.invalidateQueries({ queryKey: ['painel_engenharia'] }); };
  const salvar = async (d: Parameters<typeof atualizarProjeto>[1]) => {
    setErro('');
    try { await atualizarProjeto(projeto.id, d); atualizar(); } catch (e) { setErro(mensagemErro(e)); }
  };
  const pausa = useMutation({ mutationFn: () => pausarProjeto(projeto.id, !projeto.pausado), onSuccess: atualizar, onError: (e) => setErro(mensagemErro(e)) });
  const nome = (s: string | null) => (s ? NOME_STATUS_PROJETO[s as Projeto['status']] ?? s : '');
  return (
    <Modal aberto titulo={`Dados do projeto ${projeto.codigo}`} onFechar={onFechar} largura="max-w-2xl">
      <div className="space-y-4 text-sm">
        {erro && <Aviso>{erro}</Aviso>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Responsável">
            <Selecao value={projeto.responsavel_id ?? ''} disabled={!editavel} onChange={(e) => salvar({ responsavel_id: e.target.value || null })}>
              <option value="">Sem responsável</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo="Prazo da Engenharia"><CampoData value={projeto.prazo} disabled={!editavel} onChange={(v) => salvar({ prazo: v || null })} /></Campo>
        </div>
        <Campo rotulo="Observações">
          <AreaTexto defaultValue={projeto.observacoes} disabled={!editavel} rows={3} onBlur={(e) => e.target.value !== projeto.observacoes && salvar({ observacoes: e.target.value })} />
        </Campo>
        {chefe && projeto.status !== 'finalizado' && (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-pagina p-3">
            <span>{projeto.pausado ? 'Projeto pausado.' : 'Pausar mantém o projeto na coluna, com o selo Pausado.'}</span>
            <Botao variante="secundario" tamanho="sm" onClick={() => pausa.mutate()} disabled={pausa.isPending}>{projeto.pausado ? 'Retomar' : 'Pausar'}</Botao>
          </div>
        )}
        {projeto.importado_cad_em && <DadosCad projeto={projeto} />}
        <div>
          <div className="mb-1 flex items-center gap-1.5 font-semibold"><History size={15} /> Histórico</div>
          {eventos.length === 0 ? <div className="text-suave">Sem registros.</div> : (
            <ul className="space-y-1">
              {eventos.map((ev) => (
                <li key={ev.id} className="flex flex-wrap gap-x-2">
                  <span className="tabular-nums text-suave">{dataHoraBR(ev.criado_em)}</span>
                  <span className="font-medium">
                    {ev.tipo === 'criado' ? 'Projeto aberto' : ev.tipo === 'compra' ? `Compra solicitada (${ev.para})` : ev.tipo === 'pausa' ? (ev.para === 'pausado' ? 'Pausado' : 'Retomado') : `${nome(ev.de)} → ${nome(ev.para)}`}
                  </span>
                  {ev.justificativa && <span>· {ev.justificativa}</span>}
                  <span className="text-suave">· {ev.usuarios?.nome ?? 'Sistema'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

// Dados que vieram do carimbo do SolidWorks na importação (só leitura).
function DadosCad({ projeto }: { projeto: Projeto }) {
  const d = (projeto.dados_cad ?? {}) as Record<string, string | number | null>;
  const linhas: [string, string | number | null | undefined][] = [
    ['Código CAD', d.codigo_cad], ['Título no CAD', d.titulo], ['Nº pedido no CAD', d.pedido],
    ['Peso total (kg)', d.peso == null ? null : Number(d.peso).toLocaleString('pt-BR')], ['Área de pintura (m²)', d.area_pintura == null ? null : Number(d.area_pintura).toLocaleString('pt-BR')],
    ['Projetado', [d.projetado, d.data_projetado].filter(Boolean).join(' · ')], ['Desenhado', [d.desenhado, d.data_desenhado].filter(Boolean).join(' · ')],
    ['Aprovado', [d.aprovado, d.data_aprovado].filter(Boolean).join(' · ')], ['Revisão do CAD', d.revisao],
  ];
  return (
    <div className="rounded-xl bg-pagina p-3 text-sm">
      <div className="mb-2 font-semibold">Importado do SolidWorks em {dataHoraBR(projeto.importado_cad_em)}{d.macro ? ` (macro ${d.macro})` : ''}</div>
      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {linhas.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => (
          <div key={k} className="flex gap-2"><dt className="text-suave">{k}:</dt><dd className="font-medium">{v}</dd></div>
        ))}
      </dl>
      <HistoricoCad projetoId={projeto.id} />
    </div>
  );
}

function HistoricoCad({ projetoId }: { projetoId: string }) {
  const { data: historico = [] } = useQuery({ queryKey: ['eng', projetoId, 'importacoes'], queryFn: () => listarImportacoesCad(projetoId) });
  if (!historico.length) return null;
  const texto = (r: Record<string, number>) =>
    [r.novos && `${r.novos} novo(s)`, r.alterados && `${r.alterados} alterado(s)`, r.removidos && `${r.removidos} removido(s)`, r.liberados_em_revisao && `${r.liberados_em_revisao} liberado(s) → em revisão`]
      .filter(Boolean).join(', ') || 'sem mudanças';
  return (
    <div className="mt-3 border-t border-borda pt-2">
      <div className="mb-1 font-semibold">Histórico de importações</div>
      <ul className="space-y-1">
        {historico.map((h) => (
          <li key={h.id} className="flex flex-wrap gap-x-2">
            <span className="tabular-nums text-suave">{dataHoraBR(h.criado_em)}</span>
            <span className="font-medium">{h.tipo === 'inicial' ? 'Importação inicial' : 'Nova revisão'}</span>
            <span>{texto(h.resumo)}</span>
            {h.arquivo && <span className="font-mono text-[11px] text-suave">{h.arquivo}</span>}
            <span className="text-suave">· {h.usuarios?.nome ?? '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
