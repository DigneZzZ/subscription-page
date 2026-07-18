import { createZodDto } from 'nestjs-zod';
import proxyaddr from 'proxy-addr';
import { z } from 'zod';

const TRUST_PROXY_DEFAULT = '1';

const isTrustProxy = (val: string): boolean => {
    if (val === 'true' || val === 'false' || /^\d+$/.test(val)) return true;

    try {
        proxyaddr.compile(val.split(',').map((entry) => entry.trim()));
        return true;
    } catch {
        return false;
    }
};

const REQUIRED_REMNAWAVE_API_TOKEN_MESSAGE =
    'Remnawave Dashboard → Remnawave Settings → API Tokens. Create a new API Token and set it in the .env file.';

export const configSchema = z
    .object({
        APP_PORT: z
            .string()
            .default('3010')
            .transform((port) => parseInt(port, 10)),
        REMNAWAVE_PANEL_URL: z.string(),
        REMNAWAVE_API_TOKEN: z
            .string({ message: REQUIRED_REMNAWAVE_API_TOKEN_MESSAGE })
            .min(1, REQUIRED_REMNAWAVE_API_TOKEN_MESSAGE),

        SUBPAGE_CONFIG_UUID: z.string().default('00000000-0000-0000-0000-000000000000'),
        CUSTOM_SUB_PREFIX: z.optional(z.string()),

        TRUST_PROXY: z
            .string()
            .default(TRUST_PROXY_DEFAULT)
            .transform((val) => (val.trim() === '' ? TRUST_PROXY_DEFAULT : val.trim()))
            .refine(
                isTrustProxy,
                'TRUST_PROXY must be "true"/"false", a non-negative integer (number of trusted ' +
                    'reverse-proxy hops), or a comma-separated list of preset names ' +
                    '(loopback, linklocal, uniquelocal) and/or IP addresses / CIDR subnets.',
            )
            .transform((val): boolean | number | string => {
                if (val === 'true') return true;
                if (val === 'false') return false;
                if (/^\d+$/.test(val)) return Number(val);
                return val;
            }),

        // Chatwoot live chat widget (optional)
        CHATWOOT_BASE_URL: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? v.replace(/\/+$/, '') : undefined)),
        CHATWOOT_WEBSITE_TOKEN: z.optional(z.string()),
        CHATWOOT_HMAC_SECRET: z.optional(z.string()),

        CADDY_AUTH_API_TOKEN: z.optional(z.string()),
        CLOUDFLARE_ZERO_TRUST_CLIENT_ID: z.optional(z.string()),
        CLOUDFLARE_ZERO_TRUST_CLIENT_SECRET: z.optional(z.string()),

        PAYMENT_URL: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? v : undefined)),

        SUPPORT_EMAIL: z
            .string()
            .optional()
            .refine(
                (v: string | undefined) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
                'SUPPORT_EMAIL must be a valid email address',
            )
            .transform((v: string | undefined) => (v && v.length > 0 ? v : undefined)),

        // Shared tariff settings
        TARIFF_1M: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? parseFloat(v) : undefined))
            .refine((v) => v === undefined || !isNaN(v), 'TARIFF_1M must be a valid number'),
        TARIFF_3M: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? parseFloat(v) : undefined))
            .refine((v) => v === undefined || !isNaN(v), 'TARIFF_3M must be a valid number'),
        TARIFF_6M: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? parseFloat(v) : undefined))
            .refine((v) => v === undefined || !isNaN(v), 'TARIFF_6M must be a valid number'),
        TARIFF_12M: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? parseFloat(v) : undefined))
            .refine((v) => v === undefined || !isNaN(v), 'TARIFF_12M must be a valid number'),
        TARIFF_CURRENCY: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? v : 'RUB')),
        PAYMENT_SUCCESS_URL: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? v : undefined)),
        PAYMENT_FAIL_URL: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? v : undefined)),

        // SHM billing integration. Master switch: when false (default), the legacy flow is used
        // (env TARIFF_* tariffs, gateway payment + PAYMENT_WEBHOOK_URL webhook, gateway reset).
        // When true (and SHM_TARIFFS_URL + SHM_TARIFF_CATEGORY are set), tariffs/payment/reset
        // are handled by SHM.
        SHM_INTEGRATION_ENABLED: z
            .string()
            .default('false')
            .transform((val) => val === 'true'),
        SHM_TARIFFS_URL: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? v : undefined)),
        SHM_TARIFF_CATEGORY: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? v : undefined)),

        // Wata payment gateway
        WATA_API_KEY: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? v : undefined)),

        // Platega payment gateway
        PLATEGA_MERCHANT_ID: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? v : undefined)),
        PLATEGA_SECRET: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? v : undefined)),

        // CardLink payment gateway
        CARDLINK_API_KEY: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? v : undefined)),
        CARDLINK_SHOP_ID: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? v : undefined)),
        CARDLINK_PAYER_PAYS_COMMISSION: z
            .string()
            .default('0')
            .transform((v) => (v === '1' ? 1 : 0)),

        // Webhook for payment notifications
        PAYMENT_WEBHOOK_URL: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? v : undefined)),
        PAYMENT_WEBHOOK_SECRET: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? v : undefined)),

        MARZBAN_LEGACY_LINK_ENABLED: z
            .string()
            .default('false')
            .transform((val) => val === 'true'),
        MARZBAN_LEGACY_SECRET_KEY: z.optional(z.string()),
        MARZBAN_LEGACY_SUBSCRIPTION_VALID_FROM: z.optional(z.string()),
        MARZBAN_LEGACY_DROP_REVOKED_SUBSCRIPTIONS: z
            .string()
            .default('false')
            .transform((val) => (val === '' ? 'false' : val))
            .refine((val) => val === 'true' || val === 'false', 'Must be "true" or "false".'),
        INTERNAL_JWT_SECRET: z.string(),
        EGAMES_COOKIE: z.optional(z.string()),

        // Telegram bot for HWID device-management confirmation codes.
        // Presence enables the "Devices" section on the subscription page.
        TELEGRAM_BOT_TOKEN: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? v : undefined)),

        // HWID management mode: telegram | open | disabled (off = disabled). Case-insensitive.
        // Unset → telegram if TELEGRAM_BOT_TOKEN is set, else disabled (see resolveHwidMode).
        HWID_MANAGEMENT_MODE: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? v.trim().toLowerCase() : undefined))
            .refine(
                (v) => v === undefined || ['disabled', 'off', 'open', 'telegram'].includes(v),
                'HWID_MANAGEMENT_MODE must be one of: telegram, open, disabled (or off)',
            ),

        // Price to reset a user's traffic. Presence (+ an enabled provider) shows the button.
        TRAFFIC_RESET_PRICE: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? parseFloat(v) : undefined))
            .refine(
                (v) => v === undefined || (!isNaN(v) && v > 0),
                'TRAFFIC_RESET_PRICE must be a positive number',
            ),

        // Minimum traffic-usage percentage (0–100) at which the reset button is shown.
        // 0 = always show; 100 = only when traffic is fully used (blocked). Default 0.
        TRAFFIC_RESET_MIN_PERCENT: z
            .string()
            .default('0')
            .transform((v) => (v && v.length > 0 ? parseInt(v, 10) : 0))
            .refine(
                (v) => Number.isInteger(v) && v >= 0 && v <= 100,
                'TRAFFIC_RESET_MIN_PERCENT must be an integer between 0 and 100',
            ),

        THEME_PRESET: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? v : undefined)),
        LAYOUT_PRESET: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? v : undefined)),
        PREVIEW: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? v : undefined)),
    })
    .superRefine((data, ctx) => {
        if (
            !data.REMNAWAVE_PANEL_URL.startsWith('http://') &&
            !data.REMNAWAVE_PANEL_URL.startsWith('https://')
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'REMNAWAVE_PANEL_URL must start with http:// or https://',
                path: ['REMNAWAVE_PANEL_URL'],
            });
        }
        if (data.MARZBAN_LEGACY_LINK_ENABLED === true) {
            if (!data.MARZBAN_LEGACY_SECRET_KEY) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message:
                        'MARZBAN_LEGACY_SECRET_KEY is required when MARZBAN_LEGACY_LINK_ENABLED is true',
                });
            }
        }
        const shmTariffsConfigured = Boolean(
            data.SHM_INTEGRATION_ENABLED && data.SHM_TARIFFS_URL && data.SHM_TARIFF_CATEGORY,
        );
        if (
            (data.WATA_API_KEY || data.PLATEGA_MERCHANT_ID || data.CARDLINK_API_KEY) &&
            !data.TARIFF_1M &&
            !data.TARIFF_3M &&
            !data.TARIFF_6M &&
            !data.TARIFF_12M &&
            !shmTariffsConfigured
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message:
                    'At least one TARIFF (1M, 3M, 6M, or 12M), or SHM tariffs ' +
                    '(SHM_TARIFFS_URL + SHM_TARIFF_CATEGORY), is required when a payment provider is enabled',
                path: ['TARIFF_1M'],
            });
        }
        if (data.PLATEGA_MERCHANT_ID && !data.PLATEGA_SECRET) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'PLATEGA_SECRET is required when PLATEGA_MERCHANT_ID is set',
                path: ['PLATEGA_SECRET'],
            });
        }
        if (data.CARDLINK_API_KEY && !data.CARDLINK_SHOP_ID) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'CARDLINK_SHOP_ID is required when CARDLINK_API_KEY is set',
                path: ['CARDLINK_SHOP_ID'],
            });
        }
        if (data.CARDLINK_SHOP_ID && !data.CARDLINK_API_KEY) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'CARDLINK_API_KEY is required when CARDLINK_SHOP_ID is set',
                path: ['CARDLINK_API_KEY'],
            });
        }
        if (data.TELEGRAM_BOT_TOKEN && data.INTERNAL_JWT_SECRET.length < 32) {
            // Not a hard failure (would break existing installs on upgrade), but the
            // HWID code HMAC key is HKDF-derived from this secret — short secrets weaken it.
            console.warn(
                '[SECURITY] INTERNAL_JWT_SECRET is shorter than 32 chars; use a longer secret ' +
                    'for stronger HWID verification-code hashing.',
            );
        }
        if (data.HWID_MANAGEMENT_MODE === 'telegram' && !data.TELEGRAM_BOT_TOKEN) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'HWID_MANAGEMENT_MODE=telegram requires TELEGRAM_BOT_TOKEN',
                path: ['HWID_MANAGEMENT_MODE'],
            });
        }
    });

export type ConfigSchema = z.infer<typeof configSchema>;
export class Env extends createZodDto(configSchema) {}
