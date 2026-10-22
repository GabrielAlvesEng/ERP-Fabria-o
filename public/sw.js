// ERP Fabriaço: serviço que recebe os avisos (comunicados) com o ERP fechado (src/modules/comunicacao/push.ts).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { corpo: e.data ? e.data.text() : '' }; }
  const url = new URL(d.url || '', self.registration.scope).href;
  e.waitUntil(self.registration.showNotification(d.titulo || 'ERP Fabriaço', {
    body: d.corpo || '',
    icon: new URL('icones/icone-192.png', self.registration.scope).href,
    badge: new URL('icones/badge-96.png', self.registration.scope).href,
    tag: d.tag || undefined,
    renotify: Boolean(d.tag),
    requireInteraction: Boolean(d.urgente),
    data: { url },
  }));
});

// Tocar no aviso: usa a janela do ERP que já estiver aberta (o app vai até o comunicado) ou abre uma nova.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const erp = janelas.find((j) => j.url.startsWith(self.registration.scope));
    if (erp) {
      erp.postMessage({ tipo: 'abrir', url });
      return erp.focus();
    }
    return self.clients.openWindow(url);
  })());
});
