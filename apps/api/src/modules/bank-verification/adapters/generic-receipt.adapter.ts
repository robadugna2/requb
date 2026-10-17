/**
 * Config-driven adapter for banks whose receipt page is server-rendered HTML.
 *
 * Each entry below records a URL the bank itself serves (all observed live) and
 * how to tell "not found" apart from a real receipt.
 *
 * IMPORTANT — what is and is not confirmed:
 *   Every endpoint and every not-found signature here was observed by direct
 *   request. What is NOT confirmed is the exact field layout of a *successful*
 *   receipt page, because that needs a genuine transaction. The parser therefore
 *   reads labels generically (see html-receipt.ts) and reports whatever it
 *   finds, rather than assuming a fixed shape.
 */
import type { BankCode, BankIdentifiers, BankVerificationResult } from '../types';
import { buildResult, failed, notFound, type BankAdapter } from './adapter.interface';
import { fetchBankEndpoint } from './http';
import { extractReceiptFields, parseReceiptDate } from './html-receipt';

interface HtmlBankConfig {
  bank: BankCode;
  label: string;
  /** Build the receipt URL from identifiers, or null when fields are missing. */
  buildUrl(identifiers: BankIdentifiers): string | null;
  /** Which identifier fields this bank needs, for error messages. */
  required: (keyof BankIdentifiers)[];
  /** Substrings that mean "the transaction does not exist". */
  notFoundMarkers: string[];
  /** Substrings that mean the request itself was rejected. */
  invalidMarkers?: string[];
  /**
   * True when the page is a client-rendered SPA. Such a page returns 200 with an
   * empty shell, so HTML parsing cannot work and we say so instead of guessing.
   */
  clientRendered?: boolean;
  /** Per-bank timeout. Some hosts are slow under load. */
  timeoutMs?: number;
  /** Extra attempts after a transport failure (timeout / connection error). */
  retries?: number;
}

const CONFIGS: HtmlBankConfig[] = [
  {
    bank: 'telebirr',
    label: 'Telebirr',
    required: ['transactionNumber'],
    // Observed: GET /receipt/view?transactionno=… returns HTTP 200.
    buildUrl: (id) =>
      id.transactionNumber
        ? `https://transactioninfo.ethiotelecom.et/receipt/view?transactionno=${encodeURIComponent(id.transactionNumber)}`
        : null,
    // Observed literal on their error page: "This request is not correctttttt"
    notFoundMarkers: ['this request is not correct'],
    // Telebirr was observed answering in ~1.4s, but it also applies its own
    // 5-request rate limit (X-RateLimit-Limit: 5) and then stops answering, so
    // give it a generous-but-bounded budget and one retry.
    // Worst case 2 x 20s; keep this in mind for user-facing timeouts.
    timeoutMs: 20000,
    retries: 1,
  },
  {
    bank: 'mpesa',
    label: 'M-Pesa Ethiopia',
    required: ['transactionNumber'],
    buildUrl: (id) =>
      id.transactionNumber
        ? `https://m-pesabusiness.safaricom.et/receipt/${encodeURIComponent(id.transactionNumber)}`
        : null,
    notFoundMarkers: ['not found', 'could not be found'],
  },
  {
    bank: 'cbebirr',
    label: 'CBE Birr',
    required: ['receiptNumber'],
    // Observed: cbepay1.cbe.com.et/aureceipt?tid=… returns HTTP 200.
    buildUrl: (id) =>
      id.receiptNumber
        ? `https://cbepay1.cbe.com.et/aureceipt?tid=${encodeURIComponent(id.receiptNumber)}`
        : null,
    // Observed literal: "<h1 style='color:red'>Invalid Access Request</h1>"
    notFoundMarkers: [],
    invalidMarkers: ['invalid access request'],
  },
  {
    bank: 'kaafiebirr',
    label: 'Kaafi eBirr',
    required: ['referenceNumber'],
    // Observed: receipt.ebirr.com/kaafimf/<token> returns HTTP 200.
    buildUrl: (id) =>
      id.referenceNumber
        ? `https://receipt.ebirr.com/kaafimf/${encodeURIComponent(id.referenceNumber)}`
        : null,
    // Observed literal: "<h1 …>Not Found Page</h1>"
    notFoundMarkers: ['not found page'],
  },
  {
    bank: 'coopayebirr',
    label: 'Coopay eBirr',
    required: ['referenceNumber'],
    buildUrl: (id) =>
      id.referenceNumber
        ? `https://receipt.ebirr.com/coopay/${encodeURIComponent(id.referenceNumber)}`
        : null,
    notFoundMarkers: ['not found page'],
  },
  {
    bank: 'siinqee',
    label: 'Siinqee Bank',
    required: ['referenceNumber'],
    buildUrl: (id) =>
      id.referenceNumber
        ? `https://receipts.siinqeebank.com/generate/${encodeURIComponent(id.referenceNumber)}`
        : null,
    notFoundMarkers: [],
    // Observed: the host serves a Vite/React shell (<div id="root">), so the
    // receipt is fetched by the page from a JSON API we have NOT confirmed.
    clientRendered: true,
  },
  {
    bank: 'awash',
    label: 'Awash Bank',
    required: ['transactionNumber', 'referenceNumber'],
    buildUrl: (id) => {
      const token = id.transactionNumber ?? id.referenceNumber;
      return token ? `https://awashpay.awashbank.com/${encodeURIComponent(token)}` : null;
    },
    notFoundMarkers: [],
    // Observed: an Angular app (vendor "Servicecops") — also client-rendered.
    clientRendered: true,
  },
];

export class HtmlReceiptAdapter implements BankAdapter {
  constructor(private readonly config: HtmlBankConfig) {}

  get bank(): BankCode {
    return this.config.bank;
  }

  canHandle(identifiers: BankIdentifiers): boolean {
    return this.config.buildUrl(identifiers) !== null;
  }

  describeMissingFields(identifiers: BankIdentifiers): string[] {
    const missing = this.config.required.filter((field) => {
      const value = identifiers[field];
      return !value || String(value).trim() === '';
    });
    return missing.map((field) => String(field));
  }

  async verify(identifiers: BankIdentifiers): Promise<BankVerificationResult> {
    const url = this.config.buildUrl(identifiers);
    if (!url) {
      return failed(
        this.bank,
        this.config.label,
        0,
        'invalid_input',
        `${this.config.label} needs: ${this.describeMissingFields(identifiers).join(', ')}.`,
        false,
      );
    }

    const started = Date.now();
    const attempts = 1 + (this.config.retries ?? 0);
    const timeoutMs = this.config.timeoutMs ?? 20000;

    let outcome;
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        outcome = await fetchBankEndpoint(url, { timeoutMs });
        lastError = undefined;
        break;
      } catch (error) {
        // Only transport failures are retried; a real HTTP answer is handled below.
        lastError = error;
      }
    }

    if (!outcome) {
      return failed(
        this.bank,
        url,
        Date.now() - started,
        'upstream_unreachable',
        `${this.config.label} could not be reached after ${attempts} attempt(s): ${(lastError as Error)?.message ?? 'unknown error'}`,
      );
    }

    const duration = Date.now() - started;
    const body = outcome.text ?? '';
    const lowered = body.toLowerCase();

    if (outcome.status === 404) {
      return notFound(this.bank, url, duration, `${this.config.label}: no matching transaction.`);
    }
    if (outcome.status >= 400) {
      return failed(
        this.bank,
        url,
        duration,
        'upstream_error',
        `${this.config.label} returned HTTP ${outcome.status}.`,
      );
    }
    if (this.config.notFoundMarkers.some((marker) => lowered.includes(marker))) {
      return notFound(this.bank, url, duration, `${this.config.label}: no matching transaction.`);
    }
    if (this.config.invalidMarkers?.some((marker) => lowered.includes(marker))) {
      return notFound(
        this.bank,
        url,
        duration,
        `${this.config.label} rejected the reference as invalid.`,
      );
    }

    if (this.config.clientRendered) {
      // Be explicit rather than pretending: the shell carries no receipt data.
      return failed(
        this.bank,
        url,
        duration,
        'endpoint_not_confirmed',
        `${this.config.label} serves a client-rendered page, so the receipt is loaded from a ` +
          `backing API that has not been confirmed. Verification for this bank is not enabled yet.`,
        false,
      );
    }

    const fields = extractReceiptFields(body, {
      transactionNumber: identifiers.transactionNumber,
      referenceNumber: identifiers.referenceNumber,
      receiptNumber: identifiers.receiptNumber,
    });

    // A page that yields neither an amount nor a party name is not a receipt.
    if (fields.amount === undefined && !fields.senderName && !fields.receiverName) {
      return notFound(
        this.bank,
        url,
        duration,
        `${this.config.label}: the page did not contain a readable receipt.`,
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
      referenceNumber: fields.referenceNumber,
      transactionNumber: fields.transactionNumber,
      receiptNumber: fields.receiptNumber,
      timestamp: parseReceiptDate(fields.dateText),
      extra: { parsedLabels: fields.all },
    });
  }
}

/** One adapter instance per HTML-based bank. */
export function createHtmlAdapters(): BankAdapter[] {
  return CONFIGS.map((config) => new HtmlReceiptAdapter(config));
}
