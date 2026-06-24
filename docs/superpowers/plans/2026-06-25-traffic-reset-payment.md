# Traffic-Reset Payment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "pay to reset traffic" button to the subscription page that creates a payment through the existing provider machinery and fires the existing outgoing webhook with a `TRAFFIC_RESET` marker, so the external receiver can perform the actual reset.

**Architecture:** Reuse the existing `/api/pay` payment core (auth, IDOR binding, dual-key rate limiter, provider shuffle/fallthrough, HMAC webhook). Introduce a product discriminator (`subscription | reset`) that drives amount source, the `orderId` token (`{N}m` vs `reset`), the webhook `type`, and whether `months` is sent. A dedicated `GET /api/pay/reset` endpoint shares that core. The reset price comes from a new env var; currency reuses `TARIFF_CURRENCY`. The frontend gets the reset price via the same `#pmt` DOM-data mechanism as tariffs and shows a confirm-modal button next to the traffic block.

**Tech Stack:** NestJS + Zod (`@nestjs/config`), consolidate/EJS views; React 18 + Mantine v8 + Zustand; Vite (`vite-plugin-ejs`).

## Global Constraints

- **No automated test harness exists** (no jest, no spec files). Per-task gate = `nest build` / `tsc --noEmit` + ESLint (+ manual checks where noted). Do **not** add a test framework.
- **The reset marker MUST live in `orderId`** (`..._reset_...`) because the payment provider's confirmation callback echoes back only `orderId`. The webhook `type` field is an additional convenience, not a replacement.
- **`type` is added to BOTH webhooks:** subscription → `"SUBSCRIPTION"` (keeps `months`), reset → `"TRAFFIC_RESET"` (no `months`).
- **No client-controlled amount:** the client sends only `shortUuid`; the server reads the price from env.
- **Security parity with `/api/pay`:** same JWT/cookie gate, same IDOR check (`user.sub === shortUuid` → 403), same rate limiter, same `Cache-Control: no-store`, opaque 429/502.
- **Currency:** reuse `TARIFF_CURRENCY` (default `RUB`). No new currency var. No separate `*_ENABLED` flag — feature is presence-gated on `TRAFFIC_RESET_PRICE` (> 0) **and** ≥1 provider enabled.
- **Provider description** for reset uses the fixed Russian string `Сброс трафика` (matches the existing default `Оплата подписки`). The authoritative definition is the `RESET_PAYMENT_DESCRIPTION` constant in Task 3 Step 1.
- **Git:** conventional-commit messages; append the repo's standard `Co-Authored-By` and `Claude-Session` trailers to every commit.
- Spec: `docs/superpowers/specs/2026-06-25-traffic-reset-payment-design.md`.

## Prerequisites

Work happens in the worktree `worktree-traffic-reset-payment`. `node_modules` is git-ignored and may be absent in the worktree. Before running any build/lint gate:

```bash
cd backend && npm ci
cd ../frontend && npm ci
```

## File Structure

**Backend**
- `backend/src/common/config/app-config/config.schema.ts` — add `TRAFFIC_RESET_PRICE`.
- `.env.sample` — document the var.
- `backend/src/common/cardlink/cardlink.service.ts` — accept optional `description`.
- `backend/src/modules/root/root.service.ts` — shared `createPayment` core, `createTrafficResetPayment`, `isTrafficResetEnabled`, webhook `type`/`months`, `paymentReset` render var.
- `backend/src/modules/root/root.controller.ts` — `GET api/pay/reset` handler.
- `backend/src/common/middlewares/check-assets-cookie.middleware.ts` — gate `/api/pay/reset`.
- `backend/src/main.ts` — exclude `api/pay/reset` from the global prefix.

**Frontend**
- `frontend/index.html` — `data-reset` on `#pmt`.
- `frontend/vite.config.ts` — `paymentReset` EJS passthrough (dev parity).
- `frontend/src/entities/payment-store/payment-store.ts` — `reset` state + `setReset` + `usePaymentReset`.
- `frontend/src/app/layouts/root/root.layout.tsx` — parse `data-reset`.
- `frontend/src/shared/utils/format-amount/{format-amount.util.ts,index.ts}` — shared currency formatter (new).
- `frontend/src/widgets/main/subscription-link/subscription-link.widget.tsx` — use shared formatter (DRY).
- `frontend/src/widgets/main/subscription-info/reset-traffic-button/{reset-traffic-button.tsx,reset-traffic.i18n.ts,index.ts}` — new button + strings.
- `frontend/src/widgets/main/subscription-info/subscription-info-{cards,expanded,collapsed}.widget.tsx` — mount the button.

---

### Task 1: Config — `TRAFFIC_RESET_PRICE`

**Files:**
- Modify: `backend/src/common/config/app-config/config.schema.ts:137`
- Modify: `.env.sample`

**Interfaces:**
- Produces: env key `TRAFFIC_RESET_PRICE` (parsed to `number | undefined`, `> 0`).

- [ ] **Step 1: Add the schema field**

In `config.schema.ts`, replace the line `        EGAMES_COOKIE: z.optional(z.string()),` (line 137) with:

```ts
        EGAMES_COOKIE: z.optional(z.string()),

        // Price to reset a user's traffic. Presence (+ an enabled provider) shows the button.
        TRAFFIC_RESET_PRICE: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? parseFloat(v) : undefined))
            .refine(
                (v) => v === undefined || (!isNaN(v) && v > 0),
                'TRAFFIC_RESET_PRICE must be a positive number',
            ),
```

- [ ] **Step 2: Document it in `.env.sample`**

Append to `.env.sample` (after the `PAYMENT_WEBHOOK_SECRET` block, near the other tariff/webhook settings):

```
# Price to reset a user's traffic. If set (> 0) and a payment provider is enabled,
# a "Reset traffic" button appears on the subscription page.
# Currency reuses TARIFF_CURRENCY. The outgoing webhook for these payments carries
# type: "TRAFFIC_RESET" and an orderId containing "_reset_".
TRAFFIC_RESET_PRICE=
```

- [ ] **Step 3: Build**

Run: `cd backend && npm run build`
Expected: completes with no TypeScript errors.

- [ ] **Step 4: Sanity-check validation (manual, optional)**

With `TRAFFIC_RESET_PRICE=abc` the app must refuse to boot (`TRAFFIC_RESET_PRICE must be a positive number`); with `0` likewise; empty/positive is accepted. Verify by reading the refine, or boot locally if env is available.

- [ ] **Step 5: Commit**

```bash
git add backend/src/common/config/app-config/config.schema.ts .env.sample
git commit -m "feat(config): add TRAFFIC_RESET_PRICE env var"
```

---

### Task 2: CardLink — optional `description`

**Files:**
- Modify: `backend/src/common/cardlink/cardlink.service.ts:6-12,47`

**Interfaces:**
- Produces: `CardLinkService.createOrder` accepts optional `description`; when present it is used as the bill description, otherwise the current `orderId` default is kept (subscription behavior unchanged).

- [ ] **Step 1: Add `description` to the params interface**

Replace lines 6–12:

```ts
interface ICreateOrderParams {
    amount: number;
    currency?: string;
    failRedirectUrl?: string;
    orderId: string;
    successRedirectUrl?: string;
}
```

with:

```ts
interface ICreateOrderParams {
    amount: number;
    currency?: string;
    description?: string;
    failRedirectUrl?: string;
    orderId: string;
    successRedirectUrl?: string;
}
```

- [ ] **Step 2: Use it (fall back to `orderId`)**

Replace line 47 `        body.append('description', params.orderId);` with:

```ts
        body.append('description', params.description ?? params.orderId);
```

- [ ] **Step 3: Build**

Run: `cd backend && npm run build`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/common/cardlink/cardlink.service.ts
git commit -m "feat(cardlink): support optional order description"
```

---

### Task 3: Service core — shared `createPayment`, reset method, webhook `type`/`months`

**Files:**
- Modify: `backend/src/modules/root/root.service.ts:171-285,338-355`

**Interfaces:**
- Consumes: `WataService.createOrder`, `PlategaService.createOrder({...,description?})`, `CardLinkService.createOrder({...,description?})` (Task 2), `configService.get('TRAFFIC_RESET_PRICE')` (Task 1), `hasAnyPaymentProvider()`.
- Produces:
  - `createPaymentForTariff(shortUuid: string, months: number, sessionId: string): Promise<{ok:true;url:string}|{ok:false;reason:string}>` (kept).
  - `createTrafficResetPayment(shortUuid: string, sessionId: string): Promise<{ok:true;url:string}|{ok:false;reason:string}>` (new — consumed by Task 5 controller).
  - `isTrafficResetEnabled(): boolean` (new — consumed by Task 4 render).

- [ ] **Step 1: Add the reset-description constant**

In `root.service.ts`, just below `    private lastRateSweep = 0;` (line 34) add:

```ts
    private static readonly RESET_PAYMENT_DESCRIPTION = 'Сброс трафика';
```

- [ ] **Step 2: Replace `createPaymentForTariff` (lines 171–285) with the wrapper + shared core + reset method**

Replace the entire `public async createPaymentForTariff(...) { ... }` block (lines 171–285) with:

```ts
    public async createPaymentForTariff(
        shortUuid: string,
        months: number,
        sessionId: string,
    ): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
        if (!this.isValidTariffMonths(months)) {
            return { ok: false, reason: 'invalid_months' };
        }

        return this.createPayment(shortUuid, sessionId, { kind: 'subscription', months });
    }

    public async createTrafficResetPayment(
        shortUuid: string,
        sessionId: string,
    ): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
        if (!this.isTrafficResetEnabled()) {
            return { ok: false, reason: 'reset_disabled' };
        }

        return this.createPayment(shortUuid, sessionId, { kind: 'reset' });
    }

    public isTrafficResetEnabled(): boolean {
        const price = this.configService.get<number>('TRAFFIC_RESET_PRICE');
        return price !== undefined && price > 0 && this.hasAnyPaymentProvider();
    }

    private async createPayment(
        shortUuid: string,
        sessionId: string,
        product: { kind: 'subscription'; months: number } | { kind: 'reset' },
    ): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
        const currency = this.configService.get<string>('TARIFF_CURRENCY') ?? 'RUB';

        let amount: number | undefined;
        let orderToken: string;
        let description: string | undefined;
        let webhookType: 'SUBSCRIPTION' | 'TRAFFIC_RESET';
        let months: number | undefined;

        if (product.kind === 'subscription') {
            amount = this.configService.get<number>(`TARIFF_${product.months}M`);
            if (amount === undefined) {
                return { ok: false, reason: 'tariff_not_configured' };
            }
            orderToken = `${product.months}m`;
            webhookType = 'SUBSCRIPTION';
            months = product.months;
            description = undefined;
        } else {
            amount = this.configService.get<number>('TRAFFIC_RESET_PRICE');
            if (amount === undefined) {
                return { ok: false, reason: 'reset_not_configured' };
            }
            orderToken = 'reset';
            webhookType = 'TRAFFIC_RESET';
            months = undefined;
            description = RootService.RESET_PAYMENT_DESCRIPTION;
        }

        // Limit by session AND by shortUuid: keying on shortUuid alone let one session
        // fan out unlimited distinct values (panel-call amplification + unbounded map growth).
        if (
            !this.applyPaymentRateLimit(`s:${sessionId}`) ||
            !this.applyPaymentRateLimit(`u:${shortUuid}`)
        ) {
            this.logger.warn(
                `Payment rate limit exceeded (session ${sessionId}, shortUuid ${shortUuid})`,
            );
            return { ok: false, reason: 'rate_limited' };
        }

        const userResponse = await this.axiosService.getUserByShortUuid(shortUuid);
        if (!userResponse.isOk || !userResponse.response) {
            this.logger.warn(`Cannot create payment: user ${shortUuid} not found`);
            return { ok: false, reason: 'user_not_found' };
        }

        const userInfo = userResponse.response.response;
        const telegramId = userInfo.telegramId ?? null;
        const username = userInfo.username ?? '';
        const orderPrefix = telegramId !== null ? `${telegramId}_` : '';

        const successRedirectUrl = this.configService.get<string>('PAYMENT_SUCCESS_URL');
        const failRedirectUrl = this.configService.get<string>('PAYMENT_FAIL_URL');

        const providers: Array<'wata' | 'platega' | 'cardlink'> = [];
        if (this.wataService.isEnabled) providers.push('wata');
        if (this.plategaService.isEnabled) providers.push('platega');
        if (this.cardLinkService.isEnabled) providers.push('cardlink');

        if (providers.length === 0) {
            return { ok: false, reason: 'no_providers' };
        }

        for (let i = providers.length - 1; i > 0; i--) {
            const j = randomInt(i + 1);
            [providers[i], providers[j]] = [providers[j], providers[i]];
        }

        for (const provider of providers) {
            const ts = Date.now();
            const orderId = `${orderPrefix}${shortUuid}_${orderToken}_${ts}`;
            let url: string | null = null;
            let cardLinkBillId: string | undefined;

            try {
                if (provider === 'wata') {
                    url = await this.wataService.createOrder({
                        amount,
                        currency,
                        failRedirectUrl,
                        orderId,
                        successRedirectUrl,
                    });
                } else if (provider === 'platega') {
                    url = await this.plategaService.createOrder({
                        amount,
                        currency,
                        description,
                        orderId,
                        successRedirectUrl,
                        failRedirectUrl,
                    });
                } else if (provider === 'cardlink') {
                    const cardLinkResult = await this.cardLinkService.createOrder({
                        amount,
                        currency,
                        description,
                        failRedirectUrl,
                        orderId,
                        successRedirectUrl,
                    });
                    if (cardLinkResult) {
                        url = cardLinkResult.url;
                        cardLinkBillId = cardLinkResult.billId;
                    }
                }
            } catch (err) {
                this.logger.error(`Provider ${provider} failed for order ${orderId}: ${err}`);
            }

            if (url) {
                this.logger.log(`Order ${orderId} created via ${provider}`);
                this.sendPaymentWebhook({
                    type: webhookType,
                    orderId,
                    months,
                    amount,
                    currency,
                    shortUuid,
                    username,
                    cardLinkBillId,
                }).catch((e) =>
                    this.logger.error(`Webhook dispatch failed for ${orderId}: ${e}`),
                );
                return { ok: true, url };
            }
        }

        return { ok: false, reason: 'all_providers_failed' };
    }
```

- [ ] **Step 3: Update `sendPaymentWebhook` to carry `type` and optional `months`**

Replace the signature + payload construction (lines 338–355) — i.e. from `private async sendPaymentWebhook(data: {` through the `const payload = { ...data, timestamp: new Date().toISOString() };` block — with:

```ts
    private async sendPaymentWebhook(data: {
        type: 'SUBSCRIPTION' | 'TRAFFIC_RESET';
        orderId: string;
        months?: number;
        amount: number;
        currency: string;
        shortUuid: string;
        username: string;
        cardLinkBillId?: string;
    }): Promise<{ ok: boolean; reason?: string }> {
        const webhookUrl = this.configService.get<string>('PAYMENT_WEBHOOK_URL');
        if (!webhookUrl) {
            return { ok: false, reason: 'webhook_disabled' };
        }

        const { months, ...rest } = data;
        const payload = {
            ...rest,
            ...(months !== undefined ? { months } : {}),
            timestamp: new Date().toISOString(),
        };
```

Leave the rest of the method (headers, HMAC over `JSON.stringify(payload)`, axios POST, logging) unchanged.

- [ ] **Step 4: Build + lint**

Run: `cd backend && npm run build && npm run lint`
Expected: no errors. (Type system enforces `description` is accepted by Platega and CardLink — confirms Task 2 landed.)

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/root/root.service.ts
git commit -m "feat(payments): shared payment core with traffic-reset product and typed webhook"
```

---

### Task 4: Backend render context + template data plumbing

**Files:**
- Modify: `backend/src/modules/root/root.service.ts:472-506`
- Modify: `frontend/index.html:41`
- Modify: `frontend/vite.config.ts:27`

**Interfaces:**
- Consumes: `isTrafficResetEnabled()` (Task 3), `TRAFFIC_RESET_PRICE`, `TARIFF_CURRENCY`.
- Produces: base64 `paymentReset` = `{ amount: number, currency: string }` rendered into `#pmt` `data-reset` (consumed by Task 6).

- [ ] **Step 1: Compute `paymentReset` in the service**

In `root.service.ts`, immediately after the `const paymentTariffs = ...` assignment (the block ending at line 477) add:

```ts
            const paymentReset = this.isTrafficResetEnabled()
                ? Buffer.from(
                      JSON.stringify({
                          amount: this.configService.get<number>('TRAFFIC_RESET_PRICE'),
                          currency: this.configService.get<string>('TARIFF_CURRENCY') ?? 'RUB',
                      }),
                  ).toString('base64')
                : '';
```

- [ ] **Step 2: Pass it to the view**

In the `res.render('index', { ... })` object (starts line 501), add `paymentReset,` right after the `paymentTariffs,` line (line 506):

```ts
                paymentUrl,
                paymentTariffs,
                paymentReset,
```

- [ ] **Step 3: Add `data-reset` to the template**

In `frontend/index.html`, replace line 41:

```html
        <div id="pmt" data-url="<%- paymentUrl %>" data-tariffs="<%- paymentTariffs %>"></div>
```

with:

```html
        <div id="pmt" data-url="<%- paymentUrl %>" data-tariffs="<%- paymentTariffs %>" data-reset="<%- paymentReset %>"></div>
```

- [ ] **Step 4: Add the dev EJS passthrough**

In `frontend/vite.config.ts`, in the production branch object (lines 22–32), add `paymentReset` after the `paymentTariffs` line:

```ts
                    paymentUrl: '<%- paymentUrl %>',
                    paymentTariffs: '<%- paymentTariffs %>',
                    paymentReset: '<%- paymentReset %>',
```

- [ ] **Step 5: Build both sides**

Run: `cd backend && npm run build`
Expected: no errors.
Run: `cd ../frontend && npm run cb`
Expected: vite build succeeds (EJS template compiles with the new var).

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/root/root.service.ts frontend/index.html frontend/vite.config.ts
git commit -m "feat(payments): expose traffic-reset price to the page via #pmt data"
```

---

### Task 5: Reset endpoint + auth gate + prefix exclusion (security-critical)

**Files:**
- Modify: `backend/src/modules/root/root.controller.ts:82` (insert after `createPayment`)
- Modify: `backend/src/common/middlewares/check-assets-cookie.middleware.ts:15-19`
- Modify: `backend/src/main.ts:111`

**Interfaces:**
- Consumes: `rootService.createTrafficResetPayment(shortUuid, sessionId)` (Task 3), `renderPayRedirectPage` (existing private method).
- Produces: `GET /api/pay/reset?shortUuid=…` (consumed by Task 8 button).

- [ ] **Step 1: Add the controller handler**

In `root.controller.ts`, insert this method immediately after the closing `}` of `createPayment` (after line 82, before `private renderPayRedirectPage`):

```ts
    @Get('api/pay/reset')
    async createTrafficResetPayment(
        @GetJWTPayload() user: IJwtPayload,
        @Req() request: Request,
        @Res() response: Response,
        @Query('shortUuid') shortUuid: string,
    ) {
        if (!user) {
            response.socket?.destroy();
            return;
        }

        if (!shortUuid) {
            response.status(400).send('Bad Request');
            return;
        }

        // Bind the payment to the subscription the session was issued for (same IDOR guard as /api/pay).
        if (!user.sub || user.sub !== shortUuid) {
            response.status(403).send('Forbidden');
            return;
        }

        const result = await this.rootService.createTrafficResetPayment(
            shortUuid,
            user.sessionId,
        );
        if (!result.ok) {
            this.logger.warn(`Traffic reset payment failed for ${shortUuid}: ${result.reason}`);
            response
                .status(result.reason === 'rate_limited' ? 429 : 502)
                .send('Payment unavailable');
            return;
        }

        const acceptLang = String(request.headers['accept-language'] ?? '');
        const isRu = /(^|,|;)\s*ru\b/i.test(acceptLang);

        response
            .status(200)
            .type('html')
            .setHeader('Cache-Control', 'no-store')
            .send(this.renderPayRedirectPage(result.url, isRu));
    }
```

- [ ] **Step 2: Gate the route in the cookie middleware**

In `check-assets-cookie.middleware.ts`, replace the condition (lines 15–19):

```ts
    if (
        req.path.startsWith('/assets') ||
        req.path.startsWith('/locales') ||
        req.path === '/api/pay'
    ) {
```

with:

```ts
    if (
        req.path.startsWith('/assets') ||
        req.path.startsWith('/locales') ||
        req.path === '/api/pay' ||
        req.path === '/api/pay/reset'
    ) {
```

- [ ] **Step 3: Exclude the route from the global prefix**

In `main.ts`, replace line 111:

```ts
        exclude: [APP_CONFIG_ROUTE_WO_LEADING_PATH, 'api/pay'],
```

with:

```ts
        exclude: [APP_CONFIG_ROUTE_WO_LEADING_PATH, 'api/pay', 'api/pay/reset'],
```

- [ ] **Step 4: Build + lint**

Run: `cd backend && npm run build && npm run lint`
Expected: no errors.

- [ ] **Step 5: Manual auth check (if a local panel/env is available)**

- `GET /api/pay/reset` with **no** `session` cookie → connection destroyed (no response). Confirms the gate is active (without Step 2 it would respond unauthenticated — the key security check).
- With a valid session but `shortUuid` ≠ `user.sub` → `403 Forbidden`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/root/root.controller.ts backend/src/common/middlewares/check-assets-cookie.middleware.ts backend/src/main.ts
git commit -m "feat(payments): add authenticated /api/pay/reset endpoint"
```

---

### Task 6: Frontend store — reset state + hydration

**Files:**
- Modify: `frontend/src/entities/payment-store/payment-store.ts`
- Modify: `frontend/src/app/layouts/root/root.layout.tsx:54-72`

**Interfaces:**
- Consumes: `#pmt` `data-reset` base64 `{amount,currency}` (Task 4).
- Produces: `usePaymentReset(): { amount: number; currency: string } | null` (consumed by Task 8); `paymentActions.setReset`.

- [ ] **Step 1: Extend the store**

Replace the full contents of `payment-store.ts` with:

```ts
import { create } from 'zustand'

export interface IPaymentTariff {
    months: number
    amount: number
    currency: string
}

export interface IPaymentReset {
    amount: number
    currency: string
}

interface IState {
    paymentUrl: string
    tariffs: IPaymentTariff[]
    reset: IPaymentReset | null
}

interface IActions {
    actions: {
        setPaymentUrl: (url: string) => void
        setTariffs: (tariffs: IPaymentTariff[]) => void
        setReset: (reset: IPaymentReset | null) => void
    }
}

const initialState: IState = {
    paymentUrl: '',
    tariffs: [],
    reset: null
}

export const usePaymentStore = create<IActions & IState>()((set) => ({
    ...initialState,
    actions: {
        setPaymentUrl: (url: string) => {
            set({ paymentUrl: url })
        },
        setTariffs: (tariffs: IPaymentTariff[]) => {
            set({ tariffs })
        },
        setReset: (reset: IPaymentReset | null) => {
            set({ reset })
        }
    }
}))

export const usePaymentStoreActions = () => usePaymentStore((store) => store.actions)

export const usePaymentUrl = () => usePaymentStore((state) => state.paymentUrl)

export const usePaymentTariffs = () => usePaymentStore((state) => state.tariffs)

export const usePaymentReset = () => usePaymentStore((state) => state.reset)
```

- [ ] **Step 2: Parse `data-reset` in the layout**

In `root.layout.tsx`, inside the `if (paymentDiv) { ... }` block, immediately **after** the tariffs `try/catch` block (after line 69, before `paymentDiv.remove()` on line 71) insert:

```ts
            const resetData = paymentDiv.dataset.reset ?? ''
            if (resetData) {
                try {
                    const reset = JSON.parse(atob(resetData))
                    if (
                        reset &&
                        typeof reset.amount === 'number' &&
                        typeof reset.currency === 'string'
                    ) {
                        paymentActions.setReset(reset)
                    }
                } catch {
                    consola.error('Failed to parse payment reset config')
                }
            }
```

- [ ] **Step 3: Typecheck + lint**

Run: `cd frontend && npm run typecheck && npm run lint:eslint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/entities/payment-store/payment-store.ts frontend/src/app/layouts/root/root.layout.tsx
git commit -m "feat(payments): hydrate traffic-reset config into the payment store"
```

---

### Task 7: Shared currency formatter (DRY)

**Files:**
- Create: `frontend/src/shared/utils/format-amount/format-amount.util.ts`
- Create: `frontend/src/shared/utils/format-amount/index.ts`
- Modify: `frontend/src/widgets/main/subscription-link/subscription-link.widget.tsx:32-53`

**Interfaces:**
- Produces: `formatAmount(amount: number, currency: string): string` (consumed by Tasks 7 & 8).

- [ ] **Step 1: Create the shared util**

`frontend/src/shared/utils/format-amount/format-amount.util.ts`:

```ts
const CURRENCY_SYMBOLS: Record<string, string> = {
    RUB: '₽',
    USD: '$',
    EUR: '€',
    UAH: '₴',
    KZT: '₸',
    BYN: 'Br',
    GBP: '£',
    TRY: '₺'
}

export function formatAmount(amount: number, currency: string): string {
    const symbol = CURRENCY_SYMBOLS[currency] ?? currency
    return `${amount} ${symbol}`
}
```

`frontend/src/shared/utils/format-amount/index.ts`:

```ts
export * from './format-amount.util'
```

- [ ] **Step 2: Use it in the subscription-link widget**

In `subscription-link.widget.tsx`, delete the local `CURRENCY_SYMBOLS` const (lines 32–41) and the local `formatAmount` function (lines 50–53), keeping `PERIOD_LABELS` and `getPeriodLabel`. Then add to the import block (after line 17 `import { constructSubscriptionUrl } from '@shared/utils/construct-subscription-url'`):

```ts
import { formatAmount } from '@shared/utils/format-amount'
```

(After this edit the file still references `formatAmount(...)` in `renderTariffCard` — now resolved from the shared import. `getPeriodLabel`/`PERIOD_LABELS` remain local.)

- [ ] **Step 3: Typecheck + lint**

Run: `cd frontend && npm run typecheck && npm run lint:eslint`
Expected: no errors (no unused-symbol warnings for the removed locals).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/shared/utils/format-amount frontend/src/widgets/main/subscription-link/subscription-link.widget.tsx
git commit -m "refactor(frontend): extract shared formatAmount util"
```

---

### Task 8: Reset-traffic button + i18n + mount in the three traffic widgets

**Files:**
- Create: `frontend/src/widgets/main/subscription-info/reset-traffic-button/reset-traffic-button.tsx`
- Create: `frontend/src/widgets/main/subscription-info/reset-traffic-button/reset-traffic.i18n.ts`
- Create: `frontend/src/widgets/main/subscription-info/reset-traffic-button/index.ts`
- Modify: `frontend/src/widgets/main/subscription-info/subscription-info-cards.widget.tsx:82-112`
- Modify: `frontend/src/widgets/main/subscription-info/subscription-info-expanded.widget.tsx:151`
- Modify: `frontend/src/widgets/main/subscription-info/subscription-info-collapsed.widget.tsx:158`

**Interfaces:**
- Consumes: `usePaymentReset()` (Task 6), `formatAmount` (Task 7), `useSubscription()`, `useTranslation()`, `vibrate('tap')`, `modals.openConfirmModal`, `GET /api/pay/reset` (Task 5).
- Produces: `<ResetTrafficButton />` (renders `null` when reset is not configured).

- [ ] **Step 1: Create the i18n strings**

`frontend/src/widgets/main/subscription-info/reset-traffic-button/reset-traffic.i18n.ts`:

```ts
type Lang = 'en' | 'ru' | 'zh' | 'fa' | 'fr'

export interface IResetStrings {
    resetTraffic: string
    confirmTitle: string
    confirmBody: (price: string) => string
    pay: string
    cancel: string
}

const STRINGS: Record<Lang, IResetStrings> = {
    en: {
        resetTraffic: 'Reset traffic',
        confirmTitle: 'Reset traffic',
        confirmBody: (price) => `Reset your traffic for ${price}? This is a paid action.`,
        pay: 'Pay',
        cancel: 'Cancel'
    },
    ru: {
        resetTraffic: 'Сбросить трафик',
        confirmTitle: 'Сброс трафика',
        confirmBody: (price) => `Сбросить трафик за ${price}? Действие платное.`,
        pay: 'Оплатить',
        cancel: 'Отмена'
    },
    zh: {
        resetTraffic: '重置流量',
        confirmTitle: '重置流量',
        confirmBody: (price) => `支付 ${price} 重置流量？这是一项付费操作。`,
        pay: '支付',
        cancel: '取消'
    },
    fa: {
        resetTraffic: 'بازنشانی ترافیک',
        confirmTitle: 'بازنشانی ترافیک',
        confirmBody: (price) =>
            `ترافیک خود را با پرداخت ${price} بازنشانی می‌کنید؟ این عملیات هزینه دارد.`,
        pay: 'پرداخت',
        cancel: 'لغو'
    },
    fr: {
        resetTraffic: 'Réinitialiser le trafic',
        confirmTitle: 'Réinitialiser le trafic',
        confirmBody: (price) => `Réinitialiser votre trafic pour ${price} ? Cette action est payante.`,
        pay: 'Payer',
        cancel: 'Annuler'
    }
}

export function getResetStrings(lang: string): IResetStrings {
    return STRINGS[lang as Lang] ?? STRINGS.en
}
```

- [ ] **Step 2: Create the button component**

`frontend/src/widgets/main/subscription-info/reset-traffic-button/reset-traffic-button.tsx`:

```tsx
import { IconRefresh } from '@tabler/icons-react'
import { Button, Text } from '@mantine/core'
import { modals } from '@mantine/modals'

import { useSubscription } from '@entities/subscription-info-store'
import { usePaymentReset } from '@entities/payment-store'
import { formatAmount } from '@shared/utils/format-amount'
import { vibrate } from '@shared/utils/vibrate'
import { useTranslation } from '@shared/hooks'

import { getResetStrings } from './reset-traffic.i18n'

export const ResetTrafficButton = () => {
    const reset = usePaymentReset()
    const subscription = useSubscription()
    const { currentLang } = useTranslation()

    if (!reset) {
        return null
    }

    const s = getResetStrings(currentLang)
    const priceLabel = formatAmount(reset.amount, reset.currency)

    const handleClick = () => {
        vibrate('tap')
        modals.openConfirmModal({
            centered: true,
            title: s.confirmTitle,
            children: <Text size="sm">{s.confirmBody(priceLabel)}</Text>,
            labels: { confirm: s.pay, cancel: s.cancel },
            onConfirm: () => {
                const shortUuid = subscription.user.shortUuid
                const url = `/api/pay/reset?shortUuid=${encodeURIComponent(shortUuid)}`
                window.open(url, '_blank', 'noopener,noreferrer')
            }
        })
    }

    return (
        <Button
            fullWidth
            leftSection={<IconRefresh size={18} />}
            mt="xs"
            onClick={handleClick}
            radius="md"
            size="md"
            variant="light"
        >
            {`${s.resetTraffic} · ${priceLabel}`}
        </Button>
    )
}
```

`frontend/src/widgets/main/subscription-info/reset-traffic-button/index.ts`:

```ts
export * from './reset-traffic-button'
```

- [ ] **Step 3: Mount in the cards widget**

In `subscription-info-cards.widget.tsx`, add to the import block (after line 6 `import { useTranslation } from '@shared/hooks'`):

```ts
import { ResetTrafficButton } from './reset-traffic-button'
```

Then replace the `return ( <SimpleGrid ...> ... </SimpleGrid> )` (lines 82–112) by wrapping the grid in a `Stack` and appending the button:

```tsx
    return (
        <Stack gap="xs">
            <SimpleGrid cols={{ base: 1, xs: 1, sm: 2 }} spacing="xs" verticalSpacing="xs">
                <CardItem
                    color="blue"
                    icon={<IconUserScan size={18} />}
                    label={t(baseTranslations.name)}
                    value={user.username}
                />

                <CardItem
                    color={isActive ? 'green' : 'red'}
                    icon={isActive ? <IconCheck size={18} /> : <IconX size={18} />}
                    label={t(baseTranslations.status)}
                    value={statusText}
                />

                <CardItem
                    color="orange"
                    icon={<IconCalendar size={18} />}
                    label={t(baseTranslations.expires)}
                    value={formatDate(user.expiresAt, currentLang, baseTranslations)}
                />

                <CardItem
                    color="cyan"
                    icon={<IconArrowsUpDown size={18} />}
                    label={t(baseTranslations.bandwidth)}
                    value={bandwidthValue}
                />
            </SimpleGrid>

            <ResetTrafficButton />
        </Stack>
    )
```

(`Stack` is already imported in this file.)

- [ ] **Step 4: Mount in the expanded widget**

In `subscription-info-expanded.widget.tsx`, add the import near the other widget imports:

```ts
import { ResetTrafficButton } from './reset-traffic-button'
```

Then, immediately after the closing `</SimpleGrid>` (line 152) and before `</Stack>` (line 153), insert:

```tsx
                <ResetTrafficButton />
```

- [ ] **Step 5: Mount in the collapsed widget**

In `subscription-info-collapsed.widget.tsx`, add the import near the other widget imports:

```ts
import { ResetTrafficButton } from './reset-traffic-button'
```

Then, immediately after the closing `</SimpleGrid>` (line 159) and before `</Stack>` (line 160), insert:

```tsx
                    <ResetTrafficButton />
```

- [ ] **Step 6: Typecheck + lint + build**

Run: `cd frontend && npm run typecheck && npm run lint:eslint && npm run cb`
Expected: no errors; bundle builds.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/widgets/main/subscription-info/reset-traffic-button frontend/src/widgets/main/subscription-info/subscription-info-cards.widget.tsx frontend/src/widgets/main/subscription-info/subscription-info-expanded.widget.tsx frontend/src/widgets/main/subscription-info/subscription-info-collapsed.widget.tsx
git commit -m "feat(frontend): add reset-traffic button with confirm modal"
```

---

### Task 9: Full verification & e2e

**Files:** none (verification only).

- [ ] **Step 1: Full backend gate**

Run: `cd backend && npm run build && npm run lint`
Expected: clean.

- [ ] **Step 2: Full frontend gate**

Run: `cd frontend && npm run typecheck && npm run lint && npm run cb`
Expected: clean (eslint + stylelint + build).

- [ ] **Step 3: Manual e2e (one provider configured, `TRAFFIC_RESET_PRICE` set, `PAYMENT_WEBHOOK_URL` pointed at a request bin)**

Verify each:
- Reset button appears next to the traffic block; **disappears** when `TRAFFIC_RESET_PRICE` is unset or no provider is enabled.
- Confirm modal shows the correct price/currency and the localized title/body.
- `GET /api/pay/reset?shortUuid=<own>` → 200 redirect page; `<other shortUuid>` → 403; no session cookie → connection dropped.
- The created provider order's `orderId` contains `_reset_`.
- The outgoing webhook arrives with `type: "TRAFFIC_RESET"`, **no** `months`, and a valid `X-Webhook-Signature` (when `PAYMENT_WEBHOOK_SECRET` is set).
- The existing subscription tariff flow still works and its webhook now carries `type: "SUBSCRIPTION"` **with** `months`.
- 6th reset request within 60s → `429`.

- [ ] **Step 4: Update the spec status (optional)**

Mark the spec `Status:` as implemented, commit the docs.

---

## Self-Review

**Spec coverage:**
- §4.1 config → Task 1 ✔ · §4.7 providers → Task 2 ✔ · §4.3 service core + §3 webhook contract → Task 3 ✔ · §4.4 render + §5.1/5.2 template/vite → Task 4 ✔ · §4.5/4.6 endpoint+middleware+prefix → Task 5 ✔ · §5.3/5.4 store+hydration → Task 6 ✔ · §5.5 button (+ DRY formatter) → Tasks 7–8 ✔ · §5.6 i18n → Task 8 ✔ · §6 security → enforced in Tasks 3/5 ✔ · §7 verification → Task 9 ✔.
- `.env.sample` (§4.2) → Task 1 Step 2 ✔.

**Placeholder scan:** No TBD/TODO; every code step contains full code; commands have expected output.

**Type consistency:** `createTrafficResetPayment(shortUuid, sessionId)` defined in Task 3, called identically in Task 5. `isTrafficResetEnabled()` defined in Task 3, used in Tasks 3 & 4. `usePaymentReset()`/`IPaymentReset` defined in Task 6, consumed in Task 8. `formatAmount(amount, currency)` defined in Task 7, used in Tasks 7 & 8. `getResetStrings(lang)` defined and used in Task 8. Webhook `type`/optional `months` consistent between Task 3's core and `sendPaymentWebhook`.
