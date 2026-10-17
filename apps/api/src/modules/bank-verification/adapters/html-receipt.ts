/**
 * Field extraction from a bank's HTML receipt page.
 *
 * Most Ethiopian receipt pages are server-rendered HTML with the same handful
 * of labels ("Amount", "Payer", "Receiver", "Transaction Number", …). Rather
 * than one bespoke parser per bank, this reads a label/value pair by trying a
 * list of label spellings, which is what makes the config-driven adapter work.
 */

export interface HtmlReceiptFields {
  amount?: number;
  senderName?: string;
  senderAccount?: string;
  receiverName?: string;
  receiverAccount?: string;
  referenceNumber?: string;
  transactionNumber?: string;
  receiptNumber?: string;
  dateText?: string;
  /** Every label/value pair we could see — useful when debugging a new bank. */
  all: Record<string, string>;
}

/** Strip markup and collapse whitespace so label regexes can run. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/[\s\S]*?>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(tr|div|p|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Read the value that follows a label.
 *
 * Receipts come in two layouts:
 *   - label: value        (e.g. "Sender Name: Adane Abeje")
 *   - label  value        (an HTML table flattened to spaces, e.g. Dashen's)
 *
 * So we do NOT require a colon. Instead we take everything after the label up
 * to the earliest position where another known label starts. That is what makes
 * one parser work for both layouts.
 */
function readLabel(
  text: string,
  labels: readonly string[],
  stopLabels: readonly string[],
): string | undefined {
  const escape = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Longest-first so "Sender Account Number" wins over "Sender Account".
  const stops = [...stopLabels].sort((a, b) => b.length - a.length).map(escape);

  for (const label of labels) {
    const found = new RegExp(`${escape(label)}\\s*[:\\-]?\\s*`, 'i').exec(text);
    if (!found) continue;

    const rest = text.slice(found.index + found[0].length);
    let end = rest.length;

    // Cut at the nearest following label. `rest` starts AFTER the current
    // label, so the label cannot match itself here.
    for (const stop of stops) {
      const next = new RegExp(`\\s${stop}\\s*[:\\-]?\\s`, 'i').exec(rest);
      if (next && next.index < end) end = next.index;
    }

    const value = rest.slice(0, end).trim().replace(/[:\\-]+$/, '').trim();
    if (value.length > 0 && value.length < 200) return value;
  }
  return undefined;
}

/** Parse "1,500.00" / "ETB 1500" / "1500.00 Birr" into a number. */
export function parseAmount(raw?: string): number | undefined {
  if (!raw) return undefined;
  const match = raw.replace(/,/g, '').match(/-?\d+(?:\.\d{1,2})?/);
  if (!match) return undefined;
  const value = Number.parseFloat(match[0]);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * Normalise an account number as printed.
 *
 * Banks mask the middle digits (e.g. "5082******011"). We deliberately KEEP the
 * mask: stripping non-digits would turn it into "5082011", which looks like a
 * real 7-digit account and is actively misleading. Callers that need to compare
 * accounts should use `visibleAccountDigits()`.
 */
export function normalizeAccountNumber(raw?: string): string | undefined {
  if (!raw) return undefined;
  const value = raw.trim().replace(/\s+/g, '');
  if (!value || value.length > 64) return undefined;
  return value;
}

/** Just the visible digits of a (possibly masked) account, for comparison. */
export function visibleAccountDigits(raw?: string): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, '');
  return digits.length > 0 ? digits : undefined;
}

const ALL_LABELS = [
  'Transaction Number',
  'Transaction No',
  'Transaction ID',
  'Trx No',
  'Transaction Reference',
  'Transfer Reference',
  'Reference Number',
  'Reference No',
  'Reference',
  'Receipt Number',
  'Receipt No',
  'Voucher Number',
  'Transaction Amount',
  'Amount in words',
  'Amount in Word',
  'Total Amount',
  'Total',
  'Amount',
  'Transferred Amount',
  'Payer Name',
  'Payer',
  'Sender Name',
  'Sender',
  'Customer Name',
  'Receiver Name',
  'Receiver',
  'Beneficiary Name',
  'Beneficiary',
  'Credited Party',
  'Payer Account',
  'Sender Account Number',
  'Sender Account',
  'Receiver Account Number',
  'Receiver Account',
  'Beneficiary Account',
  'Credited Account',
  'Account Number',
  'Service Type',
  'Transaction Channel',
  'Narrative',
  'Beneficiary Bank Name',
  'Institution Name',
  'Date',
  'Transaction Date',
  'Payment Date',
  'Time',
  'Status',
  // Footer markers. Without these, a trailing "Amount in words" field swallows
  // the whole receipt footer (observed on a real Dashen receipt).
  'Terms & Conditions',
  'Terms and Conditions',
  'Support',
  'Download Receipt',
  'Always One Step Ahead',
] as const;

/**
 * Extract normalised fields from a receipt page.
 * `overrides` lets a bank-specific adapter seed values it already knows
 * (e.g. the reference the user supplied), which also acts as a fallback.
 */
export function extractReceiptFields(
  html: string,
  overrides: Partial<HtmlReceiptFields> = {},
): HtmlReceiptFields {
  const text = htmlToText(html);
  const stops = [...ALL_LABELS];

  const fields: HtmlReceiptFields = {
    amount: parseAmount(
      readLabel(
        text,
        ['Transaction Amount', 'Transferred Amount', 'Total Amount', 'Total', 'Amount'],
        stops,
      ),
    ),
    senderName: readLabel(
      text,
      ['Sender Name', 'Payer Name', 'Payer', 'Sender', 'Customer Name'],
      stops,
    ),
    senderAccount: normalizeAccountNumber(
      readLabel(
        text,
        ['Sender Account Number', 'Payer Account', 'Sender Account', 'Account Number'],
        stops,
      ),
    ),
    receiverName: readLabel(
      text,
      ['Receiver Name', 'Beneficiary Name', 'Receiver', 'Beneficiary', 'Credited Party'],
      stops,
    ),
    receiverAccount: normalizeAccountNumber(
      readLabel(
        text,
        [
          'Receiver Account Number',
          'Beneficiary Account',
          'Receiver Account',
          'Credited Account',
          'Account Number',
        ],
        stops,
      ),
    ),
    referenceNumber: readLabel(
      text,
      ['Transaction Reference', 'Reference Number', 'Reference No', 'Reference'],
      stops,
    ),
    transactionNumber: readLabel(
      text,
      ['Transaction Number', 'Transaction No', 'Transaction ID', 'Trx No'],
      stops,
    ),
    receiptNumber: readLabel(
      text,
      ['Receipt Number', 'Receipt No', 'Voucher Number'],
      stops,
    ),
    dateText: readLabel(
      text,
      ['Transaction Date', 'Payment Date', 'Date'],
      stops,
    ),
    all: {},
  };

  // Record everything we saw, for debugging a newly added bank.
  for (const label of ALL_LABELS) {
    const value = readLabel(text, [label], stops);
    if (value) fields.all[label] = value;
  }

  return { ...fields, ...overrides, all: fields.all };
}

/**
 * Best-effort date parse. Ethiopian receipt pages use several formats, so we
 * try the platform parser first and only then fall back to DD/MM/YYYY.
 */
export function parseReceiptDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString();

  const parts = raw.replace(/,/g, ' ').trim().match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (!parts) return undefined;
  const [, first, second, year] = parts;
  const candidate = new Date(
    `${year}-${second.padStart(2, '0')}-${first.padStart(2, '0')}T00:00:00Z`,
  );
  return Number.isNaN(candidate.getTime()) ? undefined : candidate.toISOString();
}
