/**
 * Per-bank identifier rules and receipt-URL routing.
 *
 * Cloned from the rule table recovered from verify.et's shipped client bundle
 * (docs/verify-et/evidence/receipt-url-rules.js) plus its validation regexes.
 *
 * Purpose: reject malformed input locally so we never waste a network call, and
 * let a member paste a receipt LINK instead of typing a reference.
 */
import type { BankCode } from './types';

export const BANK_CODES: readonly BankCode[] = [
  'cbe',
  'boa',
  'telebirr',
  'mpesa',
  'cbebirr',
  'dashen',
  'awash',
  'siinqee',
  'kaafiebirr',
  'coopayebirr',
] as const;

export function isBankCode(value: string): value is BankCode {
  return (BANK_CODES as readonly string[]).includes(value);
}

/** Human-readable names, for error messages and the admin UI. */
export const BANK_LABELS: Record<BankCode, string> = {
  cbe: 'Commercial Bank of Ethiopia',
  boa: 'Bank of Abyssinia',
  telebirr: 'Telebirr',
  mpesa: 'M-Pesa Ethiopia',
  cbebirr: 'CBE Birr',
  dashen: 'Dashen Bank',
  awash: 'Awash Bank',
  siinqee: 'Siinqee Bank',
  kaafiebirr: 'Kaafi eBirr',
  coopayebirr: 'Coopay eBirr',
};

/**
 * Ethiopian phone canonicalisation. Local form is 0XXXXXXXXX; the wallet
 * providers also accept the +251 / 251 international form.
 * Observed rule: 251[79]XXXXXXXX -> 0XXXXXXXXX.
 */
export function canonicaliseEthiopianPhone(input: string): string {
  const digits = (input ?? '').replace(/\D/g, '');
  if (/^251[79]\d{8}$/.test(digits)) return `0${digits.slice(3)}`;
  if (/^[79]\d{8}$/.test(digits)) return `0${digits}`;
  return input ?? '';
}

/**
 * CBE "Receipt ID": the modern suffix-free identifier.
 * Verified negative lookahead — it must NOT look like a legacy FT reference.
 * Also rejects an all-digit string.
 */
export const CBE_RECEIPT_ID_REGEX =
  /^(?!FT[A-Za-z0-9]{10}(?:\d{5}|\d{8})?$)[A-Za-z0-9_-]{12,128}$/i;

/** Legacy CBE FT reference: "FT" + exactly 10 alphanumerics. */
export const CBE_FT_REGEX = /^FT[A-Za-z0-9]{10}$/i;

/**
 * Per-bank validator for the bank's primary reference field.
 * Returns true when the value is shaped correctly for that bank.
 */
export function isValidReferenceForBank(bank: BankCode, value: string): boolean {
  const v = (value ?? '').trim();
  if (!v) return false;
  switch (bank) {
    case 'cbe':
      return CBE_FT_REGEX.test(v) || CBE_RECEIPT_ID_REGEX.test(v);
    case 'telebirr':
    case 'mpesa':
      return /^[A-Za-z0-9]{10}$/.test(v);
    case 'dashen':
      return /^\d{3}[A-Za-z0-9]{13}$/.test(v);
    case 'cbebirr':
      return /^[A-Za-z0-9]{10,16}$/.test(v);
    case 'awash':
      return /^(?:-[A-Za-z0-9-]{8,}|[A-Za-z0-9][A-Za-z0-9@._-]{5,63})$/.test(v);
    case 'siinqee':
      return /^E[A-Za-z0-9]{11,63}$/i.test(v);
    case 'kaafiebirr':
      return /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9_-]{10,64}$/.test(v);
    case 'coopayebirr':
      return /^[A-Za-z0-9_-]{16,64}$/.test(v);
    case 'boa':
      // BOA references look like an FT reference; the 5-digit suffix is separate.
      return CBE_FT_REGEX.test(v) || /^[A-Za-z0-9]{8,32}$/.test(v);
    default:
      return false;
  }
}

/** A single receipt-URL routing rule. */
export interface ReceiptUrlRule {
  bank: BankCode;
  /** Hosts that identify this bank. */
  hostPatterns: string[];
  /** Path prefixes that must match (empty means any path). */
  pathPrefixes: string[];
  /** Which identifier field the extracted value belongs to. */
  extractField: 'referenceNumber' | 'receiptNumber' | 'transactionNumber';
  /** Pull the value from the query string or from a path segment. */
  extractFrom: 'query' | 'path';
  /** Query parameter names to try, in order. */
  queryParams?: string[];
  /** For extractFrom=path, which segment (-1 = last). */
  pathIndex?: number;
  /** Reject extracted values shorter than this. */
  minLength: number;
  /** Keep hyphens when sanitising (transaction numbers often contain them). */
  preserveHyphen?: boolean;
  /** How sure the router is about this match. */
  confidence: number;
}

/**
 * The receipt-URL routing table, reproduced verbatim from verify.et's bundle.
 * Order matters: the first matching rule wins.
 */
export const RECEIPT_URL_RULES: readonly ReceiptUrlRule[] = [
  {
    bank: 'cbe',
    hostPatterns: ['apps.cbe.com.et'],
    pathPrefixes: ['/'],
    extractField: 'referenceNumber',
    extractFrom: 'query',
    queryParams: ['id'],
    minLength: 4,
    confidence: 0.99,
  },
  {
    bank: 'cbe',
    hostPatterns: ['mbreciept.cbe.com.et', 'mbrecipt.cbe.com.et'],
    pathPrefixes: ['/'],
    extractField: 'receiptNumber',
    extractFrom: 'path',
    pathIndex: -1,
    minLength: 12,
    preserveHyphen: true,
    confidence: 0.99,
  },
  {
    bank: 'dashen',
    hostPatterns: ['receipts.dashenbanksc.com', 'receipt.dashensuperapp.com'],
    pathPrefixes: ['/receipt/'],
    extractField: 'referenceNumber',
    extractFrom: 'path',
    pathIndex: -1,
    minLength: 4,
    confidence: 0.99,
  },
  {
    bank: 'telebirr',
    hostPatterns: ['transactioninfo.ethiotelecom.et'],
    pathPrefixes: ['/receipt/view'],
    extractField: 'transactionNumber',
    extractFrom: 'query',
    queryParams: ['transactionno', 'transaction', 'transactionid', 'reference', 'ref', 'tid'],
    minLength: 4,
    preserveHyphen: true,
    confidence: 0.99,
  },
  {
    bank: 'telebirr',
    hostPatterns: ['transactioninfo.ethiotelecom.et'],
    pathPrefixes: ['/receipt/', '/receit/', '/reciept/'],
    extractField: 'transactionNumber',
    extractFrom: 'path',
    pathIndex: -1,
    minLength: 4,
    preserveHyphen: true,
    confidence: 0.99,
  },
  {
    bank: 'telebirr',
    hostPatterns: ['leul.et'],
    pathPrefixes: ['/verify.php'],
    extractField: 'transactionNumber',
    extractFrom: 'query',
    queryParams: ['reference'],
    minLength: 4,
    preserveHyphen: true,
    confidence: 0.99,
  },
  {
    bank: 'mpesa',
    hostPatterns: ['m-pesabusiness.safaricom.et'],
    pathPrefixes: ['/receipt/'],
    extractField: 'transactionNumber',
    extractFrom: 'path',
    pathIndex: -1,
    minLength: 4,
    preserveHyphen: true,
    confidence: 0.99,
  },
  {
    bank: 'mpesa',
    hostPatterns: ['m-pesabusiness.safaricom.et'],
    pathPrefixes: ['/api/receipt/getreceipt'],
    extractField: 'transactionNumber',
    extractFrom: 'query',
    queryParams: ['trxno', 'reference', 'transactionno', 'transaction'],
    minLength: 4,
    preserveHyphen: true,
    confidence: 0.99,
  },
  {
    bank: 'boa',
    hostPatterns: ['cs.bankofabyssinia.com'],
    pathPrefixes: ['/api/onlineslip/getdetails/', '/slip/'],
    extractField: 'referenceNumber',
    extractFrom: 'query',
    queryParams: ['id', 'trx'],
    minLength: 4,
    confidence: 0.99,
  },
  {
    bank: 'cbebirr',
    hostPatterns: ['cbepay1.cbe.com.et'],
    pathPrefixes: ['/aureceipt'],
    extractField: 'receiptNumber',
    extractFrom: 'query',
    queryParams: ['tid'],
    minLength: 4,
    confidence: 0.99,
  },
  {
    bank: 'awash',
    hostPatterns: ['awashpay.awashbank.com'],
    pathPrefixes: [],
    extractField: 'transactionNumber',
    extractFrom: 'path',
    pathIndex: -1,
    minLength: 4,
    preserveHyphen: true,
    confidence: 0.99,
  },
  {
    bank: 'siinqee',
    hostPatterns: ['receipts.siinqeebank.com'],
    pathPrefixes: ['/generate/'],
    extractField: 'referenceNumber',
    extractFrom: 'path',
    pathIndex: -1,
    minLength: 4,
    confidence: 0.99,
  },
  {
    bank: 'kaafiebirr',
    hostPatterns: ['receipt.ebirr.com'],
    pathPrefixes: ['/kaafimf/'],
    extractField: 'referenceNumber',
    extractFrom: 'path',
    pathIndex: -1,
    minLength: 4,
    preserveHyphen: true,
    confidence: 0.99,
  },
  {
    bank: 'coopayebirr',
    hostPatterns: ['receipt.ebirr.com'],
    pathPrefixes: ['/coopay/'],
    extractField: 'referenceNumber',
    extractFrom: 'path',
    pathIndex: -1,
    minLength: 4,
    preserveHyphen: true,
    confidence: 0.99,
  },
] as const;

/** Hosts we recognise as official receipt pages (used to spot a pasted link). */
export const KNOWN_RECEIPT_HOSTS: readonly string[] = Array.from(
  new Set(RECEIPT_URL_RULES.flatMap((r) => r.hostPatterns)),
);
