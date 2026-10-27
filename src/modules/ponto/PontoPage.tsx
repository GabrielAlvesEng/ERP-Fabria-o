import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Fingerprint, LocateFixed, MapPin } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, dataHoraBR, hojeISO, mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Cabecalho, Campo, CampoData, Entrada, EsqueletoTabela, Modal, Selo, Vazio } from '@/shared/ui';
import { baterPonto, lerLocalizacao, listarAjustes, listarLocais, listarMarcacoes, obterMinhaPessoa, pedirAjuste, useConfigPonto, type ResultadoBatida } from './api';
import { distanciaM, distanciaTexto, horaDoMomento, ROTULO_BATIDA } from './calculo';
import { CartoesResumo, SeletorMes, TabelaEspelho } from './Espelho';
import { mesAtual, useMesPonto } from './useMes';

// Ponto (decisão 115): cada funcionário bate o próprio ponto, dentro do raio da empresa ou de uma obra ativa,
// e vê o próprio espelho do mês. Quem não bate ponto (sócios) vê só um aviso.
export function PontoPage() {
  const { session } = useAuth();
  const { data: eu, isLoading, error } = useQuery({ queryKey: ['ponto', 'eu', session?.user.id], queryFn: () => obterMinhaPessoa(session!.user.id), enabled: Boolean(session) });
  const [mes, setMes] = useState(mesAtual);
  const pessoas = useMemo(() => (eu?.bate_ponto ? [eu] : []), [eu]);
  const mesPonto = useMesPonto(mes, pessoas, eu?.id);
  const [ajuste, setAjuste] = useState(false);

  if (error) return <Aviso>{mensagemErro(error)}</Aviso>;
  if (isLoading) return <EsqueletoTabela />;
  if (!eu) return <><Cabecalho titulo="Ponto" /><Vazio>Seu login ainda não está ligado a uma ficha do RH. Fale com o RH para começar a bater o ponto.</Vazio></>;
  if (!eu.bate_ponto) return <><Cabecalho titulo="Ponto" /><Vazio>Você não precisa bater ponto.</Vazio></>;

  const meu = mesPonto.resultado[0];
  return (
    <>
      <Cabecalho titulo="Ponto" subtitulo={eu.nome} />
      <BaterPonto funcionarioId={eu.id} />
      <div className="mb-3 mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Meu espelho</h2>
        <div className="flex flex-wrap gap-2">
          <SeletorMes mes={mes} onChange={setMes} />
          <Botao variante="secundario" onClick={() => setAjuste(true)}>Pedir ajuste</Botao>
        </div>
      </div>
      {mesPonto.erro ? <Aviso>{mensagemErro(mesPonto.erro)}</Aviso> : !meu ? <EsqueletoTabela /> : (
        <>
          <CartoesResumo m={meu} />
          <TabelaEspelho m={meu} />
          <p className="mt-2 text-xs text-suave">Dias fora da tolerância (atraso acima de 10 minutos no dia, hora extra, falta, batida faltando) só entram no saldo oficial depois que o RH aprova.</p>
        </>
      )}
      <MeusAjustes funcionarioId={eu.id} />
      <PedirAjuste aberto={ajuste} onFechar={() => setAjuste(false)} />
    </>
  );
}

function BaterPonto({ funcionarioId }: { funcionarioId: string }) {
  const qc = useQueryClient();
  const { data: config } = useConfigPonto();
  const { data: locais = [] } = useQuery({ queryKey: ['ponto', 'locais'], queryFn: listarLocais });
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 1000); return () => clearInterval(t); }, []);
  const [posicao, setPosicao] = useState<GeolocationPosition | null>(null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState('');
  const [feito, setFeito] = useState<ResultadoBatida | null>(null);
  const hoje = hojeISO();
  const { data: marcacoes = [] } = useQuery({ queryKey: ['ponto', 'hoje', funcionarioId, hoje], queryFn: () => listarMarcacoes(hoje, hoje, funcionarioId), refetchInterval: 60_000 });
  const deHoje = marcacoes.filter((m) => m.dia === hoje && !m.desconsiderada_em);
  const proxima = deHoje.length < 4 ? ROTULO_BATIDA[deHoje.length] : null;

  const ativos = locais.filter((l) => l.ativo && (!l.inicio || l.inicio <= hoje) && (!l.fim || l.fim >= hoje));
  const perto = useMemo(() => {
    if (!posicao) return null;
    const { latitude, longitude } = posicao.coords;
    return ativos.map((l) => ({ l, d: distanciaM(l.latitude, l.longitude, latitude, longitude) })).sort((a, b) => a.d - b.d - (a.l.raio_m - b.l.raio_m))[0] ?? null;
  }, [posicao, ativos]);
  const dentro = perto ? perto.d <= perto.l.raio_m : false;
  const precisaoBoa = posicao ? posicao.coords.accuracy <= (config?.precisao_max_m ?? 100) : false;

  const localizar = async () => {
    setErro(''); setLendo(true);
    try { setPosicao(await lerLocalizacao()); } catch (e) { setErro(mensagemErro(e)); } finally { setLendo(false); }
  };
  useEffect(() => { void localizar(); }, []);

  const bater = useMutation({
    mutationFn: async () => {
      const p = await lerLocalizacao(); // posição nova na hora de bater
      setPosicao(p);
      return baterPonto({ latitude: p.coords.latitude, longitude: p.coords.longitude, precisao: p.coords.accuracy });
    },
    onSuccess: (r) => { setFeito(r); setErro(''); void qc.invalidateQueries({ queryKey: ['ponto', 'hoje'] }); void qc.invalidateQueries({ queryKey: ['ponto', 'mes'] }); },
    onError: (e) => setErro(mensagemErro(e)),
  });

  return (
    <div className="mx-auto max-w-md rounded-2xl bg-superficie p-6 text-center shadow-sm ring-1 ring-borda">
      <div className="text-sm capitalize text-suave">{agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'America/Sao_Paulo' })}</div>
      <div className="my-1 text-5xl font-semibold tabular-nums tracking-tight">{agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</div>
      <div className="mb-4 text-xs text-suave">Horário: {config ? `${config.manha_inicio}–${config.manha_fim} e ${config.tarde_inicio}–${config.tarde_fim}` : '…'}</div>

      <div className="mb-4 flex items-center justify-center gap-2 text-sm">
        <MapPin size={16} className={dentro && precisaoBoa ? 'text-petroleo-600' : 'text-suave'} />
        {lendo ? 'Lendo a sua localização…' : !posicao ? 'Localização não lida' : !perto ? 'Nenhum local de ponto ativo hoje' : dentro
          ? <span>Você está em <b>{perto.l.nome}</b> ({distanciaTexto(perto.d)})</span>
          : <span>Você está a <b>{distanciaTexto(perto.d)}</b> de {perto.l.nome}</span>}
        <button type="button" onClick={localizar} className="rounded p-1 text-suave hover:bg-pagina hover:text-texto" aria-label="Ler a localização de novo" title="Ler de novo"><LocateFixed size={15} /></button>
      </div>
      {posicao && !precisaoBoa && <div className="mb-3"><Aviso tipo="info">A localização está imprecisa ({Math.round(posicao.coords.accuracy)} m). Use o celular, com o GPS ligado, e tente de novo.</Aviso></div>}

      <Botao className="h-14 w-full text-base" disabled={bater.isPending || !proxima} onClick={() => bater.mutate()}>
        <Fingerprint size={22} /> {bater.isPending ? 'Batendo…' : proxima ? `Bater ponto · ${proxima}` : 'As 4 batidas de hoje já foram feitas'}
      </Botao>
      {erro && <div className="mt-3"><Aviso>{erro}</Aviso></div>}
      {feito && !erro && (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-petroleo-50 px-3 py-2 text-sm text-petroleo-600 dark:bg-petroleo-600/30 dark:text-teal-100">
          <CheckCircle2 size={16} /> {feito.repetida ? 'Esta batida já tinha sido registrada' : 'Ponto registrado'} às <b>{horaDoMomento(feito.momento)}</b> em {feito.local}
        </div>
      )}

      {deHoje.length > 0 && (
        <div className="mt-5 grid grid-cols-4 gap-2 text-xs">
          {ROTULO_BATIDA.map((r, i) => (
            <div key={r} className="rounded-lg bg-pagina p-2">
              <div className="text-suave">{r.replace(' da manhã', '').replace(' para almoço', ' almoço').replace(' do almoço', '').replace(' da tarde', '')}</div>
              <div className="mt-0.5 text-sm font-semibold tabular-nums">{deHoje[i] ? horaDoMomento(deHoje[i].momento) : '—'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MeusAjustes({ funcionarioId }: { funcionarioId: string }) {
  const { data: ajustes = [] } = useQuery({ queryKey: ['ponto', 'ajustes', funcionarioId], queryFn: () => listarAjustes({ funcionario: funcionarioId }) });
  if (!ajustes.length) return null;
  const cor = { pendente: 'amarelo', aprovado: 'verde', recusado: 'vermelho' } as const;
  return (
    <div className="mt-8">
      <h2 className="mb-3 text-lg font-semibold">Meus pedidos de ajuste</h2>
      <div className="space-y-2">
        {ajustes.slice(0, 20).map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-superficie px-4 py-3 text-sm shadow-sm ring-1 ring-borda">
            <span className="font-medium tabular-nums">{dataBR(a.dia)} às {a.hora.slice(0, 5)}</span>
            <span className="flex-1 text-suave">{a.motivo}{a.resposta && <> · RH: {a.resposta}</>}</span>
            <Selo cor={cor[a.situacao]}>{a.situacao === 'pendente' ? 'Aguardando o RH' : a.situacao === 'aprovado' ? 'Aprovado' : 'Recusado'}</Selo>
            <span className="text-xs text-suave">{dataHoraBR(a.criado_em)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PedirAjuste({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const qc = useQueryClient();
  const [dia, setDia] = useState(hojeISO());
  const [hora, setHora] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const enviar = useMutation({
    mutationFn: () => pedirAjuste(dia, hora, motivo.trim()),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['ponto', 'ajustes'] }); setHora(''); setMotivo(''); onFechar(); },
    onError: (e) => setErro(mensagemErro(e)),
  });
  return (
    <Modal aberto={aberto} titulo="Pedir ajuste de ponto" onFechar={onFechar}>
      <p className="mb-3 text-sm text-suave">Esqueceu de bater? Informe o dia e a hora certa. A batida só entra depois que o RH aprovar.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Dia *"><CampoData value={dia} onChange={setDia} /></Campo>
        <Campo rotulo="Hora *"><Entrada type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></Campo>
        <Campo rotulo="Motivo *" className="sm:col-span-2"><AreaTexto value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: esqueci de bater a saída, saí às 17:20" /></Campo>
      </div>
      {erro && <div className="mt-3"><Aviso>{erro}</Aviso></div>}
      <div className="mt-4 flex justify-end gap-2">
        <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
        <Botao disabled={!dia || !hora || motivo.trim().length < 3 || enviar.isPending} onClick={() => { setErro(''); enviar.mutate(); }}>Enviar pedido</Botao>
      </div>
    </Modal>
  );
}
