/**
 * Receipt-URL / SMS parser.
 *
 * Members often paste the receipt LINK (or a whole SMS) instead of typing the
 * reference. This turns either into a bank + identifier pair, using the routing
 * table in bank-rules.ts.
 *
 * Behaviour cloned from the observed client implementation:
 *  - repair common URL typos before parsing
 *  - strip zero-width characters
 *  - split CBE legacy "FT<10><suffix>" into reference + accountSuffix
 *  - ignore extracted values shorter than the rule's minLength
 */
import {
  CBE_FT_REGEX,
  KNOWN_RECEIPT_HOSTS,
  RECEIPT_URL_RULES,
  type ReceiptUrlRule,
} from './bank-rules';
import type { BankCode, BankIdentifiers } from './types';

export interface ParsedReceiptInput {
  bank: BankCode;
  identifiers: BankIdentifiers;
  confidence: number;
  /** The cleaned URL we actually parsed. */
  normalizedUrl: string;
  /** How the bank was determined. */
  matchedBy: 'rule' | 'host-only';
}

/** Fix the typos we see in pasted links, and strip invisible characters. */
export function normalizeReceiptUrl(input: string): string {
  let value = (input ?? '')
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    .replace(/^https::\/\//i, 'https://')
    .replace(/^http::\/\//i, 'http://')
    .replace(/^https:\/(?!\/)/i, 'https://')
    .replace(/^http:\/(?!\/)/i, 'http://')
    // Collapse a redundant separator after the scheme, e.g. "https://:://host".
    .replace(/^(https?):\/*:+\/*/i, '$1://');

  if (/^www\./i.test(value)) value = `https://${value}`;
  // Bare "host.tld/path" -> add a scheme so URL() accepts it.
  if (/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}(?::\d+)?\//i.test(value)) {
    value = `https://${value}`;
  }
  return value;
}

/** Loose host match: exact, or a subdomain of the pattern. */
function hostMatches(hostname: string, pattern: string): boolean {
  const host = hostname.toLowerCase();
  const pat = pattern.toLowerCase();
  return host === pat || host.endsWith(`.${pat}`);
}

function pathMatches(pathname: string, rule: ReceiptUrlRule): boolean {
  if (rule.pathPrefixes.length === 0) return true;
  const path = pathname.toLowerCase();
  return rule.pathPrefixes.some((prefix) => path.startsWith(prefix.toLowerCase()));
}

/** Keep alphanumerics; optionally keep hyphens (transaction numbers use them). */
function sanitize(value: string, preserveHyphen?: boolean): string {
  return preserveHyphen
    ? value.replace(/[^A-Za-z0-9-]/g, '')
    : value.replace(/[^A-Za-z0-9]/g, '');
}

function extractFromQuery(
  params: URLSearchParams,
  rule: ReceiptUrlRule,
): string | undefined {
  for (const name of rule.queryParams ?? []) {
    const value = params.get(name);
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

function extractFromPath(segments: string[], rule: ReceiptUrlRule): string | undefined {
  if (segments.length === 0) return undefined;
  const index = rule.pathIndex ?? -1;
  const segment = index < 0 ? segments[segments.length + index] : segments[index];
  return segment?.trim() || undefined;
}

/**
 * Split a CBE legacy identifier of the form FT<10 alnum><suffix>.
 * The suffix is 8 digits for CBE, 5 for Bank of Abyssinia.
 */
export function splitLegacyFtReference(
  value: string,
  suffixDigits: number,
): { referenceNumber: string; accountSuffix: string } | null {
  const cleaned = (value ?? '').replace(/[^A-Za-z0-9]/g, '');
  const match = cleaned.match(new RegExp(`^(FT[A-Za-z0-9]{10})(\\d{${suffixDigits}})$`, 'i'));
  if (!match) return null;
  const referenceNumber = match[1].toUpperCase();
  if (!CBE_FT_REGEX.test(referenceNumber)) return null;
  return { referenceNumber, accountSuffix: match[2] };
}

/** Pull the first receipt URL out of a blob of text (e.g. a pasted SMS). */
export function findReceiptUrlInText(text: string): string | null {
  const normalized = normalizeReceiptUrl(text);
  const urlPattern = /(?:https?:\/\/|https?::\/\/|www\.)[^\s<>"')\]},]+/gi;
  const candidates = normalized.match(urlPattern) ?? [];
  for (const candidate of candidates) {
    const cleaned = normalizeReceiptUrl(candidate);
    try {
      const url = new URL(cleaned);
      if (KNOWN_RECEIPT_HOSTS.some((host) => hostMatches(url.hostname, host))) {
        return cleaned;
      }
    } catch {
      // Not a usable URL — keep scanning.
    }
  }
  return null;
}

/**
 * Parse a receipt URL into a bank + identifiers.
 * Returns null when nothing recognises it.
 */
export function parseReceiptUrl(input: string): ParsedReceiptInput | null {
  const normalizedUrl = normalizeReceiptUrl(input);
  let url: URL;
  try {
    url = new URL(normalizedUrl);
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname;
  const segments = pathname
    .split('/')
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .filter(Boolean);

  const identifiers: BankIdentifiers = {};

  for (const rule of RECEIPT_URL_RULES) {
    if (!rule.hostPatterns.some((pattern) => hostMatches(hostname, pattern))) continue;
    if (!pathMatches(pathname, rule)) continue;

    // CBE legacy links carry "FT<10><8 digits>" in the id parameter.
    if (rule.bank === 'cbe' && rule.extractFrom === 'query') {
      const idValue = extractFromQuery(url.searchParams, rule);
      if (idValue) {
        const split = splitLegacyFtReference(idValue, 8);
        if (split) {
          identifiers.referenceNumber = split.referenceNumber;
          identifiers.accountSuffix = split.accountSuffix;
          return {
            bank: 'cbe',
            identifiers,
            confidence: rule.confidence,
            normalizedUrl,
            matchedBy: 'rule',
          };
        }
      }
    }

    // Bank of Abyssinia uses the same FT shape but a 5-digit suffix.
    if (rule.bank === 'boa') {
      const raw = extractFromQuery(url.searchParams, rule);
      if (raw) {
        const split = splitLegacyFtReference(raw, 5);
        if (split) {
          identifiers.referenceNumber = split.referenceNumber;
          identifiers.accountSuffix = split.accountSuffix;
          return {
            bank: 'boa',
            identifiers,
            confidence: rule.confidence,
            normalizedUrl,
            matchedBy: 'rule',
          };
        }
      }
    }

    const raw =
      rule.extractFrom === 'query'
        ? extractFromQuery(url.searchParams, rule)
        : extractFromPath(segments, rule);
    if (!raw) continue;

    const value = sanitize(raw, rule.preserveHyphen);
    if (value.length < rule.minLength) continue;

    if (rule.extractField === 'receiptNumber') identifiers.receiptNumber = value;
    else if (rule.extractField === 'transactionNumber') identifiers.transactionNumber = value;
    else identifiers.referenceNumber = value;

    return {
      bank: rule.bank,
      identifiers,
      confidence: rule.confidence,
      normalizedUrl,
      matchedBy: 'rule',
    };
  }

  // Host alone identified the bank, but we could not isolate a field.
  const hosts = new Set(
    RECEIPT_URL_RULES.filter((rule) =>
      rule.hostPatterns.some((pattern) => hostMatches(hostname, pattern)),
    ).map((rule) => rule.bank),
  );
  if (hosts.size === 1) {
    return {
      bank: [...hosts][0],
      identifiers,
      confidence: 0.95,
      normalizedUrl,
      matchedBy: 'host-only',
    };
  }

  return null;
}
