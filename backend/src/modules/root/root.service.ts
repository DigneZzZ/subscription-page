import { Request, Response } from 'express';
import { createHash, createHmac, randomInt } from 'node:crypto';
import { nanoid } from 'nanoid';
import axios from 'axios';

import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';

import { TRequestTemplateTypeKeys } from '@remnawave/backend-contract';

import { AxiosService } from '@common/axios/axios.service';
import { CardLinkService } from '@common/cardlink/cardlink.service';
import { PlategaService } from '@common/platega/platega.service';
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
    private readonly RATE_MAP_MAX_KEYS = 10_000;
    private readonly RATE_SWEEP_INTERVAL_MS = 60_000;
    private lastRateSweep = 0;
    private static readonly RESET_PAYMENT_DESCRIPTION = 'Сброс трафика';
    constructor(
        private readonly configService: ConfigService,
        private readonly jwtService: JwtService,
        private readonly axiosService: AxiosService,
        private readonly subpageConfigService: SubpageConfigService,
        private readonly wataService: WataService,
        private readonly plategaService: PlategaService,
        private readonly cardLinkService: CardLinkService,
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

            const subscriptionDataResponse = await this.axiosService.getSubscription(
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
            return;
        } catch (error) {
            this.logger.error('Error in serveSubscriptionPage', error);

            res.socket?.destroy();
            return;
        }
    }

    public listAvailableTariffs(): Array<{ months: number; amount: number; currency: string }> {
        const currency = this.configService.get<string>('TARIFF_CURRENCY') ?? 'RUB';
        const tariffConfigs = [
            { months: 1, envKey: 'TARIFF_1M' },
            { months: 3, envKey: 'TARIFF_3M' },
            { months: 6, envKey: 'TARIFF_6M' },
            { months: 12, envKey: 'TARIFF_12M' },
        ];

        return tariffConfigs
            .map(({ months, envKey }) => {
                const amount = this.configService.get<number>(envKey);
                if (amount === undefined) return null;
                return { months, amount, currency };
            })
            .filter(Boolean) as Array<{ months: number; amount: number; currency: string }>;
    }

    public hasAnyPaymentProvider(): boolean {
        return (
            this.wataService.isEnabled ||
            this.plategaService.isEnabled ||
            this.cardLinkService.isEnabled
        );
    }

    public async createPaymentForTariff(
        shortUuid: string,
        months: number,
        sessionId: string,
    ): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
        if (!this.isValidTariffMonths(months)) {
            return { ok: false, reason: 'invalid_months' };
        }

        return this.createPayment(shortUuid, sessionId, { kind: 'subscription', months });
    }

    public async createTrafficResetPayment(
        shortUuid: string,
        sessionId: string,
    ): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
        if (!this.isTrafficResetEnabled()) {
            return { ok: false, reason: 'reset_disabled' };
        }

        return this.createPayment(shortUuid, sessionId, { kind: 'reset' });
    }

    public isTrafficResetEnabled(): boolean {
        const price = this.configService.get<number>('TRAFFIC_RESET_PRICE');
        return price !== undefined && price > 0 && this.hasAnyPaymentProvider();
    }

    private async createPayment(
        shortUuid: string,
        sessionId: string,
        product: { kind: 'subscription'; months: number } | { kind: 'reset' },
    ): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
        const currency = this.configService.get<string>('TARIFF_CURRENCY') ?? 'RUB';

        let amount: number | undefined;
        let orderToken: string;
        let description: string | undefined;
        let webhookType: 'SUBSCRIPTION' | 'TRAFFIC_RESET';
        let months: number | undefined;

        if (product.kind === 'subscription') {
            amount = this.configService.get<number>(`TARIFF_${product.months}M`);
            if (amount === undefined) {
                return { ok: false, reason: 'tariff_not_configured' };
            }
            orderToken = `${product.months}m`;
            webhookType = 'SUBSCRIPTION';
            months = product.months;
            description = undefined;
        } else {
            amount = this.configService.get<number>('TRAFFIC_RESET_PRICE');
            if (amount === undefined) {
                return { ok: false, reason: 'reset_not_configured' };
            }
            orderToken = 'reset';
            webhookType = 'TRAFFIC_RESET';
            months = undefined;
            description = RootService.RESET_PAYMENT_DESCRIPTION;
        }

        // Limit by session AND by shortUuid: keying on shortUuid alone let one session
        // fan out unlimited distinct values (panel-call amplification + unbounded map growth).
        if (
            !this.applyPaymentRateLimit(`s:${sessionId}`) ||
            !this.applyPaymentRateLimit(`u:${shortUuid}`)
        ) {
            this.logger.warn(
                `Payment rate limit exceeded (session ${sessionId}, shortUuid ${shortUuid})`,
            );
            return { ok: false, reason: 'rate_limited' };
        }

        const userResponse = await this.axiosService.getUserByShortUuid(shortUuid);
        if (!userResponse.isOk || !userResponse.response) {
            this.logger.warn(`Cannot create payment: user ${shortUuid} not found`);
            return { ok: false, reason: 'user_not_found' };
        }

        const userInfo = userResponse.response.response;
        const telegramId = userInfo.telegramId ?? null;
        const username = userInfo.username ?? '';
        const orderPrefix = telegramId !== null ? `${telegramId}_` : '';

        const successRedirectUrl = this.configService.get<string>('PAYMENT_SUCCESS_URL');
        const failRedirectUrl = this.configService.get<string>('PAYMENT_FAIL_URL');

        const providers: Array<'wata' | 'platega' | 'cardlink'> = [];
        if (this.wataService.isEnabled) providers.push('wata');
        if (this.plategaService.isEnabled) providers.push('platega');
        if (this.cardLinkService.isEnabled) providers.push('cardlink');

        if (providers.length === 0) {
            return { ok: false, reason: 'no_providers' };
        }

        for (let i = providers.length - 1; i > 0; i--) {
            const j = randomInt(i + 1);
            [providers[i], providers[j]] = [providers[j], providers[i]];
        }

        for (const provider of providers) {
            const ts = Date.now();
            const orderId = `${orderPrefix}${shortUuid}_${orderToken}_${ts}`;
            let url: string | null = null;
            let cardLinkBillId: string | undefined;

            try {
                if (provider === 'wata') {
                    url = await this.wataService.createOrder({
                        amount,
                        currency,
                        failRedirectUrl,
                        orderId,
                        successRedirectUrl,
                    });
                } else if (provider === 'platega') {
                    url = await this.plategaService.createOrder({
                        amount,
                        currency,
                        description,
                        orderId,
                        successRedirectUrl,
                        failRedirectUrl,
                    });
                } else if (provider === 'cardlink') {
                    const cardLinkResult = await this.cardLinkService.createOrder({
                        amount,
                        currency,
                        description,
                        failRedirectUrl,
                        orderId,
                        successRedirectUrl,
                    });
                    if (cardLinkResult) {
                        url = cardLinkResult.url;
                        cardLinkBillId = cardLinkResult.billId;
                    }
                }
            } catch (err) {
                this.logger.error(`Provider ${provider} failed for order ${orderId}: ${err}`);
            }

            if (url) {
                this.logger.log(`Order ${orderId} created via ${provider}`);
                this.sendPaymentWebhook({
                    type: webhookType,
                    orderId,
                    months,
                    amount,
                    currency,
                    shortUuid,
                    username,
                    cardLinkBillId,
                }).catch((e) =>
                    this.logger.error(`Webhook dispatch failed for ${orderId}: ${e}`),
                );
                return { ok: true, url };
            }
        }

        return { ok: false, reason: 'all_providers_failed' };
    }

    private sweepRateMap(now: number): void {
        if (now - this.lastRateSweep < this.RATE_SWEEP_INTERVAL_MS) {
            return;
        }

        for (const [key, timestamps] of this.webhookRateMap) {
            const live = timestamps.filter((ts) => now - ts < this.WEBHOOK_RATE_WINDOW_MS);
            if (live.length === 0) {
                this.webhookRateMap.delete(key);
            } else {
                this.webhookRateMap.set(key, live);
            }
        }

        this.lastRateSweep = now;
    }

    private applyPaymentRateLimit(key: string): boolean {
        const now = Date.now();
        this.sweepRateMap(now);

        const existing = this.webhookRateMap.get(key);

        // Reject brand-new keys once the map is saturated, so an attacker iterating
        // distinct keys cannot grow it without bound (memory-exhaustion DoS).
        if (existing === undefined && this.webhookRateMap.size >= this.RATE_MAP_MAX_KEYS) {
            return false;
        }

        const recent = (existing ?? []).filter((ts) => now - ts < this.WEBHOOK_RATE_WINDOW_MS);

        if (recent.length >= this.WEBHOOK_RATE_LIMIT) {
            return false;
        }

        recent.push(now);
        this.webhookRateMap.set(key, recent);
        return true;
    }

    public isValidTariffMonths(months: number): boolean {
        const envKey = `TARIFF_${months}M`;
        return this.configService.get<number>(envKey) !== undefined;
    }

    public isValidTariffAmount(months: number, amount: number): boolean {
        const envKey = `TARIFF_${months}M`;
        const configuredAmount = this.configService.get<number>(envKey);
        return configuredAmount !== undefined && configuredAmount === amount;
    }

    private async sendPaymentWebhook(data: {
        type: 'SUBSCRIPTION' | 'TRAFFIC_RESET';
        orderId: string;
        months?: number;
        amount: number;
        currency: string;
        shortUuid: string;
        username: string;
        cardLinkBillId?: string;
    }): Promise<{ ok: boolean; reason?: string }> {
        const webhookUrl = this.configService.get<string>('PAYMENT_WEBHOOK_URL');
        if (!webhookUrl) {
            return { ok: false, reason: 'webhook_disabled' };
        }

        const { months, ...rest } = data;
        const payload = {
            ...rest,
            ...(months !== undefined ? { months } : {}),
            timestamp: new Date().toISOString(),
        };

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        // HMAC signature
        const secret = this.configService.get<string>('PAYMENT_WEBHOOK_SECRET');
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

    private generateJwtForCookie(uuid: string | null, sub: string): string {
        return this.jwtService.sign(
            {
                sessionId: nanoid(32),
                su: this.subpageConfigService.getEncryptedSubpageConfigUuid(uuid),
                sub,
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

            const tariffs = this.hasAnyPaymentProvider() ? this.listAvailableTariffs() : [];

            const paymentUrl = baseSettings.paymentUrl;
            const paymentTariffs = tariffs.length > 0
                ? Buffer.from(JSON.stringify(tariffs)).toString('base64')
                : '';

            const paymentReset = this.isTrafficResetEnabled()
                ? Buffer.from(
                      JSON.stringify({
                          amount: this.configService.get<number>('TRAFFIC_RESET_PRICE'),
                          currency: this.configService.get<string>('TARIFF_CURRENCY') ?? 'RUB',
                      }),
                  ).toString('base64')
                : '';

            const sessionShortUuid = subscriptionData?.response?.user?.shortUuid ?? '';

            res.cookie(
                'session',
                this.generateJwtForCookie(subpageConfig.subpageConfigUuid, sessionShortUuid),
                {
                    httpOnly: true,
                    secure: true,
                    maxAge: 1_800_000, // 30 minutes
                },
            );

            const cwHmacSecret = this.configService.get<string>('CHATWOOT_HMAC_SECRET') || '';
            const cwIdentifier =
                subscriptionData?.response?.user?.shortUuid ||
                subscriptionData?.response?.user?.username ||
                '';
            const cwIdentifierHash =
                cwHmacSecret && cwIdentifier
                    ? createHmac('sha256', cwHmacSecret).update(cwIdentifier).digest('hex')
                    : '';

            res.render('index', {
                metaTitle: baseSettings.metaTitle,
                metaDescription: baseSettings.metaDescription,
                panelData: Buffer.from(JSON.stringify(subscriptionData)).toString('base64'),
                paymentUrl,
                paymentTariffs,
                paymentReset,
                supportEmail: baseSettings.supportEmail,
                chatwootBaseUrl: this.configService.get<string>('CHATWOOT_BASE_URL') || '',
                chatwootWebsiteToken: this.configService.get<string>('CHATWOOT_WEBSITE_TOKEN') || '',
                chatwootIdentifierHash: cwIdentifierHash,
            });
        } catch (error) {
            this.logger.error(`Error in returnWebpage: ${error}`);

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
