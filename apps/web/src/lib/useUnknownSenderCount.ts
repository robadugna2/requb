'use client';

import { useEffect, useState } from 'react';
import { getUnknownSenderCount } from '@/lib/api';

/**
 * Live count of unresolved Unknown Senders for the nav badges.
 * Polls quietly every 60s and refreshes instantly when any flow
 * dispatches the `unknown-senders-changed` event.
 */
export function useUnknownSenderCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchCount = () => {
      getUnknownSenderCount()
        .then((data) => {
          if (!cancelled) setCount(data.count);
        })
        .catch(() => {});
    };
    fetchCount();
    const onQueueChange = () => fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    window.addEventListener('unknown-senders-changed', onQueueChange);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('unknown-senders-changed', onQueueChange);
    };
  }, []);

  return count;
}
