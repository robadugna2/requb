// Equb Admin service worker — always-fresh-first strategy.
// The app is a frequently-updated dashboard, so correctness beats offline
// speed: every same-origin request is served from the NETWORK first and the
// cache is used only as an offline fallback. This prevents a stale cached
// bundle from shadowing a new deploy (e.g. after a Settings-page fix ships).
// NEVER intercepts or caches anything under /api/.
const CACHE = 'equb-shell-v2';
const PRECACHE = ['/dashboard', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (evt) => {
  const req = evt.request;

  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // API calls are never touched by the service worker.
  if (url.pathname.startsWith('/api/')) return;

  // Navigations: network-first, fall back to the cached dashboard shell.
  if (req.mode === 'navigate') {
    evt.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put('/dashboard', res.clone());
          return res;
        } catch {
          return (await caches.match('/dashboard')) || Response.error();
        }
      })()
    );
    return;
  }

  // Everything else (including hashed build assets): network-first with an
  // offline cache fallback, so a fresh deploy is always picked up online.
  evt.respondWith(
    (async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone());
        }
        return res;
      } catch {
        return (await caches.match(req)) || Response.error();
      }
    })()
  );
});
