/* Bump VERSION on every deploy, together with js/config.js. */
const VERSION = '2.8.0';
const CACHE = 'creatagious-' + VERSION;
const CORE = ['./','index.html','offline.html','privacy.html','terms.html','delete-account.html','manifest.webmanifest',
  'css/app.css','css/pages.css','js/config.js','js/store.js','js/premium.js','js/copy.js','js/art.js','js/render.js','js/content.js','js/planner.js','js/export.js','js/views.js','js/schedule.js','js/app.js',
  'assets/fonts/inter-Regular.woff','assets/fonts/inter-Medium.woff','assets/fonts/inter-SemiBold.woff','assets/fonts/inter-Bold.woff','assets/fonts/inter-ExtraBold.woff','assets/fonts/anton.woff','assets/fonts/archivoblack.woff','assets/fonts/montserrat-black.woff','assets/fonts/poppins-bold.woff','assets/fonts/lora-bold.woff','assets/fonts/comicrelief-bold.woff',
  'assets/img/tpl_food.webp','assets/img/tpl_event.webp','assets/img/tpl_transport.webp','assets/img/tpl_sale.webp','assets/img/rec_bus.webp','assets/img/rec_burger.webp','assets/img/rec_resort.webp',
  'assets/icons/favicon.png','assets/icons/icon-192.png','assets/icons/icon-512.png','assets/icons/maskable-192.png','assets/icons/maskable-512.png','assets/icons/apple-touch-icon.png','assets/icons/badge-96.png'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' }))))));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => (n.startsWith('creatagious-') || n.startsWith('adifying-')) && n !== CACHE).map((n) => caches.delete(n)))).then(() => self.clients.claim())));
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Time to post', { body: d.body || '', tag: d.tag || 'creatagious', renotify: true, icon: 'assets/icons/icon-192.png', badge: 'assets/icons/badge-96.png', data: { url: d.url || '#schedule' } }));
});
self.addEventListener('notificationclick', (e) => { e.notification.close(); const u = new URL((e.notification.data && e.notification.data.url) || '#schedule', self.registration.scope).href; e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((l) => { const w = l.find((c) => c.url.startsWith(self.registration.scope)); if (w) { w.navigate(u).catch(() => {}); return w.focus(); } return clients.openWindow(u); })); });
self.addEventListener('message', (e) => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/api/')) return;
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).then((res) => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then((x) => x.put(r, c)); } return res; })
      .catch(async () => (await caches.match(r, { ignoreSearch: true })) || (u.pathname.endsWith('.html') && !u.pathname.endsWith('index.html') ? caches.match('offline.html') : caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(r, { ignoreSearch: true }).then((hit) => hit || fetch(r).then((res) => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then((x) => x.put(r, c)); } return res; })));
});
