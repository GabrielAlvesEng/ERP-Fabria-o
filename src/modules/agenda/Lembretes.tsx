import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Bell, CalendarClock, CalendarDays, X } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { useMinhaAgendaProxima, type Compromisso } from './api';
import { corInfo, hora, inicioDoDia, isoDia, lembretesDevidos, ocorrencias, resumoSino, somarDias, type Lembrete } from './regras';

// Lembretes da Agenda dentro do ERP (decisão 118, seção 4): véspera às 16:30, o próximo do dia de hora em hora
// (07:00 às 18:00) e faltando 15 minutos. Aparecem no canto da tela enquanto o ERP estiver aberto. O aviso com o ERP
// fechado (push do módulo Comunicação) fica para depois.

const chaveGuardada = (usuario: string) => `agenda-lembretes:${usuario}`;
function lerMostrados(usuario: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(chaveGuardada(usuario)) ?? '[]') as string[]); } catch { return new Set(); }
}
function guardarMostrados(usuario: string, chaves: Set<string>) {
  // Só as dos últimos dias, para não crescer para sempre.
  const ontem = isoDia(somarDias(new Date(), -1));
  const manter = [...chaves].filter((k) => { const d = k.match(/\d{4}-\d{2}-\d{2}/)?.[0]; return !d || d >= ontem; });
  try { localStorage.setItem(chaveGuardada(usuario), JSON.stringify(manter)); } catch { /* sem armazenamento: pode repetir */ }
}

function bip() {
  try {
    const ctx = new AudioContext();
    [0, 0.25].forEach((t) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.2);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.22);
    });
    setTimeout(() => ctx.close(), 800);
  } catch { /* navegador sem áudio */ }
}

// Com o ERP aberto em outra aba (ou minimizado), também aparece como notificação do sistema, se a pessoa já deixou.
async function notificarSistema(l: Lembrete) {
  if (!document.hidden || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(l.titulo, { body: l.texto, tag: l.chave });
    else new Notification(l.titulo, { body: l.texto, tag: l.chave });
  } catch { /* sem notificação */ }
}

function useAgora(ms: number) {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), ms);
    const voltar = () => document.visibilityState === 'visible' && setAgora(new Date());
    document.addEventListener('visibilitychange', voltar);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', voltar); };
  }, [ms]);
  return agora;
}

function useOcorrenciasProximas(agora: Date) {
  const { data = [] } = useMinhaAgendaProxima();
  const dia = isoDia(agora);
  return useMemo(() => {
    const hoje = inicioDoDia(agora);
    return ocorrencias(data, somarDias(hoje, -1), somarDias(hoje, 2));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, dia]);
}

export function LembretesAgenda() {
  const { session } = useAuth();
  const usuario = session?.user.id ?? '';
  const navigate = useNavigate();
  const agora = useAgora(20_000);
  const ocs = useOcorrenciasProximas(agora);
  const [abertos, setAbertos] = useState<Lembrete<Compromisso>[]>([]);

  useEffect(() => {
    if (!usuario) return;
    const mostrados = lerMostrados(usuario);
    const novos = lembretesDevidos(ocs, agora, mostrados);
    if (!novos.length) return;
    novos.forEach((l) => { mostrados.add(l.chave); notificarSistema(l); });
    guardarMostrados(usuario, mostrados);
    if (novos.some((l) => l.tipo === 'quinze')) bip();
    setAbertos((a) => [...a.filter((x) => !novos.some((n) => n.chave === x.chave)), ...novos].slice(-4));
  }, [usuario, ocs, agora]);

  // Os de hora em hora e da véspera somem sozinhos depois de 1 minuto; o de 15 minutos fica até fechar.
  useEffect(() => {
    if (!abertos.some((l) => l.tipo !== 'quinze')) return;
    const t = setTimeout(() => setAbertos((a) => a.filter((l) => l.tipo === 'quinze')), 60_000);
    return () => clearTimeout(t);
  }, [abertos]);

  if (!abertos.length) return null;
  const fechar = (k: string) => setAbertos((a) => a.filter((l) => l.chave !== k));
  return createPortal(
    <div className="fixed inset-x-2 bottom-2 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-96" role="status" aria-live="polite">
      {abertos.map((l) => (
        <div key={l.chave} className={`flex w-full items-start gap-3 rounded-xl bg-superficie p-3 shadow-lg ring-1 animate-[aparecer_150ms_ease-out] ${l.tipo === 'quinze' ? 'ring-2 ring-roxo-500' : 'ring-borda'}`}>
          <span className={`mt-0.5 rounded-lg p-1.5 ${l.tipo === 'quinze' ? 'bg-roxo-500 text-white' : 'bg-roxo-50 text-roxo-600 dark:bg-roxo-500/25 dark:text-roxo-100'}`}>
            {l.tipo === 'quinze' ? <Bell size={16} /> : <CalendarClock size={16} />}
          </span>
          <button className="min-w-0 flex-1 text-left" onClick={() => { fechar(l.chave); navigate(`/agenda?d=${l.o.dia}`); }}>
            <div className="text-sm font-semibold">{l.titulo}</div>
            <div className="text-xs text-suave">{l.texto}</div>
          </button>
          <button onClick={() => fechar(l.chave)} className="rounded p-1 text-suave hover:bg-pagina hover:text-texto dark:hover:bg-marinho-700" aria-label="Fechar aviso"><X size={16} /></button>
        </div>
      ))}
    </div>,
    document.body,
  );
}

// Sino da Agenda na barra de cima: o que ainda falta hoje e o primeiro de amanhã.
export function AgendaSino() {
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const agora = useAgora(60_000);
  const ocs = useOcorrenciasProximas(agora);
  const { hoje, amanha } = resumoSino(ocs, agora);
  const abrir = (dia?: string) => { setAberto(false); navigate(dia ? `/agenda?d=${dia}` : '/agenda'); };
  const item = (o: (typeof hoje)[number]) => (
    <li key={o.c.id + o.inicio.toISOString()}>
      <button onClick={() => abrir(o.dia)} className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-pagina dark:hover:bg-marinho-700">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${corInfo(o.c.cor).ponto}`} />
        <span className="min-w-0">
          <span className="block truncate font-medium">{o.c.titulo}</span>
          <span className="block text-xs tabular-nums text-suave">{o.c.dia_inteiro ? 'Dia inteiro' : `${hora(o.inicio)} às ${hora(o.fim)}`}{o.c.local ? ` · ${o.c.local}` : ''}</span>
        </span>
      </button>
    </li>
  );

  return (
    <div className="relative">
      <button onClick={() => setAberto(!aberto)} className="relative rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-marinho-700" aria-label={`Compromissos de hoje: ${hoje.length}`} title="Agenda">
        <CalendarDays size={18} />
        {hoje.length > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-roxo-500 px-1 text-[10px] font-bold text-white">{hoje.length}</span>}
      </button>
      {aberto && (
        <>
          <div className="fixed inset-0 z-30" onMouseDown={() => setAberto(false)} />
          <div className="fixed inset-x-2 top-14 z-40 rounded-xl bg-superficie p-2 shadow-lg ring-1 ring-borda sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80">
            <div className="px-2 py-1 text-sm font-semibold">Hoje</div>
            {hoje.length ? <ul className="max-h-64 overflow-y-auto">{hoje.map(item)}</ul> : <div className="px-2 py-2 text-sm text-suave">Nada mais hoje.</div>}
            {amanha.length > 0 && <><div className="px-2 pb-1 pt-2 text-sm font-semibold">Amanhã</div><ul>{amanha.map(item)}</ul></>}
            <button onClick={() => abrir()} className="mt-1 w-full rounded-lg bg-roxo-50 px-2 py-1.5 text-xs font-medium text-roxo-700 hover:bg-roxo-100 dark:bg-roxo-700/30 dark:text-roxo-100">Abrir a agenda</button>
          </div>
        </>
      )}
    </div>
  );
}
