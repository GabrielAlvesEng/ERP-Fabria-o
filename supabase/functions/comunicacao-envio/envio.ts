// Peças do envio que não dependem do Supabase. A cifragem do aviso foi conferida com outra biblioteca (http_ece).
import * as webpush from 'jsr:@negrel/webpush@0.5.0';

export interface Aparelho { id: string; endpoint: string; p256dh: string; auth: string }
export interface AvisoPush { titulo: string; corpo: string; url: string; tag: string; urgente: boolean }
export type ResultadoPush = 'ok' | 'morto' | 'falhou';

export async function servidorPush(vapidJson: string, contato: string) {
  const vapidKeys = await webpush.importVapidKeys(JSON.parse(vapidJson), { extractable: false });
  return webpush.ApplicationServer.new({ contactInformation: contato, vapidKeys });
}

// Par de chaves VAPID novo: o JSON (guardado só no servidor) e a chave pública que o navegador usa ao se inscrever.
export async function novasChavesVapid(): Promise<{ json: string; publica: string }> {
  const chaves = await webpush.generateVapidKeys({ extractable: true });
  return { json: JSON.stringify(await webpush.exportVapidKeys(chaves)), publica: await webpush.exportApplicationServerKey(chaves) };
}

export async function chavePublica(vapidJson: string): Promise<string> {
  return webpush.exportApplicationServerKey(await webpush.importVapidKeys(JSON.parse(vapidJson), { extractable: false }));
}

// Manda o aviso para um aparelho. "morto" = o Google/Apple diz que a inscrição não existe mais (desativar).
export async function enviarPush(servidor: webpush.ApplicationServer, a: Aparelho, aviso: AvisoPush): Promise<ResultadoPush> {
  try {
    await servidor.subscribe({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } })
      .pushTextMessage(JSON.stringify(aviso), { urgency: aviso.urgente ? webpush.Urgency.High : webpush.Urgency.Normal, ttl: 7 * 24 * 3600 });
    return 'ok';
  } catch (e) {
    if (e instanceof webpush.PushMessageError && (e.isGone() || e.response.status === 404)) return 'morto';
    console.error('push falhou', a.endpoint.slice(0, 40), e instanceof webpush.PushMessageError ? e.toString() : e);
    return 'falhou';
  }
}

// Texto curto que aparece na tela de bloqueio.
export function resumo(texto: string, max = 140): string {
  const t = texto.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function emailComunicado(c: { titulo: string; texto: string; urgente: boolean; autor: string }, link: string) {
  const assunto = `${c.urgente ? '[URGENTE] ' : ''}Comunicado Fabriaço: ${c.titulo}`;
  const html = `<!doctype html><html><body style="margin:0;background:#f6f6f9;font-family:Arial,Helvetica,sans-serif;color:#1e1b4b">
<div style="max-width:560px;margin:0 auto;padding:24px">
  <div style="background:#ffffff;border-radius:12px;padding:24px;border:1px solid #e5e7eb">
    <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em">Comunicado${c.urgente ? ' <b style="color:#dc2626">urgente</b>' : ''}</div>
    <h1 style="font-size:20px;margin:6px 0 16px">${esc(c.titulo)}</h1>
    <div style="font-size:15px;line-height:1.55;white-space:normal">${esc(c.texto).replace(/\n/g, '<br>')}</div>
    <div style="margin-top:16px;font-size:13px;color:#6b7280">Enviado por ${esc(c.autor)}</div>
    <a href="${esc(link)}" style="display:inline-block;margin-top:20px;background:#410FA0;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px">Abrir no ERP</a>
  </div>
  <div style="font-size:11px;color:#9ca3af;text-align:center;margin-top:12px">ERP Fabriaço · mensagem automática, não responda.</div>
</div></body></html>`;
  const texto = `${c.urgente ? 'URGENTE\n' : ''}${c.titulo}\n\n${c.texto}\n\nEnviado por ${c.autor}\nAbrir no ERP: ${link}`;
  return { assunto, html, texto };
}

// Executa as tarefas com no máximo n ao mesmo tempo.
export async function emLotes<T, R>(itens: T[], n: number, f: (t: T) => Promise<R>): Promise<R[]> {
  const saida: R[] = new Array(itens.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, async () => {
    while (i < itens.length) { const k = i++; saida[k] = await f(itens[k]); }
  }));
  return saida;
}
