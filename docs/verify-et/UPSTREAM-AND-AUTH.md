# Verify.ET — Upstream Providers & Authentication (deep dive)

Addendum to `README.md`. Same evidence tags: **[LIVE]** direct probe, **[BUNDLE]** recovered from
served JavaScript, **[REA]** browser capture, **[DOCS]** vendor claim.

---

## 1. How the Telegram login actually works **[LIVE]**

Clicking "Continue with Telegram" on `https://verify.et/login` navigated the browser to:

```
https://oauth.telegram.org/auth
  ?response_type=code
  &client_id=8328754829
  &state=7sv3iO8lAyFmYjjY8PgTKDaNVPWe1Mpc
  &scope=openid profile phone telegram%3Abot_access
  &redirect_uri=https%3A%2F%2Fverify.et%2Fapi%2Fauth%2Foauth2%2Fcallback%2Ftelegram
  &prompt=login+consent
  &code_challenge_method=S256
  &code_challenge=CnHbsmSr2UTTTp4q3xK8Xm4nLXDrVIdmOeX3n7KjS7g
```

What this proves:

| Fact | Value |
|---|---|
| OAuth provider | **Telegram** (`oauth.telegram.org`), standard authorization-code flow |
| Telegram application ID | **`8328754829`** |
| Requested scopes | `openid`, `profile`, `phone`, `telegram:bot_access` |
| Redirect URI | `https://verify.et/api/auth/oauth2/callback/telegram` |
| PKCE | **Yes** — `code_challenge_method=S256` |
| Consent prompt | `prompt=login+consent` |

The redirect path `/api/auth/oauth2/callback/:providerId` is Better Auth's generic OAuth2 plugin.
It matches the client code recovered earlier:

```js
authClient.signIn.oauth2({ providerId: "telegram", callbackURL: ".../dashboard", requestSignUp: true })
```

The Telegram consent screen offered exactly two options **[LIVE]**: *"Continue with Telegram"* and
*"Or log in with a phone number"*. A fresh browser profile has no Telegram Web session, so the
phone-number route (Telegram sends a code to the user's Telegram app) is what a new session uses.

> **Implication for EQUB:** we do **not** need this login at all for production integration. It is
> only needed to *create an API key* once. After that the server authenticates with `x-api-key`.

---

## 2. Upstream receipt hosts — what verify.et actually targets **[BUNDLE] + [LIVE]**

The per-bank verification itself happens **server-side**, so the browser cannot observe verify.et's
outbound calls. What we *can* establish is the set of upstream receipt hosts its own router
recognises, and which of them are live.

### 2.1 Reachability results **[LIVE]**

| Bank | Host / path | Result |
|---|---|---|
| cbe | `apps.cbe.com.et:100/` | blocked by sandbox proxy (502 tunnel) |
| cbe | `mbreciept.cbe.com.et/` | blocked by sandbox proxy (502 tunnel) |
| boa | `cs.bankofabyssinia.com/api/onlineslip/getdetails/` | blocked by sandbox proxy (502 tunnel) |
| telebirr | `transactioninfo.ethiotelecom.et/receipt/view` | blocked by sandbox proxy (502 tunnel) |
| cbebirr | `cbepay1.cbe.com.et/aureceipt` | blocked by sandbox proxy (502 tunnel) |
| awash | `awashpay.awashbank.com/` | blocked by sandbox proxy (502 tunnel) |
| kaafiebirr | `receipt.ebirr.com/` (root) | blocked by sandbox proxy (502 tunnel) |
| **telebirr** | **`leul.et/verify.php?reference=`** | **200 — JSON API, requires a "proxy key"** |
| mpesa | `m-pesabusiness.safaricom.et/` | 200 — Next.js "M-Pesa Onboarding" app |
| mpesa | `.../api/receipt/getreceipt` | 404 (needs correct params) |
| dashen | `receipts.dashenbanksc.com/` | 200 — `application/octet-stream`, body `prod app!` |
| dashen | `receipt.dashensuperapp.com/` | 200 — body `active` |
| dashen | `receipts.dashenbanksc.com/receipt/TEST` | 400 (real route, bad id) |
| siinqee | `receipts.siinqeebank.com/` + `/generate/TEST` | 200 — **Vite + React SPA** |
| kaafiebirr | `receipt.ebirr.com/kaafimf/TEST` | 200 — HTML, "Not Found Page" for a bad id |
| coopayebirr | `receipt.ebirr.com/coopay/TEST` | 200 — same app |

The 502s are a **sandbox network limitation, not the hosts being down** — the Equb app already
successfully calls `apps.cbe.com.et` in production code.

### 2.2 The significant find: `leul.et` **[LIVE]**

```
GET https://leul.et/                    → 200  text/html, 6 bytes, body: "Hi :)"
GET https://leul.et/verify.php          → 200  application/json
                                          {"success":false,"error":"Unauthorized: Invalid or missing proxy key"}
GET https://leul.et/verify.php?reference=TEST
                                        → 200  {"success":false,"error":"Unauthorized: Invalid or missing proxy key"}
```

Server headers: `nginx`, `X-Powered-By: PHP/8.2.34`, `X-Powered-By: PleskLin`.
`/api`, `/docs`, `/robots.txt` → all 404. No documentation is exposed.

**Why this matters.** `leul.et/verify.php?reference=` appears in verify.et's own telebirr rules as a
recognised receipt URL. `leul.et` is a **PHP proxy that fronts a bank/wallet verification API and
gates it behind a "proxy key"**. That is the same architectural pattern verify.et itself uses
(server-side adapter + keyed upstream). It is strong evidence that at least part of verify.et's
telebirr path is *proxied* rather than a direct scrape of `transactioninfo.ethiotelecom.et`.

It also means: if EQUB ever wanted to bypass verify.et for telebirr, `leul.et` is a separate
commercial dependency with its own key — not a free public API.

### 2.3 Upstream rendering model **[LIVE]**

The receipt hosts split into two families:

- **Client-rendered SPAs** — `receipts.siinqeebank.com` serves `<div id="root">` plus a Vite bundle
  (`/assets/index-BB8i_ZWM.js`). The receipt data arrives from a backing JSON API, so anything
  reading these must execute JavaScript or call that API directly.
- **Server-rendered / static** — `receipt.ebirr.com/{kaafimf,coopay}/<token>` returns finished HTML.

verify.et abstracts over both. That is exactly the value it adds: EQUB would otherwise have to
write and maintain a separate parser per bank.

---

## 3. Corrected picture of "how the FT number gets verified"

Putting the two layers together:

```
  EQUB  ──►  POST /api/verify  {bank, reference}          (x-api-key)
                  │
                  ▼
        ┌─────────────────────────────────────────────┐
        │  verify.et  —  server-side, Cloudflare      │
        │  • universal smart router (§6 of README)    │
        │  • per-bank adapters + validation regexes   │
        │  • normalises to one JSON shape             │
        └───────────────┬─────────────────────────────┘
                        │  (outbound calls — NOT observable from the browser)
                        ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  apps.cbe.com.et:100/?id={FT}{suffix}      (CBE, PDF)        │
   │  mbreciept.cbe.com.et/{id}                 (CBE receipt)     │
   │  cs.bankofabyssinia.com/api/onlineslip/…   (BOA)             │
   │  transactioninfo.ethiotelecom.et/receipt/view (Telebirr)     │
   │  leul.et/verify.php?reference=             (Telebirr proxy, keyed) │
   │  m-pesabusiness.safaricom.et/api/receipt/getreceipt (M-Pesa) │
   │  cbepay1.cbe.com.et/aureceipt?tid=         (CBE Birr)        │
   │  receipts.dashenbanksc.com / receipt.dashensuperapp.com      │
   │  awashpay.awashbank.com                    (Awash)           │
   │  receipts.siinqeebank.com/generate/{id}    (Siinqee, SPA)    │
   │  receipt.ebirr.com/{kaafimf,coopay}/{tok}  (Kaafi / Coopay)  │
   └──────────────────────────────────────────────────────────────┘
```

**Honest limitation:** the exact HTTP request verify.et makes to each bank (verb, path, params,
headers, auth) is **not observable** from outside. Only verify.et's own infrastructure sees it.
Anything claiming otherwise would be a guess. The host set above is evidence-backed; the precise
per-bank call signature is not, and is not needed for integration — we integrate against
verify.et's own stable API, which is fully documented in `README.md`.

---

## 4. What is needed to finish

1. **Complete the Telegram login** in the open browser window (user action).
2. Create an API key at `/dashboard/api-keys`.
3. Run authenticated tests: real `POST /api/verify`, enumerate `/api/reports/*`,
   `GET /api/verify/:id/receipt`, and measure account-level rate limits.
