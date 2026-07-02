import axios, { AxiosError, AxiosInstance } from 'axios';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { sanitizeUsername } from '@common/utils';

// Escape values interpolated into an HTML-parse_mode Telegram message. `sanitizeUsername`
// already restricts usernames to [a-zA-Z0-9_-] (HTML-safe), but panel-supplied device
// fields are not — they must be escaped to avoid breaking the HTML parse / injection.
function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

@Injectable()
export class TelegramNotifierService {
    private readonly logger = new Logger(TelegramNotifierService.name);
    private readonly token?: string;
    private readonly http: AxiosInstance;

    constructor(private readonly configService: ConfigService) {
        this.token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
        // Dedicated instance. No interceptors, short timeout. The code lives in the request
        // body, so this instance's errors MUST NOT be logged with their config/request.
        this.http = axios.create({ timeout: 10_000 });
    }

    get isEnabled(): boolean {
        return Boolean(this.token);
    }

    private async send(chatId: string, text: string): Promise<boolean> {
        if (!this.token) return false;
        try {
            await this.http.post(`https://api.telegram.org/bot${this.token}/sendMessage`, {
                chat_id: chatId,
                text,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
            });
            return true;
        } catch (error) {
            // NEVER log the error object / config / request — the code is in the body.
            if (error instanceof AxiosError) {
                this.logger.warn(
                    `Telegram sendMessage failed: ${error.message} (status ${error.response?.status ?? 'n/a'})`,
                );
            } else {
                this.logger.warn('Telegram sendMessage failed');
            }
            return false;
        }
    }

    sendCode(chatId: string, username: string, ip: string, code: string): Promise<boolean> {
        const u = sanitizeUsername(username);
        const text =
            `🔐 Device management for <b>${u}</b> · IP ${escapeHtml(ip)}\n` +
            `Code (valid 5 min):\n<pre>${escapeHtml(code)}</pre>`;
        return this.send(chatId, text);
    }

    notifyDeleted(
        chatId: string,
        username: string,
        ip: string,
        deviceLabel: string,
    ): Promise<boolean> {
        const u = sanitizeUsername(username);
        const text = `📱 Device removed for <b>${u}</b>: ${escapeHtml(deviceLabel)} · IP ${escapeHtml(ip)}`;
        return this.send(chatId, text);
    }

    notifyDeletedAll(
        chatId: string,
        username: string,
        ip: string,
        count: number,
    ): Promise<boolean> {
        const u = sanitizeUsername(username);
        const text = `📱 All devices removed for <b>${u}</b> (${count}) · IP ${escapeHtml(ip)}`;
        return this.send(chatId, text);
    }

    notifyBlocked(chatId: string, username: string, ip: string): Promise<boolean> {
        const u = sanitizeUsername(username);
        const text = `⚠️ Failed device-management attempts for <b>${u}</b> — IP ${escapeHtml(ip)} blocked 10 min`;
        return this.send(chatId, text);
    }
}
