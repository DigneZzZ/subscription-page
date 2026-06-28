# SHM templates for subscription-page billing integration

Two public SHM (Service Host Manager — https://github.com/danuk/shm) Template-Toolkit
templates that make SHM the billing system of record for the `subscription-page` web app:

| Template | Route | Purpose |
|----------|-------|---------|
| `tariffs.tpl` | `GET /shm/v1/public/tariffs?category=<cat>` | Public JSON catalogue of SHM services for a category. `subscription-page` renders/groups tariffs from this. |
| `payment-confirm.tpl` | `POST /shm/v1/public/payment-confirm?ps=platega\|wata\|cardlink` | Universal gateway **payment-confirmation** webhook receiver. Verifies the gateway signature, maps the user from the order id, books an idempotent `user.payment`, assigns the paid tariff as the user-service `next`, and (for reset orders) resets Remnawave traffic. |

See the full design and rationale in
`docs/superpowers/specs/2026-06-28-shm-billing-integration-design.md` (subscription-page repo).

## Deployment

Each template is a pair: the `.tpl` body and the `.tpls` JSON settings sidecar.

1. Copy all four files into the SHM templates directory (the same dir as
   `remnawave-webhook.tpl` etc. — e.g. `data/templates/` or the SHM templates volume):
   - `tariffs.tpl`, `tariffs.tpls`
   - `payment-confirm.tpl`, `payment-confirm.tpls`
2. The `.tpls` flags make them work:
   - `tariffs.tpls`: `allow_public:true`, `content-type:application/json`, `json:1`.
   - `payment-confirm.tpls`: `allow_public:true`, **`raw:true`** (required — preserves the raw
     body for signature verification), `content-type:application/json`, `json:1`.
3. The public route prefix is `/shm/v1/public/<template-name-without-.tpl>`.

> The public route runs with no session (`user` = id 1). That is intentional: the acting user is
> resolved solely from the verified gateway `orderId` → Remnawave lookup.

## Required SHM config (`config.*`)

| Key | Used by | Purpose |
|-----|---------|---------|
| `config.platega.merchant_id`, `config.platega.secret` | payment-confirm | Platega webhook auth (header compare) + `/transaction/{id}` fallback |
| `config.cardlink.api_token` | payment-confirm | CardLink MD5 signature secret |
| `config.wata.public_key` (optional) | payment-confirm | Pin WATA public key; otherwise fetched from `https://api.wata.pro/api/h2h/public-key` and cached in storage key `wata_pubkey` |
| `config.remnawave.server_id` (default `1`) | payment-confirm | Selects `server.id(N).settings.api.{host,token}` for Remnawave calls |
| `config.subscription_page.category` | payment-confirm | Category whose services are matched to assign `next`. **Must equal** subscription-page `SHM_TARIFF_CATEGORY` |
| `config.subscription_page.currency` (optional) | tariffs | Currency emitted in the catalogue (default `RUB`) |
| `config.payment_confirm.debug` (`0/1`) | payment-confirm | Enables `?dry_run=1` (verify + map, no side effects) |
| `config.payment_confirm.admin_chat_id` (+ `config.telegram.bot_token`) | payment-confirm | Telegram alerts on errors / unmatched tariffs |

## subscription-page side

Set these env vars (see `.env.sample`). When both are set, tariffs come from SHM
(`TARIFF_*` remain the fallback if SHM is unreachable):

```
SHM_TARIFFS_URL=https://<shm-host>/shm/v1/public
SHM_TARIFF_CATEGORY=<cat>   # must equal SHM config.subscription_page.category
```

## Gateway dashboard setup

Point each gateway's **success/payment webhook** at the matching `?ps=` URL:

- Platega → `https://<shm-host>/shm/v1/public/payment-confirm?ps=platega`
- WATA → `https://<shm-host>/shm/v1/public/payment-confirm?ps=wata`
- CardLink → `https://<shm-host>/shm/v1/public/payment-confirm?ps=cardlink`

Per-gateway verification & "paid" condition:

| Gateway | Body | Order id field | Signature | Paid when |
|---------|------|----------------|-----------|-----------|
| Platega | JSON | `payload` (fallback `GET /transaction/{id}`) | headers `X-MerchantId` + `X-Secret` compared to config | `status == CONFIRMED` |
| WATA | JSON | `orderId` | `X-Signature` = base64 RSA-SHA512 over raw body, public key from `/api/h2h/public-key` | `transactionStatus == Paid` |
| CardLink | form | `InvId` | `SignatureValue == upper(md5(OutSum:InvId:apiToken))` | `Status == SUCCESS` |

## Test vectors (run against a staging SHM)

```bash
SHM=https://<shm-host>
CAT=<category>
ORDER=<orderId-from-subscription-page>   # e.g. 123456789_abcdEF_3m_1782600000000

# 1) tariffs catalogue
curl -s "$SHM/shm/v1/public/tariffs?category=$CAT" | jq

# 2) CardLink confirm — SignatureValue = upper(md5(OutSum:InvId:apiToken))
TOKEN=<cardlink_api_token>
SIG=$(printf '%s' "300.00:$ORDER:$TOKEN" | md5sum | awk '{print toupper($1)}')
curl -s -X POST "$SHM/shm/v1/public/payment-confirm?ps=cardlink" \
  -d "InvId=$ORDER&OutSum=300.00&CurrencyIn=RUB&Status=SUCCESS&SignatureValue=$SIG" | jq

# 3) Platega confirm — static header auth, JSON body
curl -s -X POST "$SHM/shm/v1/public/payment-confirm?ps=platega" \
  -H "Content-Type: application/json" \
  -H "X-MerchantId: <merchant_id>" -H "X-Secret: <secret>" \
  -d "{\"id\":\"<txid>\",\"payload\":\"$ORDER\",\"amount\":300,\"currency\":\"RUB\",\"status\":\"CONFIRMED\"}" | jq

# 4) dry-run (requires config.payment_confirm.debug=1): verify + map, NO side effects
curl -s -X POST "$SHM/shm/v1/public/payment-confirm?ps=cardlink&dry_run=1" \
  -d "InvId=$ORDER&OutSum=300.00&CurrencyIn=RUB&Status=SUCCESS&SignatureValue=$SIG" | jq

# 5) not-paid is ignored (200, no credit)
curl -s -X POST "$SHM/shm/v1/public/payment-confirm?ps=cardlink" \
  -d "InvId=$ORDER&OutSum=300.00&CurrencyIn=RUB&Status=FAIL&SignatureValue=whatever" | jq
```

Expected responses:
- success → `{ "success":1, "action":"subscription"|"reset", ... }`
- duplicate (same `orderId`) → still `200`, no second credit (idempotent by `uniq_key`)
- bad signature → `{ "error":"invalid_signature", "code":401 }`
- not paid → `{ "ignored":1, "reason":"<status>" }`
- user not yet resolvable → `{ "error":"user_not_found", "code":502 }` (gateway should retry)

> WATA cannot be exercised with a hand-made signature (RSA). Test it against a WATA sandbox webhook
> or by signing a sample body with the vendor's private key.

## Behaviour notes

- **Idempotency:** `user.payment(uniq_key=orderId)` — gateway retries are safe; the reset deduction is
  additionally guarded by storage key `pc_reset_booked_<orderId>`.
- **Subscription `next`:** the category service whose `period_months` equals the order's months
  (validated against amount) is set as the user-service `next`; the `PAYMENT` → `activate_services`
  flow then prolongs onto it. If no service matches, the payment is still booked and an admin alert
  is raised (`next` left unset).
- **Reset (net-zero):** the payment is booked (income + receipt), the reset cost is deducted from
  bonus-then-balance, and Remnawave traffic is reset — so no "free" balance is created.
