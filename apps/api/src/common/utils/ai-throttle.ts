/**
 * Serializes AI calls across providers with a minimum interval between them.
 * Free-tier / reverse-engineered endpoints throttle or ban on bursts, so we
 * never fire two vision requests at once and keep a small gap between them.
 * Concurrency 1 + a configurable floor (AI_MIN_INTERVAL_MS, default 1200ms).
 */
let chain: Promise<unknown> = Promise.resolve();
let lastFinishedAt = 0;

const minIntervalMs = () => {
  const raw = Number(process.env.AI_MIN_INTERVAL_MS);
  return Number.isFinite(raw) && raw >= 0 ? raw : 1200;
};

export function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = Math.max(0, lastFinishedAt + minIntervalMs() - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    try {
      return await fn();
    } finally {
      lastFinishedAt = Date.now();
    }
  });
  // Keep the chain alive even when a call rejects.
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
