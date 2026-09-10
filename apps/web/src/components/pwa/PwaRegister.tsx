'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker (/sw.js) in production builds only.
 * Renders nothing.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[pwa] service worker registration failed:', err);
    });
  }, []);

  return null;
}
