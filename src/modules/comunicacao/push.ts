import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/shared/lib/supabase';
import { chamarEnvio } from './api';
import { chaveParaBytes, nomeAparelho, situacaoAparelho, type SituacaoAparelho } from './regras';

// Aviso no celular (Web Push). O service worker (public/sw.js) recebe o aviso com o ERP fechado e abre o comunicado
// ao tocar. A inscrição deste navegador fica em push_aparelhos, ligada ao usuário logado.

const BASE = import.meta.env.BASE_URL;
export const suportaPush = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const ehIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
export const instaladoNaTela = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

export function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return Promise.resolve(undefined);
  return navigator.serviceWorker.register(`${BASE}sw.js`, { scope: BASE }).catch((e) => { console.warn('service worker', e); return undefined; });
}

async function registro() {
  const r = (await navigator.serviceWorker.getRegistration(BASE)) ?? (await registrarServiceWorker());
  if (!r) throw new Error('Este navegador não deixou o ERP instalar o serviço de avisos.');
  await navigator.serviceWorker.ready;
  return r;
}

export async function inscricaoAtual(): Promise<PushSubscription | null> {
  if (!suportaPush()) return null;
  const r = await navigator.serviceWorker.getRegistration(BASE);
  return (await r?.pushManager.getSubscription()) ?? null;
}

const iguais = (a: ArrayBuffer | null | undefined, b: Uint8Array) => Boolean(a) && new Uint8Array(a!).every((x, i) => x === b[i]) && a!.byteLength === b.length;

export async function ativarNesteAparelho(): Promise<void> {
  if (!suportaPush()) throw new Error('Este navegador não recebe avisos. No iPhone, abra o ERP pelo ícone da tela de início.');
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') throw new Error('As notificações foram bloqueadas. Libere nas configurações do navegador para este site.');
  const r = await registro();
  const { chave } = await chamarEnvio<{ chave: string }>({ acao: 'chave' });
  const bytes = chaveParaBytes(chave);
  let sub = await r.pushManager.getSubscription();
  if (sub && !iguais(sub.options.applicationServerKey, bytes)) { await sub.unsubscribe(); sub = null; }
  sub ??= await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
  const j = sub.toJSON();
  const { error } = await supabase.rpc('registrar_aparelho', {
    p_endpoint: sub.endpoint, p_p256dh: j.keys?.p256dh ?? '', p_auth: j.keys?.auth ?? '', p_nome: nomeAparelho(navigator.userAgent, navigator.maxTouchPoints > 1),
  });
  if (error) throw error;
}

// Desliga o aviso neste navegador (e ao sair do ERP, para o próximo usuário do mesmo aparelho não receber os avisos).
export async function desativarNesteAparelho(): Promise<void> {
  const sub = await inscricaoAtual();
  if (!sub) return;
  await supabase.rpc('remover_aparelho', { p_endpoint: sub.endpoint });
  await sub.unsubscribe();
}

export function useSituacaoAparelho() {
  const [situacao, setSituacao] = useState<SituacaoAparelho | null>(null);
  const atualizar = useCallback(async () => {
    const sub = await inscricaoAtual().catch(() => null);
    setSituacao(situacaoAparelho({
      suporta: suportaPush(), ios: ehIOS(), instalado: instaladoNaTela(),
      permissao: 'Notification' in window ? Notification.permission : 'indisponivel', inscrito: Boolean(sub),
    }));
  }, []);
  useEffect(() => { void atualizar(); }, [atualizar]);
  return { situacao, atualizar };
}
