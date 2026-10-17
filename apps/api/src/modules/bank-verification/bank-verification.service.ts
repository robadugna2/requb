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
    const candidates: BankCode[] = [];
    const ref = identifiers.referenceNumber?.trim();
    const receipt = identifiers.receiptNumber?.trim();
    const txn = identifiers.transactionNumber?.trim();
    const suffix = identifiers.accountSuffix?.trim();

    if (receipt && CBE_RECEIPT_ID_REGEX.test(receipt)) {
      candidates.push('cbe');
    }
    if (ref && CBE_FT_REGEX.test(ref)) {
      // An FT reference with a 5-digit suffix is Bank of Abyssinia; 8 digits is CBE.
      if (suffix && /^\d{5}$/.test(suffix)) candidates.push('boa');
      else if (suffix && /^\d{8}$/.test(suffix)) candidates.push('cbe');
      else {
        candidates.push('cbe', 'boa');
      }
    }
    if (txn && /^[A-Za-z0-9]{10}$/.test(txn)) {
      candidates.push('telebirr', 'mpesa');
    }
    if (ref && /^\d{3}[A-Za-z0-9]{13}$/.test(ref)) candidates.push('dashen');
    if (ref && /^E[A-Za-z0-9]{11,63}$/i.test(ref)) candidates.push('siinqee');
    if (ref && /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9_-]{10,64}$/.test(ref)) {
      candidates.push('kaafiebirr');
    }
    if (ref && /^[A-Za-z0-9_-]{16,64}$/.test(ref)) candidates.push('coopayebirr');

    const unique = [...new Set(candidates)];
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
