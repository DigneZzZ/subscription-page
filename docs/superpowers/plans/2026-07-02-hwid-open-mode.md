# HWID Open Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `open` HWID-management mode (view/delete devices with no Telegram code, authorized by the page session-JWT), selected via `HWID_MANAGEMENT_MODE`, and rework the Telegram messages (English-only, HTML, code in `<pre>`) plus hide the widget entirely when Telegram isn't linked.

**Architecture:** A pure `resolveHwidMode(modeEnv, hasToken)` decides `telegram | open | disabled`. The backend service branches list/delete authorization on that mode: `telegram` keeps the existing `hwid_mgmt` session; `open` authorizes by the session-JWT `sub` alone (with a per-IP+sub delete rate-limit). The frontend fetches the mode from `/status` and either runs the code flow (`telegram`) or opens straight to the device list (`open`), and hides the card when `telegram` mode has no linked Telegram.

**Tech Stack:** NestJS + zod (backend), Node `crypto` unchanged; React 19 + Mantine v8 + zustand + ofetch (frontend). Backend tests via existing jest.

## Global Constraints

- **The verification code invariant is unchanged** (P0-1): the code appears only in the Telegram message body; `catch` blocks log only `error.message`/`error.response?.status`. This plan switches messages to `parse_mode: 'HTML'` — therefore any dynamic value interpolated into a message that is NOT already `sanitizeUsername`-d MUST be HTML-escaped (`platform`/`deviceModel`). `code` (digits) and `ip` (server-derived) need no escaping.
- **IDOR binding unchanged:** device identity always comes from the JWT `sub` claim, never a query/body param. Open mode authorizes by `sub` alone; telegram mode additionally requires the `hwid_mgmt` session (`session.shortUuid === sub && session.sessionId === jwt.sessionId`).
- **Device data** (hwid/platform/etc.) is returned only from list/delete endpoints behind authorization — never embedded in the page HTML (`panelData` still carries only `{ enabled }`).
- **All in-memory maps bounded** by `HWID.MAP_MAX_KEYS` (10_000); the new open-action rate map follows the same cap-and-reject pattern.
- **`Cache-Control: no-store, private`** stays on all `/api/devices/*` responses.
- **Mode values:** `telegram | open | disabled` (accept `off` as alias for `disabled`, case-insensitive). Default when unset: `telegram` if `TELEGRAM_BOT_TOKEN` is set, else `disabled`.
- **Backend formatting:** `npm run lint:fix` + `npm run format` in `backend/` before each backend commit. **Frontend:** run prettier + eslint **only on the touched files** (never repo-wide `prettier:write`, which reformats unrelated files); after, revert any stray file with `git checkout --`. The repo has ~12 PRE-EXISTING frontend eslint errors in untouched files — out of scope; only touched files must be error-free.

---

## File Structure

**Backend — new:**
- `backend/src/modules/hwid-devices/hwid-mode.ts` — pure `resolveHwidMode` + `HwidMode` type.
- `backend/src/modules/hwid-devices/hwid-mode.spec.ts` — jest test.

**Backend — modified:**
- `backend/src/common/config/app-config/config.schema.ts` — add `HWID_MANAGEMENT_MODE` + validation.
- `backend/src/modules/hwid-devices/hwid-devices.constants.ts` — open-action rate constants.
- `backend/src/modules/hwid-devices/telegram-notifier.service.ts` — English/HTML/`<pre>` messages + `escapeHtml`.
- `backend/src/modules/hwid-devices/hwid-devices.service.ts` — `mode` getter, `isEnabled`, `getStatus.mode`, `authorize()`, open-mode list/delete + rate-limit.
- `backend/src/modules/hwid-devices/hwid-devices.controller.ts` — 404 for `challenge`/`verify` when mode ≠ telegram.
- `backend/src/modules/root/root.service.ts` — `hwidData.enabled` from `resolveHwidMode`.
- `.env.sample` — document `HWID_MANAGEMENT_MODE`.

**Frontend — modified:**
- `frontend/src/widgets/main/devices/devices-api.ts` — `fetchStatus` returns `mode`; export `DeviceMode`.
- `frontend/src/widgets/main/devices/devices-button.widget.tsx` — visibility rule; pass mode to modal.
- `frontend/src/widgets/main/devices/devices-modal.tsx` — accept `mode`; open→list directly, no countdown.

---

### Task 1: `resolveHwidMode` (tested), config schema, constants, env docs

**Files:**
- Create: `backend/src/modules/hwid-devices/hwid-mode.ts`
- Test: `backend/src/modules/hwid-devices/hwid-mode.spec.ts`
- Modify: `backend/src/common/config/app-config/config.schema.ts`
- Modify: `backend/src/modules/hwid-devices/hwid-devices.constants.ts`
- Modify: `.env.sample`

**Interfaces:**
- Produces: `type HwidMode = 'disabled' | 'open' | 'telegram'`; `resolveHwidMode(modeEnv: string | undefined, hasToken: boolean): HwidMode`; env `HWID_MANAGEMENT_MODE`; constants `HWID.OPEN_ACTION_LIMIT`, `HWID.OPEN_ACTION_WINDOW_MS`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/hwid-devices/hwid-mode.spec.ts`:

```typescript
import { resolveHwidMode } from './hwid-mode';

describe('resolveHwidMode', () => {
    it('returns explicit open regardless of token', () => {
        expect(resolveHwidMode('open', false)).toBe('open');
        expect(resolveHwidMode('open', true)).toBe('open');
    });

    it('maps disabled and off to disabled', () => {
        expect(resolveHwidMode('disabled', true)).toBe('disabled');
        expect(resolveHwidMode('off', true)).toBe('disabled');
    });

    it('returns explicit telegram even without a token (schema validation rejects that combo separately)', () => {
        expect(resolveHwidMode('telegram', false)).toBe('telegram');
        expect(resolveHwidMode('telegram', true)).toBe('telegram');
    });

    it('defaults (unset) to telegram when a token is present, else disabled', () => {
        expect(resolveHwidMode(undefined, true)).toBe('telegram');
        expect(resolveHwidMode(undefined, false)).toBe('disabled');
        expect(resolveHwidMode('', true)).toBe('telegram');
    });

    it('is case-insensitive and trims', () => {
        expect(resolveHwidMode('  OPEN ', false)).toBe('open');
        expect(resolveHwidMode('Telegram', true)).toBe('telegram');
    });

    it('treats an unknown value as unset (default rules)', () => {
        expect(resolveHwidMode('bogus', true)).toBe('telegram');
        expect(resolveHwidMode('bogus', false)).toBe('disabled');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest hwid-mode -v`
Expected: FAIL — "Cannot find module './hwid-mode'".

- [ ] **Step 3: Implement `hwid-mode.ts`**

Create `backend/src/modules/hwid-devices/hwid-mode.ts`:

```typescript
export type HwidMode = 'disabled' | 'open' | 'telegram';

// Resolves the effective HWID management mode from the raw env value + token presence.
// Explicit values win; an unset/unknown value falls back to the backward-compatible default
// (telegram when a bot token exists, otherwise disabled). NOTE: 'telegram' is returned even
// without a token — the config schema rejects that misconfiguration separately, so this
// function never silently opens access.
export function resolveHwidMode(modeEnv: string | undefined, hasToken: boolean): HwidMode {
    const raw = (modeEnv ?? '').trim().toLowerCase();
    if (raw === 'open') return 'open';
    if (raw === 'disabled' || raw === 'off') return 'disabled';
    if (raw === 'telegram') return 'telegram';
    return hasToken ? 'telegram' : 'disabled';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest hwid-mode -v`
Expected: PASS — all specs green.

- [ ] **Step 5: Add `HWID_MANAGEMENT_MODE` to the config schema**

In `backend/src/common/config/app-config/config.schema.ts`, inside the `z.object({...})` right after the existing `TELEGRAM_BOT_TOKEN` field, add:

```typescript
        // HWID management mode: telegram | open | disabled (off = disabled). Case-insensitive.
        // Unset → telegram if TELEGRAM_BOT_TOKEN is set, else disabled (see resolveHwidMode).
        HWID_MANAGEMENT_MODE: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? v.trim().toLowerCase() : undefined))
            .refine(
                (v) => v === undefined || ['telegram', 'open', 'disabled', 'off'].includes(v),
                'HWID_MANAGEMENT_MODE must be one of: telegram, open, disabled (or off)',
            ),
```

Then, inside the existing `.superRefine((data, ctx) => { ... })` block, append:

```typescript
        if (data.HWID_MANAGEMENT_MODE === 'telegram' && !data.TELEGRAM_BOT_TOKEN) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'HWID_MANAGEMENT_MODE=telegram requires TELEGRAM_BOT_TOKEN',
                path: ['HWID_MANAGEMENT_MODE'],
            });
        }
```

- [ ] **Step 6: Add open-action rate constants**

In `backend/src/modules/hwid-devices/hwid-devices.constants.ts`, add two entries to the `HWID` object (before the closing `} as const;`):

```typescript
    OPEN_ACTION_LIMIT: 10, // open-mode delete calls allowed per window per IP+sub
    OPEN_ACTION_WINDOW_MS: 60_000,
```

- [ ] **Step 7: Document the env var**

In `.env.sample`, in the `### HWID DEVICE MANAGEMENT (optional)` block, ABOVE the `TELEGRAM_BOT_TOKEN=` line, add:

```bash
# HWID management mode: telegram | open | disabled
#   telegram (default when a bot token is set) — deleting a device requires a one-time
#            code sent to the owner's Telegram, then a 10-minute management session.
#   open     — anyone who has the subscription link can view and delete devices directly
#            on the page (no code). Actions are still bound to that subscription and
#            rate-limited. If a bot token is set, the owner still gets a deletion notice.
#   disabled — the Devices section is hidden.
# Unset → telegram if TELEGRAM_BOT_TOKEN is set below, otherwise disabled.
HWID_MANAGEMENT_MODE=
```

- [ ] **Step 8: Verify build + tests**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json && npx jest hwid-mode -v`
Expected: tsc exit 0; jest all green.

- [ ] **Step 9: Commit**

```bash
cd backend && npm run lint:fix && npm run format
# revert any incidental unrelated reformat (e.g. platega.service.ts)
git -C .. status --short | grep -q platega && git -C .. checkout -- backend/src/common/platega/platega.service.ts || true
cd .. && git add backend/src/modules/hwid-devices/hwid-mode.ts \
  backend/src/modules/hwid-devices/hwid-mode.spec.ts \
  backend/src/common/config/app-config/config.schema.ts \
  backend/src/modules/hwid-devices/hwid-devices.constants.ts .env.sample
git commit -m "feat(hwid): HWID_MANAGEMENT_MODE resolver, config, constants, env docs"
```

---

### Task 2: Telegram notifier — English-only, HTML, code in `<pre>`

**Files:**
- Modify: `backend/src/modules/hwid-devices/telegram-notifier.service.ts`

**Interfaces:**
- Consumes: `sanitizeUsername`.
- Produces: same public methods (`isEnabled`, `sendCode`, `notifyDeleted`, `notifyDeletedAll`, `notifyBlocked`) with unchanged signatures — only message text + `parse_mode` change.

- [ ] **Step 1: Rewrite the service**

Replace the entire contents of `backend/src/modules/hwid-devices/telegram-notifier.service.ts` with:

```typescript
import axios, { AxiosError, AxiosInstance } from 'axios';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { sanitizeUsername } from '@common/utils';

// Escape values interpolated into an HTML-parse_mode Telegram message. `sanitizeUsername`
// already restricts usernames to [a-zA-Z0-9_-] (HTML-safe), but panel-supplied device
// fields are not — they must be escaped to avoid breaking the HTML parse / injection.
function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

@Injectable()
export class TelegramNotifierService {
    private readonly logger = new Logger(TelegramNotifierService.name);
    private readonly token?: string;
    private readonly http: AxiosInstance;

    constructor(private readonly configService: ConfigService) {
        this.token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
        // Dedicated instance. No interceptors, short timeout. The code lives in the request
        // body, so this instance's errors MUST NOT be logged with their config/request.
        this.http = axios.create({ timeout: 10_000 });
    }

    get isEnabled(): boolean {
        return Boolean(this.token);
    }

    private async send(chatId: string, text: string): Promise<boolean> {
        if (!this.token) return false;
        try {
            await this.http.post(`https://api.telegram.org/bot${this.token}/sendMessage`, {
                chat_id: chatId,
                text,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
            });
            return true;
        } catch (error) {
            // NEVER log the error object / config / request — the code is in the body.
            if (error instanceof AxiosError) {
                this.logger.warn(
                    `Telegram sendMessage failed: ${error.message} (status ${error.response?.status ?? 'n/a'})`,
                );
            } else {
                this.logger.warn('Telegram sendMessage failed');
            }
            return false;
        }
    }

    sendCode(chatId: string, username: string, ip: string, code: string): Promise<boolean> {
        const u = sanitizeUsername(username);
        const text =
            `🔐 Device management for <b>${u}</b> · IP ${ip}\n` +
            `Code (valid 5 min):\n<pre>${code}</pre>`;
        return this.send(chatId, text);
    }

    notifyDeleted(
        chatId: string,
        username: string,
        ip: string,
        deviceLabel: string,
    ): Promise<boolean> {
        const u = sanitizeUsername(username);
        const text = `📱 Device removed for <b>${u}</b>: ${escapeHtml(deviceLabel)} · IP ${ip}`;
        return this.send(chatId, text);
    }

    notifyDeletedAll(
        chatId: string,
        username: string,
        ip: string,
        count: number,
    ): Promise<boolean> {
        const u = sanitizeUsername(username);
        const text = `📱 All devices removed for <b>${u}</b> (${count}) · IP ${ip}`;
        return this.send(chatId, text);
    }

    notifyBlocked(chatId: string, username: string, ip: string): Promise<boolean> {
        const u = sanitizeUsername(username);
        const text = `⚠️ Failed device-management attempts for <b>${u}</b> — IP ${ip} blocked 10 min`;
        return this.send(chatId, text);
    }
}
```

- [ ] **Step 2: Verify build**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd backend && npm run lint:fix && npm run format
git -C .. status --short | grep -q platega && git -C .. checkout -- backend/src/common/platega/platega.service.ts || true
cd .. && git add backend/src/modules/hwid-devices/telegram-notifier.service.ts
git commit -m "feat(hwid): English-only HTML Telegram messages with code in <pre>"
```

---

### Task 3: Service — mode, authorize, open-mode list/delete, rate-limit, status.mode

**Files:**
- Modify: `backend/src/modules/hwid-devices/hwid-devices.service.ts`

**Interfaces:**
- Consumes: `resolveHwidMode`, `HwidMode` (Task 1); `HWID.OPEN_ACTION_LIMIT`/`OPEN_ACTION_WINDOW_MS`.
- Produces: public `get mode(): HwidMode`; `get isEnabled()` = `mode !== 'disabled'`; `getStatus` result now includes `mode: HwidMode`; `listDevices`/`deleteDevice`/`deleteAll` work in both modes (open path returns `{ ok:false, status:429 }` when rate-limited).

- [ ] **Step 1: Add imports and the mode getter**

In `hwid-devices.service.ts`, add to the import block (after the `HWID` import):

```typescript
import { HwidMode, resolveHwidMode } from './hwid-mode';
```

Add an `openActionRate` field beside `statusCache`:

```typescript
    private readonly openActionRate = new Map<string, number[]>();
```

Replace the existing `isEnabled` getter with a `mode` getter + `isEnabled`:

```typescript
    get mode(): HwidMode {
        return resolveHwidMode(
            this.configService.get<string>('HWID_MANAGEMENT_MODE'),
            this.telegram.isEnabled,
        );
    }

    get isEnabled(): boolean {
        return this.mode !== 'disabled';
    }
```

- [ ] **Step 2: Add `mode` to the status result type and both return branches**

Change the `StatusResult` interface:

```typescript
interface StatusResult {
    enabled: boolean;
    mode: HwidMode;
    telegramLinked: boolean;
    deviceCount: number;
    deviceLimit: number | null;
}
```

In `getStatus`, add `mode: this.mode,` to BOTH the unknown-user object and the resolved-user object. The unknown-user branch becomes:

```typescript
        const user = await this.fetchUser(shortUuid);
        if (!user) {
            // Uniform "not linked, zero devices" shape — do not reveal whether the user exists.
            const value: StatusResult = {
                enabled: true,
                mode: this.mode,
                telegramLinked: false,
                deviceCount: 0,
                deviceLimit: null,
            };
            return value;
        }
```

and the resolved-user object becomes:

```typescript
        const value: StatusResult = {
            enabled: true,
            mode: this.mode,
            telegramLinked: user.telegramId !== null,
            deviceCount,
            deviceLimit: user.hwidDeviceLimit,
        };
```

- [ ] **Step 2b: Add the open-action rate-limiter**

Add this private method (e.g. after `resolveSession`):

```typescript
    // Bounded per-IP+sub rate limit for open-mode device actions (no session gate there).
    // Mirrors applyPaymentRateLimit: cap total keys, reject new keys at capacity.
    private allowOpenAction(ip: string, sub: string): boolean {
        const now = this.now();
        const key = `${ip}:${sub}`;
        const existing = this.openActionRate.get(key);
        if (existing === undefined && this.openActionRate.size >= HWID.MAP_MAX_KEYS) {
            return false;
        }
        const recent = (existing ?? []).filter(
            (ts) => now - ts < HWID.OPEN_ACTION_WINDOW_MS,
        );
        if (recent.length >= HWID.OPEN_ACTION_LIMIT) {
            return false;
        }
        recent.push(now);
        this.openActionRate.set(key, recent);
        return true;
    }
```

- [ ] **Step 3: Add `authorize` and switch list/delete to it**

Add a private `authorize` (place it right before `resolveSession`):

```typescript
    // Resolves the target userUuid for a device action, per mode.
    // open: authorized by the session-JWT sub alone (bound by the controller's IDOR guard).
    // telegram: requires a valid hwid_mgmt session bound to sub + sessionId.
    private async authorize(
        token: string,
        sessionId: string,
        sub: string,
    ): Promise<{ userUuid: string } | null> {
        if (this.mode === 'open') {
            const user = await this.fetchUser(sub);
            return user ? { userUuid: user.uuid } : null;
        }
        const session = this.resolveSession(token, sessionId, sub);
        return session ? { userUuid: session.userUuid } : null;
    }
```

Replace `listDevices`, `deleteDevice`, `deleteAll` with these (they now call `authorize` and add the open-mode rate-limit):

```typescript
    async listDevices(token: string, sessionId: string, sub: string) {
        const auth = await this.authorize(token, sessionId, sub);
        if (!auth) return { ok: false as const, status: 403 };
        const res = await this.axiosService.getUserHwidDevices(auth.userUuid);
        if (!res.isOk || !res.response) return { ok: false as const, status: 502 };
        return this.buildListResult(sub, res.response.response);
    }

    async deleteDevice(token: string, sessionId: string, sub: string, hwid: string, ip: string) {
        const auth = await this.authorize(token, sessionId, sub);
        if (!auth) return { ok: false as const, status: 403 };
        if (this.mode === 'open' && !this.allowOpenAction(ip, sub)) {
            return { ok: false as const, status: 429 };
        }
        // Label for the owner notification, resolved from the pre-delete list.
        const before = await this.axiosService.getUserHwidDevices(auth.userUuid);
        const target = before.isOk
            ? before.response?.response.devices.find((d) => d.hwid === hwid)
            : undefined;
        const res = await this.axiosService.deleteUserHwidDevice(auth.userUuid, hwid);
        if (!res.isOk || !res.response) return { ok: false as const, status: 502 };
        this.statusCache.delete(sub);
        void this.notifyDeviceRemoved(sub, ip, target);
        return this.buildListResult(sub, res.response.response);
    }

    async deleteAll(token: string, sessionId: string, sub: string, ip: string) {
        const auth = await this.authorize(token, sessionId, sub);
        if (!auth) return { ok: false as const, status: 403 };
        if (this.mode === 'open' && !this.allowOpenAction(ip, sub)) {
            return { ok: false as const, status: 429 };
        }
        const res = await this.axiosService.deleteAllUserHwidDevices(auth.userUuid);
        if (!res.isOk || !res.response) return { ok: false as const, status: 502 };
        this.statusCache.delete(sub);
        const remaining = res.response.response.total;
        void this.notifyAllRemoved(sub, ip, remaining);
        return this.buildListResult(sub, res.response.response);
    }
```

> `requestChallenge`/`verify`/`resolveSession`/`buildListResult`/notify helpers are unchanged. `requestChallenge` still checks `telegramId === null → not_linked`; it is only reachable in telegram mode (the controller 404s it otherwise in Task 4).

- [ ] **Step 4: Verify build**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
cd backend && npm run lint:fix && npm run format
git -C .. status --short | grep -q platega && git -C .. checkout -- backend/src/common/platega/platega.service.ts || true
cd .. && git add backend/src/modules/hwid-devices/hwid-devices.service.ts
git commit -m "feat(hwid): mode-aware authorization, open-mode device access + rate-limit"
```

---

### Task 4: Controller — 404 challenge/verify outside telegram mode

**Files:**
- Modify: `backend/src/modules/hwid-devices/hwid-devices.controller.ts`

**Interfaces:**
- Consumes: `this.service.mode` (public getter, Task 3).

- [ ] **Step 1: Guard the Telegram-only endpoints**

In `hwid-devices.controller.ts`, in the `challenge` handler, immediately AFTER `if (!this.guard(user, res)) return;` add:

```typescript
        if (this.service.mode !== 'telegram') {
            res.status(404).send('Not Found');
            return;
        }
```

Add the identical block in the `verify` handler, immediately after its `if (!this.guard(user, res)) return;` line.

- [ ] **Step 2: Verify build**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd backend && npm run lint:fix && npm run format
git -C .. status --short | grep -q platega && git -C .. checkout -- backend/src/common/platega/platega.service.ts || true
cd .. && git add backend/src/modules/hwid-devices/hwid-devices.controller.ts
git commit -m "feat(hwid): 404 challenge/verify when not in telegram mode"
```

---

### Task 5: Page `enabled` flag from the resolved mode

**Files:**
- Modify: `backend/src/modules/root/root.service.ts`

**Interfaces:**
- Consumes: `resolveHwidMode` (Task 1).

- [ ] **Step 1: Import the resolver**

In `backend/src/modules/root/root.service.ts`, add near the other imports:

```typescript
import { resolveHwidMode } from '../hwid-devices/hwid-mode';
```

- [ ] **Step 2: Compute `hwidData.enabled` from the mode**

In `returnWebpage`, replace the existing `hwidData` computation:

```typescript
            const hwidData = Buffer.from(
                JSON.stringify({
                    enabled: Boolean(this.configService.get<string>('TELEGRAM_BOT_TOKEN')),
                }),
            ).toString('base64');
```

with:

```typescript
            const hwidEnabled =
                resolveHwidMode(
                    this.configService.get<string>('HWID_MANAGEMENT_MODE'),
                    Boolean(this.configService.get<string>('TELEGRAM_BOT_TOKEN')),
                ) !== 'disabled';
            const hwidData = Buffer.from(JSON.stringify({ enabled: hwidEnabled })).toString(
                'base64',
            );
```

- [ ] **Step 3: Verify build**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
cd backend && npm run lint:fix && npm run format
git -C .. status --short | grep -q platega && git -C .. checkout -- backend/src/common/platega/platega.service.ts || true
cd .. && git add backend/src/modules/root/root.service.ts
git commit -m "feat(hwid): page enabled flag reflects resolved HWID mode"
```

---

### Task 6: Frontend API — `fetchStatus` returns `mode`

**Files:**
- Modify: `frontend/src/widgets/main/devices/devices-api.ts`

**Interfaces:**
- Produces: `export type DeviceMode = 'disabled' | 'open' | 'telegram'`; `fetchStatus()` result includes `mode: DeviceMode`.

- [ ] **Step 1: Add the type and extend `fetchStatus`**

In `frontend/src/widgets/main/devices/devices-api.ts`, add after the `import` line:

```typescript
export type DeviceMode = 'disabled' | 'open' | 'telegram'
```

Replace `fetchStatus` with:

```typescript
export async function fetchStatus() {
    return ofetch<{
        deviceCount: number
        deviceLimit: null | number
        enabled: boolean
        mode: DeviceMode
        telegramLinked: boolean
    }>(`${base}/status?v=${Date.now()}`, { credentials: 'same-origin' })
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd frontend && npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd frontend && npx prettier --write src/widgets/main/devices/devices-api.ts && npx eslint --fix src/widgets/main/devices/devices-api.ts
git -C .. status --short | grep -vE 'devices-api\.ts|\.claude' | grep -q . && echo "REVERT stray files" || true
cd .. && git add frontend/src/widgets/main/devices/devices-api.ts
git commit -m "feat(hwid): fetchStatus returns management mode"
```

> If the grep in the commit step prints "REVERT stray files", run `git status --short`, `git checkout --` each file that is NOT `devices-api.ts`, then commit.

---

### Task 7: Frontend widget + modal — open-mode flow and visibility

**Files:**
- Modify: `frontend/src/widgets/main/devices/devices-modal.tsx`
- Modify: `frontend/src/widgets/main/devices/devices-button.widget.tsx`

**Interfaces:**
- Consumes: `DeviceMode`, `fetchStatus().mode` (Task 6).
- Produces: `openDevicesModal(lang: string, mode: DeviceMode): void`.

- [ ] **Step 1: Update the modal to accept and branch on `mode`**

In `frontend/src/widgets/main/devices/devices-modal.tsx`:

Change the imports line for the store to also import `DeviceMode` from the api:

```typescript
import { IDevice } from '@entities/devices-store'

import {
    DeviceMode,
    deleteAllDevices,
    deleteDevice,
    fetchDevices,
    requestChallenge,
    verifyCode
} from './devices-api'
```

Change the `DevicesFlow` signature and initial step, and add an open-mode mount loader. Replace:

```typescript
function DevicesFlow({ s }: { s: IDeviceStrings }) {
    const [step, setStep] = useState<Step>('intro')
```

with:

```typescript
function DevicesFlow({ s, mode }: { s: IDeviceStrings; mode: DeviceMode }) {
    const [step, setStep] = useState<Step>(mode === 'open' ? 'list' : 'intro')
```

Immediately AFTER the `loadDevices` function definition, add an open-mode mount effect:

```typescript
    useEffect(() => {
        if (mode !== 'open') return
        void loadDevices().then((ok) => {
            if (!ok) notifications.show({ color: 'red', message: s.errorGeneric })
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
```

In `onDelete`, change the `403` branch to be mode-aware:

```typescript
            } else if (res.status === 403) {
                if (mode === 'telegram') setStep('intro')
                else notifications.show({ color: 'red', message: s.errorGeneric })
            } else {
```

In `onDeleteAll`'s `onConfirm`, change its `403` branch identically:

```typescript
                    } else if (res.status === 403) {
                        if (mode === 'telegram') setStep('intro')
                        else notifications.show({ color: 'red', message: s.errorGeneric })
                    } else {
```

In the `list` render, gate the session badge to telegram mode. Replace:

```typescript
            <Group justify="flex-end">
                <Badge color="cyan" variant="light">
                    {s.sessionEndsIn(mmss(sessionLeft))}
                </Badge>
            </Group>
```

with:

```typescript
            {mode === 'telegram' && (
                <Group justify="flex-end">
                    <Badge color="cyan" variant="light">
                        {s.sessionEndsIn(mmss(sessionLeft))}
                    </Badge>
                </Group>
            )}
```

Change `openDevicesModal` to accept and pass `mode`:

```typescript
export function openDevicesModal(lang: string, mode: DeviceMode): void {
    const s = getDeviceStrings(lang)
    modals.open({
        title: s.title,
        centered: true,
        fullScreen: window.matchMedia('(max-width: 30rem)').matches,
        children: <DevicesFlow mode={mode} s={s} />
    })
}
```

> `startSessionCountdown` is still called on telegram-mode verify success (unchanged). In open mode it is never started and the badge is hidden, so `sessionLeft` is inert. The cleanup effect stays as-is.

- [ ] **Step 2: Update the widget visibility and modal call**

Replace the entire body of `frontend/src/widgets/main/devices/devices-button.widget.tsx` with:

```typescript
import { Button, Group, Text } from '@mantine/core'
import { IconDevices } from '@tabler/icons-react'
import { useEffect, useState } from 'react'

import { useDevicesEnabled } from '@entities/devices-store'
import { vibrate } from '@shared/utils/vibrate'
import { useTranslation } from '@shared/hooks'

import { openDevicesModal } from './devices-modal'
import { getDeviceStrings } from './devices.i18n'
import { DeviceMode, fetchStatus } from './devices-api'

interface DeviceStatus {
    deviceCount: number
    deviceLimit: null | number
    mode: DeviceMode
    telegramLinked: boolean
}

export const DevicesButton = () => {
    const enabled = useDevicesEnabled()
    const { currentLang } = useTranslation()
    const s = getDeviceStrings(currentLang)

    const [status, setStatus] = useState<DeviceStatus | null>(null)

    useEffect(() => {
        if (!enabled) return undefined
        let cancelled = false
        fetchStatus()
            .then((st) => {
                if (cancelled) return
                setStatus({
                    mode: st.mode,
                    telegramLinked: st.telegramLinked,
                    deviceCount: st.deviceCount,
                    deviceLimit: st.deviceLimit
                })
            })
            .catch(() => {
                if (!cancelled) setStatus(null)
            })
        return () => {
            cancelled = true
        }
    }, [enabled])

    // Render nothing until we know the mode. Then:
    //  - disabled → never (defensive; the div flag already gates this)
    //  - telegram + not linked → hidden entirely (no "link Telegram" stub)
    //  - telegram + linked → shown (opens the code flow)
    //  - open → always shown (opens the device list directly)
    if (!enabled || !status) return null
    if (status.mode === 'disabled') return null
    if (status.mode === 'telegram' && !status.telegramLinked) return null

    const handleClick = () => {
        vibrate('tap')
        openDevicesModal(currentLang, status.mode)
    }

    const countLabel = s.devicesCount(status.deviceCount, status.deviceLimit)

    return (
        <Button
            color="cyan"
            fullWidth
            leftSection={<IconDevices size={18} />}
            onClick={handleClick}
            radius="md"
            size="md"
            variant="light"
        >
            <Group gap="xs" justify="space-between" w="100%" wrap="nowrap">
                <Text fw={600} size="sm">
                    {`${s.manage} · ${countLabel}`}
                </Text>
            </Group>
        </Button>
    )
}
```

- [ ] **Step 3: Verify typecheck + build**

Run: `cd frontend && npm run typecheck && npm run start:build`
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
cd frontend && npx prettier --write src/widgets/main/devices/devices-modal.tsx src/widgets/main/devices/devices-button.widget.tsx && npx eslint --fix src/widgets/main/devices/devices-modal.tsx src/widgets/main/devices/devices-button.widget.tsx
# revert any stray file prettier/eslint touched beyond these two
cd .. && git status --short
git add frontend/src/widgets/main/devices/devices-modal.tsx frontend/src/widgets/main/devices/devices-button.widget.tsx
git commit -m "feat(hwid): open-mode modal flow + mode-aware widget visibility"
```

> Before committing, check `git status --short`: if any file besides the two modal/widget files is modified, `git checkout --` it (prettier/eslint may reformat neighbors). Only the two files belong in this commit.

---

### Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Backend — tsc, build, tests, lint**

Run:

```bash
cd backend && npx tsc --noEmit -p tsconfig.json && npm run build && npm test && npm run lint
```

Expected: all exit 0; jest suites (`hwid-challenge.store`, `hwid-mode`) all green.

- [ ] **Step 2: Frontend — typecheck, build, scoped lint**

Run:

```bash
cd frontend && npm run typecheck && npm run start:build
npx eslint src/widgets/main/devices/devices-api.ts src/widgets/main/devices/devices-modal.tsx src/widgets/main/devices/devices-button.widget.tsx
```

Expected: typecheck + build exit 0; eslint on the three touched files reports 0 errors (a benign `react-refresh/only-export-components` warning on `devices-modal.tsx` is acceptable). The repo-wide `npm run lint` will still report the ~12 PRE-EXISTING errors in untouched files — out of scope.

- [ ] **Step 3: Spec-coverage self-check (manual)**

Confirm: `HWID_MANAGEMENT_MODE` resolver (Task 1, tested); English/HTML/`<pre>` messages + escapeHtml (Task 2); mode getter + open-mode authorize + rate-limit + `status.mode` (Task 3); challenge/verify 404 outside telegram (Task 4); page `enabled` from mode (Task 5); frontend mode plumbing + open-mode list + hide-when-not-linked (Tasks 6–7). Note any gap.

- [ ] **Step 4: Commit any lint/format fixes**

```bash
git add -A && git commit -m "chore(hwid): final formatting/lint pass" || echo "nothing to commit"
```

---

## Self-Review Notes

- **Spec coverage:** mode selection + default + validation → Task 1; open-mode authz (session-JWT `sub` only) + rate-limit + notifications-if-token → Task 3 (notifications reuse the unchanged notify helpers, which no-op without a token); challenge/verify 404 → Task 4; English/HTML/`<pre>`/escape → Task 2; widget hide-when-no-telegramId + open always-on → Task 7; modal open→list-no-countdown → Task 7; page enabled flag → Task 5; `mode` to frontend → Task 6. Testing: `resolveHwidMode` unit test (Task 1).
- **Security:** open mode keeps the IDOR `sub` binding (controller `guard` + `authorize` fetch-by-sub), adds a bounded per-IP+sub delete rate-limit, and never places device data in `panelData`. HTML messages escape panel-supplied device fields; username is already sanitized; the code stays digits-in-`<pre>`. Code-leak invariant unchanged.
- **Type consistency:** `HwidMode` (backend) and `DeviceMode` (frontend) share the same three literals; `getStatus` returns `mode` consumed by `fetchStatus` → widget → `openDevicesModal(lang, mode)` → `DevicesFlow`. `listDevices/deleteDevice/deleteAll` keep their existing `(token, sessionId, sub[, hwid], ip)` signatures — the controller is unchanged for those.
