// Equb Admin service worker — conservative shell caching.
// NEVER intercepts or caches anything under /api/.
const CACHE = 'equb-shell-v1';
const PRECACHE = ['/dashboard', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Tolerate individual failures — don't fail the whole install.
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

  // Only handle GET, same-origin requests.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // NEVER intercept API calls.
  if (url.pathname.startsWith('/api/')) return;

  // Navigations: network-first, fall back to the cached dashboard shell.
  if (req.mode === 'navigate') {
    evt.respondWith(fetch(req).catch(() => caches.match('/dashboard')));
    return;
  }

  // Static build assets and icons: cache-first, populate on success.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icon')) {
    evt.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res && res.ok) {
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone());
        }
        return res;
      })()
    );
    return;
  }

  // Everything else passes through untouched (no respondWith).
});
