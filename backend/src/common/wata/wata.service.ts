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

interface IWataOrderResponse {
    id: string;
    url: string;
}

@Injectable()
export class WataService {
    private readonly logger = new Logger(WataService.name);
    private readonly apiKey: string | undefined;

    constructor(private readonly configService: ConfigService) {
        this.apiKey = this.configService.get<string>('WATA_API_KEY');
    }

    public get isEnabled(): boolean {
        return !!this.apiKey;
    }

    public async createOrder(params: ICreateOrderParams): Promise<string | null> {
        if (!this.apiKey) {
            return null;
        }

        const data: Record<string, string> = {
            amount: params.amount.toFixed(2),
            currency: params.currency ?? 'RUB',
            orderId: params.orderId,
        };

        if (params.successRedirectUrl) {
            data['successRedirectUrl'] = params.successRedirectUrl;
        }

        if (params.failRedirectUrl) {
            data['failRedirectUrl'] = params.failRedirectUrl;
        }

        try {
            const response = await axios.post<IWataOrderResponse>(
                'https://api.wata.pro/api/h2h/links',
                data,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                    timeout: 10_000,
                },
            );

            this.logger.log(`Wata order created: ${response.data.id}`);

            return response.data.url ?? null;
        } catch (error) {
            if (error instanceof AxiosError) {
                this.logger.error(
                    `Wata API error (${error.response?.status}): ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`,
                );
            } else {
                this.logger.error(`Wata API unexpected error: ${error}`);
            }

            return null;
        }
    }
}
