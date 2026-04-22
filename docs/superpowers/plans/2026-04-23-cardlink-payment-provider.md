# CardLink Payment Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CardLink (cardlink.link) as a third payment provider integrated into the existing random-rotation flow alongside Wata and Platega.

**Architecture:** New `@Global` NestJS module at `backend/src/common/cardlink/` with the same `{ isEnabled, createOrder }` contract as Wata/Platega. `RootService.resolvePaymentTariffs` collects CardLink into its shuffle array; no frontend changes because `IPaymentTariff` already abstracts the provider.

**Tech Stack:** NestJS 11, TypeScript (CommonJS), axios for HTTP, zod for env validation.

**Reference spec:** [../specs/2026-04-23-cardlink-payment-provider-design.md](../specs/2026-04-23-cardlink-payment-provider-design.md)

**Testing note:** The existing provider modules (`wata/`, `platega/`) ship with no unit tests. Per the spec, this plan does NOT introduce unit tests — verification is via TypeScript compilation (`npm run build`), env-validation behaviour, and manual acceptance. TDD is deliberately skipped to stay consistent with the existing codebase.

---

## File Structure

| Path | Responsibility |
|---|---|
| `backend/src/common/cardlink/cardlink.service.ts` | **new** — `CardLinkService` with `isEnabled`, `createOrder(params)`. Handles form-urlencoded POST to CardLink API, logging, error → `null`. |
| `backend/src/common/cardlink/cardlink.module.ts` | **new** — `@Global()` module exporting `CardLinkService`. |
| `backend/src/common/cardlink/index.ts` | **new** — barrel: re-export module + service. |
| `backend/src/common/config/app-config/config.schema.ts` | **modify** — add 3 env vars (`CARDLINK_API_KEY`, `CARDLINK_SHOP_ID`, `CARDLINK_PAYER_PAYS_COMMISSION`); 2 paired `superRefine` issues; extend "at least one tariff" check. |
| `backend/src/app.module.ts` | **modify** — import and register `CardLinkModule`. |
| `backend/src/modules/root/root.service.ts` | **modify** — inject `CardLinkService`, widen provider union, extend collection loop, add provider branch in generator. |
| `.env.sample` | **modify** — document 3 new env vars, update shared-tariff comment. |

---

## Task 1: CardLinkService

**Files:**
- Create: `backend/src/common/cardlink/cardlink.service.ts`

- [ ] **Step 1: Create `cardlink.service.ts` with the full implementation**

```typescript
import axios, { AxiosError } from 'axios';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ICreateOrderParams {
    amount: number;
    currency?: string;
    failRedirectUrl?: string;
    orderId: string;
    successRedirectUrl?: string;
}

interface ICardLinkResponse {
    link_page_url: string;
    bill_id: string;
    success?: boolean;
}

@Injectable()
export class CardLinkService {
    private readonly logger = new Logger(CardLinkService.name);
    private readonly apiKey: string | undefined;
    private readonly shopId: string | undefined;
    private readonly payerPaysCommission: number;

    constructor(private readonly configService: ConfigService) {
        this.apiKey = this.configService.get<string>('CARDLINK_API_KEY');
        this.shopId = this.configService.get<string>('CARDLINK_SHOP_ID');
        this.payerPaysCommission =
            this.configService.get<number>('CARDLINK_PAYER_PAYS_COMMISSION') ?? 0;
    }

    public get isEnabled(): boolean {
        return !!this.apiKey && !!this.shopId;
    }

    public async createOrder(params: ICreateOrderParams): Promise<string | null> {
        if (!this.apiKey || !this.shopId) {
            return null;
        }

        const body = new URLSearchParams();
        body.append('amount', params.amount.toFixed(2));
        body.append('order_id', params.orderId);
        body.append('description', params.orderId);
        body.append('name', params.orderId);
        body.append('type', 'normal');
        body.append('shop_id', this.shopId);
        body.append('currency_in', params.currency ?? 'RUB');
        body.append('payer_pays_commission', String(this.payerPaysCommission));

        if (params.successRedirectUrl) {
            body.append('success_url', params.successRedirectUrl);
        }

        if (params.failRedirectUrl) {
            body.append('fail_url', params.failRedirectUrl);
        }

        try {
            const response = await axios.post<ICardLinkResponse>(
                'https://cardlink.link/api/v1/bill/create',
                body,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                    timeout: 10_000,
                },
            );

            this.logger.log(`CardLink order created: ${response.data.bill_id}`);

            return response.data.link_page_url ?? null;
        } catch (error) {
            if (error instanceof AxiosError) {
                this.logger.error(
                    `CardLink API error (${error.response?.status}): ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`,
                );
            } else {
                this.logger.error(`CardLink API unexpected error: ${error}`);
            }

            return null;
        }
    }
}
```

- [ ] **Step 2: Verify file compiles in isolation (no registration yet)**

Run: `cd backend && npx tsc --noEmit src/common/cardlink/cardlink.service.ts`
Expected: no errors. (Ignored: may complain about missing sibling module — fine, module is added next task.)

Note: this step is advisory. The authoritative compile check is at Task 7.

---

## Task 2: CardLinkModule + barrel

**Files:**
- Create: `backend/src/common/cardlink/cardlink.module.ts`
- Create: `backend/src/common/cardlink/index.ts`

- [ ] **Step 1: Create `cardlink.module.ts`**

```typescript
import { Global, Module } from '@nestjs/common';

import { CardLinkService } from './cardlink.service';

@Global()
@Module({
    providers: [CardLinkService],
    exports: [CardLinkService],
})
export class CardLinkModule {}
```

- [ ] **Step 2: Create `index.ts` barrel**

```typescript
export * from './cardlink.module';
export * from './cardlink.service';
```

- [ ] **Step 3: Commit the new module**

```bash
git add backend/src/common/cardlink/
git commit -m "feat: add CardLinkService and CardLinkModule scaffold"
```

---

## Task 3: Config schema

**Files:**
- Modify: `backend/src/common/config/app-config/config.schema.ts` (after line 81 for env fields; inside `superRefine` around lines 126-146)

- [ ] **Step 1: Add three env fields after the Platega block**

Locate the block:
```typescript
        PLATEGA_SECRET: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? v : undefined)),
```
(ends at line 81)

Insert **immediately after** (before the `PAYMENT_WEBHOOK_URL` block on line 83):

```typescript
        // CardLink payment gateway
        CARDLINK_API_KEY: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? v : undefined)),
        CARDLINK_SHOP_ID: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? v : undefined)),
        CARDLINK_PAYER_PAYS_COMMISSION: z
            .string()
            .default('0')
            .transform((v) => (v === '1' ? 1 : 0)),

```

- [ ] **Step 2: Update "at least one tariff" superRefine check**

Find the block (lines 126-139):

```typescript
        if (
            (data.WATA_API_KEY || data.PLATEGA_MERCHANT_ID) &&
            !data.TARIFF_1M &&
            !data.TARIFF_3M &&
            !data.TARIFF_6M &&
            !data.TARIFF_12M
        ) {
```

Replace the condition's first line with:

```typescript
        if (
            (data.WATA_API_KEY || data.PLATEGA_MERCHANT_ID || data.CARDLINK_API_KEY) &&
            !data.TARIFF_1M &&
            !data.TARIFF_3M &&
            !data.TARIFF_6M &&
            !data.TARIFF_12M
        ) {
```

- [ ] **Step 3: Add paired validation for CardLink after the Platega paired check**

Find the Platega check (lines 140-146):

```typescript
        if (data.PLATEGA_MERCHANT_ID && !data.PLATEGA_SECRET) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'PLATEGA_SECRET is required when PLATEGA_MERCHANT_ID is set',
                path: ['PLATEGA_SECRET'],
            });
        }
```

Insert **immediately after** (before the closing `});` of `superRefine`):

```typescript
        if (data.CARDLINK_API_KEY && !data.CARDLINK_SHOP_ID) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'CARDLINK_SHOP_ID is required when CARDLINK_API_KEY is set',
                path: ['CARDLINK_SHOP_ID'],
            });
        }
        if (data.CARDLINK_SHOP_ID && !data.CARDLINK_API_KEY) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'CARDLINK_API_KEY is required when CARDLINK_SHOP_ID is set',
                path: ['CARDLINK_API_KEY'],
            });
        }
```

- [ ] **Step 4: Commit the schema changes**

```bash
git add backend/src/common/config/app-config/config.schema.ts
git commit -m "feat: add CardLink env vars and paired validation to config schema"
```

---

## Task 4: Register CardLinkModule in AppModule

**Files:**
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Add the import**

Current imports block (lines 4-8):

```typescript
import { validateEnvConfig } from '@common/utils/validate-env-config';
import { configSchema, Env } from '@common/config/app-config';
import { PlategaModule } from '@common/platega/platega.module';
import { AxiosModule } from '@common/axios/axios.module';
import { WataModule } from '@common/wata/wata.module';
```

Change to (insert `CardLinkModule` import between the `configSchema` line and the `PlategaModule` line — this follows the existing sort-by-descending-length style of this file: `CardLinkModule` is 14 chars, fitting between `configSchema, Env` (17) and `PlategaModule` (13)):

```typescript
import { validateEnvConfig } from '@common/utils/validate-env-config';
import { configSchema, Env } from '@common/config/app-config';
import { CardLinkModule } from '@common/cardlink/cardlink.module';
import { PlategaModule } from '@common/platega/platega.module';
import { AxiosModule } from '@common/axios/axios.module';
import { WataModule } from '@common/wata/wata.module';
```

- [ ] **Step 2: Register in `imports` array**

Current `imports` (lines 13-16):

```typescript
    imports: [
        AxiosModule,
        WataModule,
        PlategaModule,
```

Change to:

```typescript
    imports: [
        AxiosModule,
        WataModule,
        PlategaModule,
        CardLinkModule,
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/app.module.ts
git commit -m "feat: register CardLinkModule in AppModule"
```

---

## Task 5: Integrate into RootService rotation

**Files:**
- Modify: `backend/src/modules/root/root.service.ts` (imports around line 17, constructor around line 39, `resolvePaymentTariffs` lines 174-194, `generateTariffsForProvider` lines 209-246)

- [ ] **Step 1: Add import**

Current (lines 15-18):

```typescript
import { AxiosService } from '@common/axios/axios.service';
import { PlategaService } from '@common/platega/platega.service';
import { WataService } from '@common/wata/wata.service';
import { IGNORED_HEADERS } from '@common/constants';
```

Change to:

```typescript
import { AxiosService } from '@common/axios/axios.service';
import { CardLinkService } from '@common/cardlink/cardlink.service';
import { PlategaService } from '@common/platega/platega.service';
import { WataService } from '@common/wata/wata.service';
import { IGNORED_HEADERS } from '@common/constants';
```

- [ ] **Step 2: Inject `CardLinkService` in constructor**

Current constructor params (lines 33-40):

```typescript
    constructor(
        private readonly configService: ConfigService,
        private readonly jwtService: JwtService,
        private readonly axiosService: AxiosService,
        private readonly subpageConfigService: SubpageConfigService,
        private readonly wataService: WataService,
        private readonly plategaService: PlategaService,
    ) {
```

Change to:

```typescript
    constructor(
        private readonly configService: ConfigService,
        private readonly jwtService: JwtService,
        private readonly axiosService: AxiosService,
        private readonly subpageConfigService: SubpageConfigService,
        private readonly wataService: WataService,
        private readonly plategaService: PlategaService,
        private readonly cardLinkService: CardLinkService,
    ) {
```

- [ ] **Step 3: Widen provider union and add CardLink to the rotation array**

Current (lines 173-176):

```typescript
        // Collect enabled providers and pick one randomly
        const providers: Array<'wata' | 'platega'> = [];
        if (this.wataService.isEnabled) providers.push('wata');
        if (this.plategaService.isEnabled) providers.push('platega');
```

Change to:

```typescript
        // Collect enabled providers and pick one randomly
        const providers: Array<'wata' | 'platega' | 'cardlink'> = [];
        if (this.wataService.isEnabled) providers.push('wata');
        if (this.plategaService.isEnabled) providers.push('platega');
        if (this.cardLinkService.isEnabled) providers.push('cardlink');
```

- [ ] **Step 4: Widen `generateTariffsForProvider` signature and add CardLink branch**

Current signature (lines 209-216):

```typescript
    private async generateTariffsForProvider(
        provider: 'wata' | 'platega',
        shortUuid: string,
        configuredTariffs: Array<{ months: number; amount: number; currency: string }>,
        currency: string,
        successRedirectUrl?: string,
        failRedirectUrl?: string,
    ): Promise<Array<{ months: number; amount: number; currency: string; url: string; orderId: string }>> {
```

Change `provider` type to:

```typescript
        provider: 'wata' | 'platega' | 'cardlink',
```

Current branching (lines 223-239):

```typescript
                if (provider === 'wata') {
                    url = await this.wataService.createOrder({
                        amount: tariff.amount,
                        currency: tariff.currency,
                        failRedirectUrl,
                        orderId,
                        successRedirectUrl,
                    });
                } else if (provider === 'platega') {
                    url = await this.plategaService.createOrder({
                        amount: tariff.amount,
                        currency: tariff.currency,
                        orderId,
                        successRedirectUrl,
                        failRedirectUrl,
                    });
                }
```

Change to (add the CardLink branch after Platega):

```typescript
                if (provider === 'wata') {
                    url = await this.wataService.createOrder({
                        amount: tariff.amount,
                        currency: tariff.currency,
                        failRedirectUrl,
                        orderId,
                        successRedirectUrl,
                    });
                } else if (provider === 'platega') {
                    url = await this.plategaService.createOrder({
                        amount: tariff.amount,
                        currency: tariff.currency,
                        orderId,
                        successRedirectUrl,
                        failRedirectUrl,
                    });
                } else if (provider === 'cardlink') {
                    url = await this.cardLinkService.createOrder({
                        amount: tariff.amount,
                        currency: tariff.currency,
                        failRedirectUrl,
                        orderId,
                        successRedirectUrl,
                    });
                }
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/root/root.service.ts
git commit -m "feat: integrate CardLink provider into payment rotation"
```

---

## Task 6: Document env in `.env.sample`

**Files:**
- Modify: `.env.sample` (lines 25 and 46)

- [ ] **Step 1: Update shared-tariff comment**

Current line 25-27:

```
# Shared tariff settings. Used by all payment providers (Wata, Platega).
# Set amounts for tariff periods you want to offer. Only non-empty tariffs will be shown.
# At least one tariff is required when any payment provider is enabled.
```

Change line 25 to:

```
# Shared tariff settings. Used by all payment providers (Wata, Platega, CardLink).
```

- [ ] **Step 2: Append CardLink block after Platega block**

Current lines 42-46:

```
# Platega payment gateway (https://platega.io)
# Set both PLATEGA_MERCHANT_ID and PLATEGA_SECRET to enable.
# When multiple providers are enabled, one is randomly selected per user visit.
PLATEGA_MERCHANT_ID=
PLATEGA_SECRET=
```

Insert **immediately after line 46** (before the blank line and `PAYMENT_WEBHOOK_URL` section):

```

# CardLink payment gateway (https://cardlink.link)
# Set both CARDLINK_API_KEY and CARDLINK_SHOP_ID to enable.
# Optional: CARDLINK_PAYER_PAYS_COMMISSION (0 = merchant pays, 1 = payer pays; default 0).
CARDLINK_API_KEY=
CARDLINK_SHOP_ID=
CARDLINK_PAYER_PAYS_COMMISSION=0
```

- [ ] **Step 3: Commit**

```bash
git add .env.sample
git commit -m "docs: document CardLink env vars in .env.sample"
```

---

## Task 7: Build verification

**Files:** none (verification only)

- [ ] **Step 1: Clean install (optional) and build**

Run:

```bash
cd backend && npm run build
```

Expected: exit 0, no TypeScript errors. NestJS `dist/` emitted.

If compile fails: the error message points to the offending file and line. Common issues:
- **Cannot find module `@common/cardlink/...`** — Task 2 files missing or `tsconfig` path alias mismatch. Verify `cardlink.module.ts` and `index.ts` exist and contain the code from Task 2.
- **Property `cardLinkService` does not exist** — Task 5 Step 2 not applied correctly.
- **Type `'cardlink'` is not assignable...** — Task 5 Step 3 or Step 4 missed one of the union widenings.

- [ ] **Step 2: Lint**

Run:

```bash
cd backend && npm run lint
```

Expected: exit 0. If eslint auto-fixable issues appear, run `npm run lint:fix` then re-run `npm run lint`.

- [ ] **Step 3: Boot sanity (no CardLink credentials)**

With no `CARDLINK_*` env vars set, start the backend:

```bash
cd backend && npm run start:dev
```

Expected: app boots to "listening" without errors. Payment rotation continues to work as before (Wata/Platega only, or fallback to `PAYMENT_URL`).

Kill with `Ctrl+C` once you see the "Nest application successfully started" log line.

- [ ] **Step 4: Boot failure check — half-set credentials**

Set only `CARDLINK_API_KEY=test` in `.env` (leave `CARDLINK_SHOP_ID` empty) and run:

```bash
cd backend && npm run start:dev
```

Expected: app REFUSES to start with a zod validation error mentioning `CARDLINK_SHOP_ID is required when CARDLINK_API_KEY is set`.

Revert `.env` afterwards.

- [ ] **Step 5: Boot sanity — both CardLink credentials set**

Set both `CARDLINK_API_KEY=<test_value>` and `CARDLINK_SHOP_ID=<test_value>` (plus at least one `TARIFF_*M`). Run:

```bash
cd backend && npm run start:dev
```

Expected: boots cleanly. Open the subscription page a few times; backend log should show:
```
Payment providers order: [..., cardlink, ...]   (order varies)
Using payment provider: cardlink                (at least once across multiple loads)
```

If `CARDLINK_API_KEY` is bogus, you'll see `CardLink API error (...)` followed by ordering moving on to the next provider. That's correct fail-tolerance.

- [ ] **Step 6: End-to-end with real credentials**

Populate `.env` with real CardLink test-shop credentials. Open the subscription page, click a tariff button — a CardLink payment page should open and complete a test transaction. Confirm `bill_id` appears in the backend log.

- [ ] **Step 7: Final commit (if any fixes were needed during verification)**

If the verification steps required code fixes, commit them. Otherwise skip.

```bash
git status
# if clean, skip
# otherwise:
git add <files>
git commit -m "fix: address CardLink integration verification issues"
```

---

## Post-implementation

- **Push and open PR**: base branch `main`. PR title: `feat: add CardLink payment provider to rotation`. PR body: link to spec and plan.
- **`.env` rollout**: coordinate with ops to add `CARDLINK_API_KEY` and `CARDLINK_SHOP_ID` (+ optional `CARDLINK_PAYER_PAYS_COMMISSION`) to production secrets. Deployment is a no-op without those secrets — safe to merge first.
- **Follow-up (deferred, NOT part of this plan)**: If a 4th provider is added later, extract a shared `IPaymentProvider` interface and collapse the `if/else if` chain in `generateTariffsForProvider` into a `Map<string, IPaymentProvider>` dispatch. At 3 providers the duplication is tolerable.
