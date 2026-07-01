import { Request, Response } from 'express';

import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';

import { GetJWTPayload } from '@common/decorators/get-jwt-payload';
import { ClientIp } from '@common/decorators/get-ip';
import { IJwtPayload } from '@common/constants';

import { HwidDevicesService } from './hwid-devices.service';
import { HWID } from './hwid-devices.constants';

@Controller('api/devices')
export class HwidDevicesController {
    constructor(private readonly service: HwidDevicesService) {}

    private noStore(res: Response): void {
        res.setHeader('Cache-Control', 'no-store, private');
    }

    // Reject when the feature is disabled or the session lacks a bound shortUuid.
    private guard(user: IJwtPayload | undefined, res: Response): user is IJwtPayload {
        if (!this.service.isEnabled) {
            res.status(404).send('Not Found');
            return false;
        }
        if (!user || !user.sub) {
            res.status(403).send('Forbidden');
            return false;
        }
        return true;
    }

    @Get('status')
    async status(@GetJWTPayload() user: IJwtPayload, @Res() res: Response): Promise<void> {
        this.noStore(res);
        if (!this.guard(user, res)) return;
        const result = await this.service.getStatus(user.sub!);
        res.status(200).json(result);
    }

    @Post('challenge')
    async challenge(
        @GetJWTPayload() user: IJwtPayload,
        @ClientIp() ip: string,
        @Res() res: Response,
    ): Promise<void> {
        this.noStore(res);
        if (!this.guard(user, res)) return;
        const result = await this.service.requestChallenge(user.sub!, ip);
        if (!result.ok) {
            const status = result.reason === 'blocked' || result.reason === 'cooldown' ? 429 : 502;
            res.status(status).json({
                ok: false,
                reason: result.reason,
                cooldownSec: result.cooldownSec,
            });
            return;
        }
        res.status(200).json({ ok: true, ttlSec: result.ttlSec, cooldownSec: result.cooldownSec });
    }

    @Post('verify')
    async verify(
        @GetJWTPayload() user: IJwtPayload,
        @ClientIp() ip: string,
        @Body() body: { code?: unknown },
        @Res() res: Response,
    ): Promise<void> {
        this.noStore(res);
        if (!this.guard(user, res)) return;
        const code = typeof body?.code === 'string' ? body.code.trim() : '';
        if (!new RegExp(`^\\d{${HWID.CODE_LENGTH}}$`).test(code)) {
            // Uniform failure — do not distinguish "malformed" from "wrong".
            res.status(200).json({ ok: false });
            return;
        }
        const result = await this.service.verify(user.sub!, code, ip, user.sessionId);
        if (!result.ok) {
            res.status(200).json({ ok: false });
            return;
        }
        res.cookie(HWID.COOKIE_NAME, result.token, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            maxAge: HWID.SESSION_TTL_MS,
        });
        res.status(200).json({ ok: true });
    }

    @Get()
    async list(
        @GetJWTPayload() user: IJwtPayload,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<void> {
        this.noStore(res);
        if (!this.guard(user, res)) return;
        const token = String(req.cookies?.[HWID.COOKIE_NAME] ?? '');
        const result = await this.service.listDevices(token, user.sessionId, user.sub!);
        if (!result.ok) {
            res.status(result.status).json({ ok: false });
            return;
        }
        res.status(200).json({
            ok: true,
            devices: result.devices,
            total: result.total,
            limit: result.limit,
        });
    }

    @Post('delete')
    async delete(
        @GetJWTPayload() user: IJwtPayload,
        @ClientIp() ip: string,
        @Req() req: Request,
        @Body() body: { hwid?: unknown },
        @Res() res: Response,
    ): Promise<void> {
        this.noStore(res);
        if (!this.guard(user, res)) return;
        const hwid = typeof body?.hwid === 'string' ? body.hwid : '';
        if (!hwid) {
            res.status(400).json({ ok: false });
            return;
        }
        const token = String(req.cookies?.[HWID.COOKIE_NAME] ?? '');
        const result = await this.service.deleteDevice(token, user.sessionId, user.sub!, hwid, ip);
        if (!result.ok) {
            res.status(result.status).json({ ok: false });
            return;
        }
        res.status(200).json({
            ok: true,
            devices: result.devices,
            total: result.total,
            limit: result.limit,
        });
    }

    @Post('delete-all')
    async deleteAll(
        @GetJWTPayload() user: IJwtPayload,
        @ClientIp() ip: string,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<void> {
        this.noStore(res);
        if (!this.guard(user, res)) return;
        const token = String(req.cookies?.[HWID.COOKIE_NAME] ?? '');
        const result = await this.service.deleteAll(token, user.sessionId, user.sub!, ip);
        if (!result.ok) {
            res.status(result.status).json({ ok: false });
            return;
        }
        res.status(200).json({
            ok: true,
            devices: result.devices,
            total: result.total,
            limit: result.limit,
        });
    }
}
