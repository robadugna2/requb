import { Module } from '@nestjs/common';
import { BankVerificationController } from './bank-verification.controller';
import { BankVerificationService } from './bank-verification.service';
import { DepositVerificationService } from './deposit-verification.service';

/**
 * Multi-bank receipt verification.
 *
 * Additive module: it depends on nothing from the existing app and changes no
 * existing behaviour. Import it wherever verification is needed, e.g.:
 *
 *   @Module({ imports: [BankVerificationModule], ... })
 *   export class DepositsModule {}
 *
 * then inject `BankVerificationService`.
 *
 * HTTP surface:
 *   GET  /verification/banks              read-only
 *   POST /verification/parse              read-only
 *   POST /verification/lookup             read-only
 *   POST /verification/deposit/:id/auto   writes the deposit it is given
 *
 * The first three never touch a deposit. The fourth is the only write path and
 * lives in `DepositVerificationService`; `BankVerificationService` itself stays
 * free of database access.
 *
 * PrismaService is provided by the @Global() PrismaModule, so no import needed.
 */
@Module({
  controllers: [BankVerificationController],
  providers: [BankVerificationService, DepositVerificationService],
  exports: [BankVerificationService, DepositVerificationService],
})
export class BankVerificationModule {}
