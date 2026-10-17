/**
 * DI + wiring + approval-logic smoke test for the bank-verification module.
 *
 * Boots the module through Nest's own DI container (no HTTP server, no
 * database, no outbound network) and exercises the controller the way an HTTP
 * request would.
 *
 * Two contexts are used:
 *   1. The REAL BankVerificationService with a stubbed PrismaService — proves
 *      the wiring works and that the deposit flow short-circuits correctly
 *      before any bank is contacted.
 *   2. A stubbed BankVerificationService — lets the approval logic (amount,
 *      receiver, duplicate reference) be tested deterministically offline,
 *      including the cases that must NOT approve.
 *
 * Run:  npx ts-node --compiler-options '{"module":"commonjs"}' scripts/verification-di-check.ts
 */
import { Global, Module, NotFoundException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { BankVerificationModule } from '../src/modules/bank-verification/bank-verification.module';
import { BankVerificationController } from '../src/modules/bank-verification/bank-verification.controller';
import { BankVerificationService } from '../src/modules/bank-verification/bank-verification.service';
import { DepositVerificationService } from '../src/modules/bank-verification/deposit-verification.service';
import { PrismaService } from '../src/prisma/prisma.service';
import type { BankVerificationResult } from '../src/modules/bank-verification/types';

// ─── results bookkeeping ─────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail?: string): void {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${label}${detail ? ` -> ${detail}` : ''}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? ` -> ${detail}` : ''}`);
  }
}

// ─── Prisma stub ─────────────────────────────────────────────────────────────
interface StubDeposit {
  id: string;
  ftNumber: string | null;
  amount: number | null;
  bankName: string | null;
  depositDate: Date | null;
  senderName: string | null;
  senderAccount: string | null;
  receiverAccount: string | null;
  branch: string | null;
  verificationStatus: string;
  cbeVerificationData?: Record<string, unknown> | null;
  cycle: {
    groupId: string;
    group: { bankAccount: string | null; cbeAccountNumbers: string[] };
  };
}

const state: {
  deposit: StubDeposit | null;
  clash: { id: string } | null;
  updates: Array<{ where: { id: string }; data: Record<string, unknown> }>;
} = { deposit: null, clash: null, updates: [] };

const prismaStub = {
  deposit: {
    findUnique: async ({ where }: { where: { id: string } }) =>
      state.deposit && state.deposit.id === where.id ? state.deposit : null,
    findFirst: async () => state.clash,
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      state.updates.push({ where, data });
      return { ...state.deposit, ...data };
    },
  },
};

function makeDeposit(patch: Partial<StubDeposit> = {}): StubDeposit {
  return {
    id: 'dep_1',
    ftNumber: 'FT26079ABCDE',
    amount: 10200,
    bankName: 'CBE',
    depositDate: null,
    senderName: null,
    senderAccount: null,
    receiverAccount: null,
    branch: null,
    verificationStatus: 'PENDING',
    cycle: {
      groupId: 'grp_1',
      group: { bankAccount: null, cbeAccountNumbers: [] },
    },
    ...patch,
  };
}

// ─── test modules ────────────────────────────────────────────────────────────
/**
 * Mirrors the real PrismaModule, which is @Global() — that is precisely why
 * BankVerificationModule can inject PrismaService without importing it.
 * A non-global stub would not be visible from the module under test.
 */
@Global()
@Module({
  providers: [{ provide: PrismaService, useValue: prismaStub }],
  exports: [PrismaService],
})
class StubPrismaModule {}

@Module({ imports: [StubPrismaModule, BankVerificationModule] })
class RealVerifierModule {}

/** A verifier that answers from a canned result — no network. */
const fakeVerifier = {
  canned: null as BankVerificationResult | null,
  calls: [] as unknown[],
  async verify(input: unknown) {
    this.calls.push(input);
    return this.canned!;
  },
  parseInput: () => null,
  inferBank: () => null,
  supportedBanks: () => ['cbe', 'dashen'],
};

@Module({
  imports: [StubPrismaModule],
  providers: [
    DepositVerificationService,
    { provide: BankVerificationService, useValue: fakeVerifier },
  ],
})
class FakeVerifierModule {}

function successResult(patch: Partial<BankVerificationResult> = {}): BankVerificationResult {
  return {
    bank: 'dashen',
    status: 'success',
    verified: true,
    amount: 10200,
    currency: 'ETB',
    referenceNumber: '082WDTS262290003',
    receiverAccount: '5082******011',
    source: 'test',
    durationMs: 1,
    ...patch,
  };
}

async function main(): Promise<void> {
  console.log('\n=== Context 1: real verifier, stubbed database ===\n');

  const realApp = await NestFactory.createApplicationContext(RealVerifierModule, {
    logger: false,
  });

  const controller = realApp.get(BankVerificationController);
  const depositService = realApp.get(DepositVerificationService);
  check('module boots and both services resolve from the container', !!controller && !!depositService);

  // ── the three original read-only endpoints still work ──
  const banks = controller.listBanks();
  check('GET /verification/banks', banks.length > 0, `${banks.length} providers`);

  const parsed = controller.parse({
    rawInput: 'https://apps.cbe.com.et:100/?id=FT26079ABCDE12345678',
  });
  check(
    'POST /verification/parse recognises a CBE link',
    parsed.recognised === true && 'bank' in parsed && parsed.bank === 'cbe',
  );

  const junk = controller.parse({ rawInput: 'hello world, not a receipt' });
  check('POST /verification/parse rejects junk without throwing', junk.recognised === false);

  const invalid = await controller.lookup({ bank: 'boa', referenceNumber: 'FT26079ABCDE' });
  check(
    'POST /verification/lookup rejects incomplete input locally',
    invalid.status === 'failed' && invalid.error?.code === 'invalid_input',
  );

  const ambiguous = await controller.lookup({ transactionNumber: 'DEI1234ABC' });
  check(
    'POST /verification/lookup refuses to guess an ambiguous bank',
    ambiguous.status === 'failed' && ambiguous.error?.code === 'ambiguous_bank',
  );

  // ── deposit-level short-circuits (all resolve before any bank call) ──
  state.deposit = null;
  let threw = false;
  try {
    await controller.autoVerifyDeposit('missing', { user: { id: 'adm_1' } }, {});
  } catch (error) {
    threw = error instanceof NotFoundException;
  }
  check('POST /verification/deposit/:id/auto 404s on an unknown deposit', threw);

  state.updates = [];
  state.deposit = makeDeposit({ verificationStatus: 'VERIFIED' });
  const decided = await controller.autoVerifyDeposit('dep_1', { user: { id: 'adm_1' } }, {});
  check(
    'already-decided deposit is left alone',
    decided.verified === false && decided.reason === 'already_decided' && state.updates.length === 0,
    decided.reason,
  );

  state.updates = [];
  state.deposit = makeDeposit({ ftNumber: null });
  const noRef = await controller.autoVerifyDeposit('dep_1', { user: { id: 'adm_1' } }, {});
  check(
    'deposit without a reference is not guessed at',
    noRef.verified === false && noRef.reason === 'no_reference' && state.updates.length === 0,
    noRef.reason,
  );

  state.updates = [];
  state.deposit = makeDeposit({ bankName: 'Zema Bank', ftNumber: 'ZZZ' });
  const unresolved = await controller.autoVerifyDeposit('dep_1', { user: { id: 'adm_1' } }, {});
  check(
    'unknown bank name is reported, not guessed',
    unresolved.verified === false && unresolved.reason === 'bank_unresolved',
    unresolved.reason,
  );

  state.updates = [];
  state.deposit = makeDeposit({ bankName: 'Bank of Abyssinia', ftNumber: 'FT26079ABCDE' });
  const boaNoSuffix = await controller.autoVerifyDeposit('dep_1', { user: { id: 'adm_1' } }, {});
  check(
    'BOA without an account suffix is rejected locally (no request fired)',
    boaNoSuffix.verified === false && boaNoSuffix.reason === 'invalid_input',
    boaNoSuffix.reason,
  );
  check(
    'rejected deposit stays PENDING',
    state.deposit.verificationStatus === 'PENDING' &&
      state.updates.every((u) => u.data.verificationStatus === undefined),
  );

  await realApp.close();

  // ── identifier routing: each bank must read the slot its adapter needs ──
  console.log('\n=== Context 1b: identifier routing ===\n');
  const build = (depositService as unknown as {
    buildIdentifiers: (b: string, r: string, a?: string) => Record<string, string | undefined>;
  }).buildIdentifiers.bind(depositService);

  // The proven CbeVerificationService uses accountNumber.substring(5), so
  // "1000123456789" yields "23456789" — the last 8 characters. Same rule here.
  const cbeFt = build('cbe', 'FT26079ABCDE', '1000123456789');
  check(
    'CBE FT goes to referenceNumber + last 8 digits of the account',
    cbeFt.referenceNumber === 'FT26079ABCDE' && cbeFt.accountSuffix === '23456789',
    JSON.stringify(cbeFt),
  );

  const cbeReceipt = build('cbe', 'A1B2C3D4E5F6G7H8', '1000123456789');
  check(
    'CBE Receipt ID goes to receiptNumber, not referenceNumber',
    cbeReceipt.receiptNumber === 'A1B2C3D4E5F6G7H8' && !cbeReceipt.referenceNumber,
  );

  const boa = build('boa', 'FT26079ABCDE', '1000123456789');
  check(
    'BOA takes exactly the last 5 digits',
    boa.accountSuffix === '56789',
    JSON.stringify(boa),
  );

  const telebirr = build('telebirr', 'DEI1234ABC');
  check('Telebirr reads transactionNumber', telebirr.transactionNumber === 'DEI1234ABC');

  const dashen = build('dashen', '082WDTS262290003');
  check('Dashen reads referenceNumber', dashen.referenceNumber === '082WDTS262290003');

  console.log('\n=== Context 2: stubbed verifier, real approval logic ===\n');

  const fakeApp = await NestFactory.createApplicationContext(FakeVerifierModule, {
    logger: false,
  });
  const svc = fakeApp.get(DepositVerificationService);

  const run = async (patch: Partial<StubDeposit>, canned: BankVerificationResult, clash = false) => {
    state.deposit = makeDeposit(patch);
    state.updates = [];
    state.clash = clash ? { id: 'dep_other' } : null;
    fakeVerifier.calls = [];
    fakeVerifier.canned = canned;
    const outcome = await svc.autoVerifyWithProvider('dep_1', 'adm_1', { bank: 'dashen' });
    return { outcome, updates: state.updates };
  };

  // Happy path
  {
    const { outcome, updates } = await run({ amount: 10200 }, successResult());
    const approved = updates.find((u) => u.data.verificationStatus === 'VERIFIED');
    check(
      'matching amount + receiver is auto-approved',
      outcome.verified === true && outcome.reason === 'verified',
      outcome.reason,
    );
    check(
      'approval writes VERIFIED, the admin id and autoVerified',
      approved?.data.verifiedById === 'adm_1' && approved?.data.autoVerified === true,
    );
    check(
      'result is stored in the existing cbeVerificationData column',
      !!approved?.data.cbeVerificationData &&
        (approved.data.cbeVerificationData as Record<string, unknown>).provider === 'dashen',
    );
  }

  // Amount mismatch must NOT approve
  {
    const { outcome, updates } = await run(
      { amount: 5000 },
      successResult({ amount: 10200 }),
    );
    check(
      'amount mismatch is not auto-approved',
      outcome.verified === false && outcome.reason === 'amount_mismatch',
      outcome.reason,
    );
    check(
      'amount mismatch leaves the deposit PENDING',
      updates.every((u) => u.data.verificationStatus === undefined),
    );
    check('amount mismatch is still recorded for review', updates.length === 1);
  }

  // Receiver mismatch must NOT approve
  {
    const { outcome } = await run(
      { amount: 10200, receiverAccount: '1000999888777' },
      successResult({ receiverAccount: '1000111222333' }),
    );
    check(
      'receiver mismatch is not auto-approved',
      outcome.verified === false && outcome.reason === 'receiver_mismatch',
      outcome.reason,
    );
  }

  // Duplicate reference must NOT approve
  {
    const { outcome } = await run({ amount: 10200 }, successResult(), true);
    check(
      'a reference already verified elsewhere is not approved again',
      outcome.verified === false && outcome.reason === 'duplicate_reference',
      outcome.reason,
    );
  }

  // Masked receiver account must still match
  {
    const { outcome } = await run(
      { amount: 10200, receiverAccount: '5082000000011' },
      successResult({ receiverAccount: '5082******011' }),
    );
    check(
      'a masked receipt account still matches the full account',
      outcome.verified === true,
      outcome.reason,
    );
  }

  // Unknown amount on the receipt must not block approval
  {
    const { outcome } = await run(
      { amount: 10200 },
      successResult({ amount: undefined }),
    );
    check(
      'an unreadable amount does not block a otherwise-clean approval',
      outcome.verified === true,
      outcome.reason,
    );
  }

  // not_found must not approve
  {
    const { outcome, updates } = await run({ amount: 10200 }, {
      ...successResult(),
      status: 'not_found',
      verified: false,
      error: { code: 'not_found', message: 'no transaction', retryable: false },
    });
    check(
      'a not-found answer is never approved',
      outcome.verified === false && outcome.reason === 'not_found',
      outcome.reason,
    );
    check('not-found answer leaves the deposit PENDING', updates.every((u) => u.data.verificationStatus === undefined));
  }

  // A failed attempt must not erase a prior success (e.g. real CBE data)
  {
    const { updates } = await run(
      { amount: 10200, cbeVerificationData: { success: true, ftNumber: 'FT26079ABCDE' } },
      {
        ...successResult(),
        status: 'not_found',
        verified: false,
        error: { code: 'not_found', message: 'no transaction', retryable: false },
      },
    );
    check(
      'a failed attempt does not overwrite an existing successful verification',
      updates.length === 0,
      `${updates.length} write(s)`,
    );
  }

  // A mismatch must also not erase a prior success
  {
    const { updates } = await run(
      { amount: 5000, cbeVerificationData: { success: true } },
      successResult({ amount: 10200 }),
    );
    const wroteBlob = updates.some((u) => u.data.cbeVerificationData !== undefined);
    check(
      'a mismatch does not overwrite an existing successful verification',
      !wroteBlob,
      `${updates.length} write(s), blob written: ${wroteBlob}`,
    );
  }

  // Backfill of missing fields
  {
    const { updates } = await run(
      { amount: null, senderName: null },
      successResult({ amount: 10200, senderName: 'ABEBE KEBEDE' }),
    );
    const written = updates[0]?.data;
    check(
      'missing amount and sender are backfilled from the receipt',
      written?.amount === 10200 && written?.senderName === 'ABEBE KEBEDE',
    );
  }

  await fakeApp.close();

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

void main().catch((error) => {
  console.error('\nFATAL', error);
  process.exit(1);
});
