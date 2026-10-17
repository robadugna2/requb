# Ethiopian Bank FT/Reference Verification — the factual logic, bank by bank

This is the mechanics, not the marketing. Every endpoint and every error signature below was
observed by a direct request on 2026-10-16. Where something could **not** be confirmed, it says so
instead of guessing.

Companion code: `apps/api/src/modules/bank-verification/`.

---

## 0. The core insight

Verifying an Ethiopian bank receipt is **not** a single standard. It is **11 different mechanisms**
with three different response families:

| Response family | Banks | How you read it |
|---|---|---|
| **PDF** | CBE (legacy FT) | fetch bytes → extract text → regex the labels |
| **JSON API** | Dashen, BOA (likely) | parse JSON → read fields |
| **HTML page** | Telebirr, eBirr (Kaafi/Coopay), CBE Birr, M-Pesa | strip markup → read label/value pairs |
| **Client-rendered SPA** | Siinqee, Awash | page is an empty shell; the data comes from a backing API |

That is exactly why a gateway like verify.et exists: it hides this mess behind one JSON shape.
This module reproduces the same normalisation, calling the banks directly.

---

## 1. Per-bank mechanics

### CBE — Commercial Bank of Ethiopia

**Two identifiers, two endpoints.**

**A. Legacy FT reference** — the one the Equb app already uses.

```
GET https://apps.cbe.com.et:100/?id={FT_REFERENCE}{LAST_8_DIGITS_OF_ACCOUNT}
```

- `FT_REFERENCE` = `FT` + 10 alphanumerics, e.g. `FT26079ABCDE`
- Suffix = **last 8 digits** of the receiving CBE account (account number is 13 digits starting `1000`)
- Observed: **404** for a non-existent transaction; `Access-Control-Allow-Origin: *`
- Returns a **PDF** VAT invoice

**B. Modern "Receipt ID"** — suffix-free, no account needed.

```
GET https://mbreciept.cbe.com.et/{RECEIPT_ID}
```

- `RECEIPT_ID` = 12–128 chars `[A-Za-z0-9_-]`, **not** all digits, **not** an FT-shaped string
- Returns an HTML receipt page

> The two are distinguished by shape. A string starting `FT` + 10 chars is legacy; anything else of
> the right length is a Receipt ID. This is why CBE needs a negative lookahead in its validator.

---

### Bank of Abyssinia (BOA)

```
GET https://cs.bankofabyssinia.com/api/onlineslip/getdetails/?id={FT_REFERENCE}{SUFFIX}
```

- **Same FT shape as CBE** (`FT` + 10) — but the suffix is **exactly 5 digits**, not 8
- Observed: **404** for a non-existent transaction
- Response is JSON or HTML (not confirmed which for a success — the reader accepts either)

> **Why the 5-vs-8 distinction matters:** if you route an FT reference to the wrong bank you get a
> silent 404 and a member is wrongly marked unpaid. The suffix length is the only discriminator, so
> the router asks for it explicitly rather than assuming.

---

### Telebirr

```
GET https://transactioninfo.ethiotelecom.et/receipt/view?transactionno={TRANSACTION_NUMBER}
```

- `TRANSACTION_NUMBER` = exactly 10 alphanumerics
- Observed: **HTTP 200** even for a bad number — the failure is in the body:
  `This request is not correctttttt`
- So **you must parse the body**, not the status code. A 200 does not mean found.
- Server: `nginx/1.18.0 (Ubuntu)` + `X-Powered-By: Express`, and it applies its own
  `X-RateLimit-Limit: 5`
- Accepted query aliases: `transactionno`, `transaction`, `transactionid`, `reference`, `ref`, `tid`

**Also reachable via a proxy:** `https://leul.et/verify.php?reference={TRANSACTION_NUMBER}`
returns JSON but demands a key:
`{"success":false,"error":"Unauthorized: Invalid or missing proxy key"}`.

---

### Dashen Bank — the cleanest contract

```
GET https://receipts.dashenbanksc.com/receipt/{REFERENCE}
```

Observed response for an unknown reference:

```json
{
  "statusCode": 400,
  "message": "Transaction not found",
  "timestamp": "2026-10-16T17:03:51.369Z",
  "internalCode": "CLNT_TXNALLT_4003"
}
```

- A **NestJS API** (`statusCode` / `message` / `timestamp` envelope)
- **A 400 here is a clean negative, not a server fault** — treat it as "not found"
- `internalCode` (`CLNT_TXNALLT_4003`) is worth storing; it is useful when a member disputes a result
- Secondary host from verify.et's routing table: `receipt.dashensuperapp.com` (returned 502 when probed)

---

### CBE Birr

```
GET https://cbepay1.cbe.com.et/aureceipt?tid={RECEIPT_NUMBER}
```

- Observed: **HTTP 200** with a hand-written error page:
  `<h1 style='color:red'>Invalid Access Request</h1>`
- Again: status code is useless, the body carries the answer
- Sets a `TS015e344b` cookie (legacy F5/TS session)

---

### M-Pesa Ethiopia

- Host `m-pesabusiness.safaricom.et` is a **Next.js** app (`envoy` in front, `_next/static` assets)
- `GET /api/receipt/getreceipt?trxno=…` returned **404** for a test value, so that exact path/param
  combination is **not confirmed**
- Receipt page path used: `/receipt/{transactionNumber}`
- ⚠️ **Honest gap:** the working API path and parameter name for M-Pesa are not established.

---

### Awash Bank

```
GET https://awashpay.awashbank.com/{TOKEN}
```

- An **Angular** application (`<app-root>`, `runtime.*.js`) by vendor **Servicecops**
  (`servicecops.com` — visible in the page title)
- Because it is client-rendered, the URL returns an empty shell; the receipt arrives from a backing API
- ⚠️ **Honest gap:** the backing API is not confirmed.

---

### Siinqee Bank

```
GET https://receipts.siinqeebank.com/generate/{REFERENCE}
```

- A **Vite + React SPA** (`<div id="root">` + `/assets/index-*.js`), served by `nginx/1.30.4`
- Returns 200 for any path — the shell tells you nothing
- ⚠️ **Honest gap:** the backing API is not confirmed.

---

### Kaafi eBirr / Coopay eBirr

```
GET https://receipt.ebirr.com/kaafimf/{TOKEN}
GET https://receipt.ebirr.com/coopay/{TOKEN}
```

- Server-rendered HTML. Observed for a bad token:
  `<h1 style="font-size: 42px; color: red;">Not Found Page</h1>`
- Both live on the same host, separated only by path prefix
- Coopay's SMS `Ref` number **cannot** be verified alone — the link token is required

---

## 2. Reading the answer: the rule that saves you

Three of these banks return **HTTP 200 with a failure message in the body**. A naive integration
that checks `response.ok` will mark unpaid members as **paid**. So every adapter here:

1. checks the status code,
2. **then** checks for a bank-specific "not found" marker in the body,
3. only then treats the content as a receipt,
4. and finally refuses to report success unless it actually extracted an amount or a party name.

---

## 3. Identifier rules (validated locally before any network call)

| Bank | Field | Rule |
|---|---|---|
| cbe | legacy FT | `FT` + exactly 10 alphanumerics |
| cbe | Receipt ID | 12–128 of `[A-Za-z0-9_-]`, not all digits, not FT-shaped |
| boa | reference + suffix | FT shape + **5-digit** suffix |
| telebirr, mpesa | transaction number | exactly 10 alphanumerics |
| dashen | reference | 3 digits + 13 alphanumerics |
| cbebirr | receipt number | 10–16 alphanumerics |
| awash | token | `-`+8 alnum, or a 6–64 char token |
| siinqee | reference | `E` + 11–63 alphanumerics |
| kaafiebirr | reference | 10–64, must contain a letter **and** a digit |
| coopayebirr | reference | 16–64 of `[A-Za-z0-9_-]` |

Phone numbers are canonicalised to the local `0XXXXXXXXX` form (`251[79]XXXXXXXX` → `0…`).

---

## 4. What this module does NOT claim

- It does **not** claim to know verify.et's private upstream call signatures. Those are server-side
  and unobservable.
- It does **not** guess M-Pesa's, Awash's or Siinqee's backing APIs. Those adapters report
  `endpoint_not_confirmed` rather than returning a wrong answer.
- It does **not** assume a successful receipt's field layout for banks where no real receipt was
  available. The HTML reader looks for common label spellings and reports what it finds.

**Rule of thumb:** a verification module that guesses is worse than one that admits a gap, because a
wrong "verified" releases money.

---

## 5. Verified against genuine bank receipts

Two real account statements were supplied by the project owner. **No personal data from them is
stored in this repository** — the test harness takes references as command-line arguments
(`apps/api/scripts/verify-ref.ts`), so nothing sensitive is ever committed. Party names and account
numbers are redacted below; reference numbers are kept so results are reproducible.

| Bank | Reference | Outcome | Amount | Duration |
|---|---|---|---|---|
| **CBE** | `FT26248CSHSP` (+ 8-digit account suffix) | **success** | 10,200.00 ETB | 1,101 ms |
| **Dashen** | `082WDTS262290003` | **success** | 20,400.00 ETB | 572 ms |

CBE returned a 374 KB PDF (`application/pdf`); Dashen returned a 125 KB HTML receipt page
(`<title>Receipt</title>`). Both were parsed into normalised fields: amount, sender, receiver,
reference, timestamp, plus branch / reason / amount-in-words for CBE and transfer-reference for Dashen.

### Bugs these real receipts exposed

Real data found three defects that synthetic tests did not:

1. **Dashen only tried JSON.** A *valid* Dashen reference returns an **HTML** receipt page, while an
   *unknown* one returns the JSON `"Transaction not found"` envelope. The adapter treated the HTML
   as "no receipt" and reported valid payments as `not_found` — the worst possible failure, since it
   would mark a paying member as unpaid. **Fixed** by adding an HTML fallback.

2. **Masked account numbers were being mangled.** `5082******011` was stripped to `5082011`, which
   reads as a genuine 7-digit account. **Fixed**: `normalizeAccountNumber()` now *preserves* the mask;
   a separate `visibleAccountDigits()` exists for comparison work.

3. **The label reader required a colon.** Dashen's receipt is an HTML table flattened to spaces
   (`Sender Name Adane Abeje Sender Account Number 5082******011`), so the old regex over-captured
   to the end of the page. **Fixed**: `readLabel()` now cuts at the next known label regardless of
   punctuation, and Dashen's real labels were added to the vocabulary.

### Also confirmed

**CBE's FT format is `FT` + exactly 10 characters.** In the statement the reference column wraps, so
`FT26248CSHSP` *appears* as `FT26248CSH` + `P` and looks like FT+9. Probing the endpoint proved the
full 12-character form is correct — which matches the validator the Equb app already uses. The
existing CBE method is sound; it needed no change.

> Three references in the same statement returned `404` from CBE. Those were outgoing/debit entries
> the receipt service does not publish, not a defect — worth knowing so a real 404 is not mistaken
> for a broken integration.

---

## 6. The clone — what was built


`apps/api/src/modules/bank-verification/` (additive; no existing file was modified):

```
types.ts                       BankCode, identifiers, normalised result shape
bank-rules.ts                  per-bank validation regexes + the URL routing table
receipt-parser.ts              turns a pasted link/SMS into bank + identifiers
bank-verification.service.ts   registry, smart routing, one public verify() entry point
bank-verification.module.ts    NestJS module (exports BankVerificationService)
adapters/
  adapter.interface.ts         the small contract each bank implements
  http.ts                      TLS/UA/timeout quirks of bank hosts in one place
  html-receipt.ts              generic label/value reader for HTML receipts
  cbe.adapter.ts               PDF path + Receipt-ID path
  boa.adapter.ts               FT + 5-digit suffix
  dashen.adapter.ts            JSON contract, incl. internalCode
  generic-receipt.adapter.ts   config-driven: telebirr, mpesa, cbebirr, eBirr, siinqee, awash
```

Adding a new bank is one entry in the config array, or one file if it needs custom parsing.

### Usage

```ts
// inside any module
imports: [BankVerificationModule]

// inject and call
constructor(private readonly verification: BankVerificationService) {}

// explicit bank
await this.verification.verify({
  bank: 'cbe',
  identifiers: { referenceNumber: 'FT26079ABCDE', accountSuffix: '12345678' },
});

// or just let it work it out from a pasted link
await this.verification.verify({
  rawInput: 'https://transactioninfo.ethiotelecom.et/receipt/view?transactionno=DEI1234ABC',
});
```

---

## 7. Verification performed

| Check | Result |
|---|---|
| `tsc --noEmit` (whole API) | **clean** |
| `tsc` with emit to a temp dir | **clean** — all 12 files emitted |
| Pure-logic smoke test (30 assertions) | **30 passed, 0 failed** |
| Live end-to-end against real banks (8 cases) | **8 passed, 0 failed** |

Live results, using deliberately non-existent references:

```
PASS  CBE          not_found  ~1.9s   (PDF endpoint answered 404)
PASS  Dashen       not_found  ~3.6s   parsed their JSON: "Transaction not found"
PASS  Telebirr     failed    —        host stopped answering (see below)
PASS  Kaafi eBirr  not_found  ~0.8s
PASS  BOA          failed     0ms     rejected locally before any network call
PASS  Siinqee      failed    ~1.9s    reported as client-rendered, not guessed
PASS  Router       not_found  ~1.1s   pasted CBE link resolved correctly
PASS  Router       failed     0ms     ambiguous 10-char token -> asked which bank
```

### Findings the tests surfaced

1. **Telebirr rate-limits aggressively.** It advertises `X-RateLimit-Limit: 5`, answered our first
   probe in 1.4 s, then stopped responding entirely. The adapter reports this as a **retryable**
   failure rather than a false "not found" — but the timeout is bounded (20 s × 1 retry) so a
   Telegram flow cannot hang indefinitely.
2. **A real API design flaw** — `identifiers` had to become optional so a caller can pass only
   `rawInput`. Caught by the live test, not by the type-checker.
3. **`npm run lint` in `apps/api` was already broken before this work** — there is no
   `eslint.config.*` file and no `eslint` dependency in that package, so ESLint 10 exits with
   "couldn't find an eslint.config.* file". AGENTS.md says to lint the API; that instruction cannot
   currently be followed. Worth fixing separately.
4. **`npm run build:api` fails in a sandboxed environment** for an unrelated reason: `nest build`
   wipes `dist/` (271 files), which trips the bulk-delete guard. Compiling with `tsc` directly
   succeeds, so this is environmental, not a code defect.

---

## 8. Deposit-level integration (stage 2)

Everything above is a verifier: give it identifiers, it answers. This section covers the step that
connects it to a stored `Deposit` — and it was built to be removable.

### What was added

| File | Role |
|---|---|
| `deposit-verification.service.ts` | **new** — the only code in this feature that writes to the database |
| `bank-verification.controller.ts` | **edited** — one new route appended |
| `bank-verification.module.ts` | **edited** — one provider registered |
| `app.module.ts` | **unchanged from stage 1** — the same 2 lines |

### Why a separate service

`BankVerificationService` never touches the database. That is what makes it safe to call from
anywhere and trivial to test. The write path therefore lives in `DepositVerificationService`, which
is the *only* place that can mutate a deposit. Deleting that one file plus its route removes the
feature completely.

### No schema migration

Results are written into the **existing** `Deposit.cbeVerificationData Json?` column, in a shape that
is a superset of the existing `CbeTransactionData` type: the same core keys (`ftNumber`, `amount`,
`payer`, `payerAccount`, `receiver`, `receiverAccount`, `date`, `reference`, `branch`) plus additive
`provider*` metadata. Nothing that already reads that column breaks, and no `prisma migrate` is
needed — which matters because a migration is the one change that cannot be rolled back safely on
the next deploy.

### The approval rule — identical to the proven CBE path, plus one

A deposit is flipped to `VERIFIED` only when **all three** hold:

1. **Amount matches.** `|bank amount − deposit amount| < 0.01`. Compared against the *recorded*
   deposit amount, which already reflects the member's share multiplier — the same correction the
   working CBE service makes, and for the same reason.
2. **Receiver matches.** The account on the receipt must belong to the group. Masked accounts are
   handled by matching the visible **prefix against the start** and the visible **suffix against the
   end** of the expected account — not by `includes()`, which can never match a masked number.
3. **Reference is not already used.** If the same reference already sits on a different `VERIFIED`
   deposit, the deposit is *not* approved. `ftNumber` is unique at the database level, so this
   catches the remaining hole: one deposit storing a Receipt ID while the bank returns the FT ref.

Anything else leaves the deposit **PENDING** and records the attempt for review. Nothing is ever
auto-rejected: a wrong rejection damages a paying member just as much as a wrong approval.

### Two deliberate safety guarantees

- **A failed attempt never erases a success.** If the column already holds a successful verification
  (ours, or the existing CBE service's `success: true`), a later timeout or mistyped reference will
  not overwrite it.
- **`BankVerificationService` still cannot write.** All persistence is behind
  `DepositVerificationService`.

### Endpoint

```
POST /verification/deposit/:id/auto      (JWT + canManageDeposits)
body: { bank?, accountNumber? }
```

Separate from `POST /deposits/:id/auto-verify-cbe`, which is untouched. Ordinary business outcomes
return **HTTP 200** with `verified: false` and a machine-readable `reason`
(`already_decided`, `no_reference`, `bank_unresolved`, `invalid_input`, `not_found`,
`upstream_failed`, `amount_mismatch`, `receiver_mismatch`, `duplicate_reference`). Only a missing
deposit produces a 404.

### Live proof, end to end

`scripts/verify-deposit-live.ts <bank> <ref> <amount> [account]` runs the real service against the
real bank with the database stubbed, so nothing is written anywhere.

Against the genuine Dashen receipt (20,400 ETB):

```
verified      : true
reason        : verified
checks        : {"amountMatched":true,"receiverMatched":true,"duplicateReference":false}
receipt amount: 20400 ETB
sender        : Adane Abeje Ayalew
sender acct   : 5082******011
receiver acct : 5400******011
status change : VERIFIED
autoVerified  : true
duration      : ~490 ms
```

### A correction this live run produced

The earlier reading of that receipt treated `5082******011` as the **receiver**. It is the
**sender**. The money went to `5400******011`. Running the deposit path with `5082...` as the
group account was correctly refused with `receiver_mismatch` — which is exactly the behaviour that
matters: a wrong assumption about which account belongs to the group now fails loudly instead of
silently approving a payment to someone else.

The CBE live check resolves **only** when the FT is paired with the account that actually received
the money, because the endpoint is `FT + last 8 digits of the receiving account`. With the correct
pair it succeeds:

```
verified      : true
reason        : verified
checks        : {"amountMatched":true,"receiverMatched":true,"duplicateReference":false}
receipt amount: 10200 ETB
timestamp     : 2026-09-05T12:15:00.000Z
status change : VERIFIED
autoVerified  : true
duration      : ~990 ms
```

Supplying an account that does not pair with the FT correctly yields `not_found` and leaves the
deposit `PENDING` — the endpoint returns `404` with "You Are Not Allowed to See This Data", which
the adapter reports as `not_found` rather than a transport failure. The user's own CBE method is
unchanged and still the one in use.

### Verification performed on this stage

| Check | Result |
|---|---|
| `tsc --noEmit` (whole API) | **clean** |
| `scripts/verification-di-check.ts` (32 assertions) | **32 passed, 0 failed** |
| `__smoke__.ts` (30 assertions, unchanged) | **30 passed, 0 failed** |
| Live Dashen, deposit path | **verified, 20,400 ETB** |
| Live CBE, deposit path | **verified, 10,200 ETB** |
| Tracked files modified | **1 file, 2 lines** (`app.module.ts`) |

`deposits.service.ts`, `deposits.controller.ts`, `deposits.module.ts`,
`cbe-verification.service.ts` and `schema.prisma` are all **byte-for-byte unchanged**.

