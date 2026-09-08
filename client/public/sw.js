/* Mahlzeit service worker.
 *
 * Strategy (kept deliberately small):
 *  - /api/*            never touched — data is always live.
 *  - navigations       network first; offline → cached app shell (/w/).
 *  - /w/assets/*       cache first (hashed, immutable build output).
 *  - icons/manifest    cache first.
 *  - push              show a notification and open the linked page on click.
 */
const CACHE = 'mahlzeit-shell-v1';
const SHELL_URL = '/w/';
const PRECACHE = [SHELL_URL, '/w/manifest.webmanifest', '/w/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Keep the shell fresh for the next offline start.
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(SHELL_URL, copy));
          return res;
        })
        .catch(() => caches.match(SHELL_URL).then((hit) => hit ?? offlineResponse())),
    );
    return;
  }

  if (url.pathname.startsWith('/w/assets/') || url.pathname.startsWith('/w/icons/') || url.pathname === '/w/manifest.webmanifest') {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
            return res;
          }),
      ),
    );
  }
});

function offlineResponse() {
  return new Response(
    '<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Mahlzeit</title><body style="font-family:system-ui;background:#fafaf9;color:#1c1917;display:grid;place-items:center;min-height:100vh;margin:0">' +
      '<div style="text-align:center;padding:2rem"><div style="width:12px;height:12px;border-radius:50%;background:#f97316;margin:0 auto 1rem"></div>' +
      '<h1 style="font-size:1.25rem;margin:0 0 .5rem">Keine Verbindung</h1><p style="color:#57534e;margin:0">Mahlzeit braucht Internet. Bitte später erneut versuchen.</p></div></body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

// ----- Push -----
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Mahlzeit', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Mahlzeit';
  const options = {
    body: data.body || '',
    icon: '/w/icons/icon-192.png',
    badge: '/w/icons/icon-192.png',
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { url: data.url || SHELL_URL },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || SHELL_URL;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
