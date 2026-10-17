import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { BankVerificationService } from './bank-verification.service';
import { DepositVerificationService } from './deposit-verification.service';
import { BANK_CODES, BANK_LABELS } from './bank-rules';
import type { BankCode, BankIdentifiers } from './types';

/** Request body for a standalone multi-bank lookup. */
class BankLookupDto {
  @IsOptional()
  @IsIn(BANK_CODES as unknown as string[])
  bank?: BankCode;

  @IsOptional() @IsString() @MaxLength(200) referenceNumber?: string;
  @IsOptional() @IsString() @MaxLength(200) receiptNumber?: string;
  @IsOptional() @IsString() @MaxLength(200) transactionNumber?: string;
  @IsOptional() @IsString() @MaxLength(20) accountSuffix?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;

  /** Alternatively paste a receipt link or SMS and let the router work it out. */
  @IsOptional() @IsString() @MaxLength(4096) rawInput?: string;
}

class ParseInputDto {
  @IsString() @MaxLength(4096) rawInput!: string;
}

/** Optional overrides for a deposit-level auto-verification. */
class AutoVerifyDepositDto {
  /** Force a provider instead of deriving it from the deposit. */
  @IsOptional()
  @IsIn(BANK_CODES as unknown as string[])
  bank?: BankCode;

  /** The receiving account to resolve against / compare with. */
  @IsOptional() @IsString() @MaxLength(40) accountNumber?: string;
}

/**
 * Multi-bank receipt verification.
 *
 * Mounted at `/verification/*` — deliberately SEPARATE from `/deposits/*` so the
 * existing deposit flow and its CBE verification are untouched.
 *
 * The first three endpoints are read-only: they never create or modify a
 * deposit. Only `POST /verification/deposit/:id/auto` writes, and it writes
 * just the one deposit named in the URL.
 */
@Controller('verification')
@UseGuards(JwtAuthGuard)
export class BankVerificationController {
  constructor(
    private readonly verification: BankVerificationService,
    private readonly depositVerification: DepositVerificationService,
  ) {}

  /** GET /verification/banks — which providers can be checked right now. */
  @Get('banks')
  listBanks() {
    return this.verification.supportedBanks().map((bank) => ({
      bank,
      label: BANK_LABELS[bank],
    }));
  }

  /**
   * POST /verification/parse
   * Turn a pasted receipt link or SMS into a bank + identifiers.
   * Touches no records and makes no outbound request.
   */
  @Post('parse')
  @HttpCode(200)
  parse(@Body() dto: ParseInputDto) {
    const parsed = this.verification.parseInput(dto.rawInput);
    if (!parsed) {
      return {
        recognised: false,
        message:
          'That link or message was not recognised as a receipt from a supported provider.',
      };
    }
    return { recognised: true, ...parsed };
  }

  /**
   * POST /verification/lookup
   * Standalone verification. Does NOT touch any deposit record.
   *
   * Body: { bank?, referenceNumber?, receiptNumber?, transactionNumber?,
   *         accountSuffix?, phone?, rawInput? }
   */
  @Post('lookup')
  @HttpCode(200)
  lookup(@Body() dto: BankLookupDto) {
    const identifiers: BankIdentifiers = {
      referenceNumber: dto.referenceNumber,
      receiptNumber: dto.receiptNumber,
      transactionNumber: dto.transactionNumber,
      accountSuffix: dto.accountSuffix,
      phone: dto.phone,
    };

    return this.verification.verify({
      bank: dto.bank,
      identifiers,
      rawInput: dto.rawInput,
    });
  }

  /**
   * POST /verification/deposit/:id/auto
   *
   * Check ONE existing deposit against its bank and approve it only when the
   * amount, the receiver account and the reference all check out.
   *
   * This is separate from `POST /deposits/:id/auto-verify-cbe`, which is left
   * exactly as it was. Nothing here can approve a deposit that the CBE path
   * would have rejected: the same two cross-checks are applied, plus a
   * duplicate-reference guard.
   *
   * Returns 200 with `verified: false` and a `reason` for ordinary business
   * outcomes (not found, mismatch, bank unreachable) — only a missing deposit
   * produces a 404.
   */
  @Post('deposit/:id/auto')
  @HttpCode(200)
  @RequirePermission('canManageDeposits')
  autoVerifyDeposit(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() dto: AutoVerifyDepositDto,
  ) {
    return this.depositVerification.autoVerifyWithProvider(id, req.user.id, {
      bank: dto?.bank,
      accountNumber: dto?.accountNumber,
    });
  }
}
