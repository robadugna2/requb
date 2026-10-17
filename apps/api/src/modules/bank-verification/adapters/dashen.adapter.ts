/**
 * Dashen Bank.
 *
 * The best-understood bank after CBE, because it answers with JSON rather than
 * a rendered page.
 *
 * Observed endpoint:
 *   GET https://receipts.dashenbanksc.com/receipt/{reference}
 *   -> HTTP 400 with a structured body when the transaction is unknown:
 *
 *      {
 *        "statusCode": 400,
 *        "message": "Transaction not found",
 *        "timestamp": "2026-10-16T17:03:51.369Z",
 *        "internalCode": "CLNT_TXNALLT_4003"
 *      }
 *
 * That envelope (statusCode/message/timestamp + an internalCode) is a NestJS
 * API. We treat a 400 carrying "not found" as a clean negative rather than an
 * error, and surface `internalCode` in `extra` because it is genuinely useful
 * when a member disputes a result.
 *
 * The success body was not observed, so the reader is tolerant: it looks for
 * the usual field spellings rather than assuming an exact schema.
 */
import type { BankIdentifiers, BankVerificationResult } from '../types';
import { buildResult, failed, notFound, type BankAdapter } from './adapter.interface';
import { extractReceiptFields, parseReceiptDate } from './html-receipt';
import { fetchBankEndpoint } from './http';

const DASHEN_HOSTS = [
  'https://receipts.dashenbanksc.com/receipt/',
  // Secondary host observed in verify.et's own routing table.
  'https://receipt.dashensuperapp.com/receipt/',
];

export class DashenAdapter implements BankAdapter {
  readonly bank = 'dashen' as const;

  canHandle(identifiers: BankIdentifiers): boolean {
    return !!this.referenceOf(identifiers);
  }

  describeMissingFields(identifiers: BankIdentifiers): string[] {
    return this.referenceOf(identifiers)
      ? []
      : ['reference (the Dashen reference number printed on the receipt)'];
  }

  private referenceOf(identifiers: BankIdentifiers): string | undefined {
    const value =
      identifiers.referenceNumber ?? identifiers.transactionNumber ?? identifiers.receiptNumber;
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  async verify(identifiers: BankIdentifiers): Promise<BankVerificationResult> {
    const reference = this.referenceOf(identifiers);
    if (!reference) {
      return failed(
        this.bank,
        'dashen',
        0,
        'invalid_input',
        'Dashen Bank needs a reference number.',
        false,
      );
    }

    let lastResult: BankVerificationResult | null = null;

    // Try the primary host, then the secondary one before giving up.
    for (const host of DASHEN_HOSTS) {
      const url = `${host}${encodeURIComponent(reference)}`;
      const result = await this.queryHost(url, reference);

      // A definitive answer (found, or explicitly not found) ends the search.
      if (result.status !== 'failed') return result;
      lastResult = result;
    }

    return (
      lastResult ??
      failed(this.bank, 'dashen', 0, 'upstream_unreachable', 'Dashen could not be reached.')
    );
  }

  private async queryHost(url: string, reference: string): Promise<BankVerificationResult> {
    const started = Date.now();

    let outcome;
    try {
      outcome = await fetchBankEndpoint(url, {
        timeoutMs: 20000,
        headers: { Accept: 'application/json, text/html;q=0.9' },
      });
    } catch (error) {
      return failed(
        this.bank,
        url,
        Date.now() - started,
        'upstream_unreachable',
        `Dashen could not be reached: ${(error as Error).message}`,
      );
    }

    const duration = Date.now() - started;
    const payload = this.tryParseJson(outcome.text);

    // Structured JSON answer — the normal case.
    if (payload) {
      const internalCode = String(payload['internalCode'] ?? '');
      const message = String(payload['message'] ?? '');
      const statusCode = Number(payload['statusCode'] ?? outcome.status);

      const saysNotFound =
        /not\s*found|no\s*transaction|does\s*not\s*exist/i.test(message) ||
        /TXNALLT/i.test(internalCode);

      if (saysNotFound || (statusCode >= 400 && statusCode < 500)) {
        return notFound(
          this.bank,
          url,
          duration,
          message || 'No Dashen transaction found for that reference.',
        );
      }
      if (statusCode >= 500) {
        return failed(
          this.bank,
          url,
          duration,
          'upstream_error',
          `Dashen returned HTTP ${statusCode}.`,
        );
      }

      const parsed = this.readJsonReceipt(payload, url, duration, reference);
      if (parsed) return parsed;

      return notFound(
        this.bank,
        url,
        duration,
        'Dashen returned a response without readable receipt fields.',
      );
    }

    // Dashen serves a real receipt as an HTML page (title "Receipt"), while an
    // unknown reference comes back as the JSON envelope handled above. So an
    // HTTP 200 with HTML is a SUCCESS, not a miss — verified against a genuine
    // Dashen Super App receipt.
    if (outcome.status === 404) {
      return notFound(this.bank, url, duration, 'No Dashen transaction found for that reference.');
    }
    if (outcome.status >= 400) {
      return failed(
        this.bank,
        url,
        duration,
        'upstream_error',
        `Dashen returned HTTP ${outcome.status}.`,
      );
    }

    const fields = extractReceiptFields(outcome.text, { referenceNumber: reference });

    // A receipt must yield at least an amount or a party name.
    if (fields.amount === undefined && !fields.senderName && !fields.receiverName) {
      return notFound(
        this.bank,
        url,
        duration,
        'Dashen returned a page that did not contain a readable receipt.',
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
      referenceNumber: fields.referenceNumber ?? reference,
      timestamp: parseReceiptDate(fields.dateText),
      extra: {
        parsedLabels: fields.all,
        // "Transfer Reference" is the long internal reference Dashen prints
        // alongside "Transaction Reference"; keep it for dispute handling.
        transferReference: fields.all['Transfer Reference'],
        amountInWords: fields.all['Amount in words'],
      },
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

  private readJsonReceipt(
    payload: Record<string, unknown>,
    url: string,
    durationMs: number,
    reference: string,
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

    const senderName = pick('payerName', 'senderName', 'payer', 'sender', 'debitAccountName');
    const receiverName = pick(
      'receiverName',
      'beneficiaryName',
      'receiver',
      'beneficiary',
      'creditAccountName',
    );

    if (amount === undefined && !senderName && !receiverName) return null;

    const dateValue = pick('transactionDate', 'paymentDate', 'date', 'timestamp');

    return buildResult(this.bank, {
      status: 'success',
      source: url,
      durationMs,
      amount: Number.isFinite(amount) ? amount : undefined,
      currency: 'ETB',
      senderName: typeof senderName === 'string' ? senderName : undefined,
      senderAccount: this.digits(pick('payerAccount', 'senderAccount', 'debitAccount')),
      receiverName: typeof receiverName === 'string' ? receiverName : undefined,
      receiverAccount: this.digits(
        pick('receiverAccount', 'beneficiaryAccount', 'creditAccount'),
      ),
      referenceNumber:
        (pick('referenceNumber', 'reference', 'transactionReference') as string) ?? reference,
      transactionNumber: pick('transactionNumber', 'transactionId') as string | undefined,
      timestamp: this.toIso(dateValue),
      extra: { raw: payload, internalCode: payload['internalCode'] },
    });
  }

  private digits(value: unknown): string | undefined {
    if (typeof value !== 'string' && typeof value !== 'number') return undefined;
    const digits = String(value).replace(/\D/g, '');
    return digits.length > 0 ? digits : undefined;
  }

  private toIso(value: unknown): string | undefined {
    if (typeof value !== 'string' && typeof value !== 'number') return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
}
