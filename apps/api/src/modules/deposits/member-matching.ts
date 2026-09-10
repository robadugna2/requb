/**
 * Fuzzy matching between a bank-transaction payer name (as extracted from a
 * CBE receipt, e.g. "ABEBE KEBEDE TESFAYE") and an equb member's stored name
 * (User.name, typically "FirstName FatherName" in Ethiopian naming style).
 *
 * Scoring: token-level similarity (exact match or Levenshtein tolerance for
 * OCR misreads) combined into a 0..1 coverage score in both directions, so a
 * 3-word payer name still matches a 2-word member name strongly when the
 * shared tokens align.
 */

export interface MemberMatchCandidate {
  userId: string;
  name: string;
  phone?: string;
  photoUrl?: string;
  membershipStatus?: string;
  score: number;
}

const MIN_TOKEN_SIMILARITY = 0.75;

export function normalizeName(name: string): string {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

function tokenSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function coverageOf(sourceTokens: string[], targetTokens: string[]): number {
  if (sourceTokens.length === 0) return 0;
  let matched = 0;
  for (const token of sourceTokens) {
    const best = Math.max(
      ...targetTokens.map((t) => tokenSimilarity(token, t)),
      0,
    );
    if (best >= MIN_TOKEN_SIMILARITY) matched++;
  }
  return matched / sourceTokens.length;
}

/**
 * Score how well a payer name matches a member name. 1 = same name,
 * >= ~0.6 = confident suggestion, below = manual pick required.
 */
export function scoreNameMatch(payerName: string, memberName: string): number {
  const payer = normalizeName(payerName);
  const member = normalizeName(memberName);
  if (!payer || !member) return 0;
  if (payer === member) return 1;

  const payerTokens = payer.split(' ');
  const memberTokens = member.split(' ');

  const payerCoverage = coverageOf(payerTokens, memberTokens);
  const memberCoverage = coverageOf(memberTokens, payerTokens);

  const score = 0.65 * payerCoverage + 0.35 * memberCoverage;
  return Math.round(Math.min(score, 1) * 1000) / 1000;
}

/** Confidence threshold above which a suggestion is offered as auto-paired. */
export const MEMBER_MATCH_THRESHOLD = 0.6;

export function rankMembersByPayerName(
  payerName: string,
  members: Array<{
    userId: string;
    name: string;
    phone?: string;
    photoUrl?: string;
    membershipStatus?: string;
  }>,
): MemberMatchCandidate[] {
  return members
    .map((m) => ({ ...m, score: scoreNameMatch(payerName, m.name) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
