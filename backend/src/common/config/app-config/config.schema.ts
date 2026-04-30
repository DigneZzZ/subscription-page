import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

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
                (v: string | undefined) =>
                    !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
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
            .refine(
                (v) => v === undefined || !isNaN(v),
                'TARIFF_12M must be a valid number',
            ),
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
        if (
            (data.WATA_API_KEY || data.PLATEGA_MERCHANT_ID || data.CARDLINK_API_KEY) &&
            !data.TARIFF_1M &&
            !data.TARIFF_3M &&
            !data.TARIFF_6M &&
            !data.TARIFF_12M
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message:
                    'At least one TARIFF (1M, 3M, 6M, or 12M) is required when a payment provider is enabled',
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
    });

export type ConfigSchema = z.infer<typeof configSchema>;
export class Env extends createZodDto(configSchema) {}
