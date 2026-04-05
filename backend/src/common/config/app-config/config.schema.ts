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

        WATA_API_KEY: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? v : undefined)),
        WATA_TARIFF_1M: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? parseFloat(v) : undefined))
            .refine((v) => v === undefined || !isNaN(v), 'WATA_TARIFF_1M must be a valid number'),
        WATA_TARIFF_3M: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? parseFloat(v) : undefined))
            .refine((v) => v === undefined || !isNaN(v), 'WATA_TARIFF_3M must be a valid number'),
        WATA_TARIFF_6M: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? parseFloat(v) : undefined))
            .refine((v) => v === undefined || !isNaN(v), 'WATA_TARIFF_6M must be a valid number'),
        WATA_TARIFF_12M: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? parseFloat(v) : undefined))
            .refine(
                (v) => v === undefined || !isNaN(v),
                'WATA_TARIFF_12M must be a valid number',
            ),
        WATA_CURRENCY: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? v : 'RUB')),
        WATA_SUCCESS_URL: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? v : undefined)),
        WATA_FAIL_URL: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? v : undefined)),
        WATA_WEBHOOK_URL: z
            .string()
            .optional()
            .transform((v) => (v && v.length > 0 ? v : undefined)),
        WATA_WEBHOOK_SECRET: z
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
            data.WATA_API_KEY &&
            !data.WATA_TARIFF_1M &&
            !data.WATA_TARIFF_3M &&
            !data.WATA_TARIFF_6M &&
            !data.WATA_TARIFF_12M
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message:
                    'At least one WATA_TARIFF (1M, 3M, 6M, or 12M) is required when WATA_API_KEY is set',
                path: ['WATA_TARIFF_1M'],
            });
        }
    });

export type ConfigSchema = z.infer<typeof configSchema>;
export class Env extends createZodDto(configSchema) {}
