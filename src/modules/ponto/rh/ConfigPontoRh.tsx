import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, LocateFixed, Plus } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, mensagemErro } from '@/shared/lib/formato';
import { Aviso, Botao, Caixa, Campo, CampoData, CampoInteiro, Entrada, Modal, Selecao, Selo } from '@/shared/ui';
import { definirBatePonto, excluirLocal, lerLocalizacao, listarFeriados, listarLocais, salvarConfig, salvarFeriado, salvarLocal, useConfigPonto, type Feriado, type LocalPonto, type PessoaPonto } from '../api';
import { coordenadasDoTexto, hhmm, minutos, type ConfigPonto } from '../calculo';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function Bloco({ titulo, detalhe, children, acoes }: { titulo: string; detalhe?: string; children: ReactNode; acoes?: ReactNode }) {
  return (
    <section className="mb-6 rounded-xl bg-superficie p-5 shadow-sm ring-1 ring-borda">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div><h2 className="font-semibold">{titulo}</h2>{detalhe && <p className="text-xs text-suave">{detalhe}</p>}</div>
        {acoes}
      </div>
      {children}
    </section>
  );
}

// RH → Ponto → Configurações: horários e tolerâncias, locais (empresa e obras), quem bate ponto e feriados.
export function ConfigPontoRh({ pessoas }: { pessoas: PessoaPonto[] }) {
  const editavel = useAuth().pode('rh', 'editar');
  return (
    <>
      <Horarios editavel={editavel} />
      <Locais editavel={editavel} />
      <QuemBate pessoas={pessoas} editavel={editavel} />
      <Feriados editavel={editavel} />
    </>
  );
}

function Horarios({ editavel }: { editavel: boolean }) {
  const qc = useQueryClient();
  const { data } = useConfigPonto();
  const [c, setC] = useState<ConfigPonto | null>(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { if (data) setC(data); }, [data]);
  const salvar = useMutation({
    mutationFn: () => salvarConfig(c!),
    onSuccess: () => { setMsg('Salvo.'); void qc.invalidateQueries({ queryKey: ['ponto'] }); },
    onError: (e) => setMsg(mensagemErro(e)),
  });
  if (!c) return null;
  const hora = (k: 'manha_inicio' | 'manha_fim' | 'tarde_inicio' | 'tarde_fim') => (
    <Entrada type="time" value={c[k]} disabled={!editavel} onChange={(e) => setC({ ...c, [k]: e.target.value })} />
  );
  const dia = (minutos(c.manha_fim) - minutos(c.manha_inicio)) + (minutos(c.tarde_fim) - minutos(c.tarde_inicio));
  return (
    <Bloco titulo="Horário e tolerâncias" detalhe={`Jornada de ${hhmm(dia)} por dia, ${hhmm(dia * c.dias_semana.length)} por semana.`}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo rotulo="Entrada da manhã">{hora('manha_inicio')}</Campo>
        <Campo rotulo="Saída para almoço">{hora('manha_fim')}</Campo>
        <Campo rotulo="Volta do almoço">{hora('tarde_inicio')}</Campo>
        <Campo rotulo="Saída da tarde">{hora('tarde_fim')}</Campo>
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {DIAS.map((d, i) => (
          <Caixa key={d} marcado={c.dias_semana.includes(i)} disabled={!editavel}
            onChange={(v) => setC({ ...c, dias_semana: v ? [...c.dias_semana, i].sort() : c.dias_semana.filter((x) => x !== i) })}>{d}</Caixa>
        ))}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo rotulo="Ponto vale a partir de"><CampoData value={c.inicio ?? ''} disabled={!editavel} onChange={(inicio) => setC({ ...c, inicio: inicio || null })} /></Campo>
        <Campo rotulo="Tolerância por batida (min)"><CampoInteiro valor={c.tolerancia_batida_min} max={30} disabled={!editavel} onChange={(v) => setC({ ...c, tolerancia_batida_min: v ?? 0 })} /></Campo>
        <Campo rotulo="Atraso tolerado no dia (min)"><CampoInteiro valor={c.tolerancia_atraso_dia_min} max={60} disabled={!editavel} onChange={(v) => setC({ ...c, tolerancia_atraso_dia_min: v ?? 0 })} /></Campo>
        <Campo rotulo="Precisão mínima do GPS (m)"><CampoInteiro valor={c.precisao_max_m} max={2000} disabled={!editavel} onChange={(v) => setC({ ...c, precisao_max_m: v ?? 100 })} /></Campo>
      </div>
      <p className="mt-2 text-xs text-suave">Chegar até {c.tolerancia_batida_min} min antes ou sair até {c.tolerancia_batida_min} min depois não conta como extra. Atrasos e saídas antecipadas que somem até {c.tolerancia_atraso_dia_min} min no dia não contam. Fora disso, o dia vai para "Aguardando aprovação".</p>
      {editavel && <div className="mt-3 flex items-center gap-3"><Botao disabled={salvar.isPending} onClick={() => { setMsg(''); salvar.mutate(); }}>Salvar horário</Botao><span className="text-sm text-suave">{msg}</span></div>}
    </Bloco>
  );
}

const localVazio = { nome: '', latitude: 0, longitude: 0, raio_m: 150, inicio: null, fim: null, ativo: true, observacoes: '' };

function Locais({ editavel }: { editavel: boolean }) {
  const { data: locais = [] } = useQuery({ queryKey: ['ponto', 'locais'], queryFn: listarLocais });
  const [editando, setEditando] = useState<(Omit<LocalPonto, 'id'> & { id?: string }) | null>(null);
  const qc = useQueryClient();
  const [erro, setErro] = useState('');
  const excluir = useMutation({
    mutationFn: excluirLocal,
    onSuccess: () => { setErro(''); void qc.invalidateQueries({ queryKey: ['ponto', 'locais'] }); },
    onError: (e) => setErro(mensagemErro(e)),
  });
  return (
    <Bloco titulo="Locais de ponto" detalhe="A empresa e as obras onde a equipe pode bater o ponto direto (ex.: obra na Gelita). Obra provisória tem data de início e fim."
      acoes={editavel && <Botao variante="secundario" tamanho="sm" onClick={() => setEditando({ ...localVazio })}><Plus size={14} /> Novo local</Botao>}>
      <div className="space-y-2">
        {locais.map((l) => (
          <div key={l.id} className={`flex flex-wrap items-center gap-3 rounded-lg bg-pagina px-3 py-2 text-sm ${l.ativo ? '' : 'opacity-60'}`}>
            <span className="font-medium">{l.nome}</span>
            <span className="text-suave">raio {l.raio_m} m</span>
            {(l.inicio || l.fim) && <span className="text-suave">{l.inicio ? dataBR(l.inicio) : '…'} a {l.fim ? dataBR(l.fim) : '…'}</span>}
            {!l.ativo && <Selo>Inativo</Selo>}
            <a href={`https://www.google.com/maps?q=${l.latitude},${l.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-roxo-600 hover:underline">ver no mapa <ExternalLink size={12} /></a>
            <span className="flex-1" />
            {editavel && <Botao tamanho="sm" variante="fantasma" onClick={() => setEditando(l)}>Editar</Botao>}
            {editavel && (
              <Botao tamanho="sm" variante="fantasma" className="text-red-600 hover:text-red-700" disabled={excluir.isPending}
                onClick={() => window.confirm(`Excluir o local "${l.nome}"? Ninguém mais consegue bater ponto nele. As batidas já feitas lá continuam no histórico.`) && excluir.mutate(l.id)}>
                Excluir
              </Botao>
            )}
          </div>
        ))}
      </div>
      {erro && <div className="mt-3"><Aviso>{erro}</Aviso></div>}
      {editando && <LocalModal local={editando} onFechar={() => setEditando(null)} />}
    </Bloco>
  );
}

function LocalModal({ local, onFechar }: { local: Omit<LocalPonto, 'id'> & { id?: string }; onFechar: () => void }) {
  const qc = useQueryClient();
  const [l, setL] = useState(local);
  const [link, setLink] = useState(local.id ? `${local.latitude}, ${local.longitude}` : '');
  const [erro, setErro] = useState('');
  const coord = coordenadasDoTexto(link);
  const salvar = useMutation({
    mutationFn: () => salvarLocal({ ...l, nome: l.nome.trim(), latitude: coord!.latitude, longitude: coord!.longitude, inicio: l.inicio || null, fim: l.fim || null }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['ponto', 'locais'] }); onFechar(); },
    onError: (e) => setErro(mensagemErro(e)),
  });
  const aqui = async () => {
    try { const p = await lerLocalizacao(); setLink(`${p.coords.latitude.toFixed(7)}, ${p.coords.longitude.toFixed(7)}`); } catch (e) { setErro(mensagemErro(e)); }
  };
  return (
    <Modal aberto titulo={l.id ? 'Editar local' : 'Novo local de ponto'} onFechar={onFechar}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Nome *" className="sm:col-span-2"><Entrada value={l.nome} onChange={(e) => setL({ ...l, nome: e.target.value })} placeholder="Ex.: Obra Gelita" /></Campo>
        <Campo rotulo="Link do Google Maps ou latitude, longitude *" className="sm:col-span-2">
          <div className="flex gap-2">
            <Entrada value={link} onChange={(e) => setLink(e.target.value)} placeholder="Cole o link do lugar no Google Maps" />
            <Botao variante="secundario" type="button" onClick={aqui} title="Usar onde estou agora"><LocateFixed size={16} /></Botao>
          </div>
        </Campo>
        <div className="text-xs text-suave sm:col-span-2">{link && (coord ? `Ponto: ${coord.latitude.toFixed(6)}, ${coord.longitude.toFixed(6)}` : 'Não encontrei as coordenadas neste texto.')}</div>
        <Campo rotulo="Raio aceito (m)"><CampoInteiro valor={l.raio_m} min={20} max={3000} onChange={(v) => setL({ ...l, raio_m: v ?? 150 })} /></Campo>
        <Campo rotulo="Situação">
          <Selecao value={l.ativo ? '1' : ''} onChange={(e) => setL({ ...l, ativo: Boolean(e.target.value) })}><option value="1">Ativo</option><option value="">Inativo</option></Selecao>
        </Campo>
        <Campo rotulo="Vale a partir de"><CampoData value={l.inicio} onChange={(inicio) => setL({ ...l, inicio: inicio || null })} /></Campo>
        <Campo rotulo="Vale até"><CampoData value={l.fim} onChange={(fim) => setL({ ...l, fim: fim || null })} /></Campo>
      </div>
      <p className="mt-2 text-xs text-suave">Deixe as datas em branco para um local fixo (a empresa). O ponto só é aceito dentro do raio, com o GPS preciso.</p>
      {erro && <div className="mt-3"><Aviso>{erro}</Aviso></div>}
      <div className="mt-4 flex justify-end gap-2">
        <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
        <Botao disabled={l.nome.trim().length < 2 || !coord || salvar.isPending} onClick={() => { setErro(''); salvar.mutate(); }}>Salvar</Botao>
      </div>
    </Modal>
  );
}

function QuemBate({ pessoas, editavel }: { pessoas: PessoaPonto[]; editavel: boolean }) {
  const qc = useQueryClient();
  const [erro, setErro] = useState('');
  const mudar = useMutation({
    mutationFn: (p: { id: string; v: boolean }) => definirBatePonto(p.id, p.v),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ponto'] }),
    onError: (e) => setErro(mensagemErro(e)),
  });
  const ativos = pessoas.filter((p) => p.situacao !== 'desligado');
  return (
    <Bloco titulo="Quem bate ponto" detalhe="Os sócios ficam fora. Para bater ponto, a ficha precisa estar ligada a um login (RH → ficha → Acesso ao ERP).">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ativos.map((p) => (
          <div key={p.id} className="flex items-center gap-2 rounded-lg bg-pagina px-3 py-2 text-sm">
            <Caixa marcado={p.bate_ponto} disabled={!editavel || mudar.isPending} onChange={(v) => mudar.mutate({ id: p.id, v })}>{p.nome}</Caixa>
            {!p.usuario_id && p.bate_ponto && <Selo cor="amarelo">sem login</Selo>}
          </div>
        ))}
      </div>
      {erro && <div className="mt-3"><Aviso>{erro}</Aviso></div>}
    </Bloco>
  );
}

function Feriados({ editavel }: { editavel: boolean }) {
  const qc = useQueryClient();
  const { data: feriados = [] } = useQuery({ queryKey: ['ponto', 'feriados'], queryFn: listarFeriados });
  const [ano, setAno] = useState(() => new Date().getFullYear());
  const [novo, setNovo] = useState<Feriado | null>(null);
  const [erro, setErro] = useState('');
  const salvar = useMutation({
    mutationFn: (p: { f: Feriado; novo: boolean }) => salvarFeriado(p.f, p.novo),
    onSuccess: () => { setNovo(null); setErro(''); void qc.invalidateQueries({ queryKey: ['ponto', 'feriados'] }); },
    onError: (e) => setErro(mensagemErro(e)),
  });
  const doAno = feriados.filter((f) => f.data.startsWith(String(ano)));
  return (
    <Bloco titulo="Feriados" detalhe="Já vêm os nacionais e o 9 de julho (SP). Acrescente os municipais de Mococa e as pontes."
      acoes={<div className="flex gap-2">
        <Selecao value={String(ano)} onChange={(e) => setAno(Number(e.target.value))}>{[ano - 1, ano, ano + 1].map((a) => <option key={a}>{a}</option>)}</Selecao>
        {editavel && <Botao variante="secundario" tamanho="sm" onClick={() => setNovo({ data: `${ano}-01-01`, nome: '', abrangencia: 'municipal', ativo: true })}><Plus size={14} /> Feriado</Botao>}
      </div>}>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {doAno.map((f) => (
          <div key={f.data} className={`flex items-center gap-3 rounded-lg bg-pagina px-3 py-1.5 text-sm ${f.ativo ? '' : 'line-through opacity-60'}`}>
            <span className="w-20 tabular-nums">{dataBR(f.data)}</span>
            <span className="flex-1">{f.nome}</span>
            <span className="text-xs text-suave">{f.abrangencia}</span>
            {editavel && <Botao tamanho="sm" variante="fantasma" onClick={() => salvar.mutate({ f: { ...f, ativo: !f.ativo }, novo: false })}>{f.ativo ? 'Desligar' : 'Religar'}</Botao>}
          </div>
        ))}
        {!doAno.length && <p className="text-sm text-suave">Nenhum feriado em {ano}.</p>}
      </div>
      {erro && <div className="mt-3"><Aviso>{erro}</Aviso></div>}
      {novo && (
        <Modal aberto titulo="Novo feriado" onFechar={() => setNovo(null)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Data *"><CampoData value={novo.data} onChange={(data) => setNovo({ ...novo, data })} /></Campo>
            <Campo rotulo="Tipo">
              <Selecao value={novo.abrangencia} onChange={(e) => setNovo({ ...novo, abrangencia: e.target.value })}>
                <option value="municipal">Municipal</option><option value="estadual">Estadual</option><option value="nacional">Nacional</option><option value="empresa">Da empresa (ponte, recesso)</option>
              </Selecao>
            </Campo>
            <Campo rotulo="Nome *" className="sm:col-span-2"><Entrada value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} /></Campo>
          </div>
          {erro && <div className="mt-3"><Aviso>{erro}</Aviso></div>}
          <div className="mt-4 flex justify-end gap-2">
            <Botao variante="secundario" onClick={() => setNovo(null)}>Cancelar</Botao>
            <Botao disabled={!novo.data || novo.nome.trim().length < 2 || salvar.isPending} onClick={() => salvar.mutate({ f: { ...novo, nome: novo.nome.trim() }, novo: !feriados.some((f) => f.data === novo.data) })}>Salvar</Botao>
          </div>
        </Modal>
      )}
    </Bloco>
  );
}
