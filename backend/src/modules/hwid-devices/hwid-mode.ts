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
