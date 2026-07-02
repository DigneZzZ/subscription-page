import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AxiosService } from '@common/axios/axios.service';

import { TelegramNotifierService } from './telegram-notifier.service';
import { HwidChallengeStore } from './hwid-challenge.store';
import { HwidMode, resolveHwidMode } from './hwid-mode';
import { HWID } from './hwid-devices.constants';

interface StatusResult {
    enabled: boolean;
    mode: HwidMode;
    telegramLinked: boolean;
    deviceCount: number;
    deviceLimit: number | null;
}

export interface DeviceDto {
    hwid: string;
    platform: string | null;
    osVersion: string | null;
    deviceModel: string | null;
    createdAt: string;
}

interface UserCtx {
    uuid: string;
    username: string;
    telegramId: number | null;
    hwidDeviceLimit: number | null;
}

interface StatusCacheEntry {
    at: number;
    value: StatusResult;
}

@Injectable()
export class HwidDevicesService {
    private readonly logger = new Logger(HwidDevicesService.name);
    private readonly store: HwidChallengeStore;
    private readonly statusCache = new Map<string, StatusCacheEntry>();
    private readonly openActionRate = new Map<string, number[]>();

    constructor(
        private readonly configService: ConfigService,
        private readonly axiosService: AxiosService,
        private readonly telegram: TelegramNotifierService,
    ) {
        this.store = new HwidChallengeStore(
            this.configService.getOrThrow<string>('INTERNAL_JWT_SECRET'),
        );
    }

    get mode(): HwidMode {
        return resolveHwidMode(
            this.configService.get<string>('HWID_MANAGEMENT_MODE'),
            this.telegram.isEnabled,
        );
    }

    get isEnabled(): boolean {
        return this.mode !== 'disabled';
    }

    private now(): number {
        return Date.now();
    }

    private async fetchUser(shortUuid: string): Promise<UserCtx | null> {
        const res = await this.axiosService.getUserByShortUuid(shortUuid);
        if (!res.isOk || !res.response) return null;
        const u = res.response.response;
        return {
            uuid: u.uuid,
            username: u.username,
            telegramId: u.telegramId ?? null,
            hwidDeviceLimit: u.hwidDeviceLimit ?? null,
        };
    }

    private toDeviceDtos(
        devices: {
            hwid: string;
            platform: string | null;
            osVersion: string | null;
            deviceModel: string | null;
            createdAt: Date;
        }[],
    ): DeviceDto[] {
        return devices.map((d) => ({
            hwid: d.hwid,
            platform: d.platform,
            osVersion: d.osVersion,
            deviceModel: d.deviceModel,
            createdAt: (d.createdAt instanceof Date
                ? d.createdAt
                : new Date(d.createdAt)
            ).toISOString(),
        }));
    }

    async getStatus(shortUuid: string): Promise<StatusResult> {
        const cached = this.statusCache.get(shortUuid);
        if (cached && this.now() - cached.at < HWID.STATUS_CACHE_TTL_MS) {
            return cached.value;
        }

        const user = await this.fetchUser(shortUuid);
        if (!user) {
            // Uniform "not linked, zero devices" shape — do not reveal whether the user exists.
            const value: StatusResult = {
                enabled: true,
                mode: this.mode,
                telegramLinked: false,
                deviceCount: 0,
                deviceLimit: null,
            };
            return value;
        }

        let deviceCount = 0;
        const devicesRes = await this.axiosService.getUserHwidDevices(user.uuid);
        if (devicesRes.isOk && devicesRes.response) {
            deviceCount = devicesRes.response.response.total;
        }

        const value: StatusResult = {
            enabled: true,
            mode: this.mode,
            telegramLinked: user.telegramId !== null,
            deviceCount,
            deviceLimit: user.hwidDeviceLimit,
        };
        if (this.statusCache.size < HWID.MAP_MAX_KEYS) {
            this.statusCache.set(shortUuid, { at: this.now(), value });
        }
        return value;
    }

    async requestChallenge(
        shortUuid: string,
        ip: string,
    ): Promise<
        | { ok: true; ttlSec: number; cooldownSec: number }
        | {
              ok: false;
              reason: 'cooldown' | 'not_linked' | 'tg_send_failed' | 'blocked' | 'unavailable';
              cooldownSec?: number;
          }
    > {
        const now = this.now();
        if (this.store.isBlocked(ip, shortUuid, now)) {
            return { ok: false, reason: 'blocked' };
        }

        const user = await this.fetchUser(shortUuid);
        if (!user) return { ok: false, reason: 'unavailable' };
        if (user.telegramId === null) return { ok: false, reason: 'not_linked' };

        const created = this.store.createChallenge(shortUuid, user.uuid, now);
        if (!created.ok) {
            if (created.reason === 'cooldown') {
                return { ok: false, reason: 'cooldown', cooldownSec: created.cooldownSec };
            }
            return { ok: false, reason: 'unavailable' };
        }

        const sent = await this.telegram.sendCode(
            String(user.telegramId),
            user.username,
            ip,
            created.code,
        );
        if (!sent) {
            // The code never reached the user; the challenge simply stays until it expires
            // or the cooldown lets them retry. Nothing to roll back (no session was created).
            return { ok: false, reason: 'tg_send_failed' };
        }
        return { ok: true, ttlSec: created.ttlSec, cooldownSec: HWID.COOLDOWN_MS / 1000 };
    }

    async verify(
        shortUuid: string,
        code: string,
        ip: string,
        sessionId: string,
    ): Promise<{ ok: true; token: string } | { ok: false }> {
        const now = this.now();
        const result = this.store.verifyCode(shortUuid, code, now, ip);
        if (!result.ok) {
            if (result.blockTriggered) {
                // Fire-and-forget owner notification; do not block the response.
                void this.notifyBlockedOwner(shortUuid, ip);
            }
            return { ok: false };
        }
        this.store.bindSession(result.token, sessionId);
        return { ok: true, token: result.token };
    }

    private async notifyBlockedOwner(shortUuid: string, ip: string): Promise<void> {
        const user = await this.fetchUser(shortUuid);
        if (user && user.telegramId !== null) {
            await this.telegram.notifyBlocked(String(user.telegramId), user.username, ip);
        }
    }

    // Bounded per-IP+sub rate limit for open-mode device actions (no session gate there).
    // Mirrors applyPaymentRateLimit: cap total keys, reject new keys at capacity.
    private allowOpenAction(ip: string, sub: string): boolean {
        const now = this.now();
        const key = `${ip}:${sub}`;
        const existing = this.openActionRate.get(key);
        if (existing === undefined && this.openActionRate.size >= HWID.MAP_MAX_KEYS) {
            return false;
        }
        const recent = (existing ?? []).filter((ts) => now - ts < HWID.OPEN_ACTION_WINDOW_MS);
        if (recent.length >= HWID.OPEN_ACTION_LIMIT) {
            return false;
        }
        recent.push(now);
        this.openActionRate.set(key, recent);
        return true;
    }

    // Resolves the target userUuid for a device action, per mode.
    // open: authorized by the session-JWT sub alone (bound by the controller's IDOR guard).
    // telegram: requires a valid hwid_mgmt session bound to sub + sessionId.
    private async authorize(
        token: string,
        sessionId: string,
        sub: string,
    ): Promise<{ userUuid: string } | null> {
        if (this.mode === 'open') {
            const user = await this.fetchUser(sub);
            return user ? { userUuid: user.uuid } : null;
        }
        const session = this.resolveSession(token, sessionId, sub);
        return session ? { userUuid: session.userUuid } : null;
    }

    private resolveSession(token: string, sessionId: string, sub: string) {
        const session = this.store.getSession(token, this.now());
        if (!session) return null;
        if (session.shortUuid !== sub || session.sessionId !== sessionId) return null;
        return session;
    }

    async listDevices(token: string, sessionId: string, sub: string) {
        const auth = await this.authorize(token, sessionId, sub);
        if (!auth) return { ok: false as const, status: 403 };
        const res = await this.axiosService.getUserHwidDevices(auth.userUuid);
        if (!res.isOk || !res.response) return { ok: false as const, status: 502 };
        return this.buildListResult(sub, res.response.response);
    }

    async deleteDevice(token: string, sessionId: string, sub: string, hwid: string, ip: string) {
        const auth = await this.authorize(token, sessionId, sub);
        if (!auth) return { ok: false as const, status: 403 };
        if (this.mode === 'open' && !this.allowOpenAction(ip, sub)) {
            return { ok: false as const, status: 429 };
        }
        // Label for the owner notification, resolved from the pre-delete list.
        const before = await this.axiosService.getUserHwidDevices(auth.userUuid);
        const target = before.isOk
            ? before.response?.response.devices.find((d) => d.hwid === hwid)
            : undefined;
        const res = await this.axiosService.deleteUserHwidDevice(auth.userUuid, hwid);
        if (!res.isOk || !res.response) return { ok: false as const, status: 502 };
        this.statusCache.delete(sub);
        void this.notifyDeviceRemoved(sub, ip, target);
        return this.buildListResult(sub, res.response.response);
    }

    async deleteAll(token: string, sessionId: string, sub: string, ip: string) {
        const auth = await this.authorize(token, sessionId, sub);
        if (!auth) return { ok: false as const, status: 403 };
        if (this.mode === 'open' && !this.allowOpenAction(ip, sub)) {
            return { ok: false as const, status: 429 };
        }
        const res = await this.axiosService.deleteAllUserHwidDevices(auth.userUuid);
        if (!res.isOk || !res.response) return { ok: false as const, status: 502 };
        this.statusCache.delete(sub);
        const remaining = res.response.response.total;
        void this.notifyAllRemoved(sub, ip, remaining);
        return this.buildListResult(sub, res.response.response);
    }

    private async buildListResult(
        sub: string,
        payload: {
            total: number;
            devices: {
                hwid: string;
                platform: string | null;
                osVersion: string | null;
                deviceModel: string | null;
                createdAt: Date;
            }[];
        },
    ) {
        const user = await this.fetchUser(sub);
        return {
            ok: true as const,
            devices: this.toDeviceDtos(payload.devices),
            total: payload.total,
            limit: user?.hwidDeviceLimit ?? null,
        };
    }

    private async notifyDeviceRemoved(
        sub: string,
        ip: string,
        device?: { platform: string | null; deviceModel: string | null },
    ): Promise<void> {
        const user = await this.fetchUser(sub);
        if (!user || user.telegramId === null) return;
        const label =
            [device?.platform, device?.deviceModel].filter(Boolean).join(' ') || 'unknown device';
        await this.telegram.notifyDeleted(String(user.telegramId), user.username, ip, label);
    }

    private async notifyAllRemoved(sub: string, ip: string, remaining: number): Promise<void> {
        const user = await this.fetchUser(sub);
        if (!user || user.telegramId === null) return;
        await this.telegram.notifyDeletedAll(String(user.telegramId), user.username, ip, remaining);
    }
}
