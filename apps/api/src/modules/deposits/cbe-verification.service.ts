import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import axios from 'axios';
import * as https from 'https';
import * as pdfParse from 'pdf-parse';

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
  ) {}

  /**
   * Validates an FT number format: "FT" followed by exactly 10 alphanumeric chars.
   */
  validateFtNumber(ft: string): void {
    if (!ft) throw new BadRequestException('FT number is required');
    if (!/^FT\w{10}$/i.test(ft)) {
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
   * Parses extracted text from a CBE VAT Invoice PDF using the same
   * regex patterns as the reference cbe_idea/index.html implementation.
   */
  parseCbePdfText(text: string, ftNumber: string): CbeTransactionData {
    const normalizedText = text.replace(/\s+/g, ' ').trim();

    const extract = (re: RegExp, txt: string): string | undefined => {
      const m = re.exec(txt);
      return m && m.groups ? m.groups['value'].trim() : undefined;
    };

    const amountStr =
      extract(/Transferred Amount\s+(?<value>[\d,]+\.\d{2})\s*ETB/i, normalizedText) ||
      extract(/Amount[:\s]*(?<value>[\d,]+\.\d{2})\s*ETB/i, normalizedText);

    return {
      ftNumber,
      rawText: text,
      amount: amountStr ? parseFloat(amountStr.replace(/,/g, '')) : undefined,
      payer: extract(/Payer\s+(?<value>[A-Za-z\s]+?)\s+Account/i, normalizedText),
      payerAccount: extract(/Payer\s+[A-Za-z\s]+?\s+Account\s+(?<value>[\d*]+)/i, normalizedText),
      receiver: extract(/Receiver\s+(?<value>[A-Za-z\s]+?)\s+Account/i, normalizedText),
      receiverAccount: extract(/Receiver\s+[A-Za-z\s]+?\s+Account\s+(?<value>[\d*]+)/i, normalizedText),
      date: extract(
        /Payment Date(?:\s*&\s*Time)?[:\s]+(?<value>[\d\/,\s:APMapm]+?)(?=\s*Reference)/i,
        normalizedText,
      ),
      reference:
        extract(/Reference No\.?(?:\s*\([^)]+\))?[:\s]+(?<value>FT\w+)/i, normalizedText) ||
        ftNumber,
      reason: extract(
        /Reason\s*(?:\/\s*Type of service)?\s*(?<value>.+?)(?=\s*Transferred Amount)/i,
        normalizedText,
      ),
      commission: extract(
        /Commission or Service Charge\s+(?<value>[\d,]+\.\d{2})\s*ETB/i,
        normalizedText,
      ),
      vatOnCommission: extract(
        /15% VAT on Commission\s+(?<value>[\d,]+\.\d{2})\s*ETB/i,
        normalizedText,
      ),
      totalDebited: extract(
        /Total amount debited from customers account\s+(?<value>[\d,]+\.\d{2})\s*ETB/i,
        normalizedText,
      ),
      amountInWords: extract(
        /Amount in Word\s+(?<value>.+?)(?=\s*The Bank|\s*©|$)/i,
        normalizedText,
      ),
      branch: extract(
        /Branch:(?:[^_]*_(?:[^_]*_)*)?(?<value>[A-Za-z\s]+?)(?=\s*Payment|\s*Transaction)/i,
        normalizedText,
      ),
    };
  }

  /**
   * Calls the CBE Direct API with the given FT number and account number,
   * extracts and parses the PDF response.
   *
   * CBE URL format: https://apps.cbe.com.et:100/?id={ftNumber}{last8digitsOfAccount}
   */
  async verifyByFtNumber(
    ftNumber: string,
    accountNumber: string,
  ): Promise<CbeTransactionData> {
    this.validateFtNumber(ftNumber);
    this.validateCbeAccountNumber(accountNumber);

    // CBE uses FT number + last 8 digits of account (account minus first 5 chars: "1000X" → last 8)
    const accountSuffix = accountNumber.substring(5); // drops "1000" + 1st digit → 8 chars
    const url = `https://apps.cbe.com.et:100/?id=${encodeURIComponent(ftNumber.toUpperCase() + accountSuffix)}`;

    this.logger.log(`Calling CBE Direct: ${url}`);

    let responseData: Buffer;
    try {
      const response = await axios.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
        timeout: 15000,
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      });
      responseData = Buffer.from(response.data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        throw new NotFoundException(
          `Transaction ${ftNumber} not found. Please check the FT number and account.`,
        );
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`CBE API call failed: ${errMsg}`);
      throw new BadRequestException(
        `CBE verification failed: ${errMsg}. The CBE service may be temporarily unavailable.`,
      );
    }

    // Extract text from PDF
    let extractedText: string;
    try {
      const parsed = await pdfParse(responseData);
      extractedText = parsed.text;
    } catch {
      // Fallback: try to read as plain text if not a PDF
      extractedText = responseData.toString('utf8');
    }

    if (!extractedText || extractedText.trim().length < 20) {
      throw new BadRequestException(
        'CBE returned an empty or unreadable response. The transaction may not exist.',
      );
    }

    return this.parseCbePdfText(extractedText, ftNumber.toUpperCase());
  }

  /**
   * Full auto-verification flow for a deposit:
   * 1. Load deposit + group
   * 2. Pick the group's first configured CBE account
   * 3. Call CBE Direct API
   * 4. Compare extracted data vs expected
   * 5. If valid → mark deposit as VERIFIED + autoVerified=true
   * 6. Return result with match status for admin review
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
      throw new BadRequestException(
        `Deposit has already been ${deposit.verificationStatus.toLowerCase()}`,
      );
    }
    if (!deposit.ftNumber) {
      throw new BadRequestException(
        'This deposit does not have an FT number. CBE auto-verification requires an FT number.',
      );
    }

    const group = deposit.cycle.group;
    const cbeAccounts: string[] = (group as any).cbeAccountNumbers || [];

    // Use specific account if provided, otherwise first configured account
    const accountToUse = specificAccount || cbeAccounts[0];
    if (!accountToUse) {
      throw new BadRequestException(
        'This group has no CBE account numbers configured. Please set up a CBE receiver account in group settings first.',
      );
    }

    let transaction: CbeTransactionData;
    try {
      transaction = await this.verifyByFtNumber(deposit.ftNumber, accountToUse);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        verified: false,
        result: { success: false, error: errMsg },
        deposit: deposit as unknown as Record<string, unknown>,
      };
    }

    // Cross-validate: receiver account should match the group's account
    const accountMatched = transaction.receiverAccount
      ? accountToUse.includes(transaction.receiverAccount.replace(/\*/g, '')) ||
        transaction.receiverAccount.replace(/\*/g, '').length < 4
      : true; // can't determine if masked

    // Cross-validate: amount should match expected contribution
    const expectedAmount = group.contributionAmount;
    const amountMatched =
      transaction.amount !== undefined
        ? Math.abs(transaction.amount - expectedAmount) < 0.01
        : true;

    const result: CbeVerificationResult = {
      success: true,
      transaction,
      accountMatched,
      amountMatched,
    };

    // Auto-verify only if both checks pass
    const shouldAutoApprove = accountMatched && amountMatched;

    // Update deposit with CBE data regardless of outcome (for admin review)
    const updatedDeposit = await this.prisma.deposit.update({
      where: { id: depositId },
      data: {
        cbeVerificationData: transaction as any,
        // Populate extracted fields if not already set
        ...(transaction.amount && !deposit.amount && { amount: transaction.amount }),
        ...(transaction.date && !deposit.depositDate && {
          depositDate: this.parseCbeDate(transaction.date),
        }),
        ...(transaction.payer && !deposit.senderName && { senderName: transaction.payer }),
        ...(transaction.payerAccount && !deposit.senderAccount && {
          senderAccount: transaction.payerAccount,
        }),
        ...(transaction.receiverAccount && !deposit.receiverAccount && {
          receiverAccount: transaction.receiverAccount,
        }),
        ...(transaction.branch && !deposit.branch && { branch: transaction.branch }),
        // Auto-verify if all checks pass
        ...(shouldAutoApprove && {
          verificationStatus: 'VERIFIED',
          verifiedById: adminId,
          autoVerified: true,
        }),
      },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        cycle: { include: { group: true } },
      },
    });

    return {
      verified: shouldAutoApprove,
      result,
      deposit: updatedDeposit as unknown as Record<string, unknown>,
    };
  }

  /**
   * Attempts to parse a CBE date string into a JS Date.
   * CBE dates look like: "07/04/2026, 10:45:30 AM"
   */
  private parseCbeDate(dateStr: string): Date | undefined {
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) return d;
      // Try MM/DD/YYYY format
      const parts = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (parts) {
        return new Date(`${parts[3]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`);
      }
    } catch { /* ignore */ }
    return undefined;
  }
}
