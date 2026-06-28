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
    private readonly baseUrl: string | undefined;
    private readonly category: string | undefined;
    private readonly TTL_MS = 60_000;
    private cache: { at: number; tariffs: ITariff[] } | undefined;

    constructor(private readonly configService: ConfigService) {
        this.baseUrl = this.configService.get<string>('SHM_TARIFFS_URL');
        this.category = this.configService.get<string>('SHM_TARIFF_CATEGORY');
    }

    public get isEnabled(): boolean {
        return !!this.baseUrl && !!this.category;
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
            // Accept either the public base (.../shm/v1/public) or a URL that already
            // ends in /tariffs — normalize so we always hit exactly <base>/tariffs.
            const base = this.baseUrl.replace(/\/+$/, '').replace(/\/tariffs$/i, '');
            const url = `${base}/tariffs`;
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
