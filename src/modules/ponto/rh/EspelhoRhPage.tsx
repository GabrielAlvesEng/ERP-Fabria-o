import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Cabecalho, Campo, CampoData, EsqueletoTabela, Modal, Selecao } from '@/shared/ui';
import { excluirJustificativa, listarJustificativas, listarPessoas, salvarJustificativa, TIPOS_JUSTIFICATIVA } from '../api';
import { CartoesResumo, SeletorMes, TabelaEspelho, BotaoPequeno } from '../Espelho';
import { diasDoMes } from '../calculo';
import { mesAtual, useMesPonto } from '../useMes';
import { DiaModal } from './DiaModal';

// RH → Ponto → espelho de um funcionário (decisão 115): batidas do mês, decisões e justificativas.
export function EspelhoRhPage() {
  const { id = '' } = useParams();
  const [busca, setBusca] = useSearchParams();
  const mes = busca.get('mes') ?? mesAtual();
  const { pode } = useAuth();
  const editavel = pode('rh', 'editar');
  const { data: pessoas = [] } = useQuery({ queryKey: ['ponto', 'pessoas'], queryFn: listarPessoas });
  const pessoa = useMemo(() => pessoas.filter((p) => p.id === id), [pessoas, id]);
  const { resultado, erro } = useMesPonto(mes, pessoa, id);
  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const [justificar, setJustificar] = useState(false);
  const m = resultado[0];

  return (
    <>
      <Link to={`/rh/ponto?aba=mes&mes=${mes}`} className="mb-3 inline-flex items-center gap-1 text-sm text-suave hover:text-texto"><ArrowLeft size={14} /> Ponto</Link>
      <Cabecalho titulo={pessoa[0]?.nome ?? 'Espelho de ponto'} subtitulo="Espelho do mês"
        acoes={<>
          <SeletorMes mes={mes} onChange={(x) => setBusca({ mes: x })} />
          {editavel && <Botao variante="secundario" onClick={() => setJustificar(true)}>Lançar justificativa</Botao>}
          <Link to={`/ponto/relatorio?mes=${mes}&f=${id}`} target="_blank"><Botao variante="secundario"><Printer size={16} /> Imprimir</Botao></Link>
        </>} />
      {erro ? <Aviso>{mensagemErro(erro)}</Aviso> : !m ? <EsqueletoTabela /> : (
        <>
          <CartoesResumo m={m} />
          <TabelaEspelho m={m} acoes={(d) => d.situacao === 'fora' ? null : (
            <BotaoPequeno variante={d.pendente ? 'primario' : 'secundario'} onClick={() => setDiaAberto(d.dia)}>{d.pendente ? 'Decidir' : 'Abrir'}</BotaoPequeno>
          )} />
          <Justificativas funcionarioId={id} mes={mes} editavel={editavel} />
          <DiaModal pessoa={m.pessoa} dia={m.dias.find((d) => d.dia === diaAberto) ?? null} onFechar={() => setDiaAberto(null)} editavel={editavel} />
        </>
      )}
      <NovaJustificativa funcionarioId={id} aberto={justificar} onFechar={() => setJustificar(false)} mes={mes} />
    </>
  );
}

function Justificativas({ funcionarioId, mes, editavel }: { funcionarioId: string; mes: string; editavel: boolean }) {
  const qc = useQueryClient();
  const { session } = useAuth();
  const dias = diasDoMes(mes);
  const { data: lista = [] } = useQuery({ queryKey: ['ponto', 'mes', mes, funcionarioId, 'justificativas'], queryFn: () => listarJustificativas(dias[0], dias[dias.length - 1], funcionarioId) });
  const excluir = useMutation({ mutationFn: (id: string) => excluirJustificativa(id, session!.user.id), onSuccess: () => void qc.invalidateQueries({ queryKey: ['ponto'] }) });
  if (!lista.length) return null;
  return (
    <div className="mt-6">
      <h2 className="mb-2 text-base font-semibold">Justificativas do mês</h2>
      <div className="space-y-1.5">
        {lista.map((j) => (
          <div key={j.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-superficie px-4 py-2.5 text-sm shadow-sm ring-1 ring-borda">
            <span className="font-medium">{j.tipo}</span>
            <span className="tabular-nums">{j.inicio === j.fim ? dataBR(j.inicio) : `${dataBR(j.inicio)} a ${dataBR(j.fim)}`}{j.periodo !== 'dia' && ` (${j.periodo === 'manha' ? 'manhã' : 'tarde'})`}</span>
            <span className="flex-1 text-suave">{j.observacao}</span>
            {editavel && <Botao tamanho="sm" variante="fantasma" onClick={() => window.confirm('Retirar esta justificativa?') && excluir.mutate(j.id)}>Retirar</Botao>}
          </div>
        ))}
      </div>
    </div>
  );
}

function NovaJustificativa({ funcionarioId, aberto, onFechar, mes }: { funcionarioId: string; aberto: boolean; onFechar: () => void; mes: string }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ inicio: `${mes}-01`, fim: `${mes}-01`, periodo: 'dia', tipo: 'Atestado médico', observacao: '' });
  const [erro, setErro] = useState('');
  const salvar = useMutation({
    mutationFn: () => salvarJustificativa({ funcionario_id: funcionarioId, ...f, fim: f.fim < f.inicio ? f.inicio : f.fim, observacao: f.observacao.trim() }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['ponto'] }); onFechar(); },
    onError: (e) => setErro(mensagemErro(e)),
  });
  return (
    <Modal aberto={aberto} titulo="Lançar justificativa" onFechar={onFechar}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Tipo *">
          <Selecao value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>{TIPOS_JUSTIFICATIVA.map((t) => <option key={t}>{t}</option>)}</Selecao>
        </Campo>
        <Campo rotulo="Período">
          <Selecao value={f.periodo} onChange={(e) => setF({ ...f, periodo: e.target.value })}>
            <option value="dia">Dia inteiro</option><option value="manha">Só a manhã</option><option value="tarde">Só a tarde</option>
          </Selecao>
        </Campo>
        <Campo rotulo="De *"><CampoData value={f.inicio} onChange={(inicio) => setF({ ...f, inicio, fim: f.fim < inicio ? inicio : f.fim })} /></Campo>
        <Campo rotulo="Até *"><CampoData value={f.fim} onChange={(fim) => setF({ ...f, fim })} /></Campo>
        <Campo rotulo="Observação" className="sm:col-span-2"><AreaTexto value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} /></Campo>
      </div>
      <p className="mt-2 text-xs text-suave">Os dias justificados não contam como previstos: não geram falta nem atraso.</p>
      {erro && <div className="mt-3"><Aviso>{erro}</Aviso></div>}
      <div className="mt-4 flex justify-end gap-2">
        <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
        <Botao disabled={!f.inicio || salvar.isPending} onClick={() => { setErro(''); salvar.mutate(); }}>Salvar</Botao>
      </div>
    </Modal>
  );
}
