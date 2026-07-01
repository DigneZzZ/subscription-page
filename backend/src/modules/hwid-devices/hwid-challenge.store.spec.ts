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
