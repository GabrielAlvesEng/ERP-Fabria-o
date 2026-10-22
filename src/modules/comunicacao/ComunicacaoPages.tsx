import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, BellRing, CheckCheck, Inbox, Mail, Paperclip, Pin, Send, Smartphone, X } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, dataHoraBR, hojeISO, mensagemErro } from '@/shared/lib/formato';
import { AbasModulo } from '@/shared/ui/AbasModulo';
import { Aviso, Botao, Cabecalho, EsqueletoTabela, Modal, Selo, Vazio } from '@/shared/ui';
import { Avatar } from '@/modules/perfil/Avatar';
import {
  avisarCelulares, cancelarComunicado, darCiente, linkAnexo, listarDestinatarios, listarEnviados, listarLeituras, marcarLido,
  usePapel, useRecebidos, type Comunicado, type Recebido,
} from './api';
import { CelularAviso } from './CelularAviso';
import { NovoComunicadoModal } from './NovoComunicadoModal';
import { fixado, ordenarCaixa, pendente, resumoLeitura, rotuloAlcance } from './regras';

// Comunicação (docs/PLANEJAMENTO_COMUNICACAO.md): todos têm a Caixa de entrada; líderes e chefes também enviam.
export function ComunicacaoLayout() {
  const { data: papel } = usePapel();
  const envia = Boolean(papel && (papel.geral || papel.setores.length));
  return <AbasModulo abas={[
    { to: '/comunicacao', rotulo: 'Caixa de entrada', icone: Inbox, end: true },
    ...(envia ? [{ to: '/comunicacao/enviados', rotulo: 'Enviados', icone: Send }] : []),
  ]} />;
}

function BotaoNovo() {
  const { data: papel } = usePapel();
  const [aberto, setAberto] = useState(false);
  if (!papel || (!papel.geral && !papel.setores.length)) return null;
  return (
    <>
      <Botao onClick={() => setAberto(true)}><Send size={15} /> Novo comunicado</Botao>
      {aberto && <NovoComunicadoModal papel={papel} onFechar={() => setAberto(false)} />}
    </>
  );
}

const paraQuem = (c: Comunicado, pessoas = 0) => rotuloAlcance(c.alcance, c.comunicado_setores.map((s) => s.setores?.nome ?? '').filter(Boolean), pessoas);

export function CaixaEntradaPage() {
  const { data = [], isLoading } = useRecebidos();
  const [busca, setBusca] = useSearchParams();
  const hoje = hojeISO();
  const lista = useMemo(() => ordenarCaixa(data, hoje), [data, hoje]);
  const abertoId = busca.get('c');
  const aberto = data.find((c) => c.id === abertoId);
  const abrir = (id: string | null) => setBusca(id ? { c: id } : {}, { replace: true });
  const pendentes = data.filter(pendente).length;

  return (
    <>
      <Cabecalho titulo="Caixa de entrada" subtitulo={pendentes ? `${pendentes} comunicado${pendentes > 1 ? 's' : ''} para ler.` : 'Os comunicados enviados para você.'} acoes={<BotaoNovo />} />
      <div className="mb-4"><CelularAviso compacto /></div>
      {isLoading ? <EsqueletoTabela /> : lista.length === 0 ? <Vazio>Nenhum comunicado por enquanto.</Vazio> : (
        <ul className="divide-y divide-borda overflow-hidden rounded-xl ring-1 ring-borda">
          {lista.map((c) => {
            const novo = pendente(c);
            return (
              <li key={c.id}>
                <button onClick={() => abrir(c.id)} className={`flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-pagina sm:px-4 ${novo ? 'bg-roxo-50/50 dark:bg-roxo-700/10' : ''}`}>
                  <Avatar caminho={c.autor?.foto_caminho} versao={c.autor?.foto_atualizada_em} nome={c.autor?.nome} tamanho={36} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {novo && <span className="h-2 w-2 shrink-0 rounded-full bg-roxo-500" aria-label="Não lido" />}
                      <span className={`truncate ${novo ? 'font-semibold' : ''}`}>{c.titulo}</span>
                      {c.urgente && <Selo cor="vermelho">Urgente</Selo>}
                      {fixado(c, hoje) && <Selo cor="roxo"><Pin size={11} className="mr-0.5" /> Fixado</Selo>}
                      {c.exige_ciente && !c.ciente_em && <Selo cor="amarelo">Pede ciente</Selo>}
                      {c.anexo_caminho && <Paperclip size={13} className="text-suave" />}
                    </span>
                    <span className="block truncate text-sm text-suave">{c.texto}</span>
                    <span className="block text-xs text-suave">{c.autor?.nome} · {dataHoraBR(c.criado_em)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {aberto && <LerModal c={aberto} onFechar={() => abrir(null)} />}
    </>
  );
}

function Anexo({ c }: { c: Comunicado }) {
  const [erro, setErro] = useState('');
  if (!c.anexo_caminho) return null;
  return (
    <div className="mt-3">
      <button className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-roxo-600 ring-1 ring-borda hover:bg-pagina dark:text-roxo-200"
        onClick={async () => { try { window.open(await linkAnexo(c.anexo_caminho!), '_blank', 'noopener'); } catch (e) { setErro(mensagemErro(e)); } }}>
        <Paperclip size={14} /> {c.anexo_nome ?? 'Anexo'}
      </button>
      {erro && <div className="mt-2"><Aviso>{erro}</Aviso></div>}
    </div>
  );
}

function Texto({ c }: { c: Comunicado }) {
  return (
    <>
      <div className="mb-3 flex items-center gap-2 text-sm text-suave">
        <Avatar caminho={c.autor?.foto_caminho} versao={c.autor?.foto_atualizada_em} nome={c.autor?.nome} tamanho={28} />
        <span>{c.autor?.nome} · {dataHoraBR(c.criado_em)}</span>
        {c.urgente && <Selo cor="vermelho">Urgente</Selo>}
      </div>
      <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{c.texto}</div>
      <Anexo c={c} />
    </>
  );
}

function LerModal({ c, onFechar }: { c: Recebido; onFechar: () => void }) {
  const qc = useQueryClient();
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    if (!c.lido_em) marcarLido(c.id).then(() => qc.invalidateQueries({ queryKey: ['comunicacao', 'recebidos'] })).catch(() => {});
  }, [c.id, c.lido_em, qc]);
  async function ciente() {
    setErro(''); setOcupado(true);
    try { await darCiente(c.id); await qc.invalidateQueries({ queryKey: ['comunicacao', 'recebidos'] }); } catch (e) { setErro(mensagemErro(e)); }
    setOcupado(false);
  }
  return (
    <Modal aberto titulo={c.titulo} onFechar={onFechar} largura="max-w-xl">
      <Texto c={c} />
      {erro && <div className="mt-3"><Aviso>{erro}</Aviso></div>}
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        {c.exige_ciente && (c.ciente_em
          ? <span className="inline-flex items-center gap-1 text-sm text-petroleo-600 dark:text-teal-200"><CheckCheck size={16} /> Ciente em {dataHoraBR(c.ciente_em)}</span>
          : <Botao onClick={ciente} disabled={ocupado}><CheckCheck size={15} /> Li e estou ciente</Botao>)}
        <Botao variante="secundario" onClick={onFechar}>Fechar</Botao>
      </div>
    </Modal>
  );
}

export function EnviadosPage() {
  const { session } = useAuth();
  const { data: papel } = usePapel();
  const eu = session?.user.id;
  const { data: lista = [], isLoading } = useQuery({
    queryKey: ['comunicacao', 'enviados', eu, papel?.geral], enabled: Boolean(eu && papel),
    queryFn: () => listarEnviados(eu!, Boolean(papel?.geral)),
  });
  const ids = lista.map((c) => c.id);
  const { data: leituras = [] } = useQuery({ queryKey: ['comunicacao', 'leituras', ids], queryFn: () => listarLeituras(ids), enabled: ids.length > 0 });
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const aberto = lista.find((c) => c.id === abertoId);

  return (
    <>
      <Cabecalho titulo="Enviados" subtitulo={papel?.geral ? 'Todos os comunicados da empresa, com quem já leu.' : 'Os comunicados que você enviou, com quem já leu.'} acoes={<BotaoNovo />} />
      {isLoading ? <EsqueletoTabela /> : lista.length === 0 ? <Vazio>Nenhum comunicado enviado.</Vazio> : (
        <ul className="divide-y divide-borda overflow-hidden rounded-xl ring-1 ring-borda">
          {lista.map((c) => {
            const r = resumoLeitura(leituras.filter((l) => l.comunicado_id === c.id));
            return (
              <li key={c.id}>
                <button onClick={() => setAbertoId(c.id)} className={`flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-3 py-3 text-left hover:bg-pagina sm:px-4 ${c.cancelado_em ? 'opacity-60' : ''}`}>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className={`truncate font-medium ${c.cancelado_em ? 'line-through' : ''}`}>{c.titulo}</span>
                      {c.urgente && <Selo cor="vermelho">Urgente</Selo>}
                      {c.cancelado_em && <Selo>Cancelado</Selo>}
                    </span>
                    <span className="block text-xs text-suave">{paraQuem(c, r.total)}{c.autor_id !== eu && ` · por ${c.autor?.nome}`} · {dataHoraBR(c.criado_em)}</span>
                  </span>
                  <span className="flex shrink-0 gap-1.5 text-xs">
                    <Selo cor={r.lidos === r.total ? 'verde' : 'cinza'}>Lido {r.lidos}/{r.total}</Selo>
                    {c.exige_ciente && <Selo cor={r.cientes === r.total ? 'verde' : 'amarelo'}>Ciente {r.cientes}/{r.total}</Selo>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {aberto && <EnviadoModal c={aberto} onFechar={() => setAbertoId(null)} />}
    </>
  );
}

function EnviadoModal({ c, onFechar }: { c: Comunicado; onFechar: () => void }) {
  const qc = useQueryClient();
  const { data: dest = [], isLoading } = useQuery({ queryKey: ['comunicacao', 'destinatarios', c.id], queryFn: () => listarDestinatarios(c.id) });
  const [erro, setErro] = useState('');
  const [info, setInfo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const r = resumoLeitura(dest);
  const ordenados = [...dest].sort((a, b) => Number(Boolean(a.lido_em)) - Number(Boolean(b.lido_em)) || (a.usuarios?.nome ?? '').localeCompare(b.usuarios?.nome ?? ''));

  async function fazer(f: () => Promise<string | void>) {
    setErro(''); setInfo(''); setOcupado(true);
    try { const m = await f(); if (m) setInfo(m); await qc.invalidateQueries({ queryKey: ['comunicacao'] }); } catch (e) { setErro(mensagemErro(e)); }
    setOcupado(false);
  }

  return (
    <Modal aberto titulo={c.titulo} onFechar={onFechar} largura="max-w-2xl">
      <div className="mb-3 text-xs text-suave">{paraQuem(c, r.total)}{c.enviar_email && ' · também por e-mail'}{c.fixado_ate && ` · fixado até ${dataBR(c.fixado_ate)}`}</div>
      <Texto c={c} />
      <div className="mt-5 flex flex-wrap gap-2 text-xs">
        <Selo cor="azul">{r.total} pessoa{r.total === 1 ? '' : 's'}</Selo>
        <Selo cor={r.celular === r.total ? 'verde' : 'amarelo'}>Celular {r.celular}/{r.total}</Selo>
        <Selo cor={r.lidos === r.total ? 'verde' : 'cinza'}>Lido {r.lidos}/{r.total}</Selo>
        {c.exige_ciente && <Selo cor={r.cientes === r.total ? 'verde' : 'amarelo'}>Ciente {r.cientes}/{r.total}</Selo>}
      </div>
      {isLoading ? <div className="mt-3"><EsqueletoTabela /></div> : (
        <div className="mt-3 max-h-72 overflow-y-auto rounded-lg ring-1 ring-borda">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-pagina text-left text-xs text-suave">
              <tr><th className="px-3 py-2 font-medium">Pessoa</th><th className="px-2 py-2 font-medium">Aviso</th><th className="px-2 py-2 font-medium">Lido</th>{c.exige_ciente && <th className="px-2 py-2 font-medium">Ciente</th>}</tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {ordenados.map((d) => (
                <tr key={d.usuario_id}>
                  <td className="px-3 py-1.5">{d.usuarios?.nome}</td>
                  <td className="px-2 py-1.5 text-suave">
                    <span className="inline-flex items-center gap-1.5">
                      <span title={d.push_enviado_em ? `Celular: ${dataHoraBR(d.push_enviado_em)}` : 'Sem celular ativado'}><Smartphone size={14} className={d.push_enviado_em ? 'text-petroleo-600 dark:text-teal-200' : 'opacity-30'} /></span>
                      {c.enviar_email && <span title={d.email_enviado_em ? `E-mail: ${dataHoraBR(d.email_enviado_em)}` : 'E-mail não enviado'}><Mail size={14} className={d.email_enviado_em ? 'text-petroleo-600 dark:text-teal-200' : 'opacity-30'} /></span>}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-xs">{d.lido_em ? dataHoraBR(d.lido_em) : <span className="text-suave">—</span>}</td>
                  {c.exige_ciente && <td className="px-2 py-1.5 text-xs">{d.ciente_em ? dataHoraBR(d.ciente_em) : <span className="text-suave">—</span>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {erro && <div className="mt-3"><Aviso>{erro}</Aviso></div>}
      {info && <div className="mt-3"><Aviso tipo="info">{info}</Aviso></div>}
      {cancelando && !c.cancelado_em && (
        <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm dark:bg-red-900/30">
          <p className="flex items-center gap-1.5"><AlertTriangle size={15} className="text-red-600" /> O comunicado some da caixa de quem recebeu. Fica aqui como cancelado. Não dá para desfazer.</p>
          <div className="mt-2 flex justify-end gap-2">
            <Botao variante="secundario" tamanho="sm" onClick={() => setCancelando(false)}>Voltar</Botao>
            <Botao variante="perigo" tamanho="sm" disabled={ocupado} onClick={() => fazer(async () => { await cancelarComunicado(c.id); setCancelando(false); return 'Comunicado cancelado.'; })}>Cancelar comunicado</Botao>
          </div>
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {!c.cancelado_em && r.lidos < r.total && (
            <Botao variante="secundario" disabled={ocupado} onClick={() => fazer(async () => {
              const res = await avisarCelulares(c.id, 'lembrete');
              return `Lembrete enviado: ${res.celular} de ${res.pessoas} pessoa${res.pessoas === 1 ? '' : 's'} com o celular ativado.`;
            })}><BellRing size={15} /> Lembrar quem não leu</Botao>
          )}
          {!c.cancelado_em && r.celular < r.total && (
            <Botao variante="fantasma" disabled={ocupado} title="Manda o aviso de novo para quem ativou o celular depois do envio" onClick={() => fazer(async () => {
              const res = await avisarCelulares(c.id, 'enviar');
              return `${res.celular} aviso${res.celular === 1 ? '' : 's'} enviado${res.celular === 1 ? '' : 's'} agora.`;
            })}><Smartphone size={15} /> Reenviar aviso</Botao>
          )}
        </div>
        <div className="flex gap-2">
          {!c.cancelado_em && !cancelando && <Botao variante="fantasma" className="text-red-600" onClick={() => setCancelando(true)}><X size={15} /> Cancelar comunicado</Botao>}
          <Botao variante="secundario" onClick={onFechar}>Fechar</Botao>
        </div>
      </div>
    </Modal>
  );
}
