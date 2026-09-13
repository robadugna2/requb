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
  /** Which source produced the best score */
  matchedVia: 'name' | 'bankAccountName' | 'history' | 'payerAlias';
  /** When matchedVia is 'payerAlias', the registered alias that matched */
  matchedAlias?: string;
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
  // Single-letter initial (e.g. "H" in "H/Michael" or OCR'd initials) matches a
  // longer token that starts with it.
  if ((a.length === 1 && b.startsWith(a)) || (b.length === 1 && a.startsWith(b))) {
    return 0.85;
  }
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

/**
 * Strictness model (three tiers, evaluated by the caller):
 *
 *  AUTO    — deterministic identity only: the normalized payer name equals the
 *            member name, bank-account-holder name, or an exact authorized-payer
 *            alias (score 1.0), or the exact payer was paired before (history).
 *            A single unambiguous candidate is required — never a guess.
 *  SUGGEST — high-but-not-exact similarity >= MEMBER_MATCH_THRESHOLD with a
 *            clear margin over the runner-up (AMBIGUITY_MARGIN). Never applied
 *            automatically; surfaced as a one-click "accept" chip.
 *  UNKNOWN — everything else (including any ambiguous top-2) goes to the
 *            Unknown Senders queue for human resolution.
 */
export const MEMBER_MATCH_THRESHOLD = 0.6;

/**
 * Margin between the top two candidates below which the match is considered
 * ambiguous and must be resolved by a human (two members with very similar
 * names should never be auto-guessed).
 */
export const AMBIGUITY_MARGIN = 0.1;

/**
 * Rank group members by how well a transaction payer name matches their
 * stored name, their bank-account-holder name, OR any of their registered
 * AUTHORIZED PAYER aliases (people who pay on the member's behalf — spouse,
 * sibling, relative). `bankAccountName` is the name as registered at the
 * bank, so it frequently matches the CBE receipt payer exactly even when the
 * equb profile name differs in transliteration. An alias match is treated as
 * a strong signal (the admin explicitly registered that person as paying for
 * this member).
 */
export function rankMembersByPayerName(
  payerName: string,
  members: Array<{
    userId: string;
    name: string;
    bankAccountName?: string;
    aliases?: string[];
    phone?: string;
    photoUrl?: string;
    membershipStatus?: string;
  }>,
): MemberMatchCandidate[] {
  return members
    .map((m) => {
      const nameScore = scoreNameMatch(payerName, m.name);
      const bankScore = m.bankAccountName
        ? scoreNameMatch(payerName, m.bankAccountName)
        : 0;
      // Best match against any authorized-payer alias, slightly boosted so a
      // registered proxy payer wins over a coincidental partial name match.
      let aliasScore = 0;
      let aliasName: string | undefined;
      for (const alias of m.aliases ?? []) {
        const s = scoreNameMatch(payerName, alias);
        if (s > aliasScore) {
          aliasScore = s;
          aliasName = alias;
        }
      }
      const aliasBoosted = aliasScore > 0 ? Math.min(1, aliasScore + 0.1) : 0;

      let matchedVia: MemberMatchCandidate['matchedVia'] = 'name';
      let score = nameScore;
      if (bankScore > score) {
        score = bankScore;
        matchedVia = 'bankAccountName';
      }
      if (aliasBoosted > score) {
        score = aliasBoosted;
        matchedVia = 'payerAlias';
      }

      return {
        userId: m.userId,
        name: m.name,
        phone: m.phone,
        photoUrl: m.photoUrl,
        membershipStatus: m.membershipStatus,
        score: Math.round(Math.min(score, 1) * 1000) / 1000,
        matchedVia,
        matchedAlias: aliasName,
      };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
