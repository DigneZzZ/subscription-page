import { Request, Response } from 'express';

import { Get, Post, Body, Controller, Res, Req, Param, Logger, HttpCode } from '@nestjs/common';

import {
    REQUEST_TEMPLATE_TYPE_VALUES,
    TRequestTemplateTypeKeys,
} from '@remnawave/backend-contract';
import { APP_CONFIG_ROUTE_WO_LEADING_PATH } from '@remnawave/subscription-page-types';

import { GetJWTPayload } from '@common/decorators/get-jwt-payload';
import { ClientIp } from '@common/decorators/get-ip';
import { IJwtPayload } from '@common/constants';

import { SubpageConfigService } from './subpage-config.service';
import { RootService } from './root.service';

@Controller()
export class RootController {
    private readonly logger = new Logger(RootController.name);

    constructor(
        private readonly rootService: RootService,
        private readonly subpageConfigService: SubpageConfigService,
    ) {}

    @Get(APP_CONFIG_ROUTE_WO_LEADING_PATH)
    async getSubscriptionPageConfig(@GetJWTPayload() user: IJwtPayload, @Req() request: Request) {
        return await this.subpageConfigService.getSubscriptionPageConfig(user.su, request);
    }

    @Post('api/payment-webhook')
    @HttpCode(200)
    async paymentWebhook(
        @GetJWTPayload() user: IJwtPayload,
        @Body()
        body: {
            orderId: string;
            months: number;
            amount: number;
            currency: string;
            shortUuid: string;
            username: string;
        },
    ) {
        if (!user) {
            return { ok: false };
        }

        if (!body.orderId || !body.months || !body.amount || !body.currency || !body.shortUuid || !body.username) {
            return { ok: false };
        }

        // Validate months is one of the configured tariffs
        if (![1, 3, 6, 12].includes(body.months)) {
            return { ok: false };
        }

        // Validate the tariff exists and amount matches configured value
        if (!this.rootService.isValidTariffAmount(body.months, body.amount)) {
            this.logger.warn(
                `Invalid tariff amount: months=${body.months}, amount=${body.amount}`,
            );
            return { ok: false };
        }

        const result = await this.rootService.sendPaymentWebhook({
            orderId: body.orderId,
            months: body.months,
            amount: body.amount,
            currency: body.currency,
            shortUuid: body.shortUuid,
            username: body.username,
        });

        return { ok: result.ok };
    }

    @Get([':shortUuid', ':shortUuid/:clientType'])
    async root(
        @ClientIp() clientIp: string,
        @Req() request: Request,
        @Res() response: Response,
        @Param('shortUuid') shortUuid: string,
        @Param('clientType') clientType: string,
    ) {
        if (request.path.startsWith('/assets') || request.path.startsWith('/locales')) {
            response.socket?.destroy();
            return;
        }

        if (clientType === undefined) {
            return await this.rootService.serveSubscriptionPage(
                clientIp,
                request,
                response,
                shortUuid,
            );
        }

        if (!REQUEST_TEMPLATE_TYPE_VALUES.includes(clientType as TRequestTemplateTypeKeys)) {
            this.logger.error(`Invalid client type: ${clientType}`);

            response.socket?.destroy();
            return;
        } else {
            return await this.rootService.serveSubscriptionPage(
                clientIp,
                request,
                response,
                shortUuid,
                clientType as TRequestTemplateTypeKeys,
            );
        }
    }
}
