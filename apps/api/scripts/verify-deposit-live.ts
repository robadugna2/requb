/**
 * Live end-to-end check of the DEPOSIT-LEVEL verification path.
 *
 * Runs the real `DepositVerificationService` and the real
 * `BankVerificationService` (so a genuine request goes to the bank), with the
 * database replaced by an in-memory stub. Nothing is written anywhere.
 *
 * References are passed as ARGUMENTS, never hard-coded, so no real customer
 * data is ever committed to this repository.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"commonjs"}' \
 *     scripts/verify-deposit-live.ts <bank> <reference> <amount> [receiverAccount]
 *
 * Examples:
 *   ... verify-deposit-live.ts dashen 082WDTS262290003 20400 5082000000011
 *   ... verify-deposit-live.ts cbe FT26248CSHRK 10200 1000123456789
 */
import { DepositVerificationService } from '../src/modules/bank-verification/deposit-verification.service';
import { BankVerificationService } from '../src/modules/bank-verification/bank-verification.service';
import { isBankCode } from '../src/modules/bank-verification/bank-rules';
import { PrismaService } from '../src/prisma/prisma.service';

async function main(): Promise<void> {
  const [bankArg, refArg, amountArg, accountArg] = process.argv.slice(2);

  if (!bankArg || !refArg || !amountArg) {
    console.error(
      'usage: verify-deposit-live.ts <bank> <reference> <amount> [receiverAccount]',
    );
    process.exit(2);
  }
  if (!isBankCode(bankArg)) {
    console.error(`unknown bank "${bankArg}".`);
    process.exit(2);
  }

  const amount = Number(amountArg);
  if (!Number.isFinite(amount)) {
    console.error(`amount "${amountArg}" is not a number.`);
    process.exit(2);
  }

  const updates: Array<Record<string, unknown>> = [];

  // Minimal in-memory stand-in for the Prisma calls this path makes.
  const prismaStub = {
    deposit: {
      findUnique: async () => ({
        id: 'live_dep',
        ftNumber: refArg,
        amount,
        bankName: bankArg,
        depositDate: null,
        senderName: null,
        senderAccount: null,
        receiverAccount: accountArg ?? null,
        branch: null,
        verificationStatus: 'PENDING',
        cycle: {
          groupId: 'live_grp',
          group: {
            bankAccount: accountArg ?? null,
            cbeAccountNumbers: accountArg ? [accountArg] : [],
          },
        },
        user: { id: 'u1', name: 'Live Test', phone: null },
      }),
      findFirst: async () => null,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        return { id: 'live_dep', ...data };
      },
    },
  };

  const service = new DepositVerificationService(
    prismaStub as unknown as PrismaService,
    new BankVerificationService(),
  );

  const outcome = await service.autoVerifyWithProvider('live_dep', 'admin_live', {
    bank: bankArg,
  });

  console.log('\n──────── deposit-level verification ────────');
  console.log(`bank          : ${outcome.bank ?? bankArg}`);
  console.log(`verified      : ${outcome.verified}`);
  console.log(`reason        : ${outcome.reason}`);
  console.log(`message       : ${outcome.message}`);
  if (outcome.checks) console.log(`checks        : ${JSON.stringify(outcome.checks)}`);

  const r = outcome.result;
  if (r) {
    console.log(`provider stat : ${r.status}`);
    console.log(`duration      : ${r.durationMs} ms`);
    if (r.amount !== undefined) console.log(`receipt amount: ${r.amount} ${r.currency}`);
    if (r.senderName) console.log(`sender        : ${r.senderName}`);
    if (r.senderAccount) console.log(`sender acct   : ${r.senderAccount}`);
    if (r.receiverAccount) console.log(`receiver acct : ${r.receiverAccount}`);
    if (r.timestamp) console.log(`timestamp     : ${r.timestamp}`);
    if (r.error) console.log(`error         : ${r.error.code} :: ${r.error.message}`);
  }

  console.log(`db writes     : ${updates.length}`);
  if (updates.length > 0) {
    const written = updates[updates.length - 1];
    const stored = written.cbeVerificationData as Record<string, unknown> | undefined;
    if (stored) {
      console.log(`stored keys   : ${Object.keys(stored).join(', ')}`);
      console.log(`stored amount : ${String(stored.amount)}`);
      console.log(`stored payer  : ${String(stored.payer)}`);
    }
    console.log(`status change : ${String(written.verificationStatus ?? '(unchanged)')}`);
    console.log(`autoVerified  : ${String(written.autoVerified ?? '(unchanged)')}`);
  }
  console.log('────────────────────────────────────────────\n');

  process.exit(outcome.reason === 'upstream_failed' ? 1 : 0);
}

void main().catch((error) => {
  console.error('FATAL', error);
  process.exit(1);
});
