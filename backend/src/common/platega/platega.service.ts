import axios, { AxiosError } from 'axios';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ICreateOrderParams {
    amount: number;
    currency?: string;
    description?: string;
    orderId: string;
    successRedirectUrl?: string;
    failRedirectUrl?: string;
}

interface IPlategaResponse {
    paymentMethod: string;
    transactionId: string;
    redirect: string;
    return: string | null;
    paymentDetails: string;
    status: string;
    expiresIn: string | null;
    merchantId: string;
    usdtRate: number;
    cryptoAmount: number;
}

@Injectable()
export class PlategaService {
    private readonly logger = new Logger(PlategaService.name);
    private readonly merchantId: string | undefined;
    private readonly secret: string | undefined;

    constructor(private readonly configService: ConfigService) {
        this.merchantId = this.configService.get<string>('PLATEGA_MERCHANT_ID');
        this.secret = this.configService.get<string>('PLATEGA_SECRET');
    }

    public get isEnabled(): boolean {
        return !!this.merchantId && !!this.secret;
    }

    public async createOrder(params: ICreateOrderParams): Promise<string | null> {
        if (!this.merchantId || !this.secret) {
            return null;
        }

        const body = {
            paymentMethod: 2,
            paymentDetails: {
                amount: params.amount,
                currency: params.currency ?? 'RUB',
            },
            description: params.description ?? 'Оплата подписки',
            return: params.successRedirectUrl ?? 'https://t.me/',
            failedUrl: params.failRedirectUrl ?? 'https://t.me/',
            payload: params.orderId,
        };

        try {
            const response = await axios.post<IPlategaResponse>(
                'https://app.platega.io/transaction/process',
                body,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-MerchantId': this.merchantId,
                        'X-Secret': this.secret,
                    },
                    timeout: 10_000,
                },
            );

            this.logger.log(
                `Platega order created: ${response.data.transactionId}`,
            );

            return response.data.redirect ?? null;
        } catch (error) {
            if (error instanceof AxiosError) {
                this.logger.error(
                    `Platega API error (${error.response?.status}): ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`,
                );
            } else {
                this.logger.error(`Platega API unexpected error: ${error}`);
            }

            return null;
        }
    }
}
