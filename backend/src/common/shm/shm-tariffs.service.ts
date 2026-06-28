import axios from 'axios';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ITariff {
    months: number;
    amount: number;
    currency: string;
    days?: number;
    id?: number;
    name?: string;
    description?: string;
}

@Injectable()
export class ShmTariffsService {
    private readonly logger = new Logger(ShmTariffsService.name);
    private readonly integrationEnabled: boolean;
    private readonly baseUrl: string | undefined;
    private readonly category: string | undefined;
    private readonly TTL_MS = 60_000;
    private cache: { at: number; tariffs: ITariff[] } | undefined;

    constructor(private readonly configService: ConfigService) {
        this.integrationEnabled =
            this.configService.get<boolean>('SHM_INTEGRATION_ENABLED') === true;
        this.baseUrl = this.configService.get<string>('SHM_TARIFFS_URL');
        this.category = this.configService.get<string>('SHM_TARIFF_CATEGORY');
    }

    // Master switch: SHM mode requires the explicit flag AND the base/category.
    public get isEnabled(): boolean {
        return this.integrationEnabled && !!this.baseUrl && !!this.category;
    }

    // Normalized public SHM base (.../shm/v1/public), tolerant of a trailing /tariffs.
    private normalizedBase(): string | undefined {
        if (!this.baseUrl) {
            return undefined;
        }
        return this.baseUrl.replace(/\/+$/, '').replace(/\/tariffs$/i, '');
    }

    // URL of the public SHM payment page for a subscription + chosen tariff.
    // SHM resolves the user, assigns the next tariff and initiates payment via its own
    // pay_systems (so the gateway callback returns to SHM and it confirms the payment).
    public buildPayUrl(shortUuid: string, serviceId: number): string | undefined {
        const base = this.normalizedBase();
        if (!this.isEnabled || !base) {
            return undefined;
        }
        return `${base}/pay?shortUuid=${encodeURIComponent(shortUuid)}&serviceId=${serviceId}&format=html`;
    }

    // URL of the public SHM traffic-reset page (dynamic price + balance check + top-up).
    public buildResetUrl(shortUuid: string): string | undefined {
        const base = this.normalizedBase();
        if (!this.isEnabled || !base) {
            return undefined;
        }
        return `${base}/reset?shortUuid=${encodeURIComponent(shortUuid)}&format=html`;
    }

    public async getTariffs(): Promise<ITariff[] | null> {
        if (!this.baseUrl || !this.category) {
            return null;
        }

        const now = Date.now();
        if (this.cache && now - this.cache.at < this.TTL_MS) {
            return this.cache.tariffs;
        }

        try {
            const url = `${this.normalizedBase()}/tariffs`;
            const response = await axios.get(url, {
                params: { category: this.category },
                timeout: 8_000,
            });

            const raw: unknown = response.data?.tariffs;
            const list = Array.isArray(raw) ? raw : [];
            const tariffs: ITariff[] = list
                .filter(
                    (t): t is Record<string, unknown> =>
                        !!t &&
                        typeof (t as Record<string, unknown>).period_months === 'number' &&
                        typeof (t as Record<string, unknown>).cost === 'number' &&
                        // Hide free / 0 ₽ services (promo, ambassador, internal) — not buyable here.
                        // Day-based / hourly tariffs (period_months = 0) are kept.
                        ((t as Record<string, unknown>).cost as number) > 0,
                )
                .map((t) => ({
                    months: t.period_months as number,
                    days: t.period_days as number | undefined,
                    amount: t.cost as number,
                    currency: (t.currency as string) ?? 'RUB',
                    id: t.id as number | undefined,
                    name: t.name as string | undefined,
                    description: t.descr as string | undefined,
                }));

            this.cache = { at: now, tariffs };
            return tariffs;
        } catch (error) {
            this.logger.error(`SHM tariffs fetch failed: ${error}`);
            return this.cache?.tariffs ?? null;
        }
    }
}
