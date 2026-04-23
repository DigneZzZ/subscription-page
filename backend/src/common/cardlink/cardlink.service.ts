import axios, { AxiosError } from 'axios';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ICreateOrderParams {
    amount: number;
    currency?: string;
    failRedirectUrl?: string;
    orderId: string;
    successRedirectUrl?: string;
}

interface ICardLinkResponse {
    link_page_url: string;
    bill_id: string;
}

@Injectable()
export class CardLinkService {
    private readonly logger = new Logger(CardLinkService.name);
    private readonly apiKey: string | undefined;
    private readonly shopId: string | undefined;
    private readonly payerPaysCommission: number;

    constructor(private readonly configService: ConfigService) {
        this.apiKey = this.configService.get<string>('CARDLINK_API_KEY');
        this.shopId = this.configService.get<string>('CARDLINK_SHOP_ID');
        this.payerPaysCommission =
            this.configService.get<number>('CARDLINK_PAYER_PAYS_COMMISSION') ?? 0;
    }

    public get isEnabled(): boolean {
        return !!this.apiKey && !!this.shopId;
    }

    public async createOrder(
        params: ICreateOrderParams,
    ): Promise<{ url: string; billId: string } | null> {
        if (!this.apiKey || !this.shopId) {
            return null;
        }

        const body = new URLSearchParams();
        body.append('amount', params.amount.toFixed(2));
        body.append('order_id', params.orderId);
        body.append('description', params.orderId);
        body.append('name', params.orderId);
        body.append('type', 'normal');
        body.append('shop_id', this.shopId);
        body.append('currency_in', params.currency ?? 'RUB');
        body.append('payer_pays_commission', String(this.payerPaysCommission));

        if (params.successRedirectUrl) {
            body.append('success_url', params.successRedirectUrl);
        }

        if (params.failRedirectUrl) {
            body.append('fail_url', params.failRedirectUrl);
        }

        try {
            const response = await axios.post<ICardLinkResponse>(
                'https://cardlink.link/api/v1/bill/create',
                body,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                    timeout: 10_000,
                },
            );

            this.logger.log(`CardLink order created: ${response.data.bill_id}`);

            if (!response.data.link_page_url || !response.data.bill_id) {
                return null;
            }

            return {
                url: response.data.link_page_url,
                billId: response.data.bill_id,
            };
        } catch (error) {
            if (error instanceof AxiosError) {
                this.logger.error(
                    `CardLink API error (${error.response?.status}): ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`,
                );
            } else {
                this.logger.error(`CardLink API unexpected error: ${error}`);
            }

            return null;
        }
    }
}
