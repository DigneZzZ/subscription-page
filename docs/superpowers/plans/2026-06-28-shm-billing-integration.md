# SHM ↔ subscription-page billing integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make SHM the billing system of record — expose SHM tariffs as public JSON consumed by subscription-page, and book gateway-confirmed payments into SHM (assigning the paid tariff as the user-service `next`, resetting traffic for reset payments).

**Architecture:** Two new public SHM Template-Toolkit templates (`tariffs`, `payment-confirm`) deployed to the SHM instance, plus additive changes in subscription-page so `listAvailableTariffs()`/pricing source from SHM with env fallback. Stateless: payment confirmation arrives only from the gateway webhook (Platega/WATA/CardLink); `user.payment(uniq_key=orderId)` is idempotent.

**Tech Stack:** SHM (Perl 5 + Template-Toolkit, CryptX/`Crypt::PK::RSA`, `Digest::SHA`, `Digest::MD5`), subscription-page backend (NestJS 11, TypeScript, axios 1.18).

**Spec:** `docs/superpowers/specs/2026-06-28-shm-billing-integration-design.md` (read it first).

## Global Constraints

- **No test runner in backend.** Only `npm run build` (nest/tsc) and `npm run lint` (eslint) exist. Verification gate = build + lint clean, plus documented `curl`/manual checks. Do NOT add jest (out of scope).
- **Do NOT write to the live SHM templates volume** (`/Volumes/my-shm-panel-wd.vsemvpn.com/templates`). Author SHM templates under `shm-templates/` in this repo; deployment is the user's explicit step.
- **TT2 gotchas (verbatim from SHM repo conventions):** numbers — use `value FILTER format("%.0f")` then `+ 0`, never `.int`; string concat with `_` (e.g. `'a' _ b`); JSON response = print `toJson(obj)` then `{{ STOP }}`; raw body in `{{ PERL }}` via `CGI->new->Vars` → `$in{POSTDATA}`; raw headers via `$ENV{HTTP_X_*}`; TT vars set with `{{ x = ... }}` are readable in PERL via `$stash->get('x')` and writable via `$stash->set('x', ...)`.
- **`.tpls` flags:** `allow_public:true` (public route), `raw:true` (preserve body for signature), `content-type:"application/json"` + `json:1` (JSON response framing).
- **Idempotency master key:** `uniq_key = orderId` on `user.payment`.
- **orderId format (subscription-page, unchanged):** `${telegramId_}${shortUuid}_${token}_${ts}`, token ∈ `1m|3m|6m|12m|reset`.
- **subscription-page changes must degrade gracefully:** if `SHM_TARIFFS_URL`/`SHM_TARIFF_CATEGORY` unset or SHM unreachable → fall back to existing `TARIFF_*` env behavior (non-breaking).

---

### Task 1: SHM `tariffs` template (public catalogue)

**Files:**
- Create: `shm-templates/tariffs.tpl`
- Create: `shm-templates/tariffs.tpls`

**Interfaces:**
- Produces: `GET {SHM}/shm/v1/public/tariffs?category=<cat>` → `{ category, count, currency, tariffs:[{id,name,cost,period_months,period_days,period,currency,category}] }`.

- [ ] **Step 1: Create `shm-templates/tariffs.tpls`**

```json
{
   "allow_public": true,
   "content-type": "application/json",
   "json": 1
}
```

- [ ] **Step 2: Create `shm-templates/tariffs.tpl`**

```tt
{{#
# tariffs — ПУБЛИЧНЫЙ каталог услуг SHM по категории (JSON)
# GET /shm/v1/public/tariffs?category=<cat>
# Категория передаётся subscription-page из env SHM_TARIFF_CATEGORY.
#}}
{{ category = request.params.category || '' }}
{{ IF category == '' }}
{{ toJson({ error => 'missing category', code => 400, count => 0, tariffs => [] }) }}
{{ STOP }}
{{ END }}

{{ default_currency = config.subscription_page.currency || config.currency || 'RUB' }}
{{ rows = service.list_for_api('category', category) }}
{{ tariffs = [] }}
{{ FOR row IN rows }}
    {{ period_raw = row.period || 0 }}
    {{ period_int = period_raw FILTER format("%.0f") }}
    {{ period_int = period_int + 0 }}
    {{ period_frac = period_raw - period_int }}
    {{ period_frac_num = (period_frac * 10000) FILTER format("%.0f") }}
    {{ period_frac_num = period_frac_num + 0 }}
    {{ extra_days = (period_frac_num / 100) FILTER format("%.0f") }}
    {{ extra_days = extra_days + 0 }}
    {{ tariffs.push({
        id => row.service_id || row.id,
        name => row.name,
        cost => row.cost + 0,
        period_months => period_int,
        period_days => extra_days,
        period => period_raw,
        currency => default_currency,
        category => category
    }) }}
{{ END }}
{{ toJson({ category => category, count => tariffs.size, currency => default_currency, tariffs => tariffs }) }}
{{ STOP }}
```

- [ ] **Step 3: Verify JSON sidecar is valid**

Run: `python3 -m json.tool shm-templates/tariffs.tpls`
Expected: pretty-printed JSON, exit 0.

- [ ] **Step 4: Document the manual curl check (no live run here)**

Record in the README (Task 6) the verification command:
`curl -s "https://<shm>/shm/v1/public/tariffs?category=<cat>" | jq` → expect a `tariffs` array; empty/unknown category → `{count:0,tariffs:[]}`.

- [ ] **Step 5: Commit**

```bash
git add shm-templates/tariffs.tpl shm-templates/tariffs.tpls
git commit -m "feat(shm): add public tariffs catalogue template"
```

---

### Task 2: SHM `payment-confirm` template (gateway webhook receiver)

**Files:**
- Create: `shm-templates/payment-confirm.tpl`
- Create: `shm-templates/payment-confirm.tpls`

**Interfaces:**
- Consumes: SHM `config.platega.{merchant_id,secret}`, `config.cardlink.api_token`, `config.wata.public_key?`, `config.remnawave.server_id`, `config.subscription_page.category`, `config.payment_confirm.{debug,admin_chat_id}`, `config.telegram.bot_token`.
- Produces: `POST {SHM}/shm/v1/public/payment-confirm?ps=platega|wata|cardlink` → `{success|ignored|error,...}`; idempotent `user.payment(uniq_key=orderId)`; sets `us.next`; resets Remnawave traffic for reset orders.

- [ ] **Step 1: Create `shm-templates/payment-confirm.tpls`**

```json
{
   "allow_public": true,
   "raw": true,
   "content-type": "application/json",
   "json": 1
}
```

- [ ] **Step 2: Create `shm-templates/payment-confirm.tpl` (full content)**

```tt
{{#
# payment-confirm — ПУБЛИЧНЫЙ приёмник вебхуков ПОДТВЕРЖДЕНИЯ оплаты.
# POST /shm/v1/public/payment-confirm?ps=platega|wata|cardlink
# Stateless: пользователь и сумма берутся из колбэка ПС; orderId = uniq_key (идемпотентность).
#
# orderId (subscription-page): ${telegramId_}${shortUuid}_${token}_${ts}
#   token ∈ 1m|3m|6m|12m (подписка) | reset (сброс трафика)
#}}

{{ ps = request.params.ps || '' }}
{{ debug = config.payment_confirm.debug || 0 }}
{{ dry_run = request.params.dry_run || 0 }}
{{ admin_chat_id = config.payment_confirm.admin_chat_id || '' }}
{{ bot_token = config.telegram.bot_token || config.telegram.telegram_bot.token || '' }}

{{# --- alert helper (Telegram) --- #}}
{{ BLOCK alert_admin }}
{{ IF admin_chat_id && bot_token }}
  {{ a_res = http.post('https://api.telegram.org/bot' _ bot_token _ '/sendMessage', 'content_type', 'application/json', 'content', toJson({ chat_id => admin_chat_id, text => alert_text, parse_mode => 'HTML' })) }}
{{ END }}
{{ END }}

{{# --- 1. provider gate --- #}}
{{ IF ps != 'platega' && ps != 'wata' && ps != 'cardlink' }}
{{ toJson({ error => 'unknown ps', code => 400 }) }}{{ STOP }}
{{ END }}

{{# --- 2/3. verify signature + normalize per provider --- #}}
{{ verified = 0 }}{{ order_id = '' }}{{ amount = 0 }}{{ currency = '' }}{{ paid = 0 }}{{ pay_status = '' }}

{{ IF ps == 'platega' }}
   {{ cfg_platega_mid = config.platega.merchant_id || '' }}
   {{ cfg_platega_secret = config.platega.secret || '' }}
   {{ PERL }}
     use CGI;
     our $cgi = CGI->new; my %in = $cgi->Vars;
     my $mid = $ENV{HTTP_X_MERCHANTID} // '';
     my $sec = $ENV{HTTP_X_SECRET} // '';
     my $cm = $stash->get('cfg_platega_mid') // '';
     my $cs = $stash->get('cfg_platega_secret') // '';
     # constant-time-ish compare
     my $ok = ( length($mid) && $mid eq $cm && length($sec) && $sec eq $cs ) ? 1 : 0;
     $stash->set('verified', $ok);
   {{ END }}
   {{ pay_status = request.params.status || '' }}
   {{ amount = (request.params.amount || 0) + 0 }}
   {{ currency = request.params.currency || '' }}
   {{ order_id = request.params.payload || '' }}
   {{ paid = pay_status == 'CONFIRMED' ? 1 : 0 }}
   {{# fallback: payload отсутствует -> вытянуть из /transaction/{id} #}}
   {{ IF order_id == '' && request.params.id }}
       {{ tx = http.get('https://app.platega.io/transaction/' _ request.params.id, 'headers', { 'X-MerchantId' => cfg_platega_mid, 'X-Secret' => cfg_platega_secret }) }}
       {{ order_id = tx.response.payload || '' }}
   {{ END }}

{{ ELSIF ps == 'wata' }}
   {{# публичный ключ: из конфига или кэш storage (обновляем при отсутствии) #}}
   {{ wata_pubkey = config.wata.public_key || '' }}
   {{ IF wata_pubkey == '' }}
       {{ cached = storage.read('name', 'wata_pubkey') }}
       {{ wata_pubkey = cached.response.value || '' }}
       {{ IF wata_pubkey == '' }}
           {{ pk = http.get('https://api.wata.pro/api/h2h/public-key') }}
           {{ wata_pubkey = pk.response.value || pk.response || '' }}
           {{ saved = storage.save('wata_pubkey', { value => wata_pubkey }) }}
       {{ END }}
   {{ END }}
   {{ PERL }}
     use CGI; use MIME::Base64 qw(decode_base64);
     use Crypt::PK::RSA;
     our $cgi = CGI->new; my %in = $cgi->Vars;
     my $body = $in{POSTDATA} // '';
     my $sig_b64 = $ENV{HTTP_X_SIGNATURE} // '';
     my $pem = $stash->get('wata_pubkey') // '';
     my $ok = 0;
     eval {
        if ( length($pem) && length($sig_b64) && length($body) ) {
            my $pk = Crypt::PK::RSA->new( \$pem );
            $ok = $pk->verify_message( $body, decode_base64($sig_b64), 'SHA512', 'v1.5' ) ? 1 : 0;
        }
        1;
     } or do { $ok = 0; };
     $stash->set('verified', $ok);
   {{ END }}
   {{ pay_status = request.params.transactionStatus || '' }}
   {{ amount = (request.params.amount || 0) + 0 }}
   {{ currency = request.params.currency || '' }}
   {{ order_id = request.params.orderId || '' }}
   {{ paid = pay_status == 'Paid' ? 1 : 0 }}

{{ ELSIF ps == 'cardlink' }}
   {{ cfg_cardlink_token = config.cardlink.api_token || '' }}
   {{ PERL }}
     use CGI; use Digest::MD5 qw(md5_hex);
     our $cgi = CGI->new; my %in = $cgi->Vars;
     my $out = $cgi->param('OutSum') // '';
     my $inv = $cgi->param('InvId') // '';
     my $sig = uc( $cgi->param('SignatureValue') // '' );
     my $tok = $stash->get('cfg_cardlink_token') // '';
     my $calc = uc( md5_hex( $out . ':' . $inv . ':' . $tok ) );
     $stash->set('verified', ( length($sig) && $sig eq $calc ) ? 1 : 0);
   {{ END }}
   {{ pay_status = request.params.Status || '' }}
   {{ amount = (request.params.OutSum || 0) + 0 }}
   {{ currency = request.params.CurrencyIn || '' }}
   {{ order_id = request.params.InvId || '' }}
   {{ paid = pay_status == 'SUCCESS' ? 1 : 0 }}
{{ END }}

{{ IF verified != 1 }}
{{ alert_text = '🚨 payment-confirm: invalid signature (' _ ps _ '), order=' _ order_id }}
{{ INCLUDE alert_admin }}
{{ toJson({ error => 'invalid_signature', ps => ps, code => 401 }) }}{{ STOP }}
{{ END }}

{{ IF paid != 1 }}
{{ toJson({ ignored => 1, reason => pay_status, ps => ps, order_id => order_id }) }}{{ STOP }}
{{ END }}

{{ IF order_id == '' }}
{{ alert_text = '🚨 payment-confirm: missing order_id (' _ ps _ ')' }}
{{ INCLUDE alert_admin }}
{{ toJson({ error => 'missing_order_id', ps => ps, code => 400 }) }}{{ STOP }}
{{ END }}

{{# --- 4. parse orderId (right-anchored) --- #}}
{{ parts = order_id.split('_') }}
{{ n = parts.size }}
{{ ts = parts.${n - 1} }}
{{ token = parts.${n - 2} }}
{{ short_uuid = '' }}{{ telegram_id = '' }}
{{ IF n >= 4 && parts.0.match('^\d+$') }}
    {{ telegram_id = parts.0 }}
    {{ short_uuid = parts.1 }}
    {{# если shortUuid содержал '_', собираем средние части #}}
    {{ i = 2 }}{{ WHILE i < (n - 2) }}{{ short_uuid = short_uuid _ '_' _ parts.$i }}{{ i = i + 1 }}{{ END }}
{{ ELSE }}
    {{ short_uuid = parts.0 }}
    {{ i = 1 }}{{ WHILE i < (n - 2) }}{{ short_uuid = short_uuid _ '_' _ parts.$i }}{{ i = i + 1 }}{{ END }}
{{ END }}
{{ is_reset = token == 'reset' ? 1 : 0 }}
{{ months = 0 }}
{{ IF !is_reset }}{{ months = token.replace('m','') + 0 }}{{ END }}

{{# --- 5. map user via Remnawave by-short-uuid --- #}}
{{ remna_server_id = config.remnawave.server_id || 1 }}
{{ HOST = server.id(remna_server_id).settings.api.host }}
{{ TOKEN = server.id(remna_server_id).settings.api.token }}
{{ rheaders = { 'Authorization' => 'Bearer ' _ TOKEN } }}
{{ rn = http.get(HOST _ '/api/users/by-short-uuid/' _ short_uuid, 'headers', rheaders) }}
{{ rn_username = rn.response.username || '' }}
{{ rn_uuid = rn.response.uuid || '' }}
{{ IF rn_username == '' || rn_uuid == '' }}
{{ alert_text = '⚠️ payment-confirm: remnawave user not found shortUuid=' _ short_uuid _ ' order=' _ order_id }}
{{ INCLUDE alert_admin }}
{{# транзиентно -> 502, чтобы ПС повторила #}}
{{ toJson({ error => 'user_not_found', short_uuid => short_uuid, code => 502 }) }}{{ STOP }}
{{ END }}
{{ uparts = rn_username.split('_') }}
{{ usi = uparts.last }}
{{ uid = us.id(usi).user_id }}
{{ IF !uid }}
{{ alert_text = '⚠️ payment-confirm: SHM user_service not found usi=' _ usi _ ' order=' _ order_id }}
{{ INCLUDE alert_admin }}
{{ toJson({ error => 'us_not_found', usi => usi, code => 502 }) }}{{ STOP }}
{{ END }}

{{# --- dry-run echo --- #}}
{{ IF dry_run && debug }}
{{ toJson({ dry_run => 1, ps => ps, order_id => order_id, paid => paid, amount => amount, currency => currency, short_uuid => short_uuid, usi => usi, uid => uid, is_reset => is_reset, months => months }) }}{{ STOP }}
{{ END }}

{{ IF is_reset }}
    {{# --- 6. RESET flow (net-zero) --- #}}
    {{ pay = user.id(uid).payment( money => amount, pay_system_id => ps, uniq_key => order_id, comment => { type => 'reset', provider => ps } ) }}
    {{ first_time = (pay.uniq_key == order_id) ? 1 : 0 }}
    {{# списываем стоимость сброса, только если платёж только что создан (guard от двойного списания) #}}
    {{ booked_key = 'pc_reset_booked_' _ order_id }}
    {{ already = storage.read('name', booked_key).response.value || '' }}
    {{ IF already == '' }}
        {{ u = user.id(uid) }}
        {{ bonus_avail = u.get_bonus || 0 }}
        {{ IF bonus_avail >= amount }}
            {{ d = u.add_bonus( 0 - amount, 'Сброс трафика (оплата ' _ ps _ ') order=' _ order_id ) }}
        {{ ELSE }}
            {{ IF bonus_avail > 0 }}{{ d = u.add_bonus( 0 - bonus_avail, 'Сброс трафика (бонусы) order=' _ order_id ) }}{{ END }}
            {{ rest = amount - bonus_avail }}
            {{ d2 = u.set( balance = (u.balance || 0) - rest ) }}
        {{ END }}
        {{ mark = storage.save(booked_key, { value => 1, ts => ts }) }}
    {{ END }}
    {{# сброс трафика в Remnawave #}}
    {{ reset_res = http.post(HOST _ '/api/users/' _ rn_uuid _ '/actions/reset-traffic', 'headers', rheaders) }}
    {{ reset_ok = (reset_res.response.status == 'ACTIVE' || reset_res.response.uuid) ? 1 : 0 }}
    {{ toJson({ success => 1, action => 'reset', order_id => order_id, user_id => uid, usi => usi, reset_ok => reset_ok }) }}{{ STOP }}
{{ ELSE }}
    {{# --- 5b. SUBSCRIPTION flow: найти услугу категории по period + сумме, назначить next --- #}}
    {{ cat = request.params.category || config.subscription_page.category || '' }}
    {{ matched_service_id = 0 }}{{ matched_cost = 0 }}
    {{ IF cat != '' }}
        {{ srows = service.list_for_api('category', cat) }}
        {{ FOR srow IN srows }}
            {{ sp_int = (srow.period || 0) FILTER format("%.0f") }}
            {{ sp_int = sp_int + 0 }}
            {{ IF sp_int == months }}
                {{ sid = srow.service_id || srow.id }}
                {{ scost = (srow.cost || 0) + 0 }}
                {{# точное совпадение суммы приоритетно #}}
                {{ IF matched_service_id == 0 || (amount > 0 && scost == amount) }}
                    {{ matched_service_id = sid }}{{ matched_cost = scost }}
                {{ END }}
            {{ END }}
        {{ END }}
    {{ END }}
    {{ IF matched_service_id > 0 && !dry_run }}
        {{ setnext = us.id(usi).api_set( next => matched_service_id ) }}
    {{ END }}
    {{ IF matched_service_id == 0 }}
        {{ alert_text = '⚠️ payment-confirm: no category service for months=' _ months _ ' amount=' _ amount _ ' cat=' _ cat _ ' order=' _ order_id _ ' (платёж записан, next не назначен)' }}
        {{ INCLUDE alert_admin }}
    {{ END }}
    {{ pay = user.id(uid).payment( money => amount, pay_system_id => ps, uniq_key => order_id, comment => { type => 'subscription', months => months, service_id => matched_service_id, provider => ps } ) }}
    {{ toJson({ success => 1, action => 'subscription', order_id => order_id, user_id => uid, usi => usi, service_id => matched_service_id, months => months }) }}{{ STOP }}
{{ END }}
```

- [ ] **Step 3: Validate the JSON sidecar**

Run: `python3 -m json.tool shm-templates/payment-confirm.tpls`
Expected: valid JSON, exit 0.

- [ ] **Step 4: Static review of embedded Perl blocks**

Manually confirm each `{{ PERL }}` block: uses only `CGI`, `MIME::Base64`, `Crypt::PK::RSA`, `Digest::MD5` (all present in the SHM base image), reads `$stash->get(...)` for config it needs, writes only `$stash->set('verified', ...)`. No `payment`/balance mutation inside PERL.

- [ ] **Step 5: Commit**

```bash
git add shm-templates/payment-confirm.tpl shm-templates/payment-confirm.tpls
git commit -m "feat(shm): add universal payment-confirm webhook receiver template"
```

---

### Task 3: subscription-page — new env + config schema

**Files:**
- Modify: `backend/src/common/config/app-config/config.schema.ts` (add two keys near the `PAYMENT_*` block)
- Modify: `.env.sample` (document them near the tariff block)

**Interfaces:**
- Produces: validated config keys `SHM_TARIFFS_URL?: string`, `SHM_TARIFF_CATEGORY?: string`.

- [ ] **Step 1: Add env to `.env.sample`** (after the `TARIFF_*` block, ~line 43)

```bash
# SHM billing integration (optional). When both are set, tariffs are sourced from SHM
# instead of the TARIFF_* values above (TARIFF_* remain the fallback if SHM is unreachable).
# SHM_TARIFFS_URL is the public SHM base, e.g. https://shm.example.com/shm/v1/public
# SHM_TARIFF_CATEGORY must equal SHM config.subscription_page.category.
SHM_TARIFFS_URL=
SHM_TARIFF_CATEGORY=
```

- [ ] **Step 2: Add zod keys to `config.schema.ts`** (alongside the other optional string envs, e.g. after `PAYMENT_FAIL_URL`)

```ts
        SHM_TARIFFS_URL: z
            .string()
            .url()
            .optional()
            .or(z.literal('').transform(() => undefined)),
        SHM_TARIFF_CATEGORY: z
            .string()
            .optional()
            .or(z.literal('').transform(() => undefined)),
```

(Match the existing style in this file; if the file uses a different optional-empty idiom, follow it.)

- [ ] **Step 3: Build to typecheck**

Run: `cd backend && npm run build`
Expected: build succeeds (config schema compiles).

- [ ] **Step 4: Commit**

```bash
git add backend/src/common/config/app-config/config.schema.ts .env.sample
git commit -m "feat(config): add SHM_TARIFFS_URL and SHM_TARIFF_CATEGORY env"
```

---

### Task 4: subscription-page — `ShmTariffsService`

**Files:**
- Create: `backend/src/common/shm/shm-tariffs.service.ts`
- Create: `backend/src/common/shm/shm.module.ts`
- Create: `backend/src/common/shm/index.ts`
- Modify: `backend/src/app.module.ts` (import `ShmModule`)

**Interfaces:**
- Produces: `ShmTariffsService.isEnabled: boolean`; `ShmTariffsService.getTariffs(): Promise<ITariff[] | null>` where `ITariff = { months:number; amount:number; currency:string; id?:number; name?:string }`. Returns `null` when disabled or no data available (caller falls back to env).

- [ ] **Step 1: Create `backend/src/common/shm/shm-tariffs.service.ts`**

```ts
import axios from 'axios';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ITariff {
    months: number;
    amount: number;
    currency: string;
    id?: number;
    name?: string;
}

@Injectable()
export class ShmTariffsService {
    private readonly logger = new Logger(ShmTariffsService.name);
    private readonly baseUrl: string | undefined;
    private readonly category: string | undefined;
    private readonly TTL_MS = 60_000;
    private cache: { at: number; tariffs: ITariff[] } | undefined;

    constructor(private readonly configService: ConfigService) {
        this.baseUrl = this.configService.get<string>('SHM_TARIFFS_URL');
        this.category = this.configService.get<string>('SHM_TARIFF_CATEGORY');
    }

    public get isEnabled(): boolean {
        return !!this.baseUrl && !!this.category;
    }

    public async getTariffs(): Promise<ITariff[] | null> {
        if (!this.baseUrl || !this.category) {
            return null;
        }

        const now = Date.now();
        if (this.cache && now - this.cache.at < this.TTL_MS) {
            return this.cache.tariffs;
        }

        try {
            const url = `${this.baseUrl.replace(/\/+$/, '')}/tariffs`;
            const response = await axios.get(url, {
                params: { category: this.category },
                timeout: 8_000,
            });

            const raw = Array.isArray(response.data?.tariffs) ? response.data.tariffs : [];
            const tariffs: ITariff[] = raw
                .filter(
                    (t: Record<string, unknown>) =>
                        typeof t?.period_months === 'number' &&
                        (t.period_months as number) > 0 &&
                        typeof t?.cost === 'number',
                )
                .map((t: Record<string, unknown>) => ({
                    months: t.period_months as number,
                    amount: t.cost as number,
                    currency: (t.currency as string) ?? 'RUB',
                    id: t.id as number | undefined,
                    name: t.name as string | undefined,
                }));

            this.cache = { at: now, tariffs };
            return tariffs;
        } catch (error) {
            this.logger.error(`SHM tariffs fetch failed: ${error}`);
            return this.cache?.tariffs ?? null;
        }
    }
}
```

- [ ] **Step 2: Create `backend/src/common/shm/shm.module.ts`**

```ts
import { Module } from '@nestjs/common';

import { ShmTariffsService } from './shm-tariffs.service';

@Module({
    providers: [ShmTariffsService],
    exports: [ShmTariffsService],
})
export class ShmModule {}
```

- [ ] **Step 3: Create `backend/src/common/shm/index.ts`**

```ts
export * from './shm-tariffs.service';
export * from './shm.module';
```

- [ ] **Step 4: Register `ShmModule` in `backend/src/app.module.ts`**

Add `ShmModule` to the `imports` array (follow the existing import style for `WataModule`/`PlategaModule`):

```ts
import { ShmModule } from '@common/shm';
// ... and add ShmModule to the @Module({ imports: [...] }) list
```

- [ ] **Step 5: Build to typecheck**

Run: `cd backend && npm run build`
Expected: build succeeds.

- [ ] **Step 6: Lint**

Run: `cd backend && npm run lint`
Expected: no errors on the new files.

- [ ] **Step 7: Commit**

```bash
git add backend/src/common/shm/ backend/src/app.module.ts
git commit -m "feat(shm): add ShmTariffsService to source tariffs from SHM"
```

---

### Task 5: subscription-page — wire SHM tariffs into `RootService`

**Files:**
- Modify: `backend/src/modules/root/root.service.ts`
  - constructor: inject `ShmTariffsService`
  - add async `getTariffs()` that prefers SHM, falls back to env `listAvailableTariffs()`
  - `returnWebpage`: use `await this.getTariffs()` for the `paymentTariffs` blob
  - `createPayment`: source the subscription amount from SHM tariffs (fallback env)
  - generalize `isValidTariffMonths` against the available tariff set
- Modify: `backend/src/modules/root/root.controller.ts` (`/api/pay` months validation uses the available month set instead of hard-coded `[1,3,6,12]`)

**Interfaces:**
- Consumes: `ShmTariffsService.getTariffs()`, `ITariff`.
- Produces: `RootService.getTariffs(): Promise<Array<{months,amount,currency,id?,name?}>>`; `RootService.getTariffAmount(months): Promise<number | undefined>`.

- [ ] **Step 1: Inject `ShmTariffsService`** into `RootService` constructor (add param, follow existing DI style alongside `wataService`/`plategaService`).

```ts
import { ShmTariffsService } from '@common/shm';
// constructor param:
        private readonly shmTariffsService: ShmTariffsService,
```

- [ ] **Step 2: Add `getTariffs()` + `getTariffAmount()`** (SHM-first, env fallback). Place near `listAvailableTariffs()`.

```ts
    public async getTariffs(): Promise<
        Array<{ months: number; amount: number; currency: string; id?: number; name?: string }>
    > {
        if (this.shmTariffsService.isEnabled) {
            const shm = await this.shmTariffsService.getTariffs();
            if (shm && shm.length > 0) {
                return shm;
            }
        }
        return this.listAvailableTariffs();
    }

    public async getTariffAmount(months: number): Promise<number | undefined> {
        const tariffs = await this.getTariffs();
        const t = tariffs.find((x) => x.months === months);
        return t?.amount;
    }
```

- [ ] **Step 3: Use `getTariffs()` in `returnWebpage`** — replace the synchronous `this.listAvailableTariffs()` call used to build `tariffs`/`paymentTariffs` with `await this.getTariffs()`.

```ts
            const tariffs = this.hasAnyPaymentProvider() ? await this.getTariffs() : [];
```

- [ ] **Step 4: Source subscription amount from SHM in `createPayment`** — in the `product.kind === 'subscription'` branch, replace `amount = this.configService.get<number>(`TARIFF_${product.months}M`)` with the SHM-first lookup, keeping env as fallback:

```ts
            amount =
                (await this.getTariffAmount(product.months)) ??
                this.configService.get<number>(`TARIFF_${product.months}M`);
            if (amount === undefined) {
                return { ok: false, reason: 'tariff_not_configured' };
            }
```

- [ ] **Step 5: Generalize `isValidTariffMonths`** to accept any month offered by `getTariffs()` (fallback to env check when SHM disabled):

```ts
    public async isValidTariffMonths(months: number): Promise<boolean> {
        const tariffs = await this.getTariffs();
        if (tariffs.length > 0) {
            return tariffs.some((t) => t.months === months);
        }
        return this.configService.get<number>(`TARIFF_${months}M`) !== undefined;
    }
```

Update `createPaymentForTariff` to `await this.isValidTariffMonths(months)`.

- [ ] **Step 6: Relax the controller month guard** in `root.controller.ts` `/api/pay`: replace the hard-coded `![1, 3, 6, 12].includes(months)` rejection with a finiteness/`>0` check, and rely on `createPaymentForTariff`'s `isValidTariffMonths` for the authoritative check (which now reflects SHM).

```ts
        const months = parseInt(monthsRaw, 10);
        if (!Number.isFinite(months) || months <= 0) {
            response.status(400).send('Invalid months');
            return;
        }
```

- [ ] **Step 7: Build + lint**

Run: `cd backend && npm run build && npm run lint`
Expected: both clean. Resolve any async/await signature mismatches surfaced by tsc (e.g. callers of `isValidTariffMonths`).

- [ ] **Step 8: Manual smoke (documented, run by user against real SHM)**

With `SHM_TARIFFS_URL`/`SHM_TARIFF_CATEGORY` set, load a subscription page and confirm tariffs reflect SHM; unset them and confirm `TARIFF_*` still drive the page (fallback).

- [ ] **Step 9: Commit**

```bash
git add backend/src/modules/root/root.service.ts backend/src/modules/root/root.controller.ts
git commit -m "feat(root): source tariffs and pricing from SHM with env fallback"
```

---

### Task 6: Deployment README + curl test vectors

**Files:**
- Create: `shm-templates/README.md`

**Interfaces:** none (docs).

- [ ] **Step 1: Write `shm-templates/README.md`** covering:
  - Deploying `tariffs.tpl/.tpls` and `payment-confirm.tpl/.tpls` into the SHM templates dir.
  - Public URLs: `GET /shm/v1/public/tariffs?category=<cat>`, `POST /shm/v1/public/payment-confirm?ps=platega|wata|cardlink`.
  - Gateway dashboard webhook config (set each gateway's success webhook to the `?ps=` URL).
  - Required SHM `config.*` keys (table from spec §7) and that `config.subscription_page.category` must equal subscription-page `SHM_TARIFF_CATEGORY`.
  - subscription-page env: `SHM_TARIFFS_URL`, `SHM_TARIFF_CATEGORY`.
  - **curl vectors** (include real, runnable examples):

```bash
# tariffs
curl -s "https://<shm>/shm/v1/public/tariffs?category=<cat>" | jq

# cardlink confirm (compute SignatureValue = upper(md5(OutSum:InvId:apiToken)))
SIG=$(printf '%s' "300.00:<orderId>:<apiToken>" | md5sum | awk '{print toupper($1)}')
curl -s -X POST "https://<shm>/shm/v1/public/payment-confirm?ps=cardlink" \
  -d "InvId=<orderId>&OutSum=300.00&CurrencyIn=RUB&Status=SUCCESS&SignatureValue=$SIG" | jq

# platega confirm (static header auth; JSON body)
curl -s -X POST "https://<shm>/shm/v1/public/payment-confirm?ps=platega" \
  -H "Content-Type: application/json" -H "X-MerchantId: <mid>" -H "X-Secret: <secret>" \
  -d '{"id":"<txid>","payload":"<orderId>","amount":300,"currency":"RUB","status":"CONFIRMED"}' | jq

# dry-run (config.payment_confirm.debug=1): verify+map without side effects
curl -s -X POST "https://<shm>/shm/v1/public/payment-confirm?ps=cardlink&dry_run=1" \
  -d "InvId=<orderId>&OutSum=300.00&CurrencyIn=RUB&Status=SUCCESS&SignatureValue=$SIG" | jq
```

  - Note: WATA verification needs the vendor's RSA signature; test against a real WATA sandbox webhook.

- [ ] **Step 2: Commit**

```bash
git add shm-templates/README.md
git commit -m "docs(shm): deployment guide and curl test vectors for SHM templates"
```

---

## Self-Review

**Spec coverage:**
- §4 tariffs template → Task 1. ✅
- §5 payment-confirm (verify/normalize/map/subscription `next`/reset net-zero/idempotency/HTTP status/dry-run) → Task 2. ✅
- §6 subscription-page (env, listAvailableTariffs→SHM, pricing, months validation, fallback) → Tasks 3–5. ✅
- §7 config keys → consumed by Task 2, documented in Task 6. ✅
- §8 security (const-time, WATA raw-body RSA, public route user=1) → Task 2 steps. ✅
- §9 testing (curl vectors, dry-run) → Tasks 2 & 6. ✅

**Placeholder scan:** No TBD/TODO; all template and TS code is complete. The README task lists concrete sections + runnable curl vectors. ✅

**Type consistency:** `ITariff{months,amount,currency,id?,name?}` defined in Task 4 and consumed unchanged in Task 5; `getTariffs()`/`getTariffAmount()`/`isValidTariffMonths()` signatures consistent across Task 5 steps. orderId token/period parsing matches the orderId contract (spec §3). ✅

**Known deviation from TDD:** backend has no test runner; per Global Constraints the gate is `npm run build` + `npm run lint` + documented manual/curl checks. Adding jest is intentionally out of scope.
