import { Request, Response } from 'express';

import { Get, Controller, Res, Req, Param, Query, Logger } from '@nestjs/common';

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

    @Get('api/pay')
    async createPayment(
        @GetJWTPayload() user: IJwtPayload,
        @Res() response: Response,
        @Query('shortUuid') shortUuid: string,
        @Query('months') monthsRaw: string,
    ) {
        if (!user) {
            response.socket?.destroy();
            return;
        }

        if (!shortUuid || !monthsRaw) {
            response.status(400).send('Bad Request');
            return;
        }

        const months = parseInt(monthsRaw, 10);
        if (!Number.isFinite(months) || ![1, 3, 6, 12].includes(months)) {
            response.status(400).send('Invalid months');
            return;
        }

        const result = await this.rootService.createPaymentForTariff(shortUuid, months);
        if (!result.ok) {
            this.logger.warn(`Payment creation failed for ${shortUuid} (${months}m): ${result.reason}`);
            response.status(result.reason === 'rate_limited' ? 429 : 502).send('Payment unavailable');
            return;
        }

        response.redirect(302, result.url);
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
