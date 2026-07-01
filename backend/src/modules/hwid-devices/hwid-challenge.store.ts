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
                // Transitively bounded: only reachable inside the gated ipFails branch above.
                this.ipBlockUntil.set(ip, now + HWID.BLOCK_MS);
                triggered = true;
            }
        }
        if (!this.mapAtCapacity(this.subFails, shortUuid)) {
            const n = this.pushWindow(this.subFails, shortUuid, now);
            const activeUntil = this.subBlockUntil.get(shortUuid) ?? 0;
            if (n >= HWID.FAIL_THRESHOLD && activeUntil <= now) {
                // Transitively bounded: only reachable inside the gated subFails branch above.
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
        // Bound the sessions map (global constraint: all in-memory maps are capacity-gated).
        // At capacity we refuse to mint a session rather than grow unbounded; the natural
        // TTL sweep frees slots. Reaching MAP_MAX_KEYS live sessions requires that many
        // successful verifications within the 10-min TTL, so this is a defensive backstop.
        if (this.sessions.size >= HWID.MAP_MAX_KEYS) {
            return { ok: false, reason: 'no_challenge', blockTriggered: false };
        }
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    dropSession(token: string, now: number): void {
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
            if (live.length) this.ipFails.set(k, live);
            else this.ipFails.delete(k);
        }
        for (const [k, arr] of this.subFails) {
            const live = arr.filter((ts) => now - ts < HWID.FAIL_WINDOW_MS);
            if (live.length) this.subFails.set(k, live);
            else this.subFails.delete(k);
        }
    }
}
