/**
 * Generic single-shot verification CLI.
 *
 * References are passed as ARGUMENTS, never hard-coded, so no real customer
 * data is ever committed to this repository.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"commonjs"}' \
 *     scripts/verify-ref.ts <bank> <ref> [<suffix>]
 *
 * Examples:
 *   ... verify-ref.ts dashen 400OWCL26225012Y
 *   ... verify-ref.ts cbe FT26248CSHRK 34617664
 *   ... verify-ref.ts telebirr DEI1234ABC
 */
import { BankVerificationService } from '../src/modules/bank-verification/bank-verification.service';
import { isBankCode } from '../src/modules/bank-verification/bank-rules';
import type { BankIdentifiers } from '../src/modules/bank-verification/types';

async function main(): Promise<void> {
  const [bankArg, refArg, suffixArg, phoneArg] = process.argv.slice(2);

  if (!bankArg || !refArg) {
    console.error('usage: verify-ref.ts <bank> <ref> [accountSuffix] [phone]');
    process.exit(2);
  }
  if (!isBankCode(bankArg)) {
    console.error(`unknown bank "${bankArg}".`);
    process.exit(2);
  }

  const identifiers: BankIdentifiers = {};
  // Route the value into the field the bank actually expects.
  if (bankArg === 'telebirr' || bankArg === 'mpesa' || bankArg === 'awash') {
    identifiers.transactionNumber = refArg;
  } else if (bankArg === 'cbebirr') {
    identifiers.receiptNumber = refArg;
  } else if (bankArg === 'cbe' && !/^FT/i.test(refArg)) {
    identifiers.receiptNumber = refArg;
  } else {
    identifiers.referenceNumber = refArg;
  }
  if (suffixArg) identifiers.accountSuffix = suffixArg;
  if (phoneArg) identifiers.phone = phoneArg;

  const service = new BankVerificationService();
  const result = await service.verify({ bank: bankArg, identifiers });

  console.log(`\nbank        : ${result.bank}`);
  console.log(`status      : ${result.status}`);
  console.log(`verified    : ${result.verified}`);
  console.log(`duration    : ${result.durationMs} ms`);
  if (result.amount !== undefined) console.log(`amount      : ${result.amount} ${result.currency}`);
  if (result.senderName) console.log(`sender      : ${result.senderName}`);
  if (result.senderAccount) console.log(`sender acct : ${result.senderAccount}`);
  if (result.receiverName) console.log(`receiver    : ${result.receiverName}`);
  if (result.receiverAccount) console.log(`receiver acct: ${result.receiverAccount}`);
  if (result.referenceNumber) console.log(`reference   : ${result.referenceNumber}`);
  if (result.timestamp) console.log(`timestamp   : ${result.timestamp}`);
  if (result.error) console.log(`error       : ${result.error.code} :: ${result.error.message}`);
  console.log(`source      : ${result.source}`);
  if (result.extra) console.log(`extra       : ${JSON.stringify(result.extra).slice(0, 400)}`);
  console.log('');

  process.exit(result.status === 'failed' ? 1 : 0);
}

void main();
