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
