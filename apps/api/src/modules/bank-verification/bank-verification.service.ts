/**
 * Orchestrates bank verification.
 *
 * Responsibilities:
 *  - hold the adapter registry,
 *  - resolve which bank a request is for (explicit, or inferred from shape),
 *  - parse a pasted receipt link / SMS into bank + identifiers,
 *  - return one normalised result shape regardless of bank.
 *
 * Design note: this service never throws for an ordinary business outcome.
 * "Not found", "invalid input" and "upstream down" are all results. It only
 * throws for programming errors.
 */
import { Injectable, Logger } from '@nestjs/common';
import {
  BANK_LABELS,
  CBE_FT_REGEX,
  CBE_RECEIPT_ID_REGEX,
  canonicaliseEthiopianPhone,
  isBankCode,
} from './bank-rules';
import { findReceiptUrlInText, parseReceiptUrl } from './receipt-parser';
import type {
  BankCode,
  BankIdentifiers,
  BankVerificationResult,
  VerifyBankPaymentInput,
} from './types';
import type { BankAdapter } from './adapters/adapter.interface';
import { failed } from './adapters/adapter.interface';
import { BoaAdapter } from './adapters/boa.adapter';
import { CbeAdapter } from './adapters/cbe.adapter';
import { DashenAdapter } from './adapters/dashen.adapter';
import { createHtmlAdapters } from './adapters/generic-receipt.adapter';

/** A guess at which bank an identifier belongs to. */
export interface BankInference {
  bank: BankCode;
  confidence: number;
  /** True when more than one bank matched equally — caller must ask. */
  ambiguous: boolean;
  candidates: BankCode[];
}

@Injectable()
export class BankVerificationService {
  private readonly logger = new Logger(BankVerificationService.name);
  private readonly adapters = new Map<BankCode, BankAdapter>();

  constructor() {
    this.register(new CbeAdapter());
    this.register(new BoaAdapter());
    this.register(new DashenAdapter());
    for (const adapter of createHtmlAdapters()) this.register(adapter);
  }

  private register(adapter: BankAdapter): void {
    this.adapters.set(adapter.bank, adapter);
  }

  /** Banks this module can actually attempt right now. */
  supportedBanks(): BankCode[] {
    return [...this.adapters.keys()];
  }

  /**
   * Parse a pasted receipt link or SMS into bank + identifiers.
   * Returns null when nothing recognisable is found.
   */
  parseInput(rawInput: string): {
    bank: BankCode;
    identifiers: BankIdentifiers;
    confidence: number;
    normalizedUrl: string;
    matchedBy: 'rule' | 'host-only';
  } | null {
    const url = findReceiptUrlInText(rawInput);
    const parsed = parseReceiptUrl(url ?? rawInput);
    if (!parsed) return null;
    return {
      bank: parsed.bank,
      identifiers: this.applyPhoneCanonicalisation(parsed.identifiers),
      confidence: parsed.confidence,
      normalizedUrl: parsed.normalizedUrl,
      matchedBy: parsed.matchedBy,
    };
  }

  /**
   * Infer the bank from identifier shapes when the caller did not say.
   * Ambiguity is reported rather than silently resolved.
   */
  inferBank(identifiers: BankIdentifiers): BankInference | null {
    // Two tiers on purpose. A bank with an exact reference shape (Dashen,
    // Siinqee, CBE/BOA) is a far stronger signal than the eBirr wallets, whose
    // patterns are catch-alls that match almost any alphanumeric string. Left
    // in one pool, a perfectly valid Dashen reference came back "could belong
    // to Dashen, Kaafi eBirr or Coopay eBirr" and the lookup refused to run.
    // A specific match now wins outright; the catch-alls only apply when
    // nothing more specific matched.
    const specific: BankCode[] = [];
    const generic: BankCode[] = [];
    const ref = identifiers.referenceNumber?.trim();
    const receipt = identifiers.receiptNumber?.trim();
    const txn = identifiers.transactionNumber?.trim();
    const suffix = identifiers.accountSuffix?.trim();

    if (receipt && CBE_RECEIPT_ID_REGEX.test(receipt)) {
      specific.push('cbe');
    }
    if (ref && CBE_FT_REGEX.test(ref)) {
      // An FT reference with a 5-digit suffix is Bank of Abyssinia; 8 digits is CBE.
      // With no suffix the shape is genuinely shared — both are offered and the
      // caller is asked, which is what the bank dropdown exists for.
      if (suffix && /^\d{5}$/.test(suffix)) specific.push('boa');
      else if (suffix && /^\d{8}$/.test(suffix)) specific.push('cbe');
      else specific.push('cbe', 'boa');
    }
    if (txn && /^[A-Za-z0-9]{10}$/.test(txn)) {
      // Telebirr and M-Pesa issue the same 10-character shape.
      specific.push('telebirr', 'mpesa');
    }
    // Exactly 3 digits + 13 alphanumerics: distinctive to Dashen.
    if (ref && /^\d{3}[A-Za-z0-9]{13}$/.test(ref)) specific.push('dashen');
    if (ref && /^E[A-Za-z0-9]{11,63}$/i.test(ref)) specific.push('siinqee');

    // eBirr wallets share a host and their references are near-indistinguishable
    // by shape. Coopay is the 16+ character form; Kaafi is the shorter mixed
    // alphanumeric form. Splitting on length keeps the common case unambiguous
    // instead of always asking the caller.
    if (ref && /^[A-Za-z0-9_-]{16,64}$/.test(ref) && /[A-Za-z]/.test(ref)) {
      generic.push('coopayebirr');
    }
    if (ref && /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9_-]{10,15}$/.test(ref)) {
      generic.push('kaafiebirr');
    }

    const unique = [...new Set(specific.length > 0 ? specific : generic)];
    if (unique.length === 0) return null;

    return {
      bank: unique[0],
      confidence: unique.length === 1 ? 0.9 : 0.5,
      ambiguous: unique.length > 1,
      candidates: unique,
    };
  }

  /**
   * Verify a payment.
   *
   * Resolution order:
   *   1. an explicit `bank`,
   *   2. a parsed receipt link / SMS in `rawInput`,
   *   3. inference from the identifier shapes.
   */
  async verify(input: VerifyBankPaymentInput): Promise<BankVerificationResult> {
    let bank: BankCode | undefined = input.bank;
    let identifiers: BankIdentifiers = this.applyPhoneCanonicalisation(input.identifiers ?? {});

    // A pasted link or SMS can supply both the bank and the identifiers.
    if (input.rawInput) {
      const parsed = this.parseInput(input.rawInput);
      if (parsed) {
        bank = bank ?? parsed.bank;
        identifiers = { ...parsed.identifiers, ...identifiers };
      } else if (!bank) {
        return failed(
          'cbe',
          'router',
          0,
          'unrecognised_input',
          'That link or message was not recognised as a receipt from a supported provider.',
          false,
        );
      }
    }

    if (!bank) {
      const inference = this.inferBank(identifiers);
      if (!inference) {
        return failed(
          'cbe',
          'router',
          0,
          'unrecognised_input',
          'Could not tell which provider this reference belongs to. Please specify the bank.',
          false,
        );
      }
      if (inference.ambiguous) {
        const names = inference.candidates.map((code) => BANK_LABELS[code]).join(' or ');
        return failed(
          inference.bank,
          'router',
          0,
          'ambiguous_bank',
          `That reference could belong to ${names}. Please specify the provider.`,
          false,
        );
      }
      bank = inference.bank;
    }

    const adapter = this.adapters.get(bank);
    if (!adapter) {
      return failed(
        bank,
        'router',
        0,
        'bank_not_supported',
        `Verification is not enabled for ${BANK_LABELS[bank] ?? bank} yet.`,
        false,
      );
    }

    if (!adapter.canHandle(identifiers)) {
      return failed(
        bank,
        bank,
        0,
        'invalid_input',
        `${BANK_LABELS[bank]}: ${adapter.describeMissingFields(identifiers).join('; ')}.`,
        false,
      );
    }

    this.logger.log(`Verifying ${BANK_LABELS[bank]} payment`);
    return adapter.verify(identifiers);
  }

  /** Wallets take the local 0XXXXXXXXX form; normalise once, centrally. */
  private applyPhoneCanonicalisation(identifiers: BankIdentifiers): BankIdentifiers {
    if (!identifiers.phone) return identifiers;
    return { ...identifiers, phone: canonicaliseEthiopianPhone(identifiers.phone) };
  }

  /** Type guard re-exported for controllers validating a `bank` query param. */
  static isBankCode(value: string): value is BankCode {
    return isBankCode(value);
  }
}
