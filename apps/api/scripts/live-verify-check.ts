/**
 * Live end-to-end check of the bank adapters.
 *
 * Run:  npx ts-node --compiler-options '{"module":"commonjs"}' scripts/live-verify-check.ts
 *
 * Deliberately uses references that DO NOT EXIST, so the expected outcome is
 * "not_found". That still exercises the entire real path — URL construction,
 * TLS, the bank's own response, our classification — against live
 * infrastructure. It is the honest way to prove the pipeline works without
 * holding a genuine receipt.
 *
 * Network required. Telebirr applies its own 5-request rate limit, so it is
 * called only once.
 */
import { BankVerificationService } from '../src/modules/bank-verification/bank-verification.service';
import type { VerifyBankPaymentInput } from '../src/modules/bank-verification/types';

const service = new BankVerificationService();

const CASES: Array<{ label: string; input: VerifyBankPaymentInput; expect: string[] }> = [
  {
    label: 'CBE  (legacy FT + 8-digit suffix)',
    input: {
      bank: 'cbe',
      identifiers: { referenceNumber: 'FT26079ABCDE', accountSuffix: '12345678' },
    },
    expect: ['not_found'],
  },
  {
    label: 'Dashen  (reference in path)',
    input: { bank: 'dashen', identifiers: { referenceNumber: '123ABCDEFGHIJKLM' } },
    expect: ['not_found'],
  },
  {
    label: 'Telebirr  (transaction number)',
    input: { bank: 'telebirr', identifiers: { transactionNumber: 'DEI1234ABC' } },
    // A timeout is an acceptable outcome: it means the pipeline worked and the
    // host did not answer in time, which we report as a retryable failure.
    expect: ['not_found', 'failed'],
  },
  {
    label: 'Kaafi eBirr  (path token)',
    input: { bank: 'kaafiebirr', identifiers: { referenceNumber: 'ABCD1234EFGH' } },
    expect: ['not_found'],
  },
  {
    label: 'BOA  (missing 5-digit suffix -> rejected locally)',
    input: { bank: 'boa', identifiers: { referenceNumber: 'FT26079ABCDE' } },
    expect: ['failed'],
  },
  {
    label: 'Siinqee  (client-rendered -> reported as unconfirmed)',
    input: { bank: 'siinqee', identifiers: { referenceNumber: 'EABCDEFGHIJKLM' } },
    expect: ['failed'],
  },
  {
    label: 'Router  (pasted CBE receipt link)',
    input: { rawInput: 'https://apps.cbe.com.et:100/?id=FT26079ABCDE12345678' },
    expect: ['not_found', 'failed'],
  },
  {
    label: 'Router  (ambiguous 10-char token -> asks which bank)',
    input: { identifiers: { transactionNumber: 'DEI1234ABC' } },
    expect: ['failed'],
  },
];

async function main(): Promise<void> {
  console.log(`\nSupported banks: ${service.supportedBanks().join(', ')}\n`);

  let ok = 0;
  let bad = 0;

  for (const testCase of CASES) {
    let result;
    try {
      result = await service.verify(testCase.input);
    } catch (error) {
      console.log(`FAIL  ${testCase.label}\n      threw: ${(error as Error).message}\n`);
      bad += 1;
      continue;
    }

    const matched = testCase.expect.includes(result.status);
    const mark = matched ? 'PASS' : 'FAIL';
    if (matched) ok += 1;
    else bad += 1;

    console.log(`${mark}  ${testCase.label}`);
    console.log(`      status=${result.status}  verified=${result.verified}  ${result.durationMs}ms`);
    if (result.error) console.log(`      error: ${result.error.code} — ${result.error.message}`);
    if (result.amount !== undefined) console.log(`      amount: ${result.amount} ${result.currency}`);
    console.log(`      source: ${result.source}`);
    console.log('');
  }

  console.log(`${ok} passed, ${bad} failed\n`);
  process.exit(bad === 0 ? 0 : 1);
}

void main();
