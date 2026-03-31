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

        PAYMENT_URL: z.optional(z.string()),

        WATA_API_KEY: z.optional(z.string()),
        WATA_AMOUNT: z
            .string()
            .transform((v) => parseFloat(v))
            .refine((v) => !isNaN(v), 'WATA_AMOUNT must be a valid number')
            .optional(),
        WATA_CURRENCY: z.string().default('RUB'),
        WATA_SUCCESS_URL: z.optional(z.string()),
        WATA_FAIL_URL: z.optional(z.string()),

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
        if (data.WATA_API_KEY && !data.WATA_AMOUNT) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'WATA_AMOUNT is required when WATA_API_KEY is set',
                path: ['WATA_AMOUNT'],
            });
        }
    });

export type ConfigSchema = z.infer<typeof configSchema>;
export class Env extends createZodDto(configSchema) {}
