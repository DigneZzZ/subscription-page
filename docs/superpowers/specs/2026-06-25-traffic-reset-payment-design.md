# Traffic-Reset Payment — Design Spec

**Date:** 2026-06-25
**Status:** Approved (design), pending implementation plan
**Scope:** Add a "pay to reset traffic" button to the subscription page. The page only
**creates a payment and fires a marked webhook** — the actual traffic reset is performed by
the external webhook receiver (which later gets payment confirmation from the payment
provider and calls Remnawave `POST /api/users/actions/reset-traffic/{uuid}`).

This is fork-only functionality (Wata/Platega/CardLink, `/api/pay`, outgoing webhook are all
fork additions), so there is no upstream-merge conflict surface.

---

## 1. Goal & Constraints

- A **"Reset traffic"** button on the subscription page, price taken from env.
- Clicking it **creates a payment** through the existing provider machinery and **sends the
  existing outgoing webhook with a special marker** so the receiver can catch it easily.
- The page **does not** reset traffic itself; the reset is delegated to the external receiver.
- **Reliability & security must match the existing payment flow** (same auth, same IDOR
  binding, same rate limiting, same HMAC signing).

### Key architectural insight (drives the marker design)
The receiver sees the payment in **two** places:
1. **Our outgoing webhook** (`PAYMENT_WEBHOOK_URL`) — rich payload, we can add any field.
2. **The provider's own confirmation callback** (Wata/Platega/CardLink → receiver) — of our
   data it carries **only `orderId`**.

Therefore the "this is a traffic reset" marker **must live inside `orderId`** (so the
provider-confirmation path is unambiguous), **and** we additionally add an explicit `type`
field to our own webhook for convenience. Both, not either.

---

## 2. Decisions (confirmed)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Marker | Token `reset` in `orderId` **and** `type: "TRAFFIC_RESET"` in our webhook payload |
| 2 | Backward compat | Add `type` to **both** webhooks: subscription → `"SUBSCRIPTION"`, reset → `"TRAFFIC_RESET"` |
| 3 | Button UX | Dedicated "Reset traffic" button next to the traffic/bandwidth block + confirm modal showing the price |
| 4 | Endpoint | Dedicated `GET /api/pay/reset?shortUuid=…` sharing the existing private payment core |
| 5 | Config | Presence-based: `TRAFFIC_RESET_PRICE` (float, >0). Currency reuses `TARIFF_CURRENCY`. Feature active ⇔ price set **and** ≥1 provider enabled |
| 6 | Provider description | Plumb optional `description` to Platega + CardLink so the reset shows a correct label ("Traffic reset") on the pay page. Wata unsupported → skipped. Marker still lives in `orderId`; this is cosmetic |
| 7 | Automated tests | No jest harness exists in the repo; not standing one up (out of scope). Resolution logic written as a pure, inspectable function. Verification = `nest build` + ESLint + manual e2e. Minimal jest can be added on request |

---

## 3. orderId & webhook contract

### orderId format
```
subscription:  [telegramId_]shortUuid_{N}m_{ts}      e.g. 123456_abcd-1234_6m_1719259845123
reset:         [telegramId_]shortUuid_reset_{ts}      e.g. 123456_abcd-1234_reset_1719259845123
```
The token slot is either `\d+m` (subscription) or `reset`. Receiver distinguishes via
`_reset_` vs `_\d+m_`. `shortUuid` uses hyphens (no underscores); `telegramId` is numeric and
optional — the `_reset_` token is unambiguous in all cases.

### Webhook payload
```jsonc
// subscription (months retained)
{ "type": "SUBSCRIPTION", "orderId": "...6m...", "months": 6,
  "amount": 299, "currency": "RUB", "shortUuid": "abcd-1234",
  "username": "john", "cardLinkBillId": "...?", "timestamp": "ISO-8601" }

// reset (no months field)
{ "type": "TRAFFIC_RESET", "orderId": "...reset...",
  "amount": 100, "currency": "RUB", "shortUuid": "abcd-1234",
  "username": "john", "cardLinkBillId": "...?", "timestamp": "ISO-8601" }
```
- `type` is present on both. `months` is present **only** for subscription.
- HMAC-SHA256 over `JSON.stringify(payload)` in `X-Webhook-Signature` — unchanged mechanism;
  it signs whatever we send, so adding fields does not break verification.

---

## 4. Backend changes

### 4.1 Config schema — `backend/src/common/config/app-config/config.schema.ts`
Add after the existing payment-related keys (near `EGAMES_COOKIE`, before the object close /
`.superRefine`):
```ts
TRAFFIC_RESET_PRICE: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? parseFloat(v) : undefined))
    .refine(
        (v) => v === undefined || (!isNaN(v) && v > 0),
        'TRAFFIC_RESET_PRICE must be a positive number',
    ),
```
No separate `*_ENABLED` flag (mirrors how tariffs are presence-gated). No new currency var —
reuse `TARIFF_CURRENCY`.

### 4.2 `.env.sample`
Document near the tariff / webhook block:
```
# Price to reset a user's traffic. If set (and a payment provider is enabled),
# a "Reset traffic" button appears on the subscription page.
# Currency reuses TARIFF_CURRENCY. The outgoing webhook for these payments carries
# type: "TRAFFIC_RESET" and an orderId containing "_reset_".
TRAFFIC_RESET_PRICE=
```

### 4.3 Service core — `backend/src/modules/root/root.service.ts`
Refactor the existing `createPaymentForTariff` into a shared private core driven by a
product discriminator:
```ts
type PaymentProduct =
    | { kind: 'subscription'; months: number }
    | { kind: 'reset' };

private async createPayment(
    shortUuid: string,
    sessionId: string,
    product: PaymentProduct,
): Promise<{ ok: true; url: string } | { ok: false; reason: string }>;
```
Resolution by `kind`:

| | subscription | reset |
|---|---|---|
| amount | `TARIFF_{months}M` | `TRAFFIC_RESET_PRICE` |
| orderId token | `${months}m` | `reset` |
| webhook `type` | `"SUBSCRIPTION"` | `"TRAFFIC_RESET"` |
| webhook `months` | `months` | *(omitted)* |
| provider `description` | *(unchanged defaults)* | `"Traffic reset"` |

Reused unchanged: dual-key rate limiter (`s:{sessionId}` + `u:{shortUuid}`, 5/60s, 10k-key
memory cap), `getUserByShortUuid` lookup, Fisher-Yates provider shuffle + fallthrough,
fire-and-forget webhook dispatch. The limiter map is **shared** across both products on
purpose (a user cannot double their budget by alternating endpoints).

Public methods:
- `createPaymentForTariff(shortUuid, months, sessionId)` → thin wrapper →
  `createPayment(shortUuid, sessionId, { kind: 'subscription', months })`.
- `createTrafficResetPayment(shortUuid, sessionId)` →
  `createPayment(shortUuid, sessionId, { kind: 'reset' })`.
- `isTrafficResetEnabled(): boolean` = `TRAFFIC_RESET_PRICE` defined & > 0 **and**
  `hasAnyPaymentProvider()`.

`sendPaymentWebhook`: extend its input to carry `type` and an optional `months`; build payload
with `type` always present and `months` only when provided. The pure mapping
(`product → { amount, token, type, months }`) is the function to keep small and inspectable.

### 4.4 Render context — `backend/src/modules/root/root.service.ts` (~line 472–506)
Alongside `paymentTariffs`, compute and pass `paymentReset`:
```ts
const paymentReset = this.isTrafficResetEnabled()
    ? Buffer.from(JSON.stringify({
          amount: this.configService.get<number>('TRAFFIC_RESET_PRICE'),
          currency: this.configService.get<string>('TARIFF_CURRENCY') ?? 'RUB',
      })).toString('base64')
    : '';
// res.render('index', { ..., paymentTariffs, paymentReset })
```

### 4.5 Controller — `backend/src/modules/root/root.controller.ts`
Add a sibling handler mirroring `createPayment` (the existing one at line 33):
```ts
@Get('api/pay/reset')
async createTrafficResetPayment(
    @GetJWTPayload() user: IJwtPayload,
    @Req() request: Request,
    @Res() response: Response,
    @Query('shortUuid') shortUuid: string,
) {
    // same IDOR binding: user.sub must equal shortUuid -> else 403
    // result = rootService.createTrafficResetPayment(shortUuid, user.sessionId)
    // 429 on rate_limited, 502 on other failure, else 200 HTML redirect page (no-store)
}
```
Reuses `renderPayRedirectPage`. No `months` param. If reset is not enabled, return 502
(same opaque "Payment unavailable" as the tariff path) — no separate info leak.

### 4.6 Middleware & prefix (MUST, security-critical)
- `backend/src/main.ts:111` — add `'api/pay/reset'` to the `setGlobalPrefix` `exclude` array
  (currently `[APP_CONFIG_ROUTE_WO_LEADING_PATH, 'api/pay']`). Without it the route 404s under
  a custom sub-prefix.
- `backend/src/common/middlewares/check-assets-cookie.middleware.ts` — the JWT/cookie gate
  currently matches `req.path === '/api/pay'`. Add `'/api/pay/reset'` explicitly (not a loose
  `startsWith`). **Without this the new route would be unauthenticated.**

### 4.7 Providers (optional description plumbing)
- `platega.service.ts` — `ICreateOrderParams` already has `description`; pass it through.
- `cardlink.service.ts` — add optional `description` to `ICreateOrderParams`; use it at the
  `description` field instead of hardcoding `orderId` **only when provided** (subscription path
  keeps current behavior).
- `wata.service.ts` — no description support; unchanged.
Subscription behavior is unchanged; only the reset path supplies a `description`.

---

## 5. Frontend changes

### 5.1 Template — `frontend/index.html:41`
```html
<div id="pmt" data-url="<%- paymentUrl %>" data-tariffs="<%- paymentTariffs %>" data-reset="<%- paymentReset %>"></div>
```
### 5.2 Dev EJS — `frontend/vite.config.ts` (~line 27, production branch)
Add `paymentReset: '<%- paymentReset %>'` to the returned object so dev parity holds.

### 5.3 Hydration — `frontend/src/app/layouts/root/root.layout.tsx` (~lines 54–71)
Next to the `data-tariffs` parse, read `paymentDiv.dataset.reset`, base64-decode + JSON.parse
into `{ amount, currency }`, and call a new `paymentActions.setReset(...)`. Guard with
try/catch like the tariffs block.

### 5.4 Store — `frontend/src/entities/payment-store/payment-store.ts`
```ts
interface IPaymentReset { amount: number; currency: string }
// state: reset: IPaymentReset | null   (default null)
// action: setReset(reset: IPaymentReset | null)
// selector: usePaymentReset = () => usePaymentStore((s) => s.reset)
```

### 5.5 UI component — new `frontend/src/widgets/main/subscription-info/reset-traffic-button/`
A single shared component used by all three traffic-block variants:
- Renders nothing when `usePaymentReset()` is `null`.
- Mantine `Button` (`IconRefresh`) labeled "Reset traffic".
- On click: `vibrate('tap')` → `modals.openConfirmModal` showing the price
  (`formatAmount(amount, currency)`), confirm/cancel labels localized.
- On confirm: `window.open('/api/pay/reset?shortUuid=' + encodeURIComponent(shortUuid),
  '_blank', 'noopener,noreferrer')` (matches the existing tariff-click pattern).
- `shortUuid` from `subscription.user.shortUuid`.

Wire it into:
- `subscription-info-cards.widget.tsx` (near the bandwidth `CardItem`, ~line 105)
- `subscription-info-expanded.widget.tsx` (near bandwidth InfoBlock, ~line 146)
- `subscription-info-collapsed.widget.tsx` (near bandwidth, ~line 153)

Button always shown when the feature is configured (operator opted in). Hiding it for
unlimited-traffic users (`trafficLimit === '0'`) is intentionally **not** done (kept simple);
can be added later if desired.

### 5.6 i18n — new local strings file
A local dictionary covering all five supported languages (`en/ru/zh/fa/fr`), keyed by
`currentLang` from `useTranslation()`. Keys: `resetTraffic` (button), `resetConfirmTitle`,
`resetConfirmBody` (interpolates the price), `pay`, `cancel`. Matches the fork's inline
localization style used by the existing Pay button while covering all languages, not just ru/en.

---

## 6. Security (parity with existing flow)

- **Auth/IDOR:** identical — JWT `session` cookie via `checkAssetsCookieMiddleware`; handler
  enforces `user.sub === shortUuid` (403 otherwise). New route added to the cookie gate.
- **No client-controlled amount:** client sends only `shortUuid`; price comes from env.
  Reset amount cannot be tampered with.
- **Rate limiting:** same dual-key limiter and memory cap, shared budget across products.
- **Webhook integrity:** unchanged HMAC-SHA256; signs the new payload (incl. `type`).
- **Cache:** reset redirect response sent with `Cache-Control: no-store` (as `/api/pay`).
- **No new secrets**, no new external calls from the page, no new PII in the webhook
  (only the already-sent `shortUuid`/`username`).
- **Opaque failures:** 429 / 502 mirror the tariff path; no internal detail leaked.

---

## 7. Verification plan

1. `cd backend && npm run build` (TypeScript/Nest) — types compile.
2. `cd backend && npm run lint` and `cd frontend && npm run lint` — clean.
3. `cd frontend && npm run build` — bundle builds.
4. Manual e2e (one provider configured, `TRAFFIC_RESET_PRICE` set):
   - Button appears next to the traffic block; hidden when `TRAFFIC_RESET_PRICE` unset or no provider.
   - Confirm modal shows the correct price/currency.
   - `GET /api/pay/reset?shortUuid=<own>` → 200 redirect page; `<other>` → 403.
   - Provider order created with `orderId` containing `_reset_`.
   - Outgoing webhook received with `type: "TRAFFIC_RESET"`, no `months`, valid
     `X-Webhook-Signature`.
   - Subscription tariff path still works and now carries `type: "SUBSCRIPTION"` + `months`.
   - Rate limit: 6th request within 60s → 429.

---

## 8. Files touched (summary)

**Backend:** `config.schema.ts`, `.env.sample`, `root.service.ts`, `root.controller.ts`,
`main.ts`, `check-assets-cookie.middleware.ts`, `platega.service.ts`, `cardlink.service.ts`.
**Frontend:** `index.html`, `vite.config.ts`, `root.layout.tsx`, `payment-store.ts`,
new `reset-traffic-button/*`, three `subscription-info-*` widgets, new i18n strings file.

---

## 9. Out of scope / explicitly deferred

- Performing the actual traffic reset (delegated to the external receiver).
- A `*_ENABLED` toggle separate from price presence.
- Hiding the button for unlimited-traffic users.
- Standing up a jest/test harness.
- Changing Wata to support a description.
