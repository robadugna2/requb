/**
 * Contract every bank adapter implements.
 *
 * An adapter knows three things about one bank:
 *   1. which identifier it needs,
 *   2. which public receipt endpoint to call,
 *   3. how to read the answer.
 *
 * Keeping the surface this small means adding a bank is one new file.
 */
import type { BankCode, BankIdentifiers, BankVerificationResult } from '../types';

export interface BankAdapter {
  readonly bank: BankCode;

  /**
   * True when the supplied identifiers are sufficient for this bank.
   * Used to give a precise error instead of firing a doomed request.
   */
  canHandle(identifiers: BankIdentifiers): boolean;

  /**
   * Explain what is missing, for a user-facing error message.
   * Only called when canHandle() returned false.
   */
  describeMissingFields(identifiers: BankIdentifiers): string[];

  /**
   * Perform the verification against the bank's own endpoint.
   * Must never throw for an ordinary "not found" — return status 'not_found'.
   * Throwing is reserved for genuine transport/parse failures.
   */
  verify(identifiers: BankIdentifiers): Promise<BankVerificationResult>;
}

/** Shared helper to build a result with sane defaults. */
export function buildResult(
  bank: BankCode,
  patch: Partial<BankVerificationResult> & {
    status: BankVerificationResult['status'];
    source: string;
    durationMs: number;
  },
): BankVerificationResult {
  return {
    bank,
    verified: patch.status === 'success',
    currency: 'ETB',
    ...patch,
  };
}

/** Normalise a "not found" answer so every adapter reports it identically. */
export function notFound(
  bank: BankCode,
  source: string,
  durationMs: number,
  message = 'No matching transaction was found.',
): BankVerificationResult {
  return buildResult(bank, {
    status: 'not_found',
    source,
    durationMs,
    error: { code: 'not_found', message, retryable: false },
  });
}

/** Normalise a transient failure (timeout, 5xx, unreadable body). */
export function failed(
  bank: BankCode,
  source: string,
  durationMs: number,
  code: string,
  message: string,
  retryable = true,
): BankVerificationResult {
  return buildResult(bank, {
    status: 'failed',
    source,
    durationMs,
    error: { code, message, retryable },
  });
}
