import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CbeAdapter } from '../bank-verification/adapters/cbe.adapter';
import { DepositVerificationService } from '../bank-verification/deposit-verification.service';
import { CBE_FT_REGEX, CBE_RECEIPT_ID_REGEX } from '../bank-verification/bank-rules';
import type { BankVerificationResult } from '../bank-verification/types';

/**
 * CBE verification, delegating to the multi-bank engine.
 *
 * WHY THIS IS A DELEGATE AND NOT A SECOND IMPLEMENTATION
 * ------------------------------------------------------
 * This service used to own its own CBE client: its own URL, its own PDF
 * request, its own parser. `CbeAdapter` does the same job and additionally
 * understands the modern Receipt ID, so keeping both meant two code paths
 * that could drift — and they did, several times (amount comparison against
 * the wrong field, masked receiver accounts being persisted, single-account
 * lookups failing on multi-account groups).
 *
 * There is now exactly one CBE implementation. This class exists only to keep
 * the proven public contract — `verifyByFtNumber`, `autoVerifyDeposit` and the
 * `CbeTransactionData` shape the admin UI reads — working unchanged.
 */
export interface CbeTransactionData {
  ftNumber: string;
  amount?: number;
  payer?: string;
  payerAccount?: string;
  receiver?: string;
  receiverAccount?: string;
  date?: string;
  reference?: string;
  reason?: string;
  branch?: string;
  commission?: string;
  vatOnCommission?: string;
  totalDebited?: string;
  amountInWords?: string;
  rawText: string;
}

export interface CbeVerificationResult {
  success: boolean;
  transaction?: CbeTransactionData;
  error?: string;
  /** True if the extracted receiver account matches the group's configured CBE account */
  accountMatched?: boolean;
  /** True if the extracted amount matches the expected contribution */
  amountMatched?: boolean;
}

@Injectable()
export class CbeVerificationService {
  private readonly logger = new Logger(CbeVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly depositVerification: DepositVerificationService,
  ) {}

  /**
   * Validates an FT number format: "FT" followed by exactly 10 alphanumeric chars.
   */
  validateFtNumber(ft: string): void {
    if (!ft) throw new BadRequestException('FT number is required');
    if (!CBE_FT_REGEX.test(ft)) {
      throw new BadRequestException(
        'Invalid FT number format. Expected: FT followed by 10 alphanumeric characters (e.g. FT1234567890)',
      );
    }
  }

  /**
   * Validates a CBE account number: must be 13 digits starting with "1000".
   */
  validateCbeAccountNumber(account: string): void {
    if (!account) throw new BadRequestException('CBE account number is required');
    if (!/^1000\d{9}$/.test(account)) {
      throw new BadRequestException(
        'Invalid CBE account number. Must be 13 digits starting with 1000 (e.g. 1000123456789)',
      );
    }
  }

  /**
   * Standalone lookup: FT reference (or Receipt ID) + receiving account.
   *
   * Throws on a genuine miss or transport failure, because every existing
   * caller treats a thrown error as "this reference is not payable" and shows
   * the message. That is the contract the scan pipeline and the lookup panel
   * were built against.
   */
  async verifyByFtNumber(
    ftNumber: string,
    accountNumber: string,
  ): Promise<CbeTransactionData> {
    const reference = ftNumber?.trim().toUpperCase();
    if (!reference) throw new BadRequestException('FT number is required');

    const isReceiptId = CBE_RECEIPT_ID_REGEX.test(reference);
    if (!isReceiptId) {
      // Legacy FT references are account-specific, so both parts are required.
      this.validateFtNumber(reference);
      this.validateCbeAccountNumber(accountNumber);
    }

    const account = String(accountNumber ?? '').trim();
    const result = await this.adapter.verify({
      ...(isReceiptId
        ? { receiptNumber: reference }
        : { referenceNumber: reference }),
      ...(account ? { accountSuffix: this.accountSuffix(account) } : {}),
    });

    if (result.status === 'not_found') {
      throw new BadRequestException(
        result.error?.message ??
          `Transaction ${reference} not found. Please check the FT number and account.`,
      );
    }
    if (result.status === 'failed') {
      throw new BadRequestException(
        `CBE verification failed: ${result.error?.message ?? 'the service may be temporarily unavailable'}.`,
      );
    }

    return this.toTransactionData(result, reference);
  }

  /**
   * Auto-verify one deposit.
   *
   * Delegates to the shared deposit verifier so CBE and every other bank apply
   * the same three checks (amount, receiver account, duplicate reference) and
   * write the same evidence. Returns the legacy shape the admin UI reads.
   *
   * The provider is NOT forced here. The route that reaches this method is
   * named for CBE, but the deposit may hold a Dashen or Telebirr reference, and
   * asking CBE about it produces a misleading "not found". Leaving `bank`
   * unset lets the verifier use the deposit's own bank name and then the
   * reference's shape, exactly as the multi-bank path does.
   */
  async autoVerifyDeposit(
    depositId: string,
    adminId: string,
    specificAccount?: string,
  ): Promise<{
    verified: boolean;
    result: CbeVerificationResult;
    deposit: Record<string, unknown>;
  }> {
    const outcome = await this.depositVerification.autoVerifyWithProvider(
      depositId,
      adminId,
      { accountNumber: specificAccount },
    );

    const deposit = await this.prisma.deposit.findUnique({
      where: { id: depositId },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        cycle: { include: { group: true } },
      },
    });

    const transaction =
      outcome.result?.status === 'success'
        ? this.toTransactionData(outcome.result, deposit?.ftNumber ?? '')
        : undefined;

    return {
      verified: outcome.verified,
      result: {
        success: !!transaction,
        transaction,
        error: transaction ? undefined : outcome.message,
        // The shared verifier already applied both cross-checks; surface its
        // verdict so the UI banners keep matching reality.
        accountMatched: outcome.checks?.receiverMatched,
        amountMatched: outcome.checks?.amountMatched,
      },
      deposit: (deposit ?? {}) as unknown as Record<string, unknown>,
    };
  }

  /** A bare adapter instance — it holds no state beyond the bank code. */
  private readonly adapter = new CbeAdapter();

  /**
   * The suffix each provider reads. CBE's legacy endpoint takes the last 8
   * digits; a full account number is trimmed to that.
   */
  private accountSuffix(account: string): string | undefined {
    const digits = account.replace(/\D/g, '');
    return digits.length >= 8 ? digits.slice(-8) : undefined;
  }

  /**
   * Map the engine's normalised result onto the shape the admin UI has always
   * consumed, so the receipt card and its raw-text viewer keep working.
   */
  private toTransactionData(
    result: BankVerificationResult,
    fallbackReference: string,
  ): CbeTransactionData {
    const extra = (result.extra ?? {}) as Record<string, unknown>;
    const asText = (value: unknown): string | undefined =>
      value === undefined || value === null || value === '' ? undefined : String(value);

    return {
      ftNumber: result.referenceNumber ?? fallbackReference,
      amount: result.amount,
      payer: result.senderName,
      payerAccount: result.senderAccount,
      receiver: result.receiverName,
      receiverAccount: result.receiverAccount,
      date: result.timestamp,
      reference: result.referenceNumber ?? result.receiptNumber ?? fallbackReference,
      reason: asText(extra.reason),
      branch: asText(extra.branch),
      commission: asText(extra.commission),
      vatOnCommission: asText(extra.vatOnCommission),
      totalDebited: asText(extra.totalDebited),
      amountInWords: asText(extra.amountInWords),
      rawText: asText(extra.rawText) ?? '',
    };
  }
}
