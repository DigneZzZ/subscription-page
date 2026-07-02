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
    OPEN_ACTION_LIMIT: 10, // open-mode delete calls allowed per window per IP+sub
    OPEN_ACTION_WINDOW_MS: 60_000,
} as const;
