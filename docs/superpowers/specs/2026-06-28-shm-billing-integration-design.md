# SHM ↔ subscription-page billing integration — design

- **Date:** 2026-06-28
- **Status:** Approved (design); pending implementation plan
- **Scope:** Two new public SHM templates (`tariffs`, `payment-confirm`) + targeted changes in the `subscription-page` repo so tariffs are sourced from SHM and confirmed payments are booked into SHM as the billing system.

---

## 1. Context & goal

Today `subscription-page` (a fork of `remnawave/subscription-page`) lets a user start a payment through one of three gateways — **Platega**, **WATA**, **CardLink** — and fires an HMAC‑signed notification webhook to `PAYMENT_WEBHOOK_URL` **at order‑creation time** (not at payment confirmation). Tariffs are static env values (`TARIFF_1M/3M/6M/12M`, `TRAFFIC_RESET_PRICE`).

Goal: make **SHM** (https://github.com/danuk/shm — "Service Host Manager", Perl + Template‑Toolkit templates) the billing system of record:

1. SHM exposes the catalogue of purchasable services (tariffs) for a configurable **category**, as public JSON, so `subscription-page` renders/groups tariffs from SHM instead of static env.
2. When a gateway **confirms** a payment, SHM registers it for the correct user, assigns the paid tariff as the user‑service's **`next`** service (so the subscription prolongs onto the chosen tariff), and for traffic‑reset payments resets the user's traffic in Remnawave.

### Decisions locked during brainstorming

| # | Decision | Choice |
|---|----------|--------|
| D1 | Source of payment **confirmation** | **Gateway webhook** — Platega/WATA/CardLink are configured (in their dashboards) to POST their success webhook to a public SHM template. SHM books the payment only on real confirmation. |
| D2 | Lifecycle | **Stateless / single‑webhook** — SHM receives only the gateway confirmation; user + amount are taken from it (no pending pre‑registration from `subscription-page`). |
| D3 | "Universal" template structure | **One template, provider via `?ps=`** query param on the webhook URL. |
| D4 | TRAFFIC_RESET on confirmation | **Record payment + reset traffic** via Remnawave API. |
| D5 | Iteration scope | **SHM templates *and* `subscription-page` changes** (fetch + group tariffs from SHM). This supersedes the earlier "don't modify subscription-page" constraint for this work. |
| D6 | How `payment-confirm` picks the tariff to assign as `next` | **Match by period (months from orderId token) + validate amount** against the category service's cost. |
| D7 | Tariffs list shape | **Flat list** `{id, name, cost, period_months, currency, category}`; consumer groups. |
| D8 | Reset money accounting | **Net‑zero** — record the payment (income + receipt) then deduct the reset cost from balance, so no "free" balance is created. |

---

## 2. Verified SHM mechanics (ground truth)

All file references are in `danuk/shm` unless noted.

- **Public template route:** `…/shm/v1/public/<name>` → `parse_for_public` (`app/public_html/shm/v1.cgi` `/public/*`; `app/lib/Core/Template.pm` `parse_for_public`), which requires `allow_public: true` in the template's `.tpls` sidecar. Authenticated sibling route `…/shm/v1/template/<name>` binds `user` to a session; the public route runs with **`user` = id 1 (no session)** — fine here because the user is resolved from the signed/verified `orderId`.
- **Template input:** `request.params.<field>` (parsed JSON/query body, incl. nested objects), `request.headers.x_<name>` (lowercase, `-`→`_`), and raw body via a `{{ PERL }}` block: `CGI->new->Vars` → `$in{POSTDATA}`, raw headers via `$ENV{HTTP_X_*}`. Requires `"raw": true` in `.tpls` to preserve the body for signature checks.
- **Template output:** print `toJson(obj)` then `{{ STOP }}`; `.tpls` `"content-type":"application/json"` + `"json":1` frame the response.
- **Register a payment:** `user.id(N).payment(money => X, pay_system_id => '...', uniq_key => '<orderId>', comment => { ... })` (`app/lib/Core/User.pm` `sub payment`). It is **idempotent by `uniq_key`** (returns the existing pay, no duplicate, no second event), credits balance (`set_balance`), and fires the **`PAYMENT`** event → `activate_services`. Pay row lives in `pays_history` with a `uniq_key` column (`app/lib/Core/Pay.pm`).
- **List services by category:** `service.list_for_api('category', <cat>)` (`app/lib/Core/Service.pm` `list_for_api`, category filter). Service `structure` has `id, name, cost, period, category, next`. `period` is **`M.DDHH`** (integer part = months; for 1/3/6/12 it is just the integer).
- **Assign next service:** user‑service field `next` (`app/lib/Core/USObject.pm`); `api_set` whitelists `next`; `change(service_id => N)` does `set(next => service->id)` and schedules the switch. We use the minimal `us.id(usi).api_set(next => service_id)` and let the `PAYMENT` → `activate_services` flow apply it.
- **Reset traffic (Remnawave):** `POST {HOST}/api/users/{uuid}/actions/reset-traffic` with `Authorization: Bearer {TOKEN}` where `HOST/TOKEN = server.id(config.remnawave.server_id || 1).settings.api.host/.token` (existing `traffic_reset.tpl`, `charge-and-reset-traffic.tpl`). Success: `response.status == 'ACTIVE' || response.uuid`.
- **Resolve user from shortUuid:** `GET {HOST}/api/users/by-short-uuid/{shortUuid}` (Bearer) → Remnawave user with `username` (`VsemVPN_<usi>`), `uuid`, `telegramId` (pattern from `shm-all.tpl`). `usi = username.split('_').last`; SHM user id = `us.id(usi).user_id`.

### Gateway webhook formats (confirmed via vendor docs)

| Gateway | Method / type | orderId echoed as | Signature verification | "Paid" value |
|---|---|---|---|---|
| **Platega** | POST JSON | `payload` (fallback: `GET https://app.platega.io/transaction/{id}` returns `payload`) | Static headers `X-MerchantId` + `X-Secret` compared (constant‑time) to stored creds — **no HMAC** | `status == "CONFIRMED"` |
| **WATA** | POST JSON | `orderId` | `X-Signature` = base64 **RSA‑SHA512** over the **raw body**; public key (PKCS#1) from `GET https://api.wata.pro/api/h2h/public-key` (cache it) | `transactionStatus == "Paid"` |
| **CardLink** | POST `x-www-form-urlencoded` | `InvId` | `SignatureValue == strtoupper(md5(OutSum ":" InvId ":" apiToken))` | `Status == "SUCCESS"` |

Notes: Platega's `payload` echo is documented inconsistently (one page omits it) — prefer `payload`, else resolve via `GET /transaction/{id}`. WATA must be verified over the exact received bytes before any re‑serialization. CardLink's MD5 secret is the live API token; reject `UNDERPAID/OVERPAID/FAIL`.

---

## 3. orderId contract (unchanged)

`subscription-page` produces, per `backend/src/modules/root/root.service.ts`:

```
orderId = `${orderPrefix}${shortUuid}_${orderToken}_${ts}`
orderPrefix = telegramId !== null ? `${telegramId}_` : ''
orderToken  = '1m' | '3m' | '6m' | '12m'   (subscription)  |  'reset'  (traffic reset)
ts          = Date.now()
```

**Right‑anchored parse** in `payment-confirm` (robust to `_` inside shortUuid):
- `ts` = last `_`‑segment (digits)
- `token` = second‑to‑last, must match `^(1m|3m|6m|12m|reset)$`
- remainder = everything before `token`; if its first segment is all digits **and** more follows, that segment is `telegramId` and the rest is `shortUuid`; otherwise the whole remainder is `shortUuid`.
- `months` = numeric part of `token` for subscriptions.

---

## 4. Component A — SHM template `tariffs` (public catalogue)

- Files: `tariffs.tpl`, `tariffs.tpls` = `{"allow_public": true, "content-type": "application/json", "json": 1}`.
- Endpoint: `GET {SHM}/shm/v1/public/tariffs?category=<cat>` (category supplied by `subscription-page` from its env).
- Logic:
  1. `cat = request.params.category` → if empty, return `{tariffs:[], count:0, error:'missing category'}` with code 400.
  2. `rows = service.list_for_api('category', cat)`.
  3. For each row compute `period_months` (int part of `period`) and `period_days` (from the `M.DDHH` fraction, per the documented parse).
  4. Emit flat JSON.
- Response:
```json
{
  "category": "<cat>",
  "count": 2,
  "currency": "RUB",
  "tariffs": [
    { "id": 12, "name": "VPN 3 мес", "cost": 300, "period_months": 3, "period_days": 0, "period": "3", "currency": "RUB", "category": "<cat>" }
  ]
}
```
- `currency`: SHM has a single system currency; emit `config`‑level currency or a fixed default (`RUB`) and document that it must match `subscription-page`'s `TARIFF_CURRENCY`.
- Edge cases: unknown/empty category → empty list; no services → empty list (not an error).

---

## 5. Component B — SHM template `payment-confirm` (gateway webhook receiver)

- Files: `payment-confirm.tpl`, `payment-confirm.tpls` = `{"allow_public": true, "raw": true, "content-type": "application/json", "json": 1}`.
- Endpoint (one per gateway, set in each gateway dashboard):
  `POST {SHM}/shm/v1/public/payment-confirm?ps=platega|wata|cardlink`

### Pipeline

1. `ps = request.params.ps`; unknown → 400.
2. Read raw body (`{{ PERL }}` `POSTDATA`) and relevant headers/`$ENV{HTTP_*}`.
3. **Verify signature** per `ps` (constant‑time where applicable):
   - platega: `HTTP_X_MERCHANTID == config.platega.merchant_id && HTTP_X_SECRET == config.platega.secret`.
   - wata: RSA‑SHA512 verify `X-Signature` over raw body using cached public key (`storage` key `wata_pubkey`, refreshed from `/api/h2h/public-key`).
   - cardlink: recompute `strtoupper(md5(OutSum:InvId:config.cardlink.api_token))` == `SignatureValue`.
   - fail → 401 + `{error:'invalid_signature'}` (+ optional admin alert).
4. **Normalize** → `{ orderId, amount, currency, paid }`:
   - platega: `payload` (fallback `GET /transaction/{id}`), `amount`, `currency`, `paid = status=='CONFIRMED'`.
   - wata: `orderId`, `amount`, `currency`, `paid = transactionStatus=='Paid'`.
   - cardlink: `InvId`, `OutSum`, `CurrencyIn`, `paid = Status=='SUCCESS'`.
5. `paid == false` → 200 `{ignored:1, reason:status}` (do not credit).
6. **Parse orderId** (section 3) → `token`, `months`, `shortUuid`.
7. **Map user:** `GET {HOST}/api/users/by-short-uuid/{shortUuid}` → `username` (`VsemVPN_<usi>`), `uuid`; `usi = username.split('_').last`; `uid = us.id(usi).user_id`. Lookup failure (user not yet in SHM / Remnawave unreachable) → **502/503** so the gateway retries.

### Subscription flow (`token = <months>m`)

8. `cat = config.subscription_page.category` (optional `&category=` URL override).
9. In `service.list_for_api('category', cat)` find the service with `period_months == months`; validate `cost ≈ amount` (tolerance for rounding). On multiple period matches, disambiguate by `cost`.
10. `us.id(usi).api_set(next => service_id)` (best‑effort).
11. `user.id(uid).payment(money => amount, pay_system_id => ps, uniq_key => orderId, comment => { type:'subscription', months, service_id, provider:ps, gateway_amount:amount })`.
    - `PAYMENT` → `activate_services` prolongs onto the assigned `next` tariff.
12. If no service matched: still credit the payment (money is real) + admin alert (`next` left unset).
13. 200 `{ success:1, action:'subscription', orderId, user_id:uid, usi, service_id }`.

### Traffic‑reset flow (`token = reset`) — net‑zero (D8)

8. `user.id(uid).payment(money => amount, pay_system_id => ps, uniq_key => orderId, comment => { type:'reset', provider:ps })` (income on record + receipt event; idempotent).
9. **Consume it:** deduct `amount` from balance (bonus first, then balance — mirroring `traffic_reset.tpl`) so net balance change ≈ 0. Guard against double‑deduction on retries (the `user.payment` idempotency means step 8 is once‑only; gate the deduction on the same once‑only result, e.g. only deduct when `payment()` returned a freshly created pay, or use a `storage` marker `reset_booked_<orderId>`).
10. `POST {HOST}/api/users/{uuid}/actions/reset-traffic` (Bearer). Naturally idempotent.
11. 200 `{ success:1, action:'reset', orderId, user_id:uid, usi }`.

### Cross‑cutting (Component B)

- **Idempotency:** `uniq_key = orderId` is the master guard; gateway retries are safe. The reset deduction + reset call must also be guarded once‑only (storage marker).
- **HTTP status policy:** success / duplicate / not‑paid → **200** (stop retries); bad `ps`/signature → **400/401**; transient (user mapping / Remnawave / payment failure) → **502/503** (let gateway retry).
- **Admin alerts:** reuse the `send_error_to_admin` BLOCK pattern from `remnawave-webhook.tpl` (`config.payment_confirm.admin_chat_id` + `config.telegram.bot_token`).
- **Debug / dry‑run:** `config.payment_confirm.debug=1` + `?dry_run=1` runs verify + map + match and echoes the would‑be action **without** `user.payment`/deduction/reset.

---

## 6. Component C — `subscription-page` changes

- **New env:**
  - `SHM_TARIFFS_URL` — public SHM base, e.g. `https://shm.example.com/shm/v1/public`.
  - `SHM_TARIFF_CATEGORY` — the category to fetch (must equal SHM `config.subscription_page.category`).
- **`backend/src/modules/root/root.service.ts` `listAvailableTariffs()`** — instead of reading `TARIFF_*`, fetch `GET {SHM_TARIFFS_URL}/tariffs?category=<cat>`, map SHM services → `{ months: period_months, amount: cost, currency, id, name }`, with a short‑TTL in‑memory cache and a safe fallback (empty list or last‑good) when SHM is unreachable.
- **Display/grouping** — group tariffs by `period_months` from SHM data (the page already base64‑encodes a `paymentTariffs` blob; keep that channel, fill it from SHM).
- **orderId unchanged** — keep `${tgid_}${shortUuid}_${months}m_${ts}`; `payment-confirm` matches by period + amount, so no format change is required.
- **`months` validation in `/api/pay`** — generalize from the hard‑coded `[1,3,6,12]` to "any `period_months` returned by the SHM tariffs feed".
- **`PAYMENT_WEBHOOK_URL`** — no longer needed for crediting in the stateless design; keep for logging or disable. (Not removed from code.)
- **Out of scope:** changing how `subscription-page` creates gateway orders (Platega/WATA/CardLink order creation stays as‑is).

---

## 7. SHM configuration keys

| Key | Purpose |
|---|---|
| `config.platega.merchant_id`, `config.platega.secret` | Platega webhook auth (header compare) |
| `config.cardlink.api_token` | CardLink MD5 signature secret |
| `config.wata.public_key` (optional) | Pin WATA public key; else fetched + cached |
| `config.remnawave.server_id` (default 1) | Selects `server.id(N).settings.api.{host,token}` |
| `config.subscription_page.category` | Category for tariff matching in `payment-confirm` (mirror of `SHM_TARIFF_CATEGORY`) |
| `config.payment_confirm.debug` | Enable dry‑run/debug |
| `config.payment_confirm.admin_chat_id` (+ `config.telegram.bot_token`) | Error alerts to Telegram |

---

## 8. Security

- Constant‑time comparisons for Platega/CardLink secrets.
- WATA: verify RSA over **raw** bytes before parsing (`raw:true`).
- Optional IP allowlist (WATA documents `62.84.126.140`, `51.250.106.150`; Platega has no fixed IPs → rely on the secret + TLS).
- Public route → `user = id 1`; the acting user is derived solely from the verified `orderId`/Remnawave lookup.
- `tariffs` exposes only catalogue data (no user data); safe as public.

---

## 9. Testing

- **`curl` vectors** per gateway: success, bad signature, not‑paid, duplicate (idempotency), reset, and "user not found → retry (502)". Include a valid CardLink MD5 and a WATA RSA sample (or a fixture public/private key for the test).
- **`tariffs`**: known category → expected flat list; empty/unknown category → empty.
- **dry‑run** path exercised end‑to‑end without side effects.
- Manual: confirm `next` is set and that a subsequent `activate_services` prolongs onto the chosen tariff; confirm reset nets balance to ~0 and resets Remnawave traffic.

---

## 10. Known properties / limitations (consequences of stateless, D2)

- Amount is taken from the gateway payload; with tariffs sourced from SHM the paid amount equals the service `cost`, so the period+amount match is exact. No pre‑registered "pending" to cross‑check against.
- `next`‑assignment is best‑effort: if the paid amount/period matches no category service, the payment is still booked and an admin alert is raised.
- orderId parsing assumes the `subscription-page` format; the right‑anchored parse tolerates `_` inside `shortUuid`.

---

## 11. Deliverables

1. `tariffs.tpl` + `tariffs.tpls` (SHM templates repo / live templates volume).
2. `payment-confirm.tpl` + `payment-confirm.tpls` (SHM).
3. `subscription-page` changes (env + `listAvailableTariffs` + grouping + `months` validation).
4. Short README: webhook URLs per gateway, required SHM `config.*` keys, gateway‑dashboard setup steps, `curl` test vectors.

> SHM templates are deployed to the SHM instance (separate repo/volume); this repo holds the `subscription-page` side and this spec.
