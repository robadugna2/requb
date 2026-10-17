/**
 * Smoke test for the pure parsing logic — no network involved.
 *
 * Run:  npx ts-node src/modules/bank-verification/__smoke__.ts
 *
 * Purpose: prove the router and the identifier rules behave, without needing a
 * real receipt. Anything that talks to a bank is deliberately excluded.
 */
import { parseReceiptUrl, splitLegacyFtReference } from './receipt-parser';
import { isValidReferenceForBank, canonicaliseEthiopianPhone } from './bank-rules';

let passed = 0;
let failed = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`);
  }
}

console.log('\nReceipt-URL routing');

const cbeFt = parseReceiptUrl('https://apps.cbe.com.et:100/?id=FT26079ABCDE12345678');
check('CBE legacy FT splits reference + 8-digit suffix', cbeFt?.identifiers, {
  referenceNumber: 'FT26079ABCDE',
  accountSuffix: '12345678',
});
check('CBE legacy FT resolves to bank cbe', cbeFt?.bank, 'cbe');

const boa = parseReceiptUrl('https://cs.bankofabyssinia.com/api/onlineslip/getdetails/?id=FT26079ABCDE12345');
check('BOA splits reference + 5-digit suffix', boa?.identifiers, {
  referenceNumber: 'FT26079ABCDE',
  accountSuffix: '12345',
});
check('BOA resolves to bank boa', boa?.bank, 'boa');

const telebirr = parseReceiptUrl(
  'https://transactioninfo.ethiotelecom.et/receipt/view?transactionno=DEI1234ABCD',
);
check('Telebirr extracts transactionNumber', telebirr?.identifiers.transactionNumber, 'DEI1234ABCD');
check('Telebirr resolves to bank telebirr', telebirr?.bank, 'telebirr');

const dashen = parseReceiptUrl('https://receipts.dashenbanksc.com/receipt/123ABCDEFGHIJKLM');
check('Dashen extracts reference from path', dashen?.identifiers.referenceNumber, '123ABCDEFGHIJKLM');

const cbebirr = parseReceiptUrl('https://cbepay1.cbe.com.et/aureceipt?tid=ABC1234567');
check('CBE Birr extracts receiptNumber', cbebirr?.identifiers.receiptNumber, 'ABC1234567');

const coopay = parseReceiptUrl('https://receipt.ebirr.com/coopay/ABCD1234EFGH5678');
check('Coopay routes to coopayebirr', coopay?.bank, 'coopayebirr');
check('Coopay extracts reference', coopay?.identifiers.referenceNumber, 'ABCD1234EFGH5678');

const kaafi = parseReceiptUrl('https://receipt.ebirr.com/kaafimf/ABCD1234EFGH');
check('Kaafi routes to kaafiebirr', kaafi?.bank, 'kaafiebirr');

const siinqee = parseReceiptUrl('https://receipts.siinqeebank.com/generate/EABCDEFGHIJKLM');
check('Siinqee routes to siinqee', siinqee?.bank, 'siinqee');

check('A non-receipt URL is rejected', parseReceiptUrl('https://example.com/hello'), null);
check('Garbage is rejected', parseReceiptUrl('not a url'), null);

console.log('\nTypos and noise');
const typo = parseReceiptUrl('https://:://apps.cbe.com.et:100/?id=FT26079ABCDE12345678');
check('Double-colon scheme typo is repaired', typo?.bank, 'cbe');
const bare = parseReceiptUrl('transactioninfo.ethiotelecom.et/receipt/view?transactionno=DEI1234ABCD');
check('Bare host without scheme is handled', bare?.bank, 'telebirr');
const zeroWidth = parseReceiptUrl('https://apps.cbe.com.et:100/?id=FT26079ABCDE\u200B12345678');
check('Zero-width characters are stripped', zeroWidth?.bank, 'cbe');

console.log('\nLegacy FT splitting');
check('8-digit split', splitLegacyFtReference('FT26079ABCDE12345678', 8), {
  referenceNumber: 'FT26079ABCDE',
  accountSuffix: '12345678',
});
check('5-digit split', splitLegacyFtReference('FT26079ABCDE12345', 5), {
  referenceNumber: 'FT26079ABCDE',
  accountSuffix: '12345',
});
check('Wrong suffix length returns null', splitLegacyFtReference('FT26079ABCDE123', 5), null);

console.log('\nIdentifier rules');
check('CBE legacy FT is valid', isValidReferenceForBank('cbe', 'FT26079ABCDE'), true);
check('CBE receipt id is valid', isValidReferenceForBank('cbe', 'fHCxyExampleRcpt1'), true);
check('Telebirr 10-char is valid', isValidReferenceForBank('telebirr', 'DEI1234ABC'), true);
check('Telebirr 9-char is invalid', isValidReferenceForBank('telebirr', 'DEI1234AB'), false);
check('Dashen shape is valid', isValidReferenceForBank('dashen', '123ABCDEFGHIJKLM'), true);
check('Siinqee needs leading E', isValidReferenceForBank('siinqee', 'ABCDEFGHIJKLM'), false);
check('Siinqee with E is valid', isValidReferenceForBank('siinqee', 'EABCDEFGHIJKLM'), true);

console.log('\nPhone canonicalisation');
check('2517... becomes 07...', canonicaliseEthiopianPhone('251912345678'), '0912345678');
check('2519... becomes 09...', canonicaliseEthiopianPhone('251712345678'), '0712345678');
check('Local form is left alone', canonicaliseEthiopianPhone('0912345678'), '0912345678');

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
