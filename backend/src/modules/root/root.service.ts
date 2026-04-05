import { RawAxiosResponseHeaders } from 'axios';
import { AxiosResponseHeaders } from 'axios';
import { Request, Response } from 'express';
import { createHash, createHmac } from 'node:crypto';
import { nanoid } from 'nanoid';
import axios from 'axios';

import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';

import { TRequestTemplateTypeKeys } from '@remnawave/backend-contract';

import { AxiosService } from '@common/axios/axios.service';
import { WataService } from '@common/wata/wata.service';
import { IGNORED_HEADERS } from '@common/constants';
import { sanitizeUsername } from '@common/utils';

import { SubpageConfigService } from './subpage-config.service';

@Injectable()
export class RootService {
    private readonly logger = new Logger(RootService.name);

    private readonly isMarzbanLegacyLinkEnabled: boolean;
    private readonly marzbanSecretKeys: string[];
    private readonly mlDropRevokedSubscriptions: boolean;
    private readonly webhookRateMap = new Map<string, number[]>();
    private readonly WEBHOOK_RATE_LIMIT = 5;
    private readonly WEBHOOK_RATE_WINDOW_MS = 60_000;
    constructor(
        private readonly configService: ConfigService,
        private readonly jwtService: JwtService,
        private readonly axiosService: AxiosService,
        private readonly subpageConfigService: SubpageConfigService,
        private readonly wataService: WataService,
    ) {
        this.isMarzbanLegacyLinkEnabled = this.configService.getOrThrow<boolean>(
            'MARZBAN_LEGACY_LINK_ENABLED',
        );
        this.mlDropRevokedSubscriptions = this.configService.getOrThrow<boolean>(
            'MARZBAN_LEGACY_DROP_REVOKED_SUBSCRIPTIONS',
        );

        const marzbanSecretKeys = this.configService.get<string>('MARZBAN_LEGACY_SECRET_KEY');

        if (marzbanSecretKeys && marzbanSecretKeys.length > 0) {
            this.marzbanSecretKeys = marzbanSecretKeys.split(',').map((key) => key.trim());
        } else {
            this.marzbanSecretKeys = [];
        }
    }

    public async serveSubscriptionPage(
        clientIp: string,
        req: Request,
        res: Response,
        shortUuid: string,
        clientType?: TRequestTemplateTypeKeys,
    ): Promise<void> {
        try {
            const userAgent = req.headers['user-agent'];

            let shortUuidLocal = shortUuid;

            if (this.isGenericPath(req.path)) {
                res.socket?.destroy();
                return;
            }

            if (this.isMarzbanLegacyLinkEnabled) {
                const username = await this.tryDecodeMarzbanLink(shortUuid);

                if (username) {
                    const sanitizedUsername = sanitizeUsername(username.username);

                    this.logger.log(
                        `Decoded Marzban username: ${username.username}, sanitized username: ${sanitizedUsername}`,
                    );

                    const userInfo = await this.axiosService.getUserByUsername(
                        clientIp,
                        sanitizedUsername,
                    );
                    if (!userInfo.isOk || !userInfo.response) {
                        this.logger.error(
                            `Decoded Marzban username is not found in Remnawave, decoded username: ${sanitizedUsername}`,
                        );

                        res.socket?.destroy();
                        return;
                    } else if (
                        this.mlDropRevokedSubscriptions &&
                        userInfo.response.response.subRevokedAt !== null
                    ) {
                        res.socket?.destroy();
                        return;
                    }

                    shortUuidLocal = userInfo.response.response.shortUuid;
                }
            }

            if (userAgent && this.isBrowser(userAgent)) {
                return this.returnWebpage(clientIp, req, res, shortUuidLocal);
            }

            let subscriptionDataResponse: {
                response: unknown;
                headers: RawAxiosResponseHeaders | AxiosResponseHeaders;
            } | null = null;

            subscriptionDataResponse = await this.axiosService.getSubscription(
                clientIp,
                shortUuidLocal,
                req.headers,
                !!clientType,
                clientType,
            );

            if (!subscriptionDataResponse) {
                res.socket?.destroy();
                return;
            }

            if (subscriptionDataResponse.headers) {
                Object.entries(subscriptionDataResponse.headers)
                    .filter(([key]) => !IGNORED_HEADERS.has(key.toLowerCase()))
                    .forEach(([key, value]) => {
                        res.setHeader(key, value);
                    });
            }

            res.status(200).send(subscriptionDataResponse.response);
        } catch (error) {
            this.logger.error('Error in serveSubscriptionPage', error);

            res.socket?.destroy();
            return;
        }
    }

    private async resolvePaymentTariffs(
        shortUuid: string,
        staticPaymentUrl: string,
    ): Promise<{ tariffs: Array<{ months: number; amount: number; currency: string; url: string }>; staticUrl: string }> {
        const tariffs: Array<{ months: number; amount: number; currency: string; url: string }> = [];

        if (this.wataService.isEnabled) {
            const currency = this.configService.get<string>('WATA_CURRENCY') ?? 'RUB';
            const successRedirectUrl = this.configService.get<string>('WATA_SUCCESS_URL');
            const failRedirectUrl = this.configService.get<string>('WATA_FAIL_URL');

            const tariffConfigs = [
                { months: 1, envKey: 'WATA_TARIFF_1M' },
                { months: 3, envKey: 'WATA_TARIFF_3M' },
                { months: 6, envKey: 'WATA_TARIFF_6M' },
                { months: 12, envKey: 'WATA_TARIFF_12M' },
            ];

            const tariffPromises = tariffConfigs
                .map(({ months, envKey }) => {
                    const amount = this.configService.get<number>(envKey);
                    if (amount === undefined) return null;
                    return { months, amount, currency };
                })
                .filter(Boolean) as Array<{ months: number; amount: number; currency: string }>;

            const urlResults = await Promise.all(
                tariffPromises.map(async (tariff) => {
                    const url = await this.wataService.createOrder({
                        amount: tariff.amount,
                        currency: tariff.currency,
                        failRedirectUrl,
                        orderId: `${shortUuid}_${tariff.months}m`,
                        successRedirectUrl,
                    });
                    return url ? { ...tariff, url } : null;
                }),
            );

            for (const result of urlResults) {
                if (result) {
                    tariffs.push(result);
                }
            }

            if (tariffs.length === 0 && tariffPromises.length > 0) {
                this.logger.warn('Wata API returned no URLs for any tariff, falling back to static PAYMENT_URL');
            }
        }

        return { tariffs, staticUrl: staticPaymentUrl };
    }

    public isValidTariffMonths(months: number): boolean {
        const envKey = `WATA_TARIFF_${months}M`;
        return this.configService.get<number>(envKey) !== undefined;
    }

    public isValidTariffAmount(months: number, amount: number): boolean {
        const envKey = `WATA_TARIFF_${months}M`;
        const configuredAmount = this.configService.get<number>(envKey);
        return configuredAmount !== undefined && configuredAmount === amount;
    }

    public async sendPaymentWebhook(data: {
        orderId: string;
        months: number;
        amount: number;
        currency: string;
        shortUuid: string;
        username: string;
    }): Promise<{ ok: boolean; reason?: string }> {
        const webhookUrl = this.configService.get<string>('WATA_WEBHOOK_URL');
        if (!webhookUrl) {
            return { ok: false, reason: 'webhook_disabled' };
        }

        // Rate limiting per shortUuid
        const now = Date.now();
        const key = data.shortUuid;
        const timestamps = this.webhookRateMap.get(key) ?? [];
        const recent = timestamps.filter((ts) => now - ts < this.WEBHOOK_RATE_WINDOW_MS);

        if (recent.length >= this.WEBHOOK_RATE_LIMIT) {
            this.logger.warn(`Rate limit exceeded for ${key}`);
            return { ok: false, reason: 'rate_limited' };
        }

        recent.push(now);
        this.webhookRateMap.set(key, recent);

        const payload = {
            ...data,
            timestamp: new Date().toISOString(),
        };

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        // HMAC signature
        const secret = this.configService.get<string>('WATA_WEBHOOK_SECRET');
        if (secret) {
            const body = JSON.stringify(payload);
            const signature = createHmac('sha256', secret).update(body).digest('hex');
            headers['X-Webhook-Signature'] = signature;
        }

        try {
            await axios.post(webhookUrl, payload, {
                headers,
                timeout: 10_000,
            });
            this.logger.log(`Payment webhook sent for order ${data.orderId}`);
            return { ok: true };
        } catch (error) {
            this.logger.error(`Payment webhook failed for order ${data.orderId}: ${error}`);
            return { ok: false, reason: 'send_failed' };
        }
    }

    private generateJwtForCookie(uuid: string | null): string {
        return this.jwtService.sign(
            {
                sessionId: nanoid(32),
                su: this.subpageConfigService.getEncryptedSubpageConfigUuid(uuid),
            },
            {
                expiresIn: '33m',
            },
        );
    }

    private isBrowser(userAgent: string): boolean {
        const browserKeywords = [
            'Mozilla',
            'Chrome',
            'Safari',
            'Firefox',
            'Opera',
            'Edge',
            'TelegramBot',
            'WhatsApp',
        ];

        return browserKeywords.some((keyword) => userAgent.includes(keyword));
    }

    private isGenericPath(path: string): boolean {
        const genericPaths = [
            'favicon.ico',
            'robots.txt',
            '.png',
            '.jpg',
            '.jpeg',
            '.gif',
            '.svg',
            '.webp',
            '.ico',
        ];

        return genericPaths.some((genericPath) => path.includes(genericPath));
    }

    private async returnWebpage(
        clientIp: string,
        req: Request,
        res: Response,
        shortUuid: string,
    ): Promise<void> {
        try {
            const subscriptionDataResponse = await this.axiosService.getSubscriptionInfo(
                clientIp,
                shortUuid,
            );

            if (!subscriptionDataResponse.isOk || !subscriptionDataResponse.response) {
                res.socket?.destroy();
                return;
            }

            const subpageConfigResponse = await this.axiosService.getSubpageConfig(
                shortUuid,
                req.headers,
            );

            if (!subpageConfigResponse.isOk || !subpageConfigResponse.response) {
                res.socket?.destroy();
                return;
            }

            const subpageConfig = subpageConfigResponse.response;

            if (subpageConfig.webpageAllowed === false) {
                this.logger.log(`Webpage access is not allowed by Remnawave's SRR.`);
                res.socket?.destroy();
                return;
            }

            const baseSettings = this.subpageConfigService.getBaseSettings(
                subpageConfig.subpageConfigUuid,
            );

            const subscriptionData = subscriptionDataResponse.response;

            if (!baseSettings.showConnectionKeys) {
                subscriptionData.response.links = [];
                subscriptionData.response.ssConfLinks = {};
            }

            const { tariffs, staticUrl } = await this.resolvePaymentTariffs(shortUuid, baseSettings.paymentUrl);

            const paymentUrl = staticUrl;
            const paymentTariffs = tariffs.length > 0
                ? Buffer.from(JSON.stringify(tariffs)).toString('base64')
                : '';

            res.cookie('session', this.generateJwtForCookie(subpageConfig.subpageConfigUuid), {
                httpOnly: true,
                secure: true,
                maxAge: 1_800_000, // 30 minutes
            });

            res.render('index', {
                metaTitle: baseSettings.metaTitle,
                metaDescription: baseSettings.metaDescription,
                panelData: Buffer.from(JSON.stringify(subscriptionData)).toString('base64'),
                paymentUrl,
                paymentTariffs,
            });
        } catch (error) {
            this.logger.error('Error in returnWebpage', error);

            res.socket?.destroy();
            return;
        }
    }

    private async tryDecodeMarzbanLink(shortUuid: string): Promise<{
        username: string;
        createdAt: Date;
    } | null> {
        if (!this.marzbanSecretKeys.length) return null;

        const token = shortUuid;
        this.logger.debug(`Verifying token: ${token}`);

        if (!token || token.length < 10) {
            this.logger.debug(`Token too short: ${token}`);
            return null;
        }

        for (const key of this.marzbanSecretKeys) {
            const result = await this.decodeMarzbanLink(shortUuid, key);
            if (result) return result;

            this.logger.debug(`Decoding Marzban link failed with key: ${key}`);
        }

        this.logger.debug(`Decoding Marzban link failed with all keys`);

        return null;
    }

    private async decodeMarzbanLink(
        token: string,
        marzbanSecretKey: string,
    ): Promise<{
        username: string;
        createdAt: Date;
    } | null> {
        if (token.split('.').length === 3) {
            try {
                const payload = await this.jwtService.verifyAsync(token, {
                    secret: marzbanSecretKey,
                    algorithms: ['HS256'],
                });

                if (payload.access !== 'subscription') {
                    throw new Error('JWT access field is not subscription');
                }

                const jwtCreatedAt = new Date(payload.iat * 1000);

                if (!this.checkSubscriptionValidity(jwtCreatedAt, payload.sub)) {
                    return null;
                }

                this.logger.debug(`JWT verified successfully, ${JSON.stringify(payload)}`);

                return {
                    username: payload.sub,
                    createdAt: jwtCreatedAt,
                };
            } catch (err) {
                this.logger.debug(`JWT verification failed: ${err}`);
            }
        }

        const uToken = token.slice(0, token.length - 10);
        const uSignature = token.slice(token.length - 10);

        this.logger.debug(`Token parts: base: ${uToken}, signature: ${uSignature}`);

        let decoded: string;
        try {
            decoded = Buffer.from(uToken, 'base64url').toString();
        } catch (err) {
            this.logger.debug(`Base64 decode error: ${err}`);
            return null;
        }

        const hash = createHash('sha256');
        hash.update(uToken + marzbanSecretKey);
        const digest = hash.digest();

        const expectedSignature = Buffer.from(digest).toString('base64url').slice(0, 10);

        this.logger.debug(`Expected signature: ${expectedSignature}, actual: ${uSignature}`);

        if (uSignature !== expectedSignature) {
            this.logger.debug('Signature mismatch');
            return null;
        }

        const parts = decoded.split(',');
        if (parts.length < 2) {
            this.logger.debug(`Invalid token format: ${decoded}`);
            return null;
        }

        const username = parts[0];
        const createdAtInt = parseInt(parts[1], 10);

        if (isNaN(createdAtInt)) {
            this.logger.debug(`Invalid created_at timestamp: ${parts[1]}`);
            return null;
        }

        const createdAt = new Date(createdAtInt * 1000);

        if (!this.checkSubscriptionValidity(createdAt, username)) {
            return null;
        }

        this.logger.debug(`Token decoded. Username: ${username}, createdAt: ${createdAt}`);

        return {
            username,
            createdAt,
        };
    }

    private checkSubscriptionValidity(createdAt: Date, username: string): boolean {
        const validFrom = this.configService.get<string | undefined>(
            'MARZBAN_LEGACY_SUBSCRIPTION_VALID_FROM',
        );

        if (!validFrom) {
            return true;
        }

        const validFromDate = new Date(validFrom);
        if (createdAt < validFromDate) {
            this.logger.debug(
                `createdAt JWT: ${createdAt.toISOString()} is before validFrom: ${validFromDate.toISOString()}`,
            );

            this.logger.warn(
                `${JSON.stringify({ username, createdAt })} – subscription createdAt is before validFrom`,
            );

            return false;
        }

        return true;
    }
}
