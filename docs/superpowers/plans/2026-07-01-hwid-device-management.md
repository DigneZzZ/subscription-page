# HWID Device Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a subscription owner view and delete HWID devices from the subscription page, gated by a one-time code sent to the owner's Telegram, then a 10-minute management session.

**Architecture:** A new isolated NestJS module (`HwidDevicesModule`) owns all endpoints and in-memory state (challenge codes, management sessions, cooldowns, IP/subscription blocks) via bounded Maps swept periodically — mirroring the existing `applyPaymentRateLimit` pattern. The verification code is HMAC-hashed (HKDF-derived key) and only ever appears in the outbound Telegram message. The frontend adds one card widget + one multi-step modal, following the existing `ResetTrafficButton` / payment-modal patterns.

**Tech Stack:** NestJS + Express (backend), `@remnawave/backend-contract` HWID commands, Node `crypto` (hkdf/hmac/timingSafeEqual/randomInt), `nanoid`, `axios`; React 19 + Mantine v8 + zustand + ofetch (frontend). Backend tests via jest + ts-jest (added in Task 1, scoped to the security core only).

## Global Constraints

- **No new runtime deps beyond what exists.** `axios`, `nanoid`, `crypto`, `@nestjs/*` already present. Frontend: Mantine, zustand, ofetch, `@tabler/icons-react` already present.
- **The verification code MUST NEVER** appear in: API responses, URLs, the DOM, zustand state, or logs. In every `catch` around the Telegram send, log only `error.message` / `error.code` / `error.response?.status` — never the error object, `error.config`, or `error.request` (the code lives in `error.config.data`).
- **Device data** (`hwid`, `platform`, `osVersion`, `deviceModel`, `userAgent`) MUST come only from `GET /api/devices` behind a valid `hwid_mgmt` session — never serialized into the initial HTML `panelData`.
- **IDOR guard on every device endpoint:** `if (!user || !user.sub) → 403`. Management-session endpoints additionally require `session.shortUuid === user.sub && session.sessionId === user.sessionId`.
- **All new in-memory Maps are bounded** by `RATE_MAP_MAX_KEYS` (10_000) and swept; reject brand-new keys once saturated.
- **Client IP** is always `req.clientIp` via the existing `@ClientIp()` decorator (never a raw header).
- **Copy is bilingual** in Telegram messages (Russian line + English line). Frontend strings follow the `getResetStrings(lang)` i18n pattern (en/ru/zh/fa/fr).
- **The installed contract's HWID device object has NO `requestIp` field** — deletion Telegram notices include only the initiator IP (`req.clientIp`), not a per-device IP.
- **Backend formatting:** run `npm run lint:fix` and `npm run format` in `backend/` before each backend commit. **Frontend:** run `npm run prettier:write` and `npm run lint:eslint` in `frontend/` before each frontend commit.
- **Constants (in `hwid-devices.constants.ts`):** code length 6; code TTL 5 min (`300_000`); management session TTL 10 min (`600_000`); challenge cooldown 60 s (`60_000`); max wrong-code attempts per challenge 3; failure window 15 min (`900_000`); block duration 10 min (`600_000`); failure threshold 3; status cache TTL 60 s (`60_000`); cookie name `hwid_mgmt`.

---

## File Structure

**Backend — new (`backend/src/modules/hwid-devices/`):**
- `hwid-devices.constants.ts` — all durations/limits/cookie name.
- `hwid-challenge.store.ts` — **security core**: HKDF key, code gen/hash/verify (timingSafeEqual), atomic challenge create, management sessions, cooldowns, IP+subscription failure counters & blocks, bounded Maps + sweep. Plain class, DI-agnostic.
- `hwid-challenge.store.spec.ts` — jest unit tests for the core.
- `telegram-notifier.service.ts` — dedicated axios instance, `sendMessage`, timeout, no-body logging, plain-text messages.
- `hwid-devices.service.ts` — orchestration.
- `hwid-devices.controller.ts` — 6 endpoints, guards, cookie, headers.
- `hwid-devices.module.ts` — module wiring.

**Backend — modified:**
- `backend/src/common/config/app-config/config.schema.ts` — add `TELEGRAM_BOT_TOKEN`.
- `backend/src/common/axios/axios.service.ts` — add 3 HWID methods.
- `backend/src/common/middlewares/check-assets-cookie.middleware.ts` — guard `/api/devices/*`.
- `backend/src/main.ts` — add device routes to `setGlobalPrefix` exclude.
- `backend/src/modules/subscription-page-backend.modules.ts` — import `HwidDevicesModule`.
- `backend/src/modules/root/root.service.ts` — inject `hwidData` in `returnWebpage`.
- `backend/src/modules/root/root.controller.ts` — pass `hwidData` to `res.render` (done inside root.service render call; see Task 8).
- `frontend/index.html` — add `#hwid` data div.
- `backend/package.json` — add jest + `test` script (Task 1).
- `.env.sample` — document `TELEGRAM_BOT_TOKEN`.

**Frontend — new (`frontend/src/`):**
- `entities/devices-store/devices-store.ts` + `index.ts` — zustand store.
- `widgets/main/devices/devices.i18n.ts` — strings.
- `widgets/main/devices/devices-api.ts` — ofetch wrappers.
- `widgets/main/devices/devices-button.widget.tsx` — the card + button.
- `widgets/main/devices/devices-modal.tsx` — the multi-step modal opener.
- `widgets/main/devices/index.ts` — barrel.

**Frontend — modified:**
- `frontend/src/app/layouts/root/root.layout.tsx` — read `#hwid` div.
- `frontend/src/widgets/main/subscription-info/subscription-info-cards.widget.tsx` — mount `<DevicesButton/>`.
- `frontend/src/widgets/main/index.ts` — export devices barrel (already `export *`s subfolders; add devices).

---

## PHASE 1 — BACKEND

### Task 1: Config, constants, env docs, and jest harness

**Files:**
- Modify: `backend/src/common/config/app-config/config.schema.ts`
- Create: `backend/src/modules/hwid-devices/hwid-devices.constants.ts`
- Modify: `backend/package.json`
- Create: `backend/jest.config.js`
- Modify: `.env.sample`

**Interfaces:**
- Produces: env key `TELEGRAM_BOT_TOKEN?: string`; constants object `HWID` (durations/limits/cookie name); `npm --prefix backend test` runs jest.

- [ ] **Step 1: Add `TELEGRAM_BOT_TOKEN` to the zod schema**

In `config.schema.ts`, inside the `z.object({...})` (next to `EGAMES_COOKIE`), add:

```typescript
        // Telegram bot for HWID device-management confirmation codes.
        // Presence enables the "Devices" section on the subscription page.
        TELEGRAM_BOT_TOKEN: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? v : undefined)),
```

- [ ] **Step 2: Add a soft warning for short `INTERNAL_JWT_SECRET`**

Do NOT change `INTERNAL_JWT_SECRET: z.string()` to `.min(32)` — existing deployments may use shorter secrets and a hard failure would break upgrades. Instead, inside the existing `.superRefine((data, ctx) => { ... })` block, append (a warning, not an issue):

```typescript
        if (data.TELEGRAM_BOT_TOKEN && data.INTERNAL_JWT_SECRET.length < 32) {
            // Not a hard failure (would break existing installs on upgrade), but the
            // HWID code HMAC key is HKDF-derived from this secret — short secrets weaken it.
            console.warn(
                '[SECURITY] INTERNAL_JWT_SECRET is shorter than 32 chars; use a longer secret ' +
                    'for stronger HWID verification-code hashing.',
            );
        }
```

- [ ] **Step 3: Create the constants file**

Create `backend/src/modules/hwid-devices/hwid-devices.constants.ts`:

```typescript
export const HWID = {
    CODE_LENGTH: 6,
    CODE_TTL_MS: 300_000, // 5 min
    SESSION_TTL_MS: 600_000, // 10 min
    COOLDOWN_MS: 60_000, // 60 s between code requests
    MAX_CODE_ATTEMPTS: 3, // wrong codes per challenge before it is destroyed
    FAIL_WINDOW_MS: 900_000, // 15 min sliding window for failures
    BLOCK_MS: 600_000, // 10 min block after threshold
    FAIL_THRESHOLD: 3, // failures within window that trigger a block
    STATUS_CACHE_TTL_MS: 60_000, // status endpoint per-shortUuid cache
    MAP_MAX_KEYS: 10_000, // bound every in-memory map
    SWEEP_INTERVAL_MS: 60_000,
    COOKIE_NAME: 'hwid_mgmt',
    HKDF_INFO: 'hwid-code-hmac',
} as const;
```

- [ ] **Step 4: Add jest + ts-jest and a `test` script (backend)**

Run:

```bash
cd backend && npm install -D jest@29 ts-jest@29 @types/jest@29
```

Add to `backend/package.json` `"scripts"`:

```json
    "test": "jest",
    "test:watch": "jest --watch",
```

Create `backend/jest.config.js`:

```javascript
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    rootDir: 'src',
    testRegex: '.*\\.spec\\.ts$',
    moduleNameMapper: {
        '^@common/(.*)$': '<rootDir>/common/$1',
    },
    transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
};
```

- [ ] **Step 5: Document the env var**

In `.env.sample`, after the Chatwoot block, add:

```bash
### HWID DEVICE MANAGEMENT (optional)
# Telegram bot token used to send one-time confirmation codes to the subscription
# owner before they can view/delete their HWID devices from the subscription page.
# The bot must belong to the subscription seller (it messages the subscription owner).
# The owner's Telegram must be linked in Remnawave (user.telegramId) for the feature
# to appear. Leave empty to hide the "Devices" section entirely.
TELEGRAM_BOT_TOKEN=
```

- [ ] **Step 6: Verify build + a trivial jest run**

Run:

```bash
cd backend && npx tsc --noEmit -p tsconfig.json && npx jest --passWithNoTests
```

Expected: tsc exits 0; jest prints "No tests found ... passWithNoTests" and exits 0.

- [ ] **Step 7: Commit**

```bash
cd backend && npm run lint:fix && npm run format
cd .. && git add backend/src/common/config/app-config/config.schema.ts \
  backend/src/modules/hwid-devices/hwid-devices.constants.ts \
  backend/package.json backend/package-lock.json backend/jest.config.js .env.sample
git commit -m "feat(hwid): config, constants, env docs, and jest harness"
```

---

### Task 2: HwidChallengeStore — the security core (TDD)

**Files:**
- Create: `backend/src/modules/hwid-devices/hwid-challenge.store.ts`
- Test: `backend/src/modules/hwid-devices/hwid-challenge.store.spec.ts`

**Interfaces:**
- Consumes: `HWID` constants (Task 1).
- Produces:
  ```typescript
  class HwidChallengeStore {
    constructor(secret: string);
    isBlocked(ip: string, shortUuid: string, now: number): boolean;
    // Atomic: returns cooldown if a fresh challenge exists, else creates one and returns the plaintext code.
    createChallenge(shortUuid: string, userUuid: string, now: number):
      | { ok: true; code: string; ttlSec: number }
      | { ok: false; reason: 'cooldown'; cooldownSec: number }
      | { ok: false; reason: 'saturated' };
    verifyCode(shortUuid: string, code: string, now: number, ip?: string):
      | { ok: true; token: string; userUuid: string }
      | { ok: false; reason: 'blocked' | 'no_challenge' | 'wrong'; blockTriggered: boolean };
    getSession(token: string, now: number): { shortUuid: string; userUuid: string; sessionId: string } | null;
    // Binds a freshly-created session to the caller's session-JWT id. Call right after verifyCode success.
    bindSession(token: string, sessionId: string): void;
    dropSession(token: string, now: number): void;
    sweep(now: number): void;
  }
  ```

- [ ] **Step 1: Write the failing test file**

Create `backend/src/modules/hwid-devices/hwid-challenge.store.spec.ts`:

```typescript
import { HwidChallengeStore } from './hwid-challenge.store';
import { HWID } from './hwid-devices.constants';

const SECRET = 'test-secret-value-32-chars-long!!';
const T0 = 1_000_000_000_000; // fixed base timestamp

const mkStore = () => new HwidChallengeStore(SECRET);

describe('HwidChallengeStore', () => {
    it('creates a numeric code of configured length and reports TTL', () => {
        const store = mkStore();
        const res = store.createChallenge('sub1', 'uuid1', T0);
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.code).toMatch(new RegExp(`^\\d{${HWID.CODE_LENGTH}}$`));
        expect(res.ttlSec).toBe(HWID.CODE_TTL_MS / 1000);
    });

    it('rejects a second request within the cooldown window', () => {
        const store = mkStore();
        store.createChallenge('sub1', 'uuid1', T0);
        const res = store.createChallenge('sub1', 'uuid1', T0 + 10_000);
        expect(res).toMatchObject({ ok: false, reason: 'cooldown' });
    });

    it('allows a new request after the cooldown and invalidates the old code', () => {
        const store = mkStore();
        const first = store.createChallenge('sub1', 'uuid1', T0);
        const firstCode = first.ok ? first.code : '';
        const second = store.createChallenge('sub1', 'uuid1', T0 + HWID.COOLDOWN_MS + 1);
        expect(second.ok).toBe(true);
        // Old code no longer verifies.
        const v = store.verifyCode('sub1', firstCode, T0 + HWID.COOLDOWN_MS + 2);
        expect(v.ok).toBe(false);
    });

    it('verifies the correct code and returns a session token + userUuid', () => {
        const store = mkStore();
        const c = store.createChallenge('sub1', 'uuid1', T0);
        const code = c.ok ? c.code : '';
        const v = store.verifyCode('sub1', code, T0 + 1_000);
        expect(v.ok).toBe(true);
        if (!v.ok) return;
        expect(v.userUuid).toBe('uuid1');
        expect(typeof v.token).toBe('string');
        const session = store.getSession(v.token, T0 + 2_000);
        expect(session).toMatchObject({ shortUuid: 'sub1', userUuid: 'uuid1' });
    });

    it('rejects an expired code', () => {
        const store = mkStore();
        const c = store.createChallenge('sub1', 'uuid1', T0);
        const code = c.ok ? c.code : '';
        const v = store.verifyCode('sub1', code, T0 + HWID.CODE_TTL_MS + 1);
        expect(v.ok).toBe(false);
    });

    it('destroys the challenge and blocks after MAX_CODE_ATTEMPTS wrong entries', () => {
        // MAX_CODE_ATTEMPTS === FAIL_THRESHOLD (3): three wrong codes both destroy the
        // challenge AND trip the block, so the follow-up verify is rejected as 'blocked'
        // (isBlocked is checked before the missing-challenge branch — the spec intends
        // "3 failed attempts → block").
        const store = mkStore();
        store.createChallenge('sub1', 'uuid1', T0);
        for (let i = 0; i < HWID.MAX_CODE_ATTEMPTS; i++) {
            store.verifyCode('sub1', '000000', T0 + i, '1.2.3.4');
        }
        expect(store.isBlocked('1.2.3.4', 'sub1', T0 + 10)).toBe(true);
        const v = store.verifyCode('sub1', '000000', T0 + 10, '1.2.3.4');
        expect(v).toMatchObject({ ok: false, reason: 'blocked' });
    });

    it('blocks an IP after FAIL_THRESHOLD failures and flags the trigger once', () => {
        const store = mkStore();
        let triggered = 0;
        for (let i = 0; i < HWID.FAIL_THRESHOLD; i++) {
            store.createChallenge('sub1', 'uuid1', T0 + i * (HWID.COOLDOWN_MS + 1));
            const v = store.verifyCode('sub1', '000000', T0 + i * (HWID.COOLDOWN_MS + 1) + 1);
            if (!v.ok && v.blockTriggered) triggered++;
        }
        expect(triggered).toBe(1);
        expect(store.isBlocked('anything', 'sub1', T0 + 5)).toBe(true);
    });

    it('lifts the block after BLOCK_MS', () => {
        const store = mkStore();
        for (let i = 0; i < HWID.FAIL_THRESHOLD; i++) {
            store.createChallenge('sub1', 'uuid1', T0 + i * (HWID.COOLDOWN_MS + 1));
            store.verifyCode('sub1', '000000', T0 + i * (HWID.COOLDOWN_MS + 1) + 1);
        }
        const blockedAt = T0 + HWID.FAIL_THRESHOLD * (HWID.COOLDOWN_MS + 1);
        expect(store.isBlocked('x', 'sub1', blockedAt)).toBe(true);
        expect(store.isBlocked('x', 'sub1', blockedAt + HWID.BLOCK_MS + 1)).toBe(false);
    });

    it('getSession returns null after session TTL and after dropSession', () => {
        const store = mkStore();
        const c = store.createChallenge('sub1', 'uuid1', T0);
        const v = store.verifyCode('sub1', c.ok ? c.code : '', T0 + 1);
        const token = v.ok ? v.token : '';
        expect(store.getSession(token, T0 + HWID.SESSION_TTL_MS + 1)).toBeNull();
        // Fresh session, then drop.
        const c2 = store.createChallenge('sub1', 'uuid1', T0 + HWID.COOLDOWN_MS + 2);
        const v2 = store.verifyCode('sub1', c2.ok ? c2.code : '', T0 + HWID.COOLDOWN_MS + 3);
        const token2 = v2.ok ? v2.token : '';
        store.dropSession(token2, T0 + HWID.COOLDOWN_MS + 4);
        expect(store.getSession(token2, T0 + HWID.COOLDOWN_MS + 5)).toBeNull();
    });

    it('bindSession enforces sessionId match via getSession consumer check', () => {
        const store = mkStore();
        const c = store.createChallenge('sub1', 'uuid1', T0);
        const v = store.verifyCode('sub1', c.ok ? c.code : '', T0 + 1);
        const token = v.ok ? v.token : '';
        store.bindSession(token, 'jwt-session-abc');
        const s = store.getSession(token, T0 + 2);
        expect(s?.sessionId).toBe('jwt-session-abc');
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest hwid-challenge.store -v`
Expected: FAIL — "Cannot find module './hwid-challenge.store'".

- [ ] **Step 3: Implement the store**

Create `backend/src/modules/hwid-devices/hwid-challenge.store.ts`:

```typescript
import { hkdfSync, randomInt, createHmac, timingSafeEqual } from 'node:crypto';
import { nanoid } from 'nanoid';

import { HWID } from './hwid-devices.constants';

interface Challenge {
    hash: Buffer; // HMAC-SHA256 of the code
    createdAt: number;
    attempts: number;
    userUuid: string;
}

interface Session {
    shortUuid: string;
    userUuid: string;
    sessionId: string; // bound to the session-JWT sessionId claim
    expiresAt: number;
}

export class HwidChallengeStore {
    private readonly hmacKey: Buffer;
    private readonly challenges = new Map<string, Challenge>(); // key: shortUuid
    private readonly sessions = new Map<string, Session>(); // key: token
    private readonly ipFails = new Map<string, number[]>();
    private readonly subFails = new Map<string, number[]>();
    private readonly ipBlockUntil = new Map<string, number>();
    private readonly subBlockUntil = new Map<string, number>();
    private lastSweep = 0;

    constructor(secret: string) {
        // Derive a dedicated HMAC key so the code hash is not tied to the raw JWT-signing secret.
        this.hmacKey = Buffer.from(hkdfSync('sha256', secret, Buffer.alloc(0), HWID.HKDF_INFO, 32));
    }

    private hashCode(code: string): Buffer {
        return createHmac('sha256', this.hmacKey).update(code).digest();
    }

    private mapAtCapacity(map: Map<string, unknown>, key: string): boolean {
        return !map.has(key) && map.size >= HWID.MAP_MAX_KEYS;
    }

    private pushWindow(map: Map<string, number[]>, key: string, now: number): number {
        const recent = (map.get(key) ?? []).filter((ts) => now - ts < HWID.FAIL_WINDOW_MS);
        recent.push(now);
        map.set(key, recent);
        return recent.length;
    }

    isBlocked(ip: string, shortUuid: string, now: number): boolean {
        const ipUntil = this.ipBlockUntil.get(ip);
        const subUntil = this.subBlockUntil.get(shortUuid);
        return (!!ipUntil && ipUntil > now) || (!!subUntil && subUntil > now);
    }

    createChallenge(
        shortUuid: string,
        userUuid: string,
        now: number,
    ):
        | { ok: true; code: string; ttlSec: number }
        | { ok: false; reason: 'cooldown'; cooldownSec: number }
        | { ok: false; reason: 'saturated' } {
        this.sweep(now);

        const existing = this.challenges.get(shortUuid);
        if (existing && now - existing.createdAt < HWID.COOLDOWN_MS) {
            const cooldownSec = Math.ceil((HWID.COOLDOWN_MS - (now - existing.createdAt)) / 1000);
            return { ok: false, reason: 'cooldown', cooldownSec };
        }

        // A superseded, never-consumed challenge counts as one failure ("code not entered").
        if (existing && existing.attempts === 0) {
            this.recordFailure('__ip_unknown_on_create__', shortUuid, now, false);
        }

        if (this.mapAtCapacity(this.challenges, shortUuid)) {
            return { ok: false, reason: 'saturated' };
        }

        // 6-digit code, zero-padded, generated with a CSPRNG.
        const code = String(randomInt(0, 10 ** HWID.CODE_LENGTH)).padStart(HWID.CODE_LENGTH, '0');
        this.challenges.set(shortUuid, {
            hash: this.hashCode(code),
            createdAt: now,
            attempts: 0,
            userUuid,
        });
        return { ok: true, code, ttlSec: HWID.CODE_TTL_MS / 1000 };
    }

    // Returns whether a NEW block was triggered by this failure.
    private recordFailure(ip: string, shortUuid: string, now: number, countIp = true): boolean {
        let triggered = false;
        if (countIp && !this.mapAtCapacity(this.ipFails, ip)) {
            const n = this.pushWindow(this.ipFails, ip, now);
            const activeUntil = this.ipBlockUntil.get(ip) ?? 0;
            if (n >= HWID.FAIL_THRESHOLD && activeUntil <= now) {
                this.ipBlockUntil.set(ip, now + HWID.BLOCK_MS);
                triggered = true;
            }
        }
        if (!this.mapAtCapacity(this.subFails, shortUuid)) {
            const n = this.pushWindow(this.subFails, shortUuid, now);
            const activeUntil = this.subBlockUntil.get(shortUuid) ?? 0;
            if (n >= HWID.FAIL_THRESHOLD && activeUntil <= now) {
                this.subBlockUntil.set(shortUuid, now + HWID.BLOCK_MS);
                triggered = true;
            }
        }
        return triggered;
    }

    verifyCode(
        shortUuid: string,
        code: string,
        now: number,
        ip = '__ip_unknown_on_verify__',
    ):
        | { ok: true; token: string; userUuid: string }
        | { ok: false; reason: 'blocked' | 'no_challenge' | 'wrong'; blockTriggered: boolean } {
        this.sweep(now);

        if (this.isBlocked(ip, shortUuid, now)) {
            return { ok: false, reason: 'blocked', blockTriggered: false };
        }

        const challenge = this.challenges.get(shortUuid);
        if (!challenge || now - challenge.createdAt >= HWID.CODE_TTL_MS) {
            if (challenge) this.challenges.delete(shortUuid);
            return { ok: false, reason: 'no_challenge', blockTriggered: false };
        }

        const submitted = this.hashCode(code);
        const match =
            submitted.length === challenge.hash.length &&
            timingSafeEqual(submitted, challenge.hash);

        if (!match) {
            challenge.attempts += 1;
            const blockTriggered = this.recordFailure(ip, shortUuid, now);
            if (challenge.attempts >= HWID.MAX_CODE_ATTEMPTS) {
                this.challenges.delete(shortUuid);
            }
            return { ok: false, reason: 'wrong', blockTriggered };
        }

        // Success: consume the challenge, mint a management session.
        this.challenges.delete(shortUuid);
        const token = nanoid(32);
        this.sessions.set(token, {
            shortUuid,
            userUuid: challenge.userUuid,
            sessionId: '',
            expiresAt: now + HWID.SESSION_TTL_MS,
        });
        return { ok: true, token, userUuid: challenge.userUuid };
    }

    bindSession(token: string, sessionId: string): void {
        const s = this.sessions.get(token);
        if (s) s.sessionId = sessionId;
    }

    getSession(
        token: string,
        now: number,
    ): { shortUuid: string; userUuid: string; sessionId: string } | null {
        const s = this.sessions.get(token);
        if (!s || s.expiresAt <= now) {
            if (s) this.sessions.delete(token);
            return null;
        }
        return { shortUuid: s.shortUuid, userUuid: s.userUuid, sessionId: s.sessionId };
    }

    dropSession(token: string, _now: number): void {
        this.sessions.delete(token);
    }

    sweep(now: number): void {
        if (now - this.lastSweep < HWID.SWEEP_INTERVAL_MS) return;
        this.lastSweep = now;

        for (const [k, c] of this.challenges) {
            if (now - c.createdAt >= HWID.CODE_TTL_MS) this.challenges.delete(k);
        }
        for (const [k, s] of this.sessions) {
            if (s.expiresAt <= now) this.sessions.delete(k);
        }
        for (const [k, until] of this.ipBlockUntil) if (until <= now) this.ipBlockUntil.delete(k);
        for (const [k, until] of this.subBlockUntil) if (until <= now) this.subBlockUntil.delete(k);
        for (const [k, arr] of this.ipFails) {
            const live = arr.filter((ts) => now - ts < HWID.FAIL_WINDOW_MS);
            live.length ? this.ipFails.set(k, live) : this.ipFails.delete(k);
        }
        for (const [k, arr] of this.subFails) {
            const live = arr.filter((ts) => now - ts < HWID.FAIL_WINDOW_MS);
            live.length ? this.subFails.set(k, live) : this.subFails.delete(k);
        }
    }
}
```

> Note: the `!(this.ipBlockUntil.get(ip)! > now)` expressions rely on `undefined > now` being `false`, so a missing entry is treated as "not blocked" — correct. The `sweep` early-return means the very first call in a test with a large `now` still runs (lastSweep starts at 0), matching the test timestamps.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest hwid-challenge.store -v`
Expected: PASS — all specs green.

- [ ] **Step 5: Commit**

```bash
cd backend && npm run lint:fix && npm run format
cd .. && git add backend/src/modules/hwid-devices/hwid-challenge.store.ts \
  backend/src/modules/hwid-devices/hwid-challenge.store.spec.ts
git commit -m "feat(hwid): challenge/session store with codes, blocks, bounded state (tested)"
```

---

### Task 3: TelegramNotifierService

**Files:**
- Create: `backend/src/modules/hwid-devices/telegram-notifier.service.ts`

**Interfaces:**
- Consumes: `ConfigService` (`TELEGRAM_BOT_TOKEN`), `sanitizeUsername` from `@common/utils`.
- Produces:
  ```typescript
  class TelegramNotifierService {
    get isEnabled(): boolean;
    sendCode(chatId: string, username: string, ip: string, code: string): Promise<boolean>;
    notifyDeleted(chatId: string, username: string, ip: string, deviceLabel: string): Promise<boolean>;
    notifyDeletedAll(chatId: string, username: string, ip: string, count: number): Promise<boolean>;
    notifyBlocked(chatId: string, username: string, ip: string): Promise<boolean>;
  }
  ```

- [ ] **Step 1: Verify `sanitizeUsername` exists and its signature**

Run: `cd backend && grep -n "export.*sanitizeUsername" src/common/utils/*.ts src/common/utils/**/*.ts`
Expected: a line exporting `sanitizeUsername(username: string): string` (already imported by root.service.ts).

- [ ] **Step 2: Implement the notifier**

Create `backend/src/modules/hwid-devices/telegram-notifier.service.ts`:

```typescript
import axios, { AxiosError, AxiosInstance } from 'axios';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { sanitizeUsername } from '@common/utils';

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
                // Plain text: no parse_mode. Username is also sanitized as defense-in-depth.
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
            `🔐 Запрос на управление устройствами подписки ${u}.\n` +
            `IP: ${ip}\nКод: ${code}\nДействителен 5 минут. Если это не вы — проигнорируйте.\n\n` +
            `🔐 Device management requested for ${u}.\n` +
            `IP: ${ip}\nCode: ${code}\nValid for 5 minutes. If this wasn't you, ignore this message.`;
        return this.send(chatId, text);
    }

    notifyDeleted(chatId: string, username: string, ip: string, deviceLabel: string): Promise<boolean> {
        const u = sanitizeUsername(username);
        const text =
            `📱 Устройство удалено (${u}): ${deviceLabel}. IP инициатора: ${ip}.\n\n` +
            `📱 Device removed (${u}): ${deviceLabel}. Initiator IP: ${ip}.`;
        return this.send(chatId, text);
    }

    notifyDeletedAll(chatId: string, username: string, ip: string, count: number): Promise<boolean> {
        const u = sanitizeUsername(username);
        const text =
            `📱 Удалены все устройства (${u}): ${count} шт. IP инициатора: ${ip}.\n\n` +
            `📱 All devices removed (${u}): ${count}. Initiator IP: ${ip}.`;
        return this.send(chatId, text);
    }

    notifyBlocked(chatId: string, username: string, ip: string): Promise<boolean> {
        const u = sanitizeUsername(username);
        const text =
            `⚠️ Неудачные попытки управления устройствами подписки ${u}. ` +
            `IP ${ip} заблокирован на 10 минут.\n\n` +
            `⚠️ Failed device-management attempts for ${u}. IP ${ip} blocked for 10 minutes.`;
        return this.send(chatId, text);
    }
}
```

- [ ] **Step 3: Verify build**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
cd backend && npm run lint:fix && npm run format
cd .. && git add backend/src/modules/hwid-devices/telegram-notifier.service.ts
git commit -m "feat(hwid): Telegram notifier with leak-safe logging and plain-text messages"
```

---

### Task 4: AxiosService HWID panel methods

**Files:**
- Modify: `backend/src/common/axios/axios.service.ts`

**Interfaces:**
- Consumes: existing `this.axiosInstance`, `ICommandResponse`.
- Produces on `AxiosService`:
  ```typescript
  getUserHwidDevices(userUuid: string): Promise<ICommandResponse<GetUserHwidDevicesCommand.Response>>;
  deleteUserHwidDevice(userUuid: string, hwid: string): Promise<ICommandResponse<DeleteUserHwidDeviceCommand.Response>>;
  deleteAllUserHwidDevices(userUuid: string): Promise<ICommandResponse<DeleteAllUserHwidDevicesCommand.Response>>;
  ```

- [ ] **Step 1: Add the imports**

In `axios.service.ts`, extend the `@remnawave/backend-contract` import list (alphabetical, matching existing style) with:

```typescript
    DeleteAllUserHwidDevicesCommand,
    DeleteUserHwidDeviceCommand,
    GetUserHwidDevicesCommand,
```

- [ ] **Step 2: Add the three methods**

Append inside the `AxiosService` class (after `getSubscription`, before the closing brace):

```typescript
    public async getUserHwidDevices(
        userUuid: string,
    ): Promise<ICommandResponse<GetUserHwidDevicesCommand.Response>> {
        try {
            const response = await this.axiosInstance.request<GetUserHwidDevicesCommand.Response>({
                method: GetUserHwidDevicesCommand.endpointDetails.REQUEST_METHOD,
                url: GetUserHwidDevicesCommand.url(encodeURIComponent(userUuid)),
            });
            return { isOk: true, response: response.data };
        } catch (error) {
            if (error instanceof AxiosError) {
                this.logger.error('Error in GetUserHwidDevices Request:', error.message);
            } else {
                this.logger.error('Error in GetUserHwidDevices Request:', error);
            }
            return { isOk: false };
        }
    }

    public async deleteUserHwidDevice(
        userUuid: string,
        hwid: string,
    ): Promise<ICommandResponse<DeleteUserHwidDeviceCommand.Response>> {
        try {
            const response = await this.axiosInstance.request<DeleteUserHwidDeviceCommand.Response>({
                method: DeleteUserHwidDeviceCommand.endpointDetails.REQUEST_METHOD,
                url: DeleteUserHwidDeviceCommand.url,
                data: { userUuid, hwid },
            });
            return { isOk: true, response: response.data };
        } catch (error) {
            if (error instanceof AxiosError) {
                this.logger.error('Error in DeleteUserHwidDevice Request:', error.message);
            } else {
                this.logger.error('Error in DeleteUserHwidDevice Request:', error);
            }
            return { isOk: false };
        }
    }

    public async deleteAllUserHwidDevices(
        userUuid: string,
    ): Promise<ICommandResponse<DeleteAllUserHwidDevicesCommand.Response>> {
        try {
            const response =
                await this.axiosInstance.request<DeleteAllUserHwidDevicesCommand.Response>({
                    method: DeleteAllUserHwidDevicesCommand.endpointDetails.REQUEST_METHOD,
                    url: DeleteAllUserHwidDevicesCommand.url,
                    data: { userUuid },
                });
            return { isOk: true, response: response.data };
        } catch (error) {
            if (error instanceof AxiosError) {
                this.logger.error('Error in DeleteAllUserHwidDevices Request:', error.message);
            } else {
                this.logger.error('Error in DeleteAllUserHwidDevices Request:', error);
            }
            return { isOk: false };
        }
    }
```

- [ ] **Step 3: Verify build**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json`
Expected: exits 0 (confirms the contract exports resolve and `endpointDetails.REQUEST_METHOD` types line up).

- [ ] **Step 4: Commit**

```bash
cd backend && npm run lint:fix && npm run format
cd .. && git add backend/src/common/axios/axios.service.ts
git commit -m "feat(hwid): axios wrappers for panel HWID device endpoints"
```

---

### Task 5: HwidDevicesService (orchestration)

**Files:**
- Create: `backend/src/modules/hwid-devices/hwid-devices.service.ts`

**Interfaces:**
- Consumes: `ConfigService`, `AxiosService` (Task 4), `HwidChallengeStore` (Task 2), `TelegramNotifierService` (Task 3), `HWID` constants.
- Produces:
  ```typescript
  interface StatusResult { enabled: boolean; telegramLinked: boolean; deviceCount: number; deviceLimit: number | null }
  interface DeviceDto { hwid: string; platform: string | null; osVersion: string | null; deviceModel: string | null; createdAt: string }
  class HwidDevicesService {
    get isEnabled(): boolean;
    getStatus(shortUuid: string): Promise<StatusResult>;
    requestChallenge(shortUuid: string, ip: string):
      Promise<{ ok: true; ttlSec: number; cooldownSec: number } | { ok: false; reason: 'cooldown' | 'not_linked' | 'tg_send_failed' | 'blocked' | 'unavailable'; cooldownSec?: number }>;
    verify(shortUuid: string, code: string, ip: string, sessionId: string):
      Promise<{ ok: true; token: string } | { ok: false }>;
    listDevices(token: string, sessionId: string, sub: string): Promise<{ ok: true; devices: DeviceDto[]; total: number; limit: number | null } | { ok: false; status: number }>;
    deleteDevice(token: string, sessionId: string, sub: string, hwid: string, ip: string): Promise<{ ok: true; devices: DeviceDto[]; total: number; limit: number | null } | { ok: false; status: number }>;
    deleteAll(token: string, sessionId: string, sub: string, ip: string): Promise<{ ok: true; devices: DeviceDto[]; total: number; limit: number | null } | { ok: false; status: number }>;
  }
  ```

- [ ] **Step 1: Implement the service**

Create `backend/src/modules/hwid-devices/hwid-devices.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AxiosService } from '@common/axios/axios.service';

import { TelegramNotifierService } from './telegram-notifier.service';
import { HwidChallengeStore } from './hwid-challenge.store';
import { HWID } from './hwid-devices.constants';

interface StatusResult {
    enabled: boolean;
    telegramLinked: boolean;
    deviceCount: number;
    deviceLimit: number | null;
}

export interface DeviceDto {
    hwid: string;
    platform: string | null;
    osVersion: string | null;
    deviceModel: string | null;
    createdAt: string;
}

interface UserCtx {
    uuid: string;
    username: string;
    telegramId: number | null;
    hwidDeviceLimit: number | null;
}

interface StatusCacheEntry {
    at: number;
    value: StatusResult;
}

@Injectable()
export class HwidDevicesService {
    private readonly logger = new Logger(HwidDevicesService.name);
    private readonly store: HwidChallengeStore;
    private readonly statusCache = new Map<string, StatusCacheEntry>();

    constructor(
        private readonly configService: ConfigService,
        private readonly axiosService: AxiosService,
        private readonly telegram: TelegramNotifierService,
    ) {
        this.store = new HwidChallengeStore(this.configService.getOrThrow<string>('INTERNAL_JWT_SECRET'));
    }

    get isEnabled(): boolean {
        return this.telegram.isEnabled;
    }

    private now(): number {
        return Date.now();
    }

    private async fetchUser(shortUuid: string): Promise<UserCtx | null> {
        const res = await this.axiosService.getUserByShortUuid(shortUuid);
        if (!res.isOk || !res.response) return null;
        const u = res.response.response;
        return {
            uuid: u.uuid,
            username: u.username,
            telegramId: u.telegramId ?? null,
            hwidDeviceLimit: u.hwidDeviceLimit ?? null,
        };
    }

    private toDeviceDtos(
        devices: { hwid: string; platform: string | null; osVersion: string | null; deviceModel: string | null; createdAt: Date }[],
    ): DeviceDto[] {
        return devices.map((d) => ({
            hwid: d.hwid,
            platform: d.platform,
            osVersion: d.osVersion,
            deviceModel: d.deviceModel,
            createdAt: (d.createdAt instanceof Date ? d.createdAt : new Date(d.createdAt)).toISOString(),
        }));
    }

    async getStatus(shortUuid: string): Promise<StatusResult> {
        const cached = this.statusCache.get(shortUuid);
        if (cached && this.now() - cached.at < HWID.STATUS_CACHE_TTL_MS) {
            return cached.value;
        }

        const user = await this.fetchUser(shortUuid);
        if (!user) {
            // Uniform "not linked, zero devices" shape — do not reveal whether the user exists.
            const value: StatusResult = { enabled: true, telegramLinked: false, deviceCount: 0, deviceLimit: null };
            return value;
        }

        let deviceCount = 0;
        const devicesRes = await this.axiosService.getUserHwidDevices(user.uuid);
        if (devicesRes.isOk && devicesRes.response) {
            deviceCount = devicesRes.response.response.total;
        }

        const value: StatusResult = {
            enabled: true,
            telegramLinked: user.telegramId !== null,
            deviceCount,
            deviceLimit: user.hwidDeviceLimit,
        };
        if (this.statusCache.size < HWID.MAP_MAX_KEYS) {
            this.statusCache.set(shortUuid, { at: this.now(), value });
        }
        return value;
    }

    async requestChallenge(
        shortUuid: string,
        ip: string,
    ): Promise<
        | { ok: true; ttlSec: number; cooldownSec: number }
        | { ok: false; reason: 'cooldown' | 'not_linked' | 'tg_send_failed' | 'blocked' | 'unavailable'; cooldownSec?: number }
    > {
        const now = this.now();
        if (this.store.isBlocked(ip, shortUuid, now)) {
            return { ok: false, reason: 'blocked' };
        }

        const user = await this.fetchUser(shortUuid);
        if (!user) return { ok: false, reason: 'unavailable' };
        if (user.telegramId === null) return { ok: false, reason: 'not_linked' };

        const created = this.store.createChallenge(shortUuid, user.uuid, now);
        if (!created.ok) {
            if (created.reason === 'cooldown') {
                return { ok: false, reason: 'cooldown', cooldownSec: created.cooldownSec };
            }
            return { ok: false, reason: 'unavailable' };
        }

        const sent = await this.telegram.sendCode(String(user.telegramId), user.username, ip, created.code);
        if (!sent) {
            // The code never reached the user; the challenge simply stays until it expires
            // or the cooldown lets them retry. Nothing to roll back (no session was created).
            return { ok: false, reason: 'tg_send_failed' };
        }
        return { ok: true, ttlSec: created.ttlSec, cooldownSec: HWID.COOLDOWN_MS / 1000 };
    }

    async verify(
        shortUuid: string,
        code: string,
        ip: string,
        sessionId: string,
    ): Promise<{ ok: true; token: string } | { ok: false }> {
        const now = this.now();
        const result = this.store.verifyCode(shortUuid, code, now, ip);
        if (!result.ok) {
            if (result.blockTriggered) {
                // Fire-and-forget owner notification; do not block the response.
                void this.notifyBlockedOwner(shortUuid, ip);
            }
            return { ok: false };
        }
        this.store.bindSession(result.token, sessionId);
        return { ok: true, token: result.token };
    }

    private async notifyBlockedOwner(shortUuid: string, ip: string): Promise<void> {
        const user = await this.fetchUser(shortUuid);
        if (user && user.telegramId !== null) {
            await this.telegram.notifyBlocked(String(user.telegramId), user.username, ip);
        }
    }

    private resolveSession(token: string, sessionId: string, sub: string) {
        const session = this.store.getSession(token, this.now());
        if (!session) return null;
        if (session.shortUuid !== sub || session.sessionId !== sessionId) return null;
        return session;
    }

    async listDevices(token: string, sessionId: string, sub: string) {
        const session = this.resolveSession(token, sessionId, sub);
        if (!session) return { ok: false as const, status: 403 };
        const res = await this.axiosService.getUserHwidDevices(session.userUuid);
        if (!res.isOk || !res.response) return { ok: false as const, status: 502 };
        return this.buildListResult(sub, res.response.response);
    }

    async deleteDevice(token: string, sessionId: string, sub: string, hwid: string, ip: string) {
        const session = this.resolveSession(token, sessionId, sub);
        if (!session) return { ok: false as const, status: 403 };
        // Label for the owner notification, resolved from the pre-delete list.
        const before = await this.axiosService.getUserHwidDevices(session.userUuid);
        const target = before.isOk
            ? before.response?.response.devices.find((d) => d.hwid === hwid)
            : undefined;
        const res = await this.axiosService.deleteUserHwidDevice(session.userUuid, hwid);
        if (!res.isOk || !res.response) return { ok: false as const, status: 502 };
        this.statusCache.delete(sub);
        void this.notifyDeviceRemoved(sub, ip, target);
        return this.buildListResult(sub, res.response.response);
    }

    async deleteAll(token: string, sessionId: string, sub: string, ip: string) {
        const session = this.resolveSession(token, sessionId, sub);
        if (!session) return { ok: false as const, status: 403 };
        const res = await this.axiosService.deleteAllUserHwidDevices(session.userUuid);
        if (!res.isOk || !res.response) return { ok: false as const, status: 502 };
        this.statusCache.delete(sub);
        const remaining = res.response.response.total;
        void this.notifyAllRemoved(sub, ip, remaining);
        return this.buildListResult(sub, res.response.response);
    }

    private async buildListResult(
        sub: string,
        payload: { total: number; devices: { hwid: string; platform: string | null; osVersion: string | null; deviceModel: string | null; createdAt: Date }[] },
    ) {
        const user = await this.fetchUser(sub);
        return {
            ok: true as const,
            devices: this.toDeviceDtos(payload.devices),
            total: payload.total,
            limit: user?.hwidDeviceLimit ?? null,
        };
    }

    private async notifyDeviceRemoved(
        sub: string,
        ip: string,
        device?: { platform: string | null; deviceModel: string | null },
    ): Promise<void> {
        const user = await this.fetchUser(sub);
        if (!user || user.telegramId === null) return;
        const label = [device?.platform, device?.deviceModel].filter(Boolean).join(' ') || 'unknown device';
        await this.telegram.notifyDeleted(String(user.telegramId), user.username, ip, label);
    }

    private async notifyAllRemoved(sub: string, ip: string, remaining: number): Promise<void> {
        const user = await this.fetchUser(sub);
        if (!user || user.telegramId === null) return;
        await this.telegram.notifyDeletedAll(String(user.telegramId), user.username, ip, remaining);
    }
}
```

> Note: on a Telegram send failure no session exists yet and the challenge is keyed by `shortUuid`; it stays until it expires or the 60 s cooldown lets the user retry. Because the code never left the server successfully, the user simply cannot verify — acceptable. If immediate re-request (bypassing cooldown) is wanted later, add a `dropChallenge(shortUuid)` to the store; not required now (YAGNI).

- [ ] **Step 2: Verify build**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json`
Expected: exits 0. If `res.response.response.devices[].createdAt` typing complains, the `toDeviceDtos` `instanceof Date` guard handles both `Date` and string; keep the signature as written.

- [ ] **Step 3: Commit**

```bash
cd backend && npm run lint:fix && npm run format
cd .. && git add backend/src/modules/hwid-devices/hwid-devices.service.ts
git commit -m "feat(hwid): device-management orchestration service"
```

---

### Task 6: HwidDevicesController (endpoints + guards)

**Files:**
- Create: `backend/src/modules/hwid-devices/hwid-devices.controller.ts`

**Interfaces:**
- Consumes: `HwidDevicesService` (Task 5), `@GetJWTPayload()` → `IJwtPayload` (`{ sessionId, su, sub? }`), `@ClientIp()`, `HWID.COOKIE_NAME`.
- Produces: routes `GET /api/devices/status`, `POST /api/devices/challenge`, `POST /api/devices/verify`, `GET /api/devices`, `POST /api/devices/delete`, `POST /api/devices/delete-all`.

- [ ] **Step 1: Implement the controller**

Create `backend/src/modules/hwid-devices/hwid-devices.controller.ts`:

```typescript
import { Request, Response } from 'express';

import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';

import { GetJWTPayload } from '@common/decorators/get-jwt-payload';
import { ClientIp } from '@common/decorators/get-ip';
import { IJwtPayload } from '@common/constants';

import { HwidDevicesService } from './hwid-devices.service';
import { HWID } from './hwid-devices.constants';

@Controller('api/devices')
export class HwidDevicesController {
    constructor(private readonly service: HwidDevicesService) {}

    private noStore(res: Response): void {
        res.setHeader('Cache-Control', 'no-store, private');
    }

    // Reject when the feature is disabled or the session lacks a bound shortUuid.
    private guard(user: IJwtPayload | undefined, res: Response): user is IJwtPayload {
        if (!this.service.isEnabled) {
            res.status(404).send('Not Found');
            return false;
        }
        if (!user || !user.sub) {
            res.status(403).send('Forbidden');
            return false;
        }
        return true;
    }

    @Get('status')
    async status(@GetJWTPayload() user: IJwtPayload, @Res() res: Response): Promise<void> {
        this.noStore(res);
        if (!this.guard(user, res)) return;
        const result = await this.service.getStatus(user.sub!);
        res.status(200).json(result);
    }

    @Post('challenge')
    async challenge(
        @GetJWTPayload() user: IJwtPayload,
        @ClientIp() ip: string,
        @Res() res: Response,
    ): Promise<void> {
        this.noStore(res);
        if (!this.guard(user, res)) return;
        const result = await this.service.requestChallenge(user.sub!, ip);
        if (!result.ok) {
            const status = result.reason === 'blocked' || result.reason === 'cooldown' ? 429 : 502;
            res.status(status).json({ ok: false, reason: result.reason, cooldownSec: result.cooldownSec });
            return;
        }
        res.status(200).json({ ok: true, ttlSec: result.ttlSec, cooldownSec: result.cooldownSec });
    }

    @Post('verify')
    async verify(
        @GetJWTPayload() user: IJwtPayload,
        @ClientIp() ip: string,
        @Body() body: { code?: unknown },
        @Res() res: Response,
    ): Promise<void> {
        this.noStore(res);
        if (!this.guard(user, res)) return;
        const code = typeof body?.code === 'string' ? body.code.trim() : '';
        if (!new RegExp(`^\\d{${HWID.CODE_LENGTH}}$`).test(code)) {
            // Uniform failure — do not distinguish "malformed" from "wrong".
            res.status(200).json({ ok: false });
            return;
        }
        const result = await this.service.verify(user.sub!, code, ip, user.sessionId);
        if (!result.ok) {
            res.status(200).json({ ok: false });
            return;
        }
        res.cookie(HWID.COOKIE_NAME, result.token, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            maxAge: HWID.SESSION_TTL_MS,
        });
        res.status(200).json({ ok: true });
    }

    @Get()
    async list(
        @GetJWTPayload() user: IJwtPayload,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<void> {
        this.noStore(res);
        if (!this.guard(user, res)) return;
        const token = String(req.cookies?.[HWID.COOKIE_NAME] ?? '');
        const result = await this.service.listDevices(token, user.sessionId, user.sub!);
        if (!result.ok) {
            res.status(result.status).json({ ok: false });
            return;
        }
        res.status(200).json({ ok: true, devices: result.devices, total: result.total, limit: result.limit });
    }

    @Post('delete')
    async delete(
        @GetJWTPayload() user: IJwtPayload,
        @ClientIp() ip: string,
        @Req() req: Request,
        @Body() body: { hwid?: unknown },
        @Res() res: Response,
    ): Promise<void> {
        this.noStore(res);
        if (!this.guard(user, res)) return;
        const hwid = typeof body?.hwid === 'string' ? body.hwid : '';
        if (!hwid) {
            res.status(400).json({ ok: false });
            return;
        }
        const token = String(req.cookies?.[HWID.COOKIE_NAME] ?? '');
        const result = await this.service.deleteDevice(token, user.sessionId, user.sub!, hwid, ip);
        if (!result.ok) {
            res.status(result.status).json({ ok: false });
            return;
        }
        res.status(200).json({ ok: true, devices: result.devices, total: result.total, limit: result.limit });
    }

    @Post('delete-all')
    async deleteAll(
        @GetJWTPayload() user: IJwtPayload,
        @ClientIp() ip: string,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<void> {
        this.noStore(res);
        if (!this.guard(user, res)) return;
        const token = String(req.cookies?.[HWID.COOKIE_NAME] ?? '');
        const result = await this.service.deleteAll(token, user.sessionId, user.sub!, ip);
        if (!result.ok) {
            res.status(result.status).json({ ok: false });
            return;
        }
        res.status(200).json({ ok: true, devices: result.devices, total: result.total, limit: result.limit });
    }
}
```

- [ ] **Step 2: Verify build**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json`
Expected: exits 0. (Confirm `IJwtPayload` has `sessionId` and `sub?` — it does, per `jwt-payload.interface.ts`.)

- [ ] **Step 3: Commit**

```bash
cd backend && npm run lint:fix && npm run format
cd .. && git add backend/src/modules/hwid-devices/hwid-devices.controller.ts
git commit -m "feat(hwid): device-management controller with IDOR + session guards"
```

---

### Task 7: Wiring — module, middleware, global-prefix exclude

**Files:**
- Create: `backend/src/modules/hwid-devices/hwid-devices.module.ts`
- Modify: `backend/src/modules/subscription-page-backend.modules.ts`
- Modify: `backend/src/common/middlewares/check-assets-cookie.middleware.ts`
- Modify: `backend/src/main.ts`

**Interfaces:**
- Consumes: all Task 3/5/6 classes; `AxiosService` (global via AxiosModule), `ConfigService` (global).
- Produces: `HwidDevicesModule` registered so `/api/devices/*` routes are live and JWT-guarded.

- [ ] **Step 1: Create the module**

Create `backend/src/modules/hwid-devices/hwid-devices.module.ts`:

```typescript
import { Module } from '@nestjs/common';

import { TelegramNotifierService } from './telegram-notifier.service';
import { HwidDevicesController } from './hwid-devices.controller';
import { HwidDevicesService } from './hwid-devices.service';

@Module({
    controllers: [HwidDevicesController],
    providers: [HwidDevicesService, TelegramNotifierService],
})
export class HwidDevicesModule {}
```

> `AxiosService` and `ConfigService` are provided globally (AxiosModule is `@Global()`, ConfigModule is global), so no `imports` are needed. If `tsc`/Nest reports `AxiosService` cannot be resolved at runtime, add `imports: [AxiosModule]` importing from `@common/axios/axios.module`.

- [ ] **Step 2: Register the module**

Read `backend/src/modules/subscription-page-backend.modules.ts` and add `HwidDevicesModule` to its `imports` array alongside `RootModule`:

```typescript
import { HwidDevicesModule } from './hwid-devices/hwid-devices.module';
// ...
@Module({
    imports: [RootModule, HwidDevicesModule],
})
```

- [ ] **Step 3: Guard `/api/devices/*` in the cookie middleware**

In `check-assets-cookie.middleware.ts`, extend the `if` condition to include the devices prefix:

```typescript
    if (
        req.path.startsWith('/assets') ||
        req.path.startsWith('/locales') ||
        req.path === '/api/pay' ||
        req.path === '/api/pay/reset' ||
        req.path.startsWith('/api/devices')
    ) {
```

- [ ] **Step 4: Exclude device routes from the global prefix**

In `main.ts`, extend the `setGlobalPrefix` exclude list so device routes stay at `/api/devices/*` regardless of `CUSTOM_SUB_PREFIX` (matching the middleware's absolute-path check):

```typescript
    app.setGlobalPrefix(customSubPrefix, {
        exclude: [
            APP_CONFIG_ROUTE_WO_LEADING_PATH,
            'api/pay',
            'api/pay/reset',
            'api/devices/status',
            'api/devices/challenge',
            'api/devices/verify',
            'api/devices',
            'api/devices/delete',
            'api/devices/delete-all',
        ],
    });
```

- [ ] **Step 5: Verify build and full test suite**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json && npm run build && npm test`
Expected: tsc 0, nest build succeeds, jest suite (store spec) passes.

- [ ] **Step 6: Manual middleware sanity check (no session cookie → socket destroyed)**

Run:

```bash
cd backend && node -e "
const { checkAssetsCookieMiddleware } = require('./dist/src/common/middlewares/check-assets-cookie.middleware');
process.env.INTERNAL_JWT_SECRET='x';
let destroyed=false;
const req={path:'/api/devices/status', cookies:{}};
const res={socket:{destroy:()=>{destroyed=true;}}};
checkAssetsCookieMiddleware(req,res,()=>{});
console.log('destroyed on missing cookie:', destroyed);
"
```

Expected: prints `destroyed on missing cookie: true`.

- [ ] **Step 7: Commit**

```bash
cd backend && npm run lint:fix && npm run format
cd .. && git add backend/src/modules/hwid-devices/hwid-devices.module.ts \
  backend/src/modules/subscription-page-backend.modules.ts \
  backend/src/common/middlewares/check-assets-cookie.middleware.ts \
  backend/src/main.ts
git commit -m "feat(hwid): wire module, JWT-guard /api/devices, exclude from global prefix"
```

---

### Task 8: Inject `enabled` flag into the page (server → browser)

**Files:**
- Modify: `backend/src/modules/root/root.service.ts` (`returnWebpage`)
- Modify: `frontend/index.html`

**Interfaces:**
- Consumes: `TELEGRAM_BOT_TOKEN` presence.
- Produces: `res.render('index', { ..., hwidData })` where `hwidData` is base64 of `{ enabled: boolean }`; `#hwid` div in HTML.

- [ ] **Step 1: Compute and pass `hwidData` in `returnWebpage`**

In `root.service.ts` `returnWebpage`, just before the `res.render('index', {...})` call, add:

```typescript
            const hwidData = Buffer.from(
                JSON.stringify({ enabled: Boolean(this.configService.get<string>('TELEGRAM_BOT_TOKEN')) }),
            ).toString('base64');
```

Then add `hwidData,` to the object passed to `res.render('index', { ... })`.

- [ ] **Step 2: Add the `#hwid` div to the template**

In `frontend/index.html`, after the `#sup` div (line 42), add:

```html
        <div id="hwid" data-hwid="<%- hwidData %>"></div>
```

- [ ] **Step 3: Verify backend build**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
cd backend && npm run lint:fix && npm run format
cd .. && git add backend/src/modules/root/root.service.ts frontend/index.html
git commit -m "feat(hwid): expose feature-enabled flag to the subscription page"
```

---

## PHASE 2 — FRONTEND

### Task 9: devices-store + read `#hwid` div

**Files:**
- Create: `frontend/src/entities/devices-store/devices-store.ts`
- Create: `frontend/src/entities/devices-store/index.ts`
- Modify: `frontend/src/app/layouts/root/root.layout.tsx`

**Interfaces:**
- Produces:
  ```typescript
  interface IDevice { hwid: string; platform: string | null; osVersion: string | null; deviceModel: string | null; createdAt: string }
  useDevicesEnabled(): boolean
  useDevicesStoreActions(): { setEnabled(v: boolean): void }
  ```

- [ ] **Step 1: Create the store**

Create `frontend/src/entities/devices-store/devices-store.ts`:

```typescript
import { create } from 'zustand'

export interface IDevice {
    hwid: string
    platform: string | null
    osVersion: string | null
    deviceModel: string | null
    createdAt: string
}

interface IState {
    enabled: boolean
}

interface IActions {
    actions: {
        setEnabled: (v: boolean) => void
    }
}

const initialState: IState = {
    enabled: false
}

export const useDevicesStore = create<IActions & IState>()((set) => ({
    ...initialState,
    actions: {
        setEnabled: (v: boolean) => {
            set({ enabled: v })
        }
    }
}))

export const useDevicesStoreActions = () => useDevicesStore((store) => store.actions)

export const useDevicesEnabled = () => useDevicesStore((state) => state.enabled)
```

- [ ] **Step 2: Create the barrel**

Create `frontend/src/entities/devices-store/index.ts`:

```typescript
export * from './devices-store'
```

- [ ] **Step 3: Read the `#hwid` div in the layout**

In `root.layout.tsx`: add the import near the other entity-store imports:

```typescript
import { useDevicesStoreActions } from '@entities/devices-store'
```

Inside `RootLayout`, near the other `const ...Actions = use...Actions()` lines, add:

```typescript
    const devicesActions = useDevicesStoreActions()
```

Inside the `useLayoutEffect`, after the `#sup` block (right before `const fetchConfig = ...`), add:

```typescript
        const hwidDiv = document.getElementById('hwid')
        if (hwidDiv) {
            const hwidData = hwidDiv.dataset.hwid ?? ''
            if (hwidData) {
                try {
                    const parsed = JSON.parse(atob(hwidData))
                    devicesActions.setEnabled(parsed?.enabled === true)
                } catch {
                    consola.error('Failed to parse hwid config')
                }
            }
            hwidDiv.remove()
        }
```

- [ ] **Step 4: Verify typecheck**

Run: `cd frontend && npm run typecheck`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
cd frontend && npm run prettier:write && npm run lint:eslint
cd .. && git add frontend/src/entities/devices-store frontend/src/app/layouts/root/root.layout.tsx
git commit -m "feat(hwid): devices store and feature-flag hydration from page"
```

---

### Task 10: i18n strings

**Files:**
- Create: `frontend/src/widgets/main/devices/devices.i18n.ts`

**Interfaces:**
- Produces: `getDeviceStrings(lang: string): IDeviceStrings`.

- [ ] **Step 1: Create the i18n file**

Create `frontend/src/widgets/main/devices/devices.i18n.ts`:

```typescript
type Lang = 'en' | 'fa' | 'fr' | 'ru' | 'zh'

export interface IDeviceStrings {
    title: string
    manage: string
    linkTelegramHint: string
    devicesCount: (n: number, limit: number | null) => string
    sendCode: string
    codeSentTo: string
    enterCode: string
    verify: string
    resend: (sec: number) => string
    sessionEndsIn: (mmss: string) => string
    delete: string
    deleteAll: string
    confirmDeleteAllTitle: string
    confirmDeleteAllBody: string
    empty: string
    added: string
    errorGeneric: string
    errorBlocked: string
    errorNotLinked: string
    errorTgSend: string
    close: string
    cancel: string
}

const STRINGS: Record<Lang, IDeviceStrings> = {
    en: {
        title: 'Devices',
        manage: 'Manage devices',
        linkTelegramHint: 'Link Telegram to your subscription to manage devices',
        devicesCount: (n, limit) => (limit ? `${n} of ${limit} devices` : `${n} devices`),
        sendCode: 'Send code to Telegram',
        codeSentTo: 'We sent a 6-digit code to your Telegram.',
        enterCode: 'Enter the code',
        verify: 'Confirm',
        resend: (sec) => (sec > 0 ? `Resend in ${sec}s` : 'Resend code'),
        sessionEndsIn: (mmss) => `Session ends in ${mmss}`,
        delete: 'Remove',
        deleteAll: 'Remove all devices',
        confirmDeleteAllTitle: 'Remove all devices',
        confirmDeleteAllBody: 'Remove every device from this subscription?',
        empty: 'No devices',
        added: 'Added',
        errorGeneric: 'Something went wrong. Try again later.',
        errorBlocked: 'Too many attempts. Try again in 10 minutes.',
        errorNotLinked: 'Telegram is not linked to this subscription.',
        errorTgSend: 'Could not send the code. Try again later.',
        close: 'Close',
        cancel: 'Cancel'
    },
    ru: {
        title: 'Устройства',
        manage: 'Управлять устройствами',
        linkTelegramHint: 'Привяжите Telegram к подписке, чтобы управлять устройствами',
        devicesCount: (n, limit) => (limit ? `${n} из ${limit} устройств` : `${n} устройств`),
        sendCode: 'Отправить код в Telegram',
        codeSentTo: 'Мы отправили 6-значный код в ваш Telegram.',
        enterCode: 'Введите код',
        verify: 'Подтвердить',
        resend: (sec) => (sec > 0 ? `Повтор через ${sec}с` : 'Отправить код повторно'),
        sessionEndsIn: (mmss) => `Сессия завершится через ${mmss}`,
        delete: 'Удалить',
        deleteAll: 'Удалить все устройства',
        confirmDeleteAllTitle: 'Удаление всех устройств',
        confirmDeleteAllBody: 'Удалить все устройства из этой подписки?',
        empty: 'Устройств нет',
        added: 'Добавлено',
        errorGeneric: 'Что-то пошло не так. Попробуйте позже.',
        errorBlocked: 'Слишком много попыток. Повторите через 10 минут.',
        errorNotLinked: 'Telegram не привязан к этой подписке.',
        errorTgSend: 'Не удалось отправить код. Попробуйте позже.',
        close: 'Закрыть',
        cancel: 'Отмена'
    },
    zh: {
        title: '设备',
        manage: '管理设备',
        linkTelegramHint: '请将 Telegram 绑定到订阅以管理设备',
        devicesCount: (n, limit) => (limit ? `${n} / ${limit} 台设备` : `${n} 台设备`),
        sendCode: '发送验证码到 Telegram',
        codeSentTo: '我们已向您的 Telegram 发送 6 位验证码。',
        enterCode: '输入验证码',
        verify: '确认',
        resend: (sec) => (sec > 0 ? `${sec} 秒后重发` : '重新发送验证码'),
        sessionEndsIn: (mmss) => `会话将在 ${mmss} 后结束`,
        delete: '移除',
        deleteAll: '移除所有设备',
        confirmDeleteAllTitle: '移除所有设备',
        confirmDeleteAllBody: '移除此订阅的所有设备？',
        empty: '没有设备',
        added: '添加于',
        errorGeneric: '出错了，请稍后再试。',
        errorBlocked: '尝试次数过多，请 10 分钟后再试。',
        errorNotLinked: '此订阅未绑定 Telegram。',
        errorTgSend: '无法发送验证码，请稍后再试。',
        close: '关闭',
        cancel: '取消'
    },
    fa: {
        title: 'دستگاه‌ها',
        manage: 'مدیریت دستگاه‌ها',
        linkTelegramHint: 'برای مدیریت دستگاه‌ها تلگرام را به اشتراک خود متصل کنید',
        devicesCount: (n, limit) => (limit ? `${n} از ${limit} دستگاه` : `${n} دستگاه`),
        sendCode: 'ارسال کد به تلگرام',
        codeSentTo: 'کد ۶ رقمی به تلگرام شما ارسال شد.',
        enterCode: 'کد را وارد کنید',
        verify: 'تأیید',
        resend: (sec) => (sec > 0 ? `ارسال مجدد در ${sec} ثانیه` : 'ارسال مجدد کد'),
        sessionEndsIn: (mmss) => `جلسه در ${mmss} پایان می‌یابد`,
        delete: 'حذف',
        deleteAll: 'حذف همه دستگاه‌ها',
        confirmDeleteAllTitle: 'حذف همه دستگاه‌ها',
        confirmDeleteAllBody: 'همه دستگاه‌ها از این اشتراک حذف شوند؟',
        empty: 'دستگاهی نیست',
        added: 'افزوده‌شده',
        errorGeneric: 'مشکلی پیش آمد. بعداً دوباره تلاش کنید.',
        errorBlocked: 'تلاش بیش از حد. ۱۰ دقیقه دیگر تلاش کنید.',
        errorNotLinked: 'تلگرام به این اشتراک متصل نیست.',
        errorTgSend: 'ارسال کد ممکن نشد. بعداً تلاش کنید.',
        close: 'بستن',
        cancel: 'لغو'
    },
    fr: {
        title: 'Appareils',
        manage: 'Gérer les appareils',
        linkTelegramHint: 'Liez Telegram à votre abonnement pour gérer les appareils',
        devicesCount: (n, limit) => (limit ? `${n} sur ${limit} appareils` : `${n} appareils`),
        sendCode: 'Envoyer le code sur Telegram',
        codeSentTo: 'Nous avons envoyé un code à 6 chiffres sur votre Telegram.',
        enterCode: 'Saisissez le code',
        verify: 'Confirmer',
        resend: (sec) => (sec > 0 ? `Renvoyer dans ${sec}s` : 'Renvoyer le code'),
        sessionEndsIn: (mmss) => `La session se termine dans ${mmss}`,
        delete: 'Supprimer',
        deleteAll: 'Supprimer tous les appareils',
        confirmDeleteAllTitle: 'Supprimer tous les appareils',
        confirmDeleteAllBody: 'Supprimer tous les appareils de cet abonnement ?',
        empty: 'Aucun appareil',
        added: 'Ajouté',
        errorGeneric: 'Une erreur est survenue. Réessayez plus tard.',
        errorBlocked: 'Trop de tentatives. Réessayez dans 10 minutes.',
        errorNotLinked: "Telegram n'est pas lié à cet abonnement.",
        errorTgSend: "Impossible d'envoyer le code. Réessayez plus tard.",
        close: 'Fermer',
        cancel: 'Annuler'
    }
}

export function getDeviceStrings(lang: string): IDeviceStrings {
    return STRINGS[lang as Lang] ?? STRINGS.en
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd frontend && npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
cd frontend && npm run prettier:write && npm run lint:eslint
cd .. && git add frontend/src/widgets/main/devices/devices.i18n.ts
git commit -m "feat(hwid): device-management i18n strings"
```

---

### Task 11: Frontend device API client

**Files:**
- Create: `frontend/src/widgets/main/devices/devices-api.ts`

**Interfaces:**
- Consumes: `IDevice` from `@entities/devices-store`, `ofetch`.
- Produces:
  ```typescript
  fetchStatus(): Promise<{ enabled: boolean; telegramLinked: boolean; deviceCount: number; deviceLimit: number | null }>
  requestChallenge(): Promise<{ ok: boolean; reason?: string; cooldownSec?: number }>
  verifyCode(code: string): Promise<{ ok: boolean }>
  fetchDevices(): Promise<{ ok: boolean; devices: IDevice[]; total: number; limit: number | null; status?: number }>
  deleteDevice(hwid: string): Promise<{ ok: boolean; devices: IDevice[]; total: number; limit: number | null; status?: number }>
  deleteAllDevices(): Promise<{ ok: boolean; devices: IDevice[]; total: number; limit: number | null; status?: number }>
  ```

- [ ] **Step 1: Implement the client**

Create `frontend/src/widgets/main/devices/devices-api.ts`:

```typescript
import { ofetch } from 'ofetch'

import { IDevice } from '@entities/devices-store'

// Same-origin requests; the session cookie and hwid_mgmt cookie ride along automatically.
const base = '/api/devices'

interface ListPayload {
    ok: boolean
    devices?: IDevice[]
    total?: number
    limit?: number | null
    status?: number
}

const normalizeList = (payload: ListPayload, status: number) => ({
    ok: Boolean(payload?.ok),
    devices: Array.isArray(payload?.devices) ? payload.devices : [],
    total: typeof payload?.total === 'number' ? payload.total : 0,
    limit: typeof payload?.limit === 'number' ? payload.limit : null,
    status
})

export async function fetchStatus() {
    return ofetch<{ enabled: boolean; telegramLinked: boolean; deviceCount: number; deviceLimit: number | null }>(
        `${base}/status?v=${Date.now()}`,
        { credentials: 'same-origin' }
    )
}

export async function requestChallenge() {
    return ofetch<{ ok: boolean; reason?: string; cooldownSec?: number }>(`${base}/challenge`, {
        method: 'POST',
        credentials: 'same-origin',
        // ofetch does not throw for our JSON error bodies if we ignore non-2xx; capture them:
        ignoreResponseError: true
    })
}

export async function verifyCode(code: string) {
    return ofetch<{ ok: boolean }>(`${base}/verify`, {
        method: 'POST',
        credentials: 'same-origin',
        body: { code },
        ignoreResponseError: true
    })
}

export async function fetchDevices() {
    let status = 0
    const payload = await ofetch<ListPayload>(`${base}?v=${Date.now()}`, {
        credentials: 'same-origin',
        ignoreResponseError: true,
        onResponse({ response }) {
            status = response.status
        }
    })
    return normalizeList(payload, status)
}

export async function deleteDevice(hwid: string) {
    let status = 0
    const payload = await ofetch<ListPayload>(`${base}/delete`, {
        method: 'POST',
        credentials: 'same-origin',
        body: { hwid },
        ignoreResponseError: true,
        onResponse({ response }) {
            status = response.status
        }
    })
    return normalizeList(payload, status)
}

export async function deleteAllDevices() {
    let status = 0
    const payload = await ofetch<ListPayload>(`${base}/delete-all`, {
        method: 'POST',
        credentials: 'same-origin',
        ignoreResponseError: true,
        onResponse({ response }) {
            status = response.status
        }
    })
    return normalizeList(payload, status)
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd frontend && npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
cd frontend && npm run prettier:write && npm run lint:eslint
cd .. && git add frontend/src/widgets/main/devices/devices-api.ts
git commit -m "feat(hwid): frontend device API client"
```

---

### Task 12: DevicesButton card widget

**Files:**
- Create: `frontend/src/widgets/main/devices/devices-button.widget.tsx`
- Create: `frontend/src/widgets/main/devices/index.ts`
- Modify: `frontend/src/widgets/main/index.ts`
- Modify: `frontend/src/widgets/main/subscription-info/subscription-info-cards.widget.tsx`

**Interfaces:**
- Consumes: `useDevicesEnabled`, `useSubscription`, `useTranslation`, `getDeviceStrings`, `fetchStatus`, `openDevicesModal` (Task 13).
- Produces: `<DevicesButton />` mounted under the info cards.

- [ ] **Step 1: Implement the widget**

Create `frontend/src/widgets/main/devices/devices-button.widget.tsx`:

```typescript
import { IconDevices } from '@tabler/icons-react'
import { Button, Group, Text } from '@mantine/core'
import { useEffect, useState } from 'react'

import { useDevicesEnabled } from '@entities/devices-store'
import { useTranslation } from '@shared/hooks'
import { vibrate } from '@shared/utils/vibrate'

import { openDevicesModal } from './devices-modal'
import { getDeviceStrings } from './devices.i18n'
import { fetchStatus } from './devices-api'

export const DevicesButton = () => {
    const enabled = useDevicesEnabled()
    const { currentLang } = useTranslation()
    const s = getDeviceStrings(currentLang)

    const [telegramLinked, setTelegramLinked] = useState<boolean | null>(null)
    const [deviceCount, setDeviceCount] = useState<number>(0)
    const [deviceLimit, setDeviceLimit] = useState<number | null>(null)

    useEffect(() => {
        if (!enabled) return
        let cancelled = false
        fetchStatus()
            .then((status) => {
                if (cancelled) return
                setTelegramLinked(status.telegramLinked)
                setDeviceCount(status.deviceCount)
                setDeviceLimit(status.deviceLimit)
            })
            .catch(() => {
                if (!cancelled) setTelegramLinked(false)
            })
        return () => {
            cancelled = true
        }
    }, [enabled])

    if (!enabled) return null

    const handleClick = () => {
        vibrate('tap')
        openDevicesModal(currentLang)
    }

    const countLabel = s.devicesCount(deviceCount, deviceLimit)

    return (
        <Button
            fullWidth
            color="cyan"
            disabled={telegramLinked === false}
            leftSection={<IconDevices size={18} />}
            onClick={handleClick}
            radius="md"
            size="md"
            variant="light"
        >
            <Group gap="xs" justify="space-between" wrap="nowrap" w="100%">
                <Text fw={600} size="sm">
                    {telegramLinked === false ? s.linkTelegramHint : `${s.manage} · ${countLabel}`}
                </Text>
            </Group>
        </Button>
    )
}
```

- [ ] **Step 2: Create the widget barrel**

Create `frontend/src/widgets/main/devices/index.ts`:

```typescript
export * from './devices-button.widget'
```

- [ ] **Step 3: Export from the main widgets barrel**

In `frontend/src/widgets/main/index.ts`, add:

```typescript
export * from './devices'
```

- [ ] **Step 4: Mount under the info cards**

In `subscription-info-cards.widget.tsx`: add the import beside the `ResetTrafficButton` import:

```typescript
import { DevicesButton } from '@widgets/main/devices'
```

Then, in the returned JSX, add `<DevicesButton />` right after `<ResetTrafficButton />`:

```typescript
            <ResetTrafficButton />
            <DevicesButton />
```

> If the `@widgets/main/devices` alias import creates a circular import warning (cards widget is itself under `widgets/main`), import via the relative path instead: `import { DevicesButton } from '../../devices'`.

- [ ] **Step 5: Verify typecheck (modal not yet created — expect one missing-module error)**

Run: `cd frontend && npm run typecheck`
Expected: FAIL only with "Cannot find module './devices-modal'" — this is resolved in Task 13. Do not commit yet.

- [ ] **Step 6: (Deferred commit)** — commit together with Task 13 once the modal exists and typecheck passes.

---

### Task 13: Management modal (send code → verify → device list)

**Files:**
- Create: `frontend/src/widgets/main/devices/devices-modal.tsx`

**Interfaces:**
- Consumes: `@mantine/modals`, `@mantine/core` (`PinInput`, `Button`, `Stack`, `Text`, `Group`, `Badge`, `ActionIcon`, `Loader`), `@mantine/notifications`, API client (Task 11), i18n (Task 10), `IDevice`.
- Produces: `openDevicesModal(lang: string): void`.

- [ ] **Step 1: Implement the modal**

Create `frontend/src/widgets/main/devices/devices-modal.tsx`:

```typescript
import { IconDeviceMobile, IconTrash } from '@tabler/icons-react'
import { ActionIcon, Badge, Button, Group, Loader, PinInput, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useEffect, useRef, useState } from 'react'
import { modals } from '@mantine/modals'

import { IDevice } from '@entities/devices-store'

import {
    deleteAllDevices,
    deleteDevice,
    fetchDevices,
    requestChallenge,
    verifyCode
} from './devices-api'
import { getDeviceStrings, IDeviceStrings } from './devices.i18n'

const SESSION_SECONDS = 600

function mmss(total: number): string {
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${m}:${String(s).padStart(2, '0')}`
}

type Step = 'intro' | 'code' | 'list'

function DevicesFlow({ s }: { s: IDeviceStrings }) {
    const [step, setStep] = useState<Step>('intro')
    const [busy, setBusy] = useState(false)
    const [cooldown, setCooldown] = useState(0)
    const [code, setCode] = useState('')
    const [devices, setDevices] = useState<IDevice[]>([])
    const [limit, setLimit] = useState<number | null>(null)
    const [sessionLeft, setSessionLeft] = useState(SESSION_SECONDS)
    const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null)
    const sessionTimer = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        return () => {
            if (cooldownTimer.current) clearInterval(cooldownTimer.current)
            if (sessionTimer.current) clearInterval(sessionTimer.current)
        }
    }, [])

    const startCooldown = (sec: number) => {
        setCooldown(sec)
        if (cooldownTimer.current) clearInterval(cooldownTimer.current)
        cooldownTimer.current = setInterval(() => {
            setCooldown((c) => {
                if (c <= 1 && cooldownTimer.current) clearInterval(cooldownTimer.current)
                return c > 0 ? c - 1 : 0
            })
        }, 1000)
    }

    const startSessionCountdown = () => {
        setSessionLeft(SESSION_SECONDS)
        if (sessionTimer.current) clearInterval(sessionTimer.current)
        sessionTimer.current = setInterval(() => {
            setSessionLeft((v) => {
                if (v <= 1) {
                    if (sessionTimer.current) clearInterval(sessionTimer.current)
                    setStep('intro') // session expired → back to start
                    return 0
                }
                return v - 1
            })
        }, 1000)
    }

    const onSendCode = async () => {
        setBusy(true)
        try {
            const res = await requestChallenge()
            if (res.ok) {
                setStep('code')
                startCooldown(res.cooldownSec ?? 60)
            } else if (res.reason === 'cooldown') {
                setStep('code')
                startCooldown(res.cooldownSec ?? 60)
            } else if (res.reason === 'blocked') {
                notifications.show({ color: 'red', message: s.errorBlocked })
            } else if (res.reason === 'not_linked') {
                notifications.show({ color: 'red', message: s.errorNotLinked })
            } else if (res.reason === 'tg_send_failed') {
                notifications.show({ color: 'red', message: s.errorTgSend })
            } else {
                notifications.show({ color: 'red', message: s.errorGeneric })
            }
        } finally {
            setBusy(false)
        }
    }

    const loadDevices = async () => {
        const res = await fetchDevices()
        if (res.ok) {
            setDevices(res.devices)
            setLimit(res.limit)
            return true
        }
        return false
    }

    const onVerify = async (value: string) => {
        setBusy(true)
        try {
            const res = await verifyCode(value)
            if (!res.ok) {
                notifications.show({ color: 'red', message: s.errorGeneric })
                setCode('')
                return
            }
            const loaded = await loadDevices()
            if (loaded) {
                setStep('list')
                startSessionCountdown()
            } else {
                notifications.show({ color: 'red', message: s.errorGeneric })
            }
        } finally {
            setBusy(false)
        }
    }

    const onDelete = async (hwid: string) => {
        setBusy(true)
        try {
            const res = await deleteDevice(hwid)
            if (res.ok) {
                setDevices(res.devices)
                setLimit(res.limit)
            } else if (res.status === 403) {
                setStep('intro')
            } else {
                notifications.show({ color: 'red', message: s.errorGeneric })
            }
        } finally {
            setBusy(false)
        }
    }

    const onDeleteAll = () => {
        modals.openConfirmModal({
            centered: true,
            title: s.confirmDeleteAllTitle,
            children: <Text size="sm">{s.confirmDeleteAllBody}</Text>,
            labels: { confirm: s.deleteAll, cancel: s.cancel },
            confirmProps: { color: 'red' },
            onConfirm: async () => {
                setBusy(true)
                try {
                    const res = await deleteAllDevices()
                    if (res.ok) {
                        setDevices(res.devices)
                        setLimit(res.limit)
                    } else if (res.status === 403) {
                        setStep('intro')
                    } else {
                        notifications.show({ color: 'red', message: s.errorGeneric })
                    }
                } finally {
                    setBusy(false)
                }
            }
        })
    }

    if (step === 'intro') {
        return (
            <Stack gap="md">
                <Text size="sm">{s.codeSentTo}</Text>
                <Button color="cyan" loading={busy} onClick={onSendCode} radius="md" size="md">
                    {s.sendCode}
                </Button>
            </Stack>
        )
    }

    if (step === 'code') {
        return (
            <Stack align="center" gap="md">
                <Text size="sm">{s.enterCode}</Text>
                <PinInput
                    length={6}
                    oneTimeCode
                    type="number"
                    inputType="tel"
                    value={code}
                    onChange={setCode}
                    onComplete={onVerify}
                />
                <Button
                    disabled={cooldown > 0 || busy}
                    onClick={onSendCode}
                    size="xs"
                    variant="subtle"
                >
                    {s.resend(cooldown)}
                </Button>
            </Stack>
        )
    }

    return (
        <Stack gap="sm">
            <Group justify="flex-end">
                <Badge color="cyan" variant="light">
                    {s.sessionEndsIn(mmss(sessionLeft))}
                </Badge>
            </Group>
            {devices.length === 0 ? (
                <Text c="dimmed" size="sm" ta="center">
                    {s.empty}
                </Text>
            ) : (
                devices.map((d) => (
                    <Group key={d.hwid} gap="sm" justify="space-between" wrap="nowrap">
                        <Group gap="xs" style={{ minWidth: 0 }} wrap="nowrap">
                            <IconDeviceMobile size={18} style={{ flexShrink: 0 }} />
                            <Stack gap={0} style={{ minWidth: 0 }}>
                                <Text fw={600} size="sm" truncate>
                                    {[d.deviceModel, d.platform].filter(Boolean).join(' · ') ||
                                        d.hwid}
                                </Text>
                                <Text c="dimmed" size="xs" truncate>
                                    {[d.osVersion, `${s.added}: ${d.createdAt.slice(0, 10)}`]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </Text>
                            </Stack>
                        </Group>
                        <ActionIcon
                            color="red"
                            disabled={busy}
                            onClick={() => onDelete(d.hwid)}
                            variant="light"
                        >
                            <IconTrash size={18} />
                        </ActionIcon>
                    </Group>
                ))
            )}
            {devices.length > 0 && (
                <Button
                    color="red"
                    disabled={busy}
                    leftSection={<IconTrash size={16} />}
                    onClick={onDeleteAll}
                    variant="light"
                >
                    {s.deleteAll}
                </Button>
            )}
        </Stack>
    )
}

export function openDevicesModal(lang: string): void {
    const s = getDeviceStrings(lang)
    modals.open({
        title: s.title,
        centered: true,
        fullScreen: window.matchMedia('(max-width: 30rem)').matches,
        children: <DevicesFlow s={s} />
    })
}
```

> **Fallback if `PinInput` is unavailable** in the installed Mantine build: replace the `<PinInput .../>` with `<TextInput inputMode="numeric" maxLength={6} value={code} onChange={(e) => { const v = e.currentTarget.value.replace(/\D/g, '').slice(0, 6); setCode(v); if (v.length === 6) onVerify(v) }} />` and import `TextInput` instead of `PinInput`. Mantine v8.3.18 ships `PinInput`, so the primary path should work.

- [ ] **Step 2: Verify typecheck + build**

Run: `cd frontend && npm run typecheck && npm run start:build`
Expected: both exit 0 (this also resolves the Task 12 missing-module error).

- [ ] **Step 3: Commit (Tasks 12 + 13 together)**

```bash
cd frontend && npm run prettier:write && npm run lint:eslint
cd .. && git add frontend/src/widgets/main/devices frontend/src/widgets/main/index.ts \
  frontend/src/widgets/main/subscription-info/subscription-info-cards.widget.tsx
git commit -m "feat(hwid): device-management card widget and multi-step modal"
```

---

### Task 14: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Backend — typecheck, build, tests, lint**

Run:

```bash
cd backend && npx tsc --noEmit -p tsconfig.json && npm run build && npm test && npm run lint
```

Expected: all exit 0; jest suite green.

- [ ] **Step 2: Frontend — typecheck, lint, build**

Run:

```bash
cd frontend && npm run typecheck && npm run lint && npm run start:build
```

Expected: all exit 0.

- [ ] **Step 3: Spec-coverage self-check (manual)**

Confirm against the spec's hardening summary: P0-1 (Task 3 no-body logging), P0-2 (Task 5 `resolveSession` + Task 6 guard), P0-3 (Task 2 HKDF + timingSafeEqual), P0-4 (Task 8 only `{enabled}` in HTML), P0-5 (Task 7 middleware prefix + Task 6 feature-gate 404), P0-6 (Task 2 atomic `createChallenge`), S-1..S-7 (uniform responses, rate-limit/blocks, bounded maps, plain-text TG, timeout, config, `Cache-Control: no-store`). Note any gap.

- [ ] **Step 4: Final commit if any lint/format fixes were applied**

```bash
git add -A && git commit -m "chore(hwid): final formatting/lint pass" || echo "nothing to commit"
```

---

## Self-Review Notes

- **Spec coverage:** status/challenge/verify/list/delete/delete-all → Tasks 5–6; code hashing/blocks/atomicity → Task 2; Telegram → Task 3; panel wrappers → Task 4; wiring/middleware/prefix → Task 7; feature flag to page → Task 8; widget/modal/store/i18n/api → Tasks 9–13. Every P0/S item mapped in Task 14 Step 3.
- **Deviation from spec (documented):** `INTERNAL_JWT_SECRET ≥32` is a startup **warning**, not a hard schema failure, to avoid breaking existing installs; HKDF derivation makes the construction correct regardless (Task 1 Step 2).
- **Contract reality vs OpenAPI:** installed `GetUserHwidDevicesCommand` device shape has no `requestIp`/`firstConnectedAt`; deletion notices use the initiator IP only (Global Constraints + Task 3/5).
- **Type consistency:** `IJwtPayload` = `{ sessionId, su, sub? }` used identically in Tasks 5/6; `DeviceDto`/`IDevice` fields match across backend service and frontend store/api/modal; session binding uses `sessionId` end-to-end.
