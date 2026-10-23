/**
 * Commercial Bank of Ethiopia.
 *
 * Two distinct identifiers, two distinct endpoints (both observed live):
 *
 *  - Legacy FT reference -> https://apps.cbe.com.et:100/?id={FT}{last8OfAccount}
 *    Returns a PDF VAT invoice. 404 when the transaction does not exist.
 *    The account suffix is the last 8 digits of the receiving account.
 *
 *  - Modern "Receipt ID"  -> https://mbreciept.cbe.com.et/{receiptId}
 *    Returns an HTML receipt page, no account suffix required.
 *
 * This mirrors the logic already proven in the existing
 * CbeVerificationService, generalised to also accept a Receipt ID.
 */
import * as pdfParse from 'pdf-parse';
import { CBE_FT_REGEX, CBE_RECEIPT_ID_REGEX } from '../bank-rules';
import type { BankIdentifiers, BankVerificationResult } from '../types';
import { buildResult, failed, notFound, type BankAdapter } from './adapter.interface';
import { fetchBankEndpoint } from './http';

const CBE_DIRECT_HOST = 'https://apps.cbe.com.et:100/';
const CBE_RECEIPT_HOST = 'https://mbreciept.cbe.com.et';

export class CbeAdapter implements BankAdapter {
  readonly bank = 'cbe' as const;

  canHandle(identifiers: BankIdentifiers): boolean {
    return this.resolveMode(identifiers) !== null;
  }

  describeMissingFields(identifiers: BankIdentifiers): string[] {
    const missing: string[] = [];
    const hasReceiptId =
      !!identifiers.receiptNumber && CBE_RECEIPT_ID_REGEX.test(identifiers.receiptNumber);
    const hasFt =
      !!identifiers.referenceNumber && CBE_FT_REGEX.test(identifiers.referenceNumber);

    if (!hasReceiptId && !hasFt) {
      missing.push(
        'reference (a CBE Receipt ID, or a legacy FT reference such as FT26079ABCDE)',
      );
    }
    if (hasFt && !identifiers.accountSuffix) {
      missing.push(
        'accountSuffix (the last 8 digits of the receiving CBE account — required for legacy FT lookups)',
      );
    }
    return missing;
  }

  private resolveMode(
    identifiers: BankIdentifiers,
  ): { mode: 'receipt-id'; value: string } | { mode: 'ft'; ft: string; suffix: string } | null {
    const receipt = identifiers.receiptNumber?.trim();
    if (receipt && CBE_RECEIPT_ID_REGEX.test(receipt)) {
      return { mode: 'receipt-id', value: receipt };
    }
    const ft = identifiers.referenceNumber?.trim().toUpperCase();
    const suffix = identifiers.accountSuffix?.trim();
    if (ft && suffix && CBE_FT_REGEX.test(ft)) {
      return { mode: 'ft', ft, suffix };
    }
    return null;
  }

  async verify(identifiers: BankIdentifiers): Promise<BankVerificationResult> {
    const mode = this.resolveMode(identifiers);
    if (!mode) {
      return failed(
        this.bank,
        'cbe',
        0,
        'invalid_input',
        `CBE needs ${this.describeMissingFields(identifiers).join(' and ')}.`,
        false,
      );
    }

    return mode.mode === 'receipt-id'
      ? this.verifyByReceiptId(mode.value)
      : this.verifyByFt(mode.ft, mode.suffix);
  }

  /** Legacy path: FT reference + account suffix -> PDF invoice. */
  private async verifyByFt(ft: string, suffix: string): Promise<BankVerificationResult> {
    const started = Date.now();
    const url = `${CBE_DIRECT_HOST}?id=${encodeURIComponent(ft + suffix)}`;

    let outcome;
    try {
      outcome = await fetchBankEndpoint(url, { asBuffer: true, timeoutMs: 20000 });
    } catch (error) {
      return failed(
        this.bank,
        url,
        Date.now() - started,
        'upstream_unreachable',
        `CBE Direct could not be reached: ${(error as Error).message}`,
      );
    }

    const duration = Date.now() - started;

    if (outcome.status === 404) {
      return notFound(this.bank, url, duration, 'No CBE transaction found for that FT reference and account.');
    }
    if (outcome.status >= 400) {
      return failed(
        this.bank,
        url,
        duration,
        'upstream_error',
        `CBE returned HTTP ${outcome.status}.`,
      );
    }

    const bytes = outcome.buffer ?? Buffer.alloc(0);
    let text: string;
    try {
      text = (await pdfParse(bytes)).text;
    } catch {
      // Some responses are plain text rather than a PDF.
      text = bytes.toString('utf8');
    }

    if (!text || text.trim().length < 20) {
      return notFound(this.bank, url, duration, 'CBE returned an empty or unreadable receipt.');
    }

    return this.parseInvoiceText(text, url, duration, { referenceNumber: ft });
  }

  /** Modern path: Receipt ID -> HTML receipt page. */
  private async verifyByReceiptId(receiptId: string): Promise<BankVerificationResult> {
    const started = Date.now();
    const url = `${CBE_RECEIPT_HOST}/${encodeURIComponent(receiptId)}`;

    let outcome;
    try {
      outcome = await fetchBankEndpoint(url, { timeoutMs: 20000 });
    } catch (error) {
      return failed(
        this.bank,
        url,
        Date.now() - started,
        'upstream_unreachable',
        `CBE receipt service could not be reached: ${(error as Error).message}`,
      );
    }

    const duration = Date.now() - started;

    if (outcome.status === 404) {
      return notFound(this.bank, url, duration, 'No CBE transaction found for that Receipt ID.');
    }
    if (outcome.status >= 400) {
      return failed(this.bank, url, duration, 'upstream_error', `CBE returned HTTP ${outcome.status}.`);
    }

    const text = this.htmlToText(outcome.text);
    if (!text || text.length < 20) {
      return notFound(this.bank, url, duration, 'CBE returned an empty or unreadable receipt.');
    }

    return this.parseInvoiceText(text, url, duration, { receiptNumber: receiptId });
  }

  /** Strip markup so the same regexes work on an HTML receipt. */
  private htmlToText(html: string): string {
    return html
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Read a CBE receipt into normalised fields.
   * Patterns are the ones proven against real CBE receipts in the existing
   * CbeVerificationService, kept deliberately tolerant of Amharic names and
   * masked account numbers.
   */
  private parseInvoiceText(
    rawText: string,
    source: string,
    durationMs: number,
    identity: { referenceNumber?: string; receiptNumber?: string },
  ): BankVerificationResult {
    const text = rawText.replace(/\s+/g, ' ').trim();

    const group = (re: RegExp): string | undefined => {
      const m = re.exec(text);
      return m?.groups?.['value']?.trim() || undefined;
    };

    const party = (label: string): string | undefined =>
      group(new RegExp(`${label}\\s*:?\\s*(?<value>.+?)\\s*(?:Account|A\\/C)`, 'i')) ??
      group(
        new RegExp(
          `${label}\\s*:?\\s+(?<value>[\\p{L}][\\p{L}.,'\\/ -]{1,60}?)\\s+(?:Transferred|Payment|Reference|Date|Amount|VSC|\\d)`,
          'iu',
        ),
      );

    const amountStr =
      group(/Transferred Amount\s+(?<value>[\d,]+\.\d{2})\s*ETB/i) ??
      group(/Amount[:\s]*(?<value>[\d,]+\.\d{2})\s*ETB/i);

    const reference =
      group(/Reference No\.?(?:\s*\([^)]+\))?[:\s]+(?<value>FT\w+)/i) ??
      identity.referenceNumber;

    const dateStr =
      group(
        /(?:Payment|Transaction|Value)\s*Date(?:\s*&\s*Time)?\s*:?\s*(?<value>[\d\/,.\s:APMapm]{6,40}?)(?=\s*(?:Reference|Reason|Transferred|VSC|Commission|Amount|Narration|$))/i,
      ) ?? group(/Date\s*:?\s*(?<value>\d{1,2}\/\d{1,2}\/\d{2,4}(?:,?\s*[\d:]{4,8}\s*[AP]M)?)/i);

    const amount = amountStr ? Number.parseFloat(amountStr.replace(/,/g, '')) : undefined;

    const parsedDate = dateStr ? this.parseCbeDate(dateStr) : undefined;

    return buildResult(this.bank, {
      status: 'success',
      source,
      durationMs,
      amount: Number.isFinite(amount) ? amount : undefined,
      currency: 'ETB',
      senderName: party('Payer') ?? party('Sender'),
      senderAccount: group(
        /(?:Payer|Sender)\s+:?.*?(?:Account|A\/C)\s*:?\s*(?<value>[\d*]+)/i,
      ),
      receiverName: party('Receiver') ?? party('Beneficiary'),
      receiverAccount: group(
        /(?:Receiver|Beneficiary)\s+:?.*?(?:Account|A\/C)\s*:?\s*(?<value>[\d*]+)/i,
      ),
      referenceNumber: reference,
      receiptNumber: identity.receiptNumber,
      timestamp: parsedDate?.toISOString(),
      extra: {
        // Kept so the admin UI can still show the receipt's raw text, which the
        // legacy CBE service exposed directly on its transaction object.
        rawText,
        branch: group(
          /Branch:(?:[^_]*_(?:[^_]*_)*)?(?<value>[A-Za-z\s]+?)(?=\s*Payment|\s*Transaction)/i,
        ),
        reason: group(
          /Reason\s*(?:\/\s*Type of service)?\s*(?<value>.+?)(?=\s*Transferred Amount)/i,
        ),
        commission: group(/Commission or Service Charge\s+(?<value>[\d,]+\.\d{2})\s*ETB/i),
        vatOnCommission: group(/15% VAT on Commission\s+(?<value>[\d,]+\.\d{2})\s*ETB/i),
        totalDebited: group(
          /Total amount debited from customers account\s+(?<value>[\d,]+\.\d{2})\s*ETB/i,
        ),
        amountInWords: group(/Amount in Word\s+(?<value>.+?)(?=\s*The Bank|\s*©|$)/i),
      },
    });
  }

  /** CBE prints DD/MM/YYYY. Never guess: fall back to a plain parse first. */
  private parseCbeDate(dateStr: string): Date | undefined {
    if (!dateStr) return undefined;
    const direct = new Date(dateStr);
    if (!Number.isNaN(direct.getTime())) return direct;

    const cleaned = dateStr.replace(/,/g, ' ').trim();
    const parts = cleaned.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!parts) return undefined;

    const [, first, second, year] = parts;
    if (Number(first) > 1900) return new Date(`${first}-${second}-${year}`);
    return new Date(`${year}-${second.padStart(2, '0')}-${first.padStart(2, '0')}`);
  }
}
