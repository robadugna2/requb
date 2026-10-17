# Verify.ET — Reverse-Engineered Integration Reference

**Status:** Reconnaissance complete. No EQUB application code has been modified.
**Date of capture:** 2026-10-16
**Target:** `https://verify.et` (legacy alias: `https://confirm.et`)
**Operator:** Suba Software Solution — <https://subasoftware.com> (stated in the site footer of `/login`)

> **Evidence discipline.** Every claim below is tagged with how it was established:
>
> | Tag | Meaning |
> |---|---|
> | **[LIVE]** | Observed by a direct HTTP request against the production service on 2026-10-16. Raw output in `evidence/`. |
> | **[BUNDLE]** | Recovered from JavaScript the production site actually served to a browser. Byte-exact copies retained. |
> | **[REA]** | Captured by a REA-driven headless Chromium scenario (network + DOM + screenshot). Evidence JSON retained. |
> | **[DOCS]** | Stated by Verify.ET's own documentation pages. Vendor claim — **not** independently verified. |
>
> Anything not tagged was not verified and is not asserted. Where the vendor docs and the observed
> reality disagree, the discrepancy is called out explicitly.

---

## 0. How this was produced (reproducible method)

1. **HTTP probing** — `curl` against every endpoint named in the vendor docs, plus the endpoints
   discovered from the client bundle. Purpose: prove which routes exist and what they enforce.
2. **REA browser scenarios** — `rea capture-browser-scenario` driving headless Chrome 155.0.8059.41
   against `/`, `/login`, and `/verify`. Captured DOM, screenshots, console/page errors, and every
   network transaction (71, 53, and 68 transactions respectively).
3. **Static analysis of shipped bundles** — 65 JavaScript chunks (~800 KB) served by production were
   downloaded and mined for API paths, per-bank field rules, validation regexes, and error codes.
   Minification does not remove string literals or regexes, so these survive intact.

**Evidence artifacts** (all under `docs/verify-et/evidence/`):

| File | Contents |
|---|---|
| `probe-gets.txt` | Live GET probes with status codes |
| `probe-posts.txt` | Live POST probes with status codes |
| `receipt-url-rules.js` | The verbatim "universal smart router" URL-rule table **[BUNDLE]** |
| `rea-home.json` | REA evidence bundle for `https://verify.et/` |
| `rea-login.json` | REA evidence bundle for `/login` |
| `rea-verify.json` | REA evidence bundle for `/verify` |
| `login-dom.html` | Rendered DOM of `/login` |
| `verify-dom.html` | Rendered DOM of `/verify` |

REA evidence IDs: `ev_b4a8a9f0…` (home), plus the login/verify bundles in the same directory.

---

## 1. What Verify.ET actually is

A **server-side payment-receipt verification gateway** for Ethiopian banks and wallets. You send it a
receipt identifier; it resolves the transaction against the underlying provider and returns a
normalised JSON result. It is **not** a bank and **not** a payment gateway — it does not move money.

**Stack, as observed:**

| Layer | Finding | Evidence |
|---|---|---|
| Frontend | Vite + **Rolldown** bundled React SPA, TanStack Router + TanStack Query | **[BUNDLE]** `rolldown-runtime-*.js`, `vendor-react-*.js`, `vendor-router-*.js`, `vendor-query-*.js` |
| Auth | **Better Auth**, Telegram OAuth2 provider | **[BUNDLE]** `auth-client-*.js`; **[LIVE]** `GET /api/auth/get-session` → `200` |
| Edge | Cloudflare (`Server: cloudflare`, `CF-RAY`, `cf-cache-status`) | **[LIVE]** response headers |
| API style | REST, JSON envelope `{ success, message, data, … }` | **[LIVE]** all probes |
| Analytics | `analytics.passport.et/api/send` (third party) | **[REA]** network capture |
| Legacy domain | `confirm.et` is rewritten to `verify.et` client-side | **[BUNDLE]** `http-*.js` |

The HTTP client shipped to browsers reveals the transport contract exactly **[BUNDLE]**:

- Base URL `https://verify.et`, overridable to the page origin when both are loopback.
- `credentials: "include"` — **cookie sessions** are the browser auth mechanism.
- Default timeout **8000 ms**.
- Errors surface as a typed `ApiError { status, requestId, retryAfterSeconds, body }`, where
  `requestId` comes from the `x-request-id` header and `retryAfterSeconds` from `Retry-After`.

---

## 2. Authentication model

There are **two independent access paths**. This is the single most important fact for integration.

### 2.1 Account path — `x-api-key` (what a server integration must use)

```
x-api-key: VERIFY_BANK_ET_<secret>
Idempotency-Key: <unique-string>
```

Keys are **scoped by resource and action** **[DOCS]**:

| Permission | Grants |
|---|---|
| `verification:read` / `verification:write` | verify, poll, history, webhook management |
| `metrics:read` | `/api/metrics`, `/api/reports/*` |
| `uptime:read` | `/api/uptime` |

Live proof that the key is enforced **[LIVE]**:

```
POST /api/verify   (no key)      → 401  {"success":false,"message":"Unauthorized"}
POST /api/verify   (bogus key)   → 401  {"success":false,"message":"Invalid API key."}
GET  /api/metrics  (no key)      → 401  {"success":false,"message":"Unauthorized"}
```

> Note the **two distinct 401 bodies**: a missing key yields `Unauthorized`, a present-but-invalid
> key yields `Invalid API key.` — useful for distinguishing misconfiguration from a bad secret.

### 2.2 Public path — no key, heavily rate-limited

```
POST /api/public/verify
```

Discovered in the shared `lib-*.js` chunk **[BUNDLE]**:

```js
T = `/api/verify`          // account scope  (requires x-api-key)
E = `/api/public/verify`   // public scope   (no key)
D = scope => scope === `public` ? E : T
```

Confirmed live **[LIVE]** — a keyless POST was accepted:

```json
{"success":true,"message":"Verification queued.","data":[],
 "requestId":"327654e4-ca56-426a-aed1-f68918f6f62f",
 "statusUrl":"/api/public/verify/327654e4-ca56-426a-aed1-f68918f6f62f",
 "estimatedWaitMs":5000,
 "verification":{"requestId":"…","bank":"cbe","processingStatus":"queued",
                 "status":"pending","verified":false},
 "links":{"statusUrl":"…","pollAfterMs":1500}}
```

…and then **rate-limited after a handful of calls** **[LIVE]**:

```json
{"success":false,
 "message":"You have reached the free receipt check limit. Sign in to keep checking receipts.",
 "data":[],
 "retryAfterSeconds":713,
 "error":{"code":"PUBLIC_VERIFY_RATE_LIMITED","retryAfterSeconds":713}}
```

The first public response also carried `X-RateLimit-Limit: 5` and `X-RateLimit-Remaining: 0`
**[LIVE]** — i.e. **5 free checks per window per client**.

> **Integration consequence:** the public endpoint is fine for a manual "check one receipt" screen,
> but it is **not** viable for automated Equb deposit processing. Automated verification must use an
> `x-api-key`.

### 2.3 Interactive login (for the dashboard only)

`/login` offers exactly one control: **"Continue with Telegram"** **[REA]** `login-dom.html`.
No email/password form is rendered. The click handler is **[BUNDLE]** `TelegramAuthPanel-*.js`:

```js
await authClient.signIn.oauth2({
  providerId: "telegram",
  callbackURL:       `${origin}/dashboard`,
  errorCallbackURL:  `${origin}/login?redirect=…`,
  requestSignUp: true,
});
```

Telegram sign-in error codes recovered verbatim **[BUNDLE]**:
`access_denied`, `oauth_code_verification_failed`, `user_info_is_missing`, `name_is_missing`,
`unable_to_create_session`, `unable_to_create_user`, `account_not_linked`.

> Better Auth email routes (`/sign-in/email`, `/sign-up/email`) exist in the router but are **not**
> surfaced by the `/login` page.

---

## 3. Endpoint catalogue

All rows below were probed live on 2026-10-16 unless marked otherwise.

| Method | Path | Auth | Live result | Notes |
|---|---|---|---|---|
| POST | `/api/verify` | `x-api-key` | `401` no key / `401 Invalid API key.` bogus key | Account verification |
| POST | `/api/public/verify` | none | `202` queued | Rate-limited to 5 |
| GET | `/api/verify/:requestId` | `x-api-key` | `401` | Status poll |
| GET | `/api/public/verify/:requestId` | none | `200` completed | Status poll (public) |
| GET | `/api/verify/:requestId/events` | `x-api-key` | **[BUNDLE]** | SSE stream, `withCredentials:true` |
| GET | `/api/verify/history` | `verification:read` | `401` | Filters: bank, status, dates, limit, offset |
| GET | `/api/verify/:id/receipt` | session/public | **[BUNDLE]** | Returns the **original bank receipt** |
| POST | `/api/verify/test-webhook` | `verification:read` | **[DOCS]** | Legacy one-off webhook test |
| POST | `/api/webhook-endpoints` | `verification:write` | `401` | Create endpoint, secret shown once |
| POST | `/api/webhook-endpoints/:id/test` | `verification:write` | **[DOCS]** | |
| POST | `/api/webhook-endpoints/:id/rotate-secret` | `verification:write` | **[DOCS]** | 24 h dual-secret overlap |
| PATCH | `/api/webhook-endpoints/:id` | `verification:write` | **[DOCS]** | Change events / pause |
| GET | `/api/webhook-endpoints/:id/deliveries` | `verification:read` | **[DOCS]** | |
| POST | `/api/webhook-endpoints/:id/deliveries/:d/redeliver` | `verification:write` | **[DOCS]** | |
| POST | `/api/api-keys` | session cookie | `401` | Secret returned **once** |
| GET | `/api/bank-accounts` | session cookie | `401` | Saved settlement accounts |
| GET | `/api/metrics` | `metrics:read` | `401` | |
| GET | `/api/uptime` | `uptime:read` | `401` | |
| GET | `/api/uptime/client/*` | public | **[DOCS]** | |
| GET | `/api/reports/summary` | — | **`404`** | ⚠️ **Docs claim `/api/reports/*`; this subpath does not exist** |

**Documentation discrepancy:** the vendor docs state `GET /api/reports/*` requires `metrics:read`.
The concrete path `/api/reports/summary` returns **`404 Not Found`** (not `401`), meaning no route
matches it at all. The real report paths must be discovered from an authenticated session.

**Client-side route map** (recovered **[BUNDLE]**, useful for onboarding a human operator):

```
/login  /register  /verify-email  /dashboard  /pricing  /docs  /status  /uptime  /blog
/verify           /verify/:bank      /verify/receipt
/status/:bank
/docs/get-started /docs/api          /docs/sdk
/dashboard/api-keys/  /dashboard/api-keys/$key  /dashboard/api-keys/webhooks/
/dashboard/api-keys/image-processing/
/dashboard/verifications/  /dashboard/verifications/$request
/dashboard/business/accounts  /dashboard/business/team  /dashboard/business/insights
/dashboard/business/transactions/$verification  /dashboard/business/reports/$membership
/dashboard/settings/profile  /dashboard/settings/business
/dashboard/subscription  /dashboard/payments
```

---

## 4. The verification flow

```
                     ┌─────────────────────────────────────────────┐
  POST {bank, ref}   │  /api/verify          (x-api-key)           │
  ──────────────────►│  /api/public/verify   (no key, 5-per-window)│
                     └──────────────┬──────────────────────────────┘
                                    │
                     200 ───────────┴─────────── 202
                   (finished inline)          (queued)
                                                    │
                        ┌───────────────────────────┼──────────────────────────┐
                        ▼                           ▼                          ▼
             GET /api/verify/:id          GET …/:id/events (SSE)      webhook POST to you
             (poll, pollAfterMs)          (streams status, done)      (verification.completed)
```

- **`waitMs`** (query param) makes the API wait briefly inline; if it finishes in time you get `200`,
  otherwise `202`. The client requests `waitMs` for public checks **[BUNDLE]**.
- On `202` you **must** keep `requestId`; the client treats a missing `requestId` as a hard error.
- The client's own polling budget is **125 seconds**, stopping when `processingStatus` is
  `completed` or `failed` **[DOCS]**.
- `X-Verify-Cache: HIT` is returned when a result was served from cache **[BUNDLE]** reads this
  header; it is also listed in `Access-Control-Expose-Headers` **[LIVE]**.

### 4.1 Real end-to-end result **[LIVE]**

Submitted `{"bank":"cbe","reference":"INVALIDTEST123"}`; polled the status URL 6 s later:

```json
{"success":true,"message":"Verification status.",
 "data":{
   "requestId":"327654e4-ca56-426a-aed1-f68918f6f62f",
   "bank":"cbe",
   "processingStatus":"completed",
   "status":"not_found",
   "verified":false,
   "result":{"bank":"cbe","status":"not_found","verified":false,"receiptNumber":"INVALIDTEST123"},
   "errorMessage":"No CBE transaction found.",
   "error":{"code":"not_found","message":"No CBE transaction found.","retryable":false},
   "queuedAt":"2026-10-16T13:46:45.513Z",
   "startedAt":"2026-10-16T13:46:45.547Z",
   "completedAt":"2026-10-16T13:46:45.985Z"}}
```

Round trip ≈ **470 ms**. Note the full lifecycle timestamps — useful for latency budgeting and for
proving to an admin *when* a check ran.

### 4.2 Successful result shape **[DOCS]** (not independently verified — we had no valid receipt)

```json
{"success":true,"message":"Transaction verified successfully.",
 "data":[{
   "bank":"cbe","status":"success","verified":true,
   "amount":1500,"currency":"ETB",
   "senderName":"…","receiverName":"…","receiverAccount":"1****7441",
   "referenceNumber":"FT26EXAMPLE1","receiptNumber":"fHCxyExampleRcpt1",
   "timestamp":"2026-02-20T12:00:00.000Z",
   "confirmationHistory":{ "scope":"platform","isFirstConfirmation":true,
                           "confirmedBefore":false,"confirmationCount":1 },
   "settlementAccountMatch":{ "matched":true,"matchType":"masked_pattern",
                              "matchConfidence":"high","reason":"receiver_mask_matches_visible_digits" }
 }],
 "requestId":"…",
 "verification":{ "processingStatus":"completed","status":"success","verified":true }}
```

⚠️ **Important asymmetry:** on the **submit** response, results live in `data` as an **array**
(`data: []` when queued, `data: [{…}]` when done). On the **poll** response, the result lives in
`data` as an **object** with a nested `result` field. Any adapter must handle both.

`confirmationHistory` is a **fraud signal**: it tells you whether this same receipt has already been
confirmed before, platform-wide. `confirmedBefore: true` on a fresh deposit claim is a duplicate-receipt
attempt. This is directly relevant to Equb — one bank receipt should back exactly one deposit.

---

## 5. Supported banks and required fields

Two independent sources agree: the vendor docs **[DOCS]** and the public `/verify` bank directory
**[REA]** `verify-dom.html`.

| Bank | `bank` value | Required field(s) | Public page label |
|---|---|---|---|
| Commercial Bank of Ethiopia | `cbe` | `reference` = **Receipt ID** (no suffix). Legacy `FT…` refs need an 8-digit suffix | "Receipt ID" |
| Bank of Abyssinia | `boa` | `referenceNumber` + `accountSuffix` (**exactly 5 digits**) | "Reference number / Account suffix (5 digits)" |
| Telebirr | `telebirr` | `transactionNumber` | "Transaction number" |
| M-Pesa Ethiopia | `mpesa` | `transactionNumber` | "Transaction number" |
| CBE Birr | `cbebirr` | `receiptNumber` + `phone` | "Receipt number / Phone (251XXXXXXXXX)" |
| Dashen Bank | `dashen` | `referenceNumber` | "Reference number" |
| Awash Bank | `awash` | `referenceNumber` | "Receipt URL or token" |
| Siinqee Bank | `siinqee` | `referenceNumber` | "Receipt URL or token" |
| Kaafi eBirr | `kaafiebirr` | `referenceNumber` (+ optional `phone`) | "Receipt URL or token / Phone (optional)" |
| Coopay eBirr | `coopayebirr` | `referenceNumber` (+ optional `phone`) | "Receipt link or token / Phone (optional)" |
| Zemen Bank | `zemen` | — | ⚠️ **Enum/status surface only.** Direct submissions return *unsupported* **[DOCS]** |

**Universal smart router.** You may omit `bank` and send only `reference`. Explicit `bank` always
wins when present **[DOCS]**. Live proof of routing **[LIVE]**:

```
POST /api/public/verify  {"reference":"INVALIDTEST123"}   → resolved bank: "cbe"
POST /api/public/verify  {}                               → 400-equivalent:
   "Missing `reference` for universal verification.
    Provide `reference` or use explicit `bank` payload fields."
```

**Settlement-account matching.** Optional `settlementAccount` asserts *which* account should have
received the money; otherwise Verify.ET checks your saved `/api/bank-accounts` **[DOCS]**.
Stable reason codes **[DOCS]**:
`receiver_account_exact_match`, `receiver_mask_matches_visible_digits`, `receiver_suffix_matches`,
`no_registered_accounts`, `missing_receiver_account`, `candidate_account_mismatch`,
`ambiguous_registered_accounts`, `verification_not_successful`.
Masked matches that are ambiguous return `matched:false, ambiguous:true` rather than guessing.

---

## 6. Universal smart router — full URL-rule table **[BUNDLE]**

This is the verbatim table shipped to browsers, recovered from `src-*.js`. It is the authoritative
description of how a pasted **receipt URL** is turned into bank + field values.

```js
[
 {bank:`cbe`,hostPatterns:[`apps.cbe.com.et`],pathPrefixes:[`/`],
  extractField:`referenceNumber`,extractFrom:`query`,queryParams:[`id`],minLength:4,confidence:.99},

 {bank:`cbe`,hostPatterns:[`mbreciept.cbe.com.et`,`mbrecipt.cbe.com.et`],pathPrefixes:[`/`],
  extractField:`receiptNumber`,extractFrom:`path`,pathIndex:-1,minLength:12,preserveHyphen:true,confidence:.99},

 {bank:`dashen`,hostPatterns:[`receipts.dashenbanksc.com`,`receipt.dashensuperapp.com`],
  pathPrefixes:[`/receipt/`],extractField:`referenceNumber`,extractFrom:`path`,pathIndex:-1,
  minLength:4,confidence:.99},

 {bank:`telebirr`,hostPatterns:[`transactioninfo.ethiotelecom.et`],pathPrefixes:[`/receipt/view`],
  extractField:`transactionNumber`,extractFrom:`query`,
  queryParams:[`transactionno`,`transaction`,`transactionid`,`reference`,`ref`,`tid`],
  minLength:4,preserveHyphen:true,confidence:.99},

 {bank:`telebirr`,hostPatterns:[`transactioninfo.ethiotelecom.et`],
  pathPrefixes:[`/receipt/`,`/receit/`,`/reciept/`],
  extractField:`transactionNumber`,extractFrom:`path`,pathIndex:-1,minLength:4,
  preserveHyphen:true,confidence:.99},

 {bank:`telebirr`,hostPatterns:[`leul.et`],pathPrefixes:[`/verify.php`],
  extractField:`transactionNumber`,extractFrom:`query`,queryParams:[`reference`],
  minLength:4,preserveHyphen:true,confidence:.99},

 {bank:`mpesa`,hostPatterns:[`m-pesabusiness.safaricom.et`],pathPrefixes:[`/receipt/`],
  extractField:`transactionNumber`,extractFrom:`path`,pathIndex:-1,minLength:4,
  preserveHyphen:true,confidence:.99},

 {bank:`mpesa`,hostPatterns:[`m-pesabusiness.safaricom.et`],pathPrefixes:[`/api/receipt/getreceipt`],
  extractField:`transactionNumber`,extractFrom:`query`,
  queryParams:[`trxno`,`reference`,`transactionno`,`transaction`],minLength:4,
  preserveHyphen:true,confidence:.99},

 {bank:`boa`,hostPatterns:[`cs.bankofabyssinia.com`],
  pathPrefixes:[`/api/onlineslip/getdetails/`,`/slip/`],
  extractField:`referenceNumber`,extractFrom:`query`,queryParams:[`id`,`trx`],
  minLength:4,confidence:.99},

 {bank:`cbebirr`,hostPatterns:[`cbepay1.cbe.com.et`],pathPrefixes:[`/aureceipt`],
  extractField:`receiptNumber`,extractFrom:`query`,queryParams:[`tid`],minLength:4,confidence:.99},

 {bank:`awash`,hostPatterns:[`awashpay.awashbank.com`],
  extractField:`transactionNumber`,extractFrom:`path`,pathIndex:-1,minLength:4,
  preserveHyphen:true,confidence:.99},

 {bank:`siinqee`,hostPatterns:[`receipts.siinqeebank.com`],pathPrefixes:[`/generate/`],
  extractField:`referenceNumber`,extractFrom:`path`,pathIndex:-1,minLength:4,confidence:.99},

 {bank:`kaafiebirr`,hostPatterns:[`receipt.ebirr.com`],pathPrefixes:[`/kaafimf/`],
  extractField:`referenceNumber`,extractFrom:`path`,pathIndex:-1,minLength:4,
  preserveHyphen:true,confidence:.99},

 {bank:`coopayebirr`,hostPatterns:[`receipt.ebirr.com`],pathPrefixes:[`/coopay/`],
  extractField:`referenceNumber`,extractFrom:`path`,pathIndex:-1,minLength:4,
  preserveHyphen:true,confidence:.99},
]
```

**Notable behaviours recovered alongside it [BUNDLE]:**

- **URL normalisation** before matching: strips zero-width characters, repairs `https://` typos
  (`https::\/\/`, `https:\/`), and prefixes bare `host.tld/path` inputs with `https://`.
- **CBE legacy split:** an `apps.cbe.com.et/?id=` URL carrying `FT<10 chars><8 digits>` is split into
  `referenceNumber = FT…` + `accountSuffix = <8 digits>`.
- **Bank-of-Abyssinia split:** same `FT<10><5 digits>` split with a **5-digit** suffix.
- **Phone canonicalisation:** `2517XXXXXXXX` / `2519XXXXXXXX` → `07XXXXXXXX` / `09XXXXXXXX`.
- **Input guard:** the SMS/text parser accepts up to **16384 characters**, and field values shorter
  than 3 characters are discarded.
- **Confidence scoring:** URL-derived fields score `.98`–`.99`; whole-host ambiguity alone scores
  `.95`. Extraction sources are labelled `official-url`, `sender-id`, `composite-token`, or `content`
  (mixed → `hybrid`).

---

## 7. Per-bank identifier validation **[BUNDLE]**

Shipped client-side validators. Useful to replicate server-side so bad input is rejected before it
costs a verification credit.

| Bank | Field | Regex |
|---|---|---|
| `cbe` | `referenceNumber` (FT ref) | `/^FT[A-Za-z0-9]{10}$/i` |
| `cbe` | `receiptNumber` (Receipt ID) | `/^(?!FT[A-Za-z0-9]{10}(?:\d{5}\|\d{8})?$)[A-Za-z0-9_-]{12,128}$/i` **and not** all digits |
| `telebirr`, `mpesa` | `transactionNumber` | `/^[A-Za-z0-9]{10}$/` |
| `dashen` | `referenceNumber` | `/^\d{3}[A-Za-z0-9]{13}$/` |
| `cbebirr` | `receiptNumber` | `/^[A-Za-z0-9]{10,16}$/` |
| `awash` | `referenceNumber` | `/^(?:-[A-Za-z0-9-]{8,}\|[A-Za-z0-9][A-Za-z0-9@._-]{5,63})$/` |
| `siinqee` | `referenceNumber` | `/^E[A-Za-z0-9]{11,63}$/i` |
| `kaafiebirr` | `referenceNumber` | `/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9_-]{10,64}$/` |
| `coopayebirr` | `referenceNumber` | `/^[A-Za-z0-9_-]{16,64}$/` |
| — | phone → local form | `/^251[79]\d{8}$/` ⇒ `0` + last 9 |

---

## 8. Exact request bodies per bank **[BUNDLE]**

Recovered verbatim from the client's payload builder — this is precisely what the site sends:

```js
cbe:         {bank:"cbe", receiptNumber}                                  // when a Receipt ID is known
cbe:         {bank:"cbe", referenceNumber, accountSuffix}                 // legacy FT path
telebirr:    {bank:"telebirr", transactionNumber}
dashen:      {bank:"dashen", referenceNumber}
boa:         {bank:"boa", referenceNumber, accountSuffix}
cbebirr:     {bank:"cbebirr", receiptNumber, phone}
awash:       {bank:"awash", referenceNumber}          // falls back to transactionNumber
mpesa:       {bank:"mpesa", transactionNumber}
siinqee:     {bank:"siinqee", referenceNumber}
kaafiebirr:  {bank:"kaafiebirr", referenceNumber}  (+ {phone} when supplied)
coopayebirr: {bank:"coopayebirr", referenceNumber} (+ {phone} when supplied)
```

Field-name aliases accepted by the API **[DOCS]**: `reference` ≡ `referenceNumber`; `suffix` ≡
`accountSuffix`; `phone` ≡ `phoneNumber`; `receiptNumber` is a CBE alias of the Receipt ID.

---

## 9. Error catalogue

### 9.1 Observed live **[LIVE]**

| HTTP | Body / `error.code` | Meaning |
|---|---|---|
| 401 | `{"success":false,"message":"Unauthorized"}` | No API key supplied |
| 401 | `{"success":false,"message":"Invalid API key."}` | Key present but rejected |
| 404 | `404 Not Found` (text/plain) | No such route (e.g. `/api/reports/summary`) |
| 202 | `"Verification queued."` | Accepted, async |
| 200 | `error.code: "not_found"`, `retryable:false` | Provider has no such transaction |
| 429 | `error.code: "PUBLIC_VERIFY_RATE_LIMITED"` + `retryAfterSeconds` | Free public quota exhausted |

### 9.2 Documented **[DOCS]** (vendor claims, not independently verified)

```
401  Invalid API key
403  Permission denied: verification:write required
409  Idempotency key already used for a different verification request
422  Invalid bank-specific payload
429  API key rate limit exceeded or queue saturated
503  Verification queue unavailable
402  INSUFFICIENT_CREDITS
```

### 9.3 Receipt-image errors **[DOCS]**

`IMAGE_IDEMPOTENCY_KEY_REQUIRED`, `IMAGE_REQUIRED`, `INVALID_IMAGE`, `INVALID_IMAGE_FIELDS`,
`INVALID_MULTIPART`, `IMAGE_TOO_LARGE` (413), `UNSUPPORTED_IMAGE` (415), `INSUFFICIENT_IMAGE_CREDITS`
(402), `IMAGE_PROCESSING_DISABLED` (403), `IMAGE_IDEMPOTENCY_CONFLICT` (409),
`IMAGE_PROCESSING_IN_PROGRESS` (409), `IMAGE_FIELD_CONFLICT` (422), `IMAGE_EXTRACTION_INCOMPLETE`
(422), `IMAGE_UNREADABLE` (422), `IMAGE_PROVIDER_FAILURE` (502), `IMAGE_OCR_TIMEOUT` (504),
`IMAGE_PROCESSING_UNAVAILABLE` (503).

> Image processing is **off by default** and billed separately in **image credits**. JPEG/PNG/WebP,
> ≤ 8 MB, OCR may take up to 30 s (set client timeout ≥ 45 s).

---

## 10. Webhooks (the recommended production path)

Register **one** HTTPS endpoint, then submit without a per-request callback URL **[DOCS]**.

**Delivery contract:**
- Header `X-Webhook-Signature: sha256=<hex>`; **also** `X-Webhook-Timestamp`, `X-Webhook-Event-Id`,
  and `X-Webhook-Test: true` on test pings.
- Signature = `HMAC-SHA256(secret, "<timestamp>.<raw body>")`. Compare in **constant time**, accept
  multiple comma-separated `sha256=` values during rotation.
- Reject stale timestamps (> 5 minutes skew) — the vendor's own sample enforces this.
- Reply **204** immediately, then process asynchronously.
- **Retries:** 5 attempts — immediately, 30 s, 2 m, 8 m, 30 m — same event id and JSON, new timestamp.
- Secret is `whsec_…`, shown **once**; rotation keeps the old secret valid for **24 h**.
- Events: `verification.completed` (default), optional `verification.succeeded`,
  `verification.not_found`, `verification.failed`; `webhook.test` always on.
- Max **10** endpoints per account.

**Payload [DOCS]:**

```json
{"id":"7c9e6679-…","event":"verification.completed",
 "requestId":"550e8400-…","timestamp":"2026-02-20T12:00:02.500Z",
 "data":{"processingStatus":"completed","status":"success","verified":true,
         "bank":"cbe","amount":"1500","currency":"ETB",
         "senderName":"…","receiverName":"…",
         "referenceNumber":"FT26EXAMPLE1","receiptNumber":"fHCxyExampleRcpt1",
         "durationMs":2340,"completedAt":"2026-02-20T12:00:02.340Z"}}
```

`data.error` is present when the check does not verify.

---

## 11. Credits, limits, and cost model **[DOCS]**

- Every verification consumes a **verification credit** from a shared account balance; exhaustion
  returns `402 INSUFFICIENT_CREDITS`.
- Image processing consumes a separate **image credit**. A credit is spent once the file is
  *accepted* — a failed OCR or a later verification failure does **not** refund it. A retry with the
  same `Idempotency-Key` and same file spends nothing extra.
- API-key rate limits return `429` + `Retry-After`; queue saturation also returns `429`.

---

## 12. What is still unverified (honest gaps)

These require either your credentials or a real receipt. I have **not** guessed at any of them.

1. **A real successful verification** — we only produced `not_found`. The success payload, the
   `settlementAccountMatch` object, and `confirmationHistory` remain **[DOCS]**-only.
2. **`GET /api/reports/*`** — the documented wildcard did not resolve at `/summary` (404). The real
   report paths need an authenticated session to enumerate.
3. **`GET /api/verify/:id/receipt`** — the original-receipt download. Its response schema was
   recovered from the bundle (`kind: document|link|unavailable`), but no live call was made.
4. **Account-level rate limits and credit pricing** — only the *public* limit (5) was measurable.
5. **Zemen** — documented as status-only; not confirmed either way.
6. **Image processing** — documented but not exercised (off by default, needs credits).

---

## 13. Proposed integration with the EQUB app

> **Nothing has been changed. This is a proposal awaiting your approval.**

### 13.1 Where the app stands today

`apps/api/src/modules/deposits/cbe-verification.service.ts` already verifies **CBE only**, by
scraping the bank's own PDF endpoint:

```ts
const url = `https://apps.cbe.com.et:100/?id=${ftNumber}${accountSuffix}`;  // accountSuffix = last 8 digits
```

…then parsing the returned PDF with regexes. The `Deposit` model already carries
`ftNumber`, `bankName`, `amount`, `senderName`, `senderAccount`, `receiverAccount`, `branch`,
`verificationStatus`, `verifiedById`, `autoVerified`, and a `cbeVerificationData Json?` blob.

**Limitations this leaves open:** CBE only; brittle to CBE HTML/PDF changes; no duplicate-receipt
detection; no webhook-driven verification; the `@@unique([ftNumber])` constraint assumes every bank
identifier is an "FT number".

### 13.2 Proposed shape

Add a **provider-agnostic verification layer** alongside — not instead of — the existing CBE path,
so nothing regresses while we cut over bank by bank.

```
apps/api/src/modules/verification/
  verify-et.client.ts          // typed HTTP client: POST /api/verify, poll, SSE, webhook verify
  verify-et.types.ts           // request/response/error types + per-bank field maps
  verify-et.adapter.ts         // Deposit  ⇄  Verify.ET payload translation
  verify-et-webhook.controller.ts  // POST /verification/webhooks/verify-et  (raw body, 204)
  verification.module.ts
```

**Adapter responsibilities**
1. Map a `Deposit` to the correct per-bank body using §8 (`cbe`/`telebirr`/`boa`/`dashen`/…).
2. Pre-validate with §7 regexes so malformed input never burns a credit.
3. Reuse the §6 URL-rule table so a member can paste a **receipt link** instead of typing a number.
4. On result: write a new `verificationData Json?` field (keeping `cbeVerificationData` intact for
   back-compat), set `bankName`, and compare `amount` and `receiverAccount` against the group's
   configured accounts — the same two cross-checks the CBE service already performs.
5. Treat `confirmationHistory.confirmedBefore === true` as a **fraud signal** and refuse to
   auto-approve.

**Database changes (additive only, one migration)**
- `Deposit.verificationProvider String?` — `"cbe-direct"` | `"verify-et"`.
- `Deposit.verificationRequestId String?` — Verify.ET `requestId`, indexed, for reconciliation.
- `Deposit.verificationData Json?` — normalised Verify.ET result.
- `Deposit.verificationConfidence Float?` — mirror of Verify.ET's match confidence.
- Loosen `@@unique([ftNumber])` → scoped uniqueness, since Telebirr/M-Pesa identifiers are not FTs.

**Configuration** — new env vars, no secrets in code:

```
VERIFY_ET_BASE_URL=https://verify.et
VERIFY_ET_API_KEY=VERIFY_BANK_ET_…
VERIFY_ET_WEBHOOK_SECRET=whsec_…
VERIFY_ET_ENABLED=true
```

**Rollout** — (1) client + adapter behind a flag; (2) webhook receiver; (3) Telegram bot flow uses it
for non-CBE banks; (4) cut CBE over last; (5) keep the legacy path until a full cycle passes clean.

### 13.3 What I need from you before writing any code

1. **Proceed or not** — explicit go-ahead to modify the app.
2. **API key** — a `VERIFY_BANK_ET_…` key with `verification:read` + `verification:write`. This is
   the only way to verify the success path, the account rate limits, and the report endpoints.
   I can generate it if you log in and hand me the dashboard session, or you can create it and paste
   the key.
3. **A real receipt** — one genuine (already-settled) CBE/Telebirr/other receipt identifier, so we can
   capture a true `success` payload and confirm `confirmationHistory` behaviour. Test data is fine.
4. **Settlement accounts** — which account(s) each Equb group receives into, so
   `settlementAccount` matching can be wired up.
5. **Scope** — all 11 banks at once, or start with CBE + Telebirr (the two the Equb flow actually
   sees most)?

---

## 14. Security notes for the integration

- **Never ship the API key to the browser.** Verify.ET's own docs say this; the key must live
  server-side in `apps/api` only.
- **Verify webhook signatures** before trusting any payload, and reject stale timestamps.
- **Deduplicate on `requestId` and on `X-Webhook-Event-Id`** — retries deliver the same event.
- **Do not auto-approve on `verified:true` alone.** Keep the existing amount + receiver-account
  cross-checks; `verified` means "this receipt is real", not "this member paid the right amount into
  the right account".
