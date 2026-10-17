/**
 * Deposit-level bridge between a stored Deposit and the multi-bank verifier.
 *
 * WHY THIS IS A SEPARATE SERVICE
 * ------------------------------
 * `BankVerificationService` is deliberately pure: it takes identifiers, calls a
 * bank, returns a normalised result, and writes nothing. That purity is what
 * makes it testable and what keeps it safe to call from anywhere.
 *
 * This service is the only place that touches the database. Keeping the write
 * path in its own file means:
 *   - the verifier can never accidentally mutate a deposit,
 *   - `CbeVerificationService` (the user's proven, working path) is not edited,
 *   - `DepositsService` is not edited,
 *   - the whole feature can be removed by deleting this file plus its route.
 *
 * NO SCHEMA CHANGE
 * ----------------
 * Results are stored in the existing `Deposit.cbeVerificationData Json?` column,
 * in a shape that is a superset of what `CbeTransactionData` already describes
 * (same core keys, plus additive `provider*` metadata). No Prisma migration is
 * required, so deploying this cannot break an existing database.
 *
 * SAFETY MODEL — mirrors the proven CBE rules exactly
 * ---------------------------------------------------
 *   1. Amount must match the recorded deposit amount (when both are known).
 *   2. The receiver account must belong to the group (when both are known).
 *   3. The reference must not already be verified on a DIFFERENT deposit.
 * Only when all three hold does the deposit flip to VERIFIED. Anything else is
 * recorded for admin review and left PENDING — never auto-rejected, because a
 * wrong rejection is as damaging as a wrong approval.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BANK_LABELS, CBE_FT_REGEX, CBE_RECEIPT_ID_REGEX } from './bank-rules';
import { BankVerificationService } from './bank-verification.service';
import type {
  BankCode,
  BankIdentifiers,
  BankVerificationResult,
} from './types';

/** Why an auto-verification did not approve the deposit. */
export type AutoVerifyReason =
  | 'verified'
  | 'already_decided'
  | 'no_reference'
  | 'bank_unresolved'
  | 'bank_not_supported'
  | 'invalid_input'
  | 'not_found'
  | 'upstream_failed'
  | 'amount_mismatch'
  | 'receiver_mismatch'
  | 'duplicate_reference';

export interface AutoVerifyOutcome {
  /** True only when the deposit was flipped to VERIFIED by this call. */
  verified: boolean;
  reason: AutoVerifyReason;
  message: string;
  bank?: BankCode;
  /** The raw normalised answer from the bank, for support and audit. */
  result?: BankVerificationResult;
  checks?: {
    amountMatched?: boolean;
    receiverMatched?: boolean;
    duplicateReference?: boolean;
  };
  /** Deposit status after the call. */
  verificationStatus?: string;
}

export interface AutoVerifyOptions {
  /** Force a provider instead of deriving it from the deposit. */
  bank?: BankCode;
  /**
   * The receiver account to resolve against. Used for CBE's FT+suffix lookup
   * and as the expected receiver for every other bank. Falls back to the
   * deposit's recorded receiver, then the group's configured accounts.
   */
  accountNumber?: string;
}

/**
 * Drop `undefined` keys so the value is safe to write into a Prisma `Json`
 * column. Prisma accepts `null` but rejects `undefined` inside a JSON object,
 * and every optional receipt field can legitimately be missing.
 */
function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Free-text bank names seen in `Deposit.bankName` → our codes. */
const BANK_NAME_HINTS: Array<[RegExp, BankCode]> = [
  [/^cbe\s*birr$|^cbebirr$/i, 'cbebirr'],
  [/^telebirr$|ethio\s*telecom|ethiotelecom/i, 'telebirr'],
  [/^m[-\s]?pesa/i, 'mpesa'],
  [/kaafi/i, 'kaafiebirr'],
  [/coopay/i, 'coopayebirr'],
  [/siinqee/i, 'siinqee'],
  [/awash/i, 'awash'],
  [/dashen/i, 'dashen'],
  [/abyssinia|^boa$/i, 'boa'],
  // Checked last: "CBE" also prefixes "CBE Birr", which is handled above.
  [/^cbe$|commercial\s*bank/i, 'cbe'],
];

@Injectable()
export class DepositVerificationService {
  private readonly logger = new Logger(DepositVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly verification: BankVerificationService,
  ) {}

  /**
   * Verify one deposit against its bank, and approve it only when every
   * cross-check passes.
   *
   * Business outcomes are returned, not thrown. Only a missing deposit throws
   * (a genuine 404). This keeps batch callers resilient: one unreachable bank
   * must not abort a run of fifty deposits.
   */
  async autoVerifyWithProvider(
    depositId: string,
    adminId: string,
    options: AutoVerifyOptions = {},
  ): Promise<AutoVerifyOutcome> {
    const deposit = await this.prisma.deposit.findUnique({
      where: { id: depositId },
      include: {
        cycle: { include: { group: true } },
        user: { select: { id: true, name: true, phone: true } },
      },
    });

    if (!deposit) {
      throw new NotFoundException(`Deposit with ID ${depositId} not found`);
    }

    if (deposit.verificationStatus !== 'PENDING') {
      return {
        verified: false,
        reason: 'already_decided',
        message: `Deposit is already ${deposit.verificationStatus.toLowerCase()}.`,
        verificationStatus: deposit.verificationStatus,
      };
    }

    const reference = deposit.ftNumber?.trim();
    if (!reference) {
      return {
        verified: false,
        reason: 'no_reference',
        message:
          'This deposit has no reference number, so it cannot be checked against a bank.',
        verificationStatus: deposit.verificationStatus,
      };
    }

    const group = deposit.cycle.group;
    const expectedAccount = this.resolveExpectedAccount(deposit, options, group);

    // ── Which bank? ────────────────────────────────────────────────────────
    const bank = options.bank ?? this.bankFromName(deposit.bankName) ?? undefined;
    const identifiers = bank
      ? this.buildIdentifiers(bank, reference, expectedAccount)
      : { referenceNumber: reference };

    const resolvedBank =
      bank ??
      this.verification.parseInput(reference)?.bank ??
      this.verification.inferBank(identifiers)?.bank;

    if (!resolvedBank) {
      return {
        verified: false,
        reason: 'bank_unresolved',
        message:
          'Could not tell which bank this reference belongs to. Set the bank on the deposit, or pass it explicitly.',
        verificationStatus: deposit.verificationStatus,
      };
    }

    const finalIdentifiers =
      bank === resolvedBank
        ? identifiers
        : this.buildIdentifiers(resolvedBank, reference, expectedAccount);

    // ── Ask the bank ───────────────────────────────────────────────────────
    this.logger.log(
      `Auto-verifying deposit ${depositId} against ${BANK_LABELS[resolvedBank] ?? resolvedBank}`,
    );

    const result = await this.verification.verify({
      bank: resolvedBank,
      identifiers: finalIdentifiers,
    });

    if (result.status === 'failed') {
      // Transport / configuration problem. Nothing is decided; the deposit
      // stays PENDING and the caller can retry.
      await this.recordAttempt(depositId, resolvedBank, result, {}, deposit.cbeVerificationData);
      return {
        verified: false,
        reason: this.failureReason(result),
        message: result.error?.message ?? 'The bank could not be reached.',
        bank: resolvedBank,
        result,
        verificationStatus: deposit.verificationStatus,
      };
    }

    if (result.status === 'not_found' || !result.verified) {
      await this.recordAttempt(depositId, resolvedBank, result, {}, deposit.cbeVerificationData);
      return {
        verified: false,
        reason: 'not_found',
        message:
          result.error?.message ??
          'The bank has no transaction with that reference.',
        bank: resolvedBank,
        result,
        verificationStatus: deposit.verificationStatus,
      };
    }

    // ── Cross-checks ───────────────────────────────────────────────────────
    // Same rule the proven CBE path uses: compare against the amount actually
    // recorded on the deposit (which already reflects the member's share
    // multiplier), not the group's base contribution.
    const amountMatched =
      result.amount !== undefined && deposit.amount != null
        ? Math.abs(result.amount - deposit.amount) < 0.01
        : true;

    const receiverMatched = this.receiverMatches(
      result.receiverAccount,
      expectedAccount,
    );

    const duplicateReference = await this.isReferenceAlreadyUsed(
      depositId,
      result,
    );

    const checks = { amountMatched, receiverMatched, duplicateReference };
    const shouldApprove = amountMatched && receiverMatched && !duplicateReference;

    await this.persistVerification(depositId, adminId, resolvedBank, result, checks, shouldApprove, deposit);

    if (!shouldApprove) {
      const reason: AutoVerifyReason = duplicateReference
        ? 'duplicate_reference'
        : !amountMatched
          ? 'amount_mismatch'
          : 'receiver_mismatch';

      return {
        verified: false,
        reason,
        message: this.mismatchMessage(reason, result, deposit, expectedAccount),
        bank: resolvedBank,
        result,
        checks,
        verificationStatus: deposit.verificationStatus,
      };
    }

    return {
      verified: true,
      reason: 'verified',
      message: `${BANK_LABELS[resolvedBank] ?? resolvedBank} confirmed this transaction and it was auto-approved.`,
      bank: resolvedBank,
      result,
      checks,
      verificationStatus: 'VERIFIED',
    };
  }

  // ─── helpers ─────────────────────────────────────────────────────────────

  /**
   * The account we expect the money to have landed in.
   * Caller override → deposit's own receiver → the group's configured accounts.
   */
  private resolveExpectedAccount(
    deposit: { receiverAccount: string | null },
    options: AutoVerifyOptions,
    group: { bankAccount: string | null; cbeAccountNumbers: string[] },
  ): string | undefined {
    const candidates = [
      options.accountNumber,
      deposit.receiverAccount ?? undefined,
      ...(group.cbeAccountNumbers ?? []),
      group.bankAccount ?? undefined,
    ];
    return candidates.find((value) => !!value && String(value).trim() !== '');
  }

  /** Map the deposit's free-text bank name onto a code we support. */
  private bankFromName(name?: string | null): BankCode | null {
    const value = name?.trim();
    if (!value) return null;
    for (const [pattern, code] of BANK_NAME_HINTS) {
      if (pattern.test(value)) return code;
    }
    return null;
  }

  /**
   * Put the stored reference into the slot the chosen adapter reads.
   * Each bank is explicit here on purpose — a wrong slot silently verifies
   * nothing, so guessing is not acceptable.
   */
  private buildIdentifiers(
    bank: BankCode,
    reference: string,
    expectedAccount?: string,
  ): BankIdentifiers {
    const ref = reference.trim();

    switch (bank) {
      case 'cbe':
        if (CBE_FT_REGEX.test(ref)) {
          // Legacy path needs the last 8 digits of the receiving account.
          const digits = expectedAccount?.replace(/\D/g, '') ?? '';
          return {
            referenceNumber: ref,
            accountSuffix: digits.length >= 8 ? digits.slice(-8) : undefined,
          };
        }
        if (CBE_RECEIPT_ID_REGEX.test(ref)) {
          return { receiptNumber: ref };
        }
        // Unknown shape — hand it over and let the adapter report why.
        return { referenceNumber: ref, receiptNumber: ref };

      case 'boa': {
        // BOA prints exactly 5 digits of the account on the receipt.
        const digits = expectedAccount?.replace(/\D/g, '') ?? '';
        return {
          referenceNumber: ref,
          accountSuffix: digits.length >= 5 ? digits.slice(-5) : undefined,
        };
      }

      case 'dashen':
      case 'siinqee':
      case 'kaafiebirr':
      case 'coopayebirr':
        return { referenceNumber: ref };

      case 'telebirr':
      case 'mpesa':
      case 'awash':
        return { transactionNumber: ref, referenceNumber: ref };

      case 'cbebirr':
        return { receiptNumber: ref };

      default:
        return { referenceNumber: ref };
    }
  }

  /**
   * Compare the receiver account printed on the receipt with the account we
   * expected the money in.
   *
   * Receipts mask the middle of the account ("5082******011"), so the visible
   * digits are a PREFIX and a SUFFIX of the real number — never a contiguous
   * substring. A naive `includes()` therefore rejects every genuine masked
   * receipt, which is the worst possible error here (a paying member marked
   * unpaid). We match the head against the start and the tail against the end.
   *
   * Anything unreadable is treated as "cannot judge" (true) rather than a
   * mismatch: refusing to approve is decided by the caller, not by a guess.
   */
  private receiverMatches(
    receiptAccount?: string,
    expectedAccount?: string,
  ): boolean {
    if (!receiptAccount || !expectedAccount) return true;

    // Keep digits and mask markers; normalise the common mask characters.
    const receiptDigits = receiptAccount
      .replace(/[xX•·]/g, '*')
      .replace(/[^0-9*]/g, '');
    const expectedDigits = expectedAccount.replace(/[^0-9]/g, '');

    if (expectedDigits.length < 4) return true;

    if (receiptDigits.includes('*')) {
      const parts = receiptDigits.split(/\*+/);
      const head = parts[0] ?? '';
      const tail = parts.length > 1 ? parts[parts.length - 1] : '';

      // Nothing readable at all — do not judge.
      if (head.length < 4 && tail.length < 3) return true;

      const headOk = head.length < 4 ? true : expectedDigits.startsWith(head);
      const tailOk = tail.length < 3 ? true : expectedDigits.endsWith(tail);
      return headOk && tailOk;
    }

    if (receiptDigits.length < 4) return true;
    return (
      expectedDigits.includes(receiptDigits) ||
      receiptDigits.includes(expectedDigits)
    );
  }

  /**
   * A reference that already sits on another VERIFIED deposit means the same
   * receipt is being claimed twice. `ftNumber` is unique at the database level,
   * so this catches the remaining case: the deposit stores one form of the
   * reference (e.g. a Receipt ID) while the bank returns another (the FT ref).
   */
  private async isReferenceAlreadyUsed(
    depositId: string,
    result: BankVerificationResult,
  ): Promise<boolean> {
    const references = [
      result.referenceNumber,
      result.transactionNumber,
      result.receiptNumber,
    ]
      .map((value) => value?.trim())
      .filter((value): value is string => !!value);

    if (references.length === 0) return false;

    const clash = await this.prisma.deposit.findFirst({
      where: {
        id: { not: depositId },
        verificationStatus: 'VERIFIED',
        OR: references.flatMap((value) => [
          { ftNumber: value },
          { ftNumber: value.toUpperCase() },
        ]),
      },
      select: { id: true },
    });

    return !!clash;
  }

  /**
   * Store the bank's answer even when nothing is approved, for admin review.
   *
   * Refuses to overwrite a verification that already SUCCEEDED. The proven
   * `CbeVerificationService` writes real CBE data into this same column; a
   * later failed multi-bank attempt (a timeout, a mistyped reference) must not
   * erase that evidence.
   */
  private async recordAttempt(
    depositId: string,
    bank: BankCode,
    result: BankVerificationResult,
    checks: AutoVerifyOutcome['checks'],
    existing?: Prisma.JsonValue | null,
  ): Promise<void> {
    if (this.hasSuccessfulVerification(existing)) {
      this.logger.log(
        `Deposit ${depositId} already holds a successful verification; attempt not stored.`,
      );
      return;
    }

    await this.prisma.deposit
      .update({
        where: { id: depositId },
        data: {
          cbeVerificationData: this.serialise(bank, result, checks, false) as Prisma.InputJsonValue,
        },
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `Could not store verification attempt for deposit ${depositId}: ${String(error)}`,
        );
      });
  }

  /**
   * True when the stored blob already describes a successful verification.
   * Recognises both shapes: ours (`providerStatus: 'success'`) and the proven
   * CBE service's (`success: true`).
   */
  private hasSuccessfulVerification(data?: Prisma.JsonValue | null): boolean {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    const record = data as Record<string, unknown>;
    return record.providerStatus === 'success' || record.success === true;
  }

  /**
   * Persist the result and — only when every check passed — approve the deposit.
   * Missing fields are backfilled exactly like the proven CBE path does, so
   * payer-pairing and the self-learning alias system keep working.
   */
  private async persistVerification(
    depositId: string,
    adminId: string,
    bank: BankCode,
    result: BankVerificationResult,
    checks: NonNullable<AutoVerifyOutcome['checks']>,
    approve: boolean,
    deposit: {
      amount: number | null;
      depositDate: Date | null;
      senderName: string | null;
      senderAccount: string | null;
      receiverAccount: string | null;
      branch: string | null;
      cbeVerificationData?: Prisma.JsonValue | null;
    },
  ): Promise<void> {
    const depositDate = result.timestamp ? new Date(result.timestamp) : undefined;
    const hasValidDate = !!depositDate && !Number.isNaN(depositDate.getTime());

    // Never let a rejected attempt overwrite evidence of a prior success.
    const keepExisting =
      !approve && this.hasSuccessfulVerification(deposit.cbeVerificationData);

    await this.prisma.deposit.update({
      where: { id: depositId },
      data: {
        ...(keepExisting
          ? {}
          : {
              cbeVerificationData: this.serialise(
                bank,
                result,
                checks,
                approve,
              ) as Prisma.InputJsonValue,
            }),
        ...(result.amount !== undefined && deposit.amount == null && { amount: result.amount }),
        ...(hasValidDate && !deposit.depositDate && { depositDate }),
        ...(result.senderName && !deposit.senderName && { senderName: result.senderName }),
        ...(result.senderAccount && !deposit.senderAccount && {
          senderAccount: result.senderAccount,
        }),
        ...(result.receiverAccount && !deposit.receiverAccount && {
          receiverAccount: result.receiverAccount,
        }),
        ...(result.extra?.branch && !deposit.branch
          ? { branch: String(result.extra.branch) }
          : {}),
        ...(approve && {
          verificationStatus: 'VERIFIED' as const,
          verifiedById: adminId,
          autoVerified: true,
        }),
      },
    });
  }

  /**
   * Build the stored blob.
   *
   * The core keys deliberately mirror `CbeTransactionData`, so anything that
   * already reads `cbeVerificationData` keeps working unchanged. Provider
   * metadata is additive.
   */
  private serialise(
    bank: BankCode,
    result: BankVerificationResult,
    checks: AutoVerifyOutcome['checks'],
    approved: boolean,
  ): Record<string, unknown> {
    return jsonSafe({
      // ── CBE-compatible core ──
      ftNumber: result.referenceNumber ?? result.transactionNumber ?? result.receiptNumber,
      amount: result.amount,
      payer: result.senderName,
      payerAccount: result.senderAccount,
      receiver: result.receiverName,
      receiverAccount: result.receiverAccount,
      date: result.timestamp,
      reference: result.referenceNumber ?? result.receiptNumber ?? result.transactionNumber,
      branch: result.extra?.branch,
      // ── provider metadata (additive) ──
      provider: bank,
      providerLabel: BANK_LABELS[bank] ?? bank,
      providerStatus: result.status,
      providerSource: result.source,
      providerDurationMs: result.durationMs,
      providerExtra: result.extra,
      checks: checks ?? {},
      approved,
      verifiedAt: new Date().toISOString(),
    });
  }

  private failureReason(result: BankVerificationResult): AutoVerifyReason {
    switch (result.error?.code) {
      case 'invalid_input':
        return 'invalid_input';
      case 'bank_not_supported':
        return 'bank_not_supported';
      case 'endpoint_not_confirmed':
        return 'bank_not_supported';
      default:
        return 'upstream_failed';
    }
  }

  private mismatchMessage(
    reason: AutoVerifyReason,
    result: BankVerificationResult,
    deposit: { amount: number | null },
    expectedAccount?: string,
  ): string {
    const label = BANK_LABELS[result.bank] ?? result.bank;
    switch (reason) {
      case 'duplicate_reference':
        return `${label} confirmed the transaction, but this reference is already verified on another deposit. Left pending for review.`;
      case 'amount_mismatch':
        return `${label} shows ETB ${result.amount ?? '—'} but the deposit records ETB ${deposit.amount ?? '—'}. Left pending for review.`;
      case 'receiver_mismatch':
        return `${label} shows the money went to ${result.receiverAccount ?? 'an unreadable account'}, not to ${expectedAccount ?? 'the group account'}. Left pending for review.`;
      default:
        return 'The transaction was found but did not pass the automatic checks.';
    }
  }
}
