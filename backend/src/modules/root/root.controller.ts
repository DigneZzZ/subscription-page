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
        @Req() request: Request,
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

        const acceptLang = String(request.headers['accept-language'] ?? '');
        const isRu = /(^|,|;)\s*ru\b/i.test(acceptLang);

        response
            .status(200)
            .type('html')
            .setHeader('Cache-Control', 'no-store')
            .send(this.renderPayRedirectPage(result.url, isRu));
    }

    private renderPayRedirectPage(url: string, isRu: boolean): string {
        const safeUrlAttr = url
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        const title = isRu ? 'Формируем платёжную ссылку…' : 'Preparing payment link…';
        const fallbackText = isRu
            ? 'Если страница не открылась автоматически —'
            : 'If the page does not open automatically —';
        const linkText = isRu ? 'нажмите здесь' : 'click here';
        const delayMs = 700;
        const metaRefreshSec = 2;

        return `<!doctype html>
<html lang="${isRu ? 'ru' : 'en'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <meta http-equiv="refresh" content="${metaRefreshSec};url=${safeUrlAttr}">
    <title>${title}</title>
    <style>
        html, body { margin: 0; padding: 0; height: 100%; }
        body {
            background: #161B23;
            color: #fff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .box { text-align: center; padding: 24px; max-width: 420px; }
        .spinner {
            width: 52px;
            height: 52px;
            margin: 0 auto 28px;
            border: 3px solid rgba(34, 211, 238, 0.18);
            border-top-color: #22d3ee;
            border-radius: 50%;
            animation: spin 0.85s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        h1 { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: 0.2px; }
        p { margin: 18px 0 0; font-size: 13px; color: #8b95a7; line-height: 1.5; }
        a { color: #22d3ee; text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <main class="box">
        <div class="spinner" aria-hidden="true"></div>
        <h1>${title}</h1>
        <p>${fallbackText} <a id="pay-link" href="${safeUrlAttr}">${linkText}</a></p>
    </main>
    <script>
        (function () {
            var link = document.getElementById('pay-link');
            var target = link && link.getAttribute('href');
            if (!target) return;
            setTimeout(function () { window.location.replace(target); }, ${delayMs});
        })();
    </script>
</body>
</html>`;
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
