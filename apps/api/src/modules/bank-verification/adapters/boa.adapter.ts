/**
 * Bank of Abyssinia.
 *
 * Observed endpoint:
 *   GET https://cs.bankofabyssinia.com/api/onlineslip/getdetails/?id={FT}{suffix}
 *   -> HTTP 404 when the transaction does not exist.
 *
 * BOA shares CBE's legacy FT shape but requires a **5-digit** account suffix
 * (CBE uses 8), which is why the split rule in receipt-parser.ts is
 * parameterised by suffix length.
 *
 * The success body was not observed (needs a real transaction), so the parser
 * accepts either JSON or HTML — whichever the host returns.
 */
import { CBE_FT_REGEX } from '../bank-rules';
import type { BankIdentifiers, BankVerificationResult } from '../types';
import { buildResult, failed, notFound, type BankAdapter } from './adapter.interface';
import { extractReceiptFields, parseReceiptDate } from './html-receipt';
import { fetchBankEndpoint } from './http';

const BOA_SLIP_HOST = 'https://cs.bankofabyssinia.com/api/onlineslip/getdetails/';

export class BoaAdapter implements BankAdapter {
  readonly bank = 'boa' as const;

  canHandle(identifiers: BankIdentifiers): boolean {
    return !!identifiers.referenceNumber && !!identifiers.accountSuffix;
  }

  describeMissingFields(identifiers: BankIdentifiers): string[] {
    const missing: string[] = [];
    if (!identifiers.referenceNumber) {
      missing.push('referenceNumber (the FT reference, e.g. FT26079ABCDE)');
    } else if (!CBE_FT_REGEX.test(identifiers.referenceNumber.trim())) {
      missing.push('referenceNumber in FT format (FT followed by 10 characters)');
    }
    if (!identifiers.accountSuffix) {
      missing.push('accountSuffix (exactly 5 digits, as printed on the BOA receipt)');
    } else if (!/^\d{5}$/.test(identifiers.accountSuffix.trim())) {
      missing.push('accountSuffix as exactly 5 digits');
    }
    return missing;
  }

  async verify(identifiers: BankIdentifiers): Promise<BankVerificationResult> {
    if (!this.canHandle(identifiers)) {
      return failed(
        this.bank,
        'boa',
        0,
        'invalid_input',
        `Bank of Abyssinia needs ${this.describeMissingFields(identifiers).join(' and ')}.`,
        false,
      );
    }

    const ft = identifiers.referenceNumber!.trim().toUpperCase();
    const suffix = identifiers.accountSuffix!.trim();
    const url = `${BOA_SLIP_HOST}?id=${encodeURIComponent(ft + suffix)}`;
    const started = Date.now();

    let outcome;
    try {
      outcome = await fetchBankEndpoint(url, { timeoutMs: 20000 });
    } catch (error) {
      return failed(
        this.bank,
        url,
        Date.now() - started,
        'upstream_unreachable',
        `Bank of Abyssinia could not be reached: ${(error as Error).message}`,
      );
    }

    const duration = Date.now() - started;

    if (outcome.status === 404) {
      return notFound(
        this.bank,
        url,
        duration,
        'No Bank of Abyssinia transaction found for that reference and account suffix.',
      );
    }
    if (outcome.status >= 400) {
      return failed(
        this.bank,
        url,
        duration,
        'upstream_error',
        `Bank of Abyssinia returned HTTP ${outcome.status}.`,
      );
    }

    // Try JSON first: BOA's slip service is an API and may answer with JSON.
    const asJson = this.tryParseJson(outcome.text);
    if (asJson) {
      const jsonResult = this.readJsonReceipt(asJson, url, duration, ft);
      if (jsonResult) return jsonResult;
    }

    const fields = extractReceiptFields(outcome.text, { referenceNumber: ft });
    if (fields.amount === undefined && !fields.senderName && !fields.receiverName) {
      return notFound(
        this.bank,
        url,
        duration,
        'The Bank of Abyssinia page did not contain a readable receipt.',
      );
    }

    return buildResult(this.bank, {
      status: 'success',
      source: url,
      durationMs: duration,
      amount: fields.amount,
      currency: 'ETB',
      senderName: fields.senderName,
      senderAccount: fields.senderAccount,
      receiverName: fields.receiverName,
      receiverAccount: fields.receiverAccount,
      referenceNumber: fields.referenceNumber ?? ft,
      timestamp: parseReceiptDate(fields.dateText),
      extra: { parsedLabels: fields.all },
    });
  }

  private tryParseJson(text: string): Record<string, unknown> | null {
    const trimmed = (text ?? '').trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
    try {
      const parsed = JSON.parse(trimmed);
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  /** Map a JSON slip payload onto our result shape. */
  private readJsonReceipt(
    payload: Record<string, unknown>,
    url: string,
    durationMs: number,
    ft: string,
  ): BankVerificationResult | null {
    const data = (payload['data'] ?? payload) as Record<string, unknown>;

    const pick = (...keys: string[]): unknown => {
      for (const key of keys) {
        const value = data[key];
        if (value !== undefined && value !== null && value !== '') return value;
      }
      return undefined;
    };

    const rawAmount = pick('amount', 'transferredAmount', 'transactionAmount', 'totalAmount');
    const amount =
      typeof rawAmount === 'number'
        ? rawAmount
        : typeof rawAmount === 'string'
          ? Number.parseFloat(rawAmount.replace(/,/g, ''))
          : undefined;

    const senderName = pick('payerName', 'senderName', 'payer', 'sender');
    const receiverName = pick('receiverName', 'beneficiaryName', 'receiver', 'beneficiary');

    if (amount === undefined && !senderName && !receiverName) return null;

    return buildResult(this.bank, {
      status: 'success',
      source: url,
      durationMs,
      amount: Number.isFinite(amount) ? amount : undefined,
      currency: 'ETB',
      senderName: typeof senderName === 'string' ? senderName : undefined,
      senderAccount: this.digits(pick('payerAccount', 'senderAccount', 'debitAccount')),
      receiverName: typeof receiverName === 'string' ? receiverName : undefined,
      receiverAccount: this.digits(pick('receiverAccount', 'beneficiaryAccount', 'creditAccount')),
      referenceNumber: (pick('referenceNumber', 'reference', 'ftNumber') as string) ?? ft,
      timestamp: parseReceiptDate(pick('transactionDate', 'date', 'paymentDate') as string),
      extra: { raw: payload },
    });
  }

  private digits(value: unknown): string | undefined {
    if (typeof value !== 'string' && typeof value !== 'number') return undefined;
    const digits = String(value).replace(/\D/g, '');
    return digits.length > 0 ? digits : undefined;
  }
}
