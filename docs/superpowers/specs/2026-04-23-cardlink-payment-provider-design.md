# CardLink Payment Provider — Design

**Date:** 2026-04-23
**Status:** Draft → pending user review

## Goal

Add CardLink (cardlink.link) as a third payment provider alongside Wata and Platega, participating in the existing random-rotation flow used by the subscription page. When all three are configured, each page load randomly selects one provider to generate dynamic payment links for the user's tariff choices.

## Non-Goals

- No refactor to extract a shared `IPaymentProvider` interface — deferred until a fourth provider lands (YAGNI).
- No frontend changes — `IPaymentTariff` already abstracts over the provider.
- No unit tests — consistent with the existing provider modules (Wata, Platega), which have none.
- No changes to the webhook / tariff-validation / HMAC pipeline — CardLink reuses all of it unchanged.

## Background

Current architecture (see [backend/src/modules/root/root.service.ts:146-246](../../backend/src/modules/root/root.service.ts#L146-L246)):

- Each provider lives under `backend/src/common/<name>/` as a `@Global()` NestJS module exposing `<Name>Service` with two public members: `isEnabled: boolean` and `createOrder(params): Promise<string | null>`.
- `RootService.resolvePaymentTariffs` collects all enabled providers into an array, shuffles via Fisher-Yates with `crypto.randomInt`, then tries each in order. The first provider that successfully creates orders for at least one configured tariff wins.
- Shared tariff amounts (`TARIFF_1M/3M/6M/12M`), currency (`TARIFF_CURRENCY`, default `RUB`), and redirect URLs (`PAYMENT_SUCCESS_URL`, `PAYMENT_FAIL_URL`) are identical across providers.
- `orderId` format: `${shortUuid}_${months}m_${timestamp}` — generated centrally in `generateTariffsForProvider`.

CardLink API specifics (per the Python reference supplied by the user):

- Endpoint: `POST https://cardlink.link/api/v1/bill/create`
- Auth: `Authorization: Bearer <API_KEY>` header
- Content-Type: `application/x-www-form-urlencoded` (unlike Wata/Platega, which use JSON)
- Required fields: `amount`, `order_id`, `description`, `type=normal`, `shop_id`, `currency_in`, `payer_pays_commission`, `name`
- Response: `{ link_page_url, bill_id }` — `link_page_url` is what the user opens to pay.

## Design Decisions (from brainstorming)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Env vars: `CARDLINK_API_KEY` + `CARDLINK_SHOP_ID` | Mirrors Python reference naming; consistent with `PLATEGA_*` paired style. |
| 2 | `description` and `name` fields both set to `orderId` | User preference (option C). Technical but unambiguous; keeps payment page copy provider-agnostic. |
| 3 | `success_url`/`fail_url` passed opportunistically when `PAYMENT_SUCCESS_URL`/`PAYMENT_FAIL_URL` are set | Unknown whether CardLink honours them; if it ignores, no harm done. |
| 4 | `payer_pays_commission` configurable via `CARDLINK_PAYER_PAYS_COMMISSION` env (default `0`) | Allows toggling without rebuild. |

## Architecture

### New files

```
backend/src/common/cardlink/
├── index.ts               # barrel export of CardLinkService
├── cardlink.module.ts     # @Global NestJS module
└── cardlink.service.ts    # provider implementation
```

### `cardlink.service.ts` contract

```typescript
interface ICreateOrderParams {
    amount: number;
    currency?: string;
    orderId: string;
    successRedirectUrl?: string;
    failRedirectUrl?: string;
}

interface ICardLinkResponse {
    link_page_url: string;
    bill_id: string;
    success?: boolean;
}

@Injectable()
export class CardLinkService {
    public get isEnabled(): boolean;  // true iff apiKey AND shopId are set
    public async createOrder(params: ICreateOrderParams): Promise<string | null>;
}
```

`createOrder` behaviour:

1. If `apiKey` or `shopId` missing → return `null`.
2. Build body via `URLSearchParams` (axios auto-sets `application/x-www-form-urlencoded`):
   - `amount` = `params.amount.toFixed(2)` (matches Wata)
   - `order_id` = `params.orderId`
   - `description` = `params.orderId`
   - `name` = `params.orderId`
   - `type` = `'normal'`
   - `shop_id` = `this.shopId`
   - `currency_in` = `params.currency ?? 'RUB'`
   - `payer_pays_commission` = `String(this.payerPaysCommission)` (0 or 1)
   - `success_url` = `params.successRedirectUrl` (only if truthy)
   - `fail_url` = `params.failRedirectUrl` (only if truthy)
3. `POST https://cardlink.link/api/v1/bill/create` with `Authorization: Bearer ${apiKey}`, timeout 10s.
4. Log success: `CardLink order created: ${response.data.bill_id}`.
5. Return `response.data.link_page_url ?? null`.
6. On `AxiosError`: log status + response body. On any other error: log message. Return `null` in both cases. Matches `wata.service.ts:67-78` exactly.

### Config schema changes

[backend/src/common/config/app-config/config.schema.ts](../../backend/src/common/config/app-config/config.schema.ts)

Add after the Platega block (after line 81):

```typescript
// CardLink payment gateway
CARDLINK_API_KEY: z.string().optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
CARDLINK_SHOP_ID: z.string().optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
CARDLINK_PAYER_PAYS_COMMISSION: z.string().default('0')
    .transform((v) => (v === '1' ? 1 : 0)),
```

Extend `superRefine`:

1. Paired validation (mirrors Platega check at lines 140-146):
   ```typescript
   if (data.CARDLINK_API_KEY && !data.CARDLINK_SHOP_ID) { /* issue */ }
   if (data.CARDLINK_SHOP_ID && !data.CARDLINK_API_KEY) { /* issue */ }
   ```
2. Update "at least one tariff" check (lines 126-139) to include CardLink:
   ```typescript
   if ((data.WATA_API_KEY || data.PLATEGA_MERCHANT_ID || data.CARDLINK_API_KEY) && !anyTariff) { ... }
   ```

### Root service changes

[backend/src/modules/root/root.service.ts](../../backend/src/modules/root/root.service.ts)

1. Import `CardLinkService` from `@common/cardlink/cardlink.service`.
2. Constructor: add `private readonly cardLinkService: CardLinkService`.
3. `resolvePaymentTariffs` (lines 173-184):
   - Widen union: `Array<'wata' | 'platega' | 'cardlink'>`.
   - Add `if (this.cardLinkService.isEnabled) providers.push('cardlink');`.
   - Fisher-Yates loop is length-agnostic; no change needed.
4. `generateTariffsForProvider` (lines 209-246):
   - Widen `provider` param union.
   - Add `else if` branch calling `this.cardLinkService.createOrder(...)` with the same argument shape as Wata/Platega calls.

### App module registration

[backend/src/app.module.ts](../../backend/src/app.module.ts)

- Import `CardLinkModule` from `@common/cardlink/cardlink.module`.
- Add to `imports: [AxiosModule, WataModule, PlategaModule, CardLinkModule, ConfigModule.forRoot(...), ...]`.

### `.env.sample` update

[.env.sample](../../.env.sample)

Append after the Platega block (line 46):

```
# CardLink payment gateway (https://cardlink.link)
# Set both CARDLINK_API_KEY and CARDLINK_SHOP_ID to enable.
# Optional: CARDLINK_PAYER_PAYS_COMMISSION (0 = merchant pays, 1 = payer pays; default 0).
# When multiple providers are enabled, one is randomly selected per user visit.
CARDLINK_API_KEY=
CARDLINK_SHOP_ID=
CARDLINK_PAYER_PAYS_COMMISSION=0
```

Also update the comment on line 25 from `Used by all payment providers (Wata, Platega).` → `Used by all payment providers (Wata, Platega, CardLink).`. The "When multiple providers are enabled..." comment on line 44 already reads generically and needs no change.

## Data Flow (unchanged — CardLink slots in transparently)

1. User opens subscription page → `RootService.returnWebpage` → `resolvePaymentTariffs(shortUuid, staticUrl)`.
2. Enabled providers collected, Fisher-Yates shuffled, iterated.
3. Winning provider yields `Array<{ months, amount, currency, url, orderId }>`.
4. Tariffs base64-encoded into `#pmt` element on the page.
5. Frontend (`payment-store` + `subscription-link.widget`) decodes and renders buttons.
6. Click → frontend POSTs to `/api/payment-webhook` (HMAC, rate-limited by shortUuid) → then `window.open(tariff.url)`.

CardLink's `link_page_url` substitutes for `tariff.url` with zero frontend knowledge of the provider.

## Error Handling

- Missing/partial env — caught at startup by zod `superRefine`; app refuses to boot.
- CardLink API error (network / 4xx / 5xx) — `createOrder` returns `null`, the tariff is dropped from the returned array. If _all_ tariffs for CardLink return null, `generateTariffsForProvider` yields empty; `resolvePaymentTariffs` moves to the next shuffled provider. If every provider fails, falls back to static `PAYMENT_URL` — same as today.
- Malformed CardLink response (no `link_page_url`) — treated as failure, returns `null`.

## Acceptance Criteria (manual)

1. `cd backend && npm run build` → no TS errors.
2. Start with empty `CARDLINK_*` → app boots; `CARDLINK_*` providers not in rotation log.
3. Set only `CARDLINK_API_KEY`, leave `CARDLINK_SHOP_ID` empty → app refuses to start with zod error.
4. Set all three providers with working credentials → reload page 10× → log `Payment providers order: [...]` shows varying order; `Using payment provider: cardlink` observed at least once.
5. With invalid `CARDLINK_API_KEY` and valid Wata/Platega → rotation still succeeds; `CardLink API error (...)` appears in logs but user still gets tariffs.
6. With only `CARDLINK_*` set and valid credentials → clicking a tariff opens real CardLink payment page that completes a test payment.

## Risks & Mitigations

- **Form-encoding mismatch** — CardLink requires `application/x-www-form-urlencoded`; axios auto-sets it when body is `URLSearchParams`. Mitigation: explicit `URLSearchParams` usage + integration smoke test (Acceptance #6).
- **`success_url`/`fail_url` unknown** — if CardLink rejects unknown params, the whole call fails. Mitigation: if Acceptance #6 fails with these params, drop them from the request (a trivial 2-line change) and rely on CardLink dashboard-configured redirects.
- **Session-level caching of shuffle** — each page load runs a fresh shuffle, so no user pinning. This is consistent with Wata/Platega behaviour.

## Files Changed

| File | Change |
|---|---|
| `backend/src/common/cardlink/cardlink.service.ts` | **new** |
| `backend/src/common/cardlink/cardlink.module.ts` | **new** |
| `backend/src/common/cardlink/index.ts` | **new** |
| `backend/src/common/config/app-config/config.schema.ts` | add CardLink env + superRefine rules |
| `backend/src/app.module.ts` | register CardLinkModule |
| `backend/src/modules/root/root.service.ts` | inject CardLinkService, extend rotation union + generator branch |
| `.env.sample` | document new env vars |
