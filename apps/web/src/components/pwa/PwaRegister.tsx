'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker (/sw.js) in production builds only, and keeps
 * the client on the LATEST deployed code:
 *  - checks for an updated worker on load and every 60s (a fresh deploy is
 *    picked up within a minute instead of up to 24h)
 *  - when a new worker takes control, reloads the page once so the browser
 *    stops running stale cached JavaScript (prevents "I changed it but the
 *    old behavior is still there" after deploys)
 * Renders nothing.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    let reloadGuarded = false;

    const applyNewWorker = (registration: ServiceWorkerRegistration) => {
      const worker = registration.installing || registration.waiting;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        // New worker installed and waiting -> activate it now.
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          worker.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    };

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        applyNewWorker(registration);
        // Ask the browser to check /sw.js for a new version right away and
        // periodically after, so deploys propagate quickly.
        registration.update().catch(() => undefined);
        const interval = window.setInterval(() => {
          registration.update().catch(() => undefined);
        }, 60000);

        navigator.serviceWorker.addEventListener('controllerchange', () => {
          // A different service worker took control => a new app version is
          // live. Reload once so the page runs the fresh bundle.
          if (reloadGuarded) return;
          reloadGuarded = true;
          window.clearInterval(interval);
          window.location.reload();
        });
      })
      .catch((err) => {
        console.warn('[pwa] service worker registration failed:', err);
      });
  }, []);

  return null;
}
