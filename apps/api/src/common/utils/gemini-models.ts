/**
 * Gemini model auto-detection: Google introduces and retires models
 * continuously (gemini-2.0-flash was retired within two years), so nothing
 * is hardcoded — the best available model is discovered from the live
 * /models list and ranked newest-first.
 */

export const GEMINI_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface GeminiModelInfo {
  /** e.g. "models/gemini-3.1-pro" */
  name?: string;
  supportedGenerationMethods?: string[];
}

/**
 * Picks the best generateContent-capable Gemini model from a /models reply.
 * Ranking: highest version first; within a version, pro > flash > lite
 * (pro reads documents best and is free-tier accessible; flash has the
 * higher rate limits); previews/experimental models rank slightly lower.
 */
export function pickBestGeminiModel(models: GeminiModelInfo[]): string | null {
  const candidates = models
    .filter((m) => /^models\/gemini-/.test(m.name ?? ''))
    .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((m) => m.name!.replace(/^models\//, ''));

  if (candidates.length === 0) return null;

  const score = (name: string): number => {
    const version = parseFloat(name.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? '0');
    let s = version * 100;
    if (/pro/.test(name)) s += 3;
    else if (/flash(?!.*lite)/.test(name)) s += 2;
    else if (/lite/.test(name)) s += 1;
    if (/preview|exp\b/.test(name)) s -= 0.5;
    return s;
  };

  return candidates.sort((a, b) => score(b) - score(a))[0] ?? null;
}
