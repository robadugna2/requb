/**
 * Shared types for the bank-verification module.
 *
 * This module clones the *factual* per-bank receipt-verification logic used by
 * Ethiopian payment-verification gateways: for each bank it calls the bank's own
 * public receipt endpoint and normalises the answer into one shape.
 *
 * Every endpoint and identifier rule here was established by direct observation
 * (see docs/verify-et/README.md and docs/verify-et/UPSTREAM-AND-AUTH.md).
 */

/** Banks/wallets this module can verify. Matches verify.et's own bank enum. */
export type BankCode =
  | 'cbe'
  | 'boa'
  | 'telebirr'
  | 'mpesa'
  | 'cbebirr'
  | 'dashen'
  | 'awash'
  | 'siinqee'
  | 'kaafiebirr'
  | 'coopayebirr';

/**
 * Identifier fields. Banks differ in which they need, so we carry all of them
 * and let each adapter pick what it uses.
 */
export interface BankIdentifiers {
  /** CBE legacy FT reference, BOA/others reference number. e.g. FT26079ABCDE */
  referenceNumber?: string;
  /** CBE "Receipt ID" (the modern, suffix-free identifier). */
  receiptNumber?: string;
  /** Telebirr / M-Pesa / Awash transaction number. */
  transactionNumber?: string;
  /** Bank of Abyssinia requires exactly 5 digits; older CBE FT refs use 8. */
  accountSuffix?: string;
  /** CBE Birr and optional on eBirr wallets. */
  phone?: string;
}

/** Terminal outcome of a verification. */
export type VerificationStatus = 'success' | 'not_found' | 'failed';

/** Normalised result every adapter must produce. */
export interface BankVerificationResult {
  bank: BankCode;
  status: VerificationStatus;
  verified: boolean;

  amount?: number;
  currency?: string;
  senderName?: string;
  senderAccount?: string;
  receiverName?: string;
  receiverAccount?: string;

  referenceNumber?: string;
  receiptNumber?: string;
  transactionNumber?: string;

  /** ISO-8601 where the bank gives a parseable timestamp. */
  timestamp?: string;
  /** Provider-specific extra fields worth keeping for audit. */
  extra?: Record<string, unknown>;

  /** Populated when status !== 'success'. */
  error?: {
    code: string;
    message: string;
    /** True when retrying the same request could plausibly succeed. */
    retryable: boolean;
  };

  /** Which upstream host actually answered — useful for support. */
  source: string;
  /** Wall-clock duration of the upstream call. */
  durationMs: number;
}

/** What a caller hands to the service. */
export interface VerifyBankPaymentInput {
  /** Omit to let the smart router infer the bank from the identifier shape. */
  bank?: BankCode;
  /**
   * Identifier fields. Optional when `rawInput` already carries them (a pasted
   * receipt link or SMS), in which case the parser fills them in.
   */
  identifiers?: BankIdentifiers;
  /** Optional raw text (SMS or receipt URL) to parse instead of identifiers. */
  rawInput?: string;
}
