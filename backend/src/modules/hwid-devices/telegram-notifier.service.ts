import axios, { AxiosError, AxiosInstance } from 'axios';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { sanitizeUsername } from '@common/utils';

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
                // Plain text: no parse_mode. Username is also sanitized as defense-in-depth.
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
            `🔐 Запрос на управление устройствами подписки ${u}.\n` +
            `IP: ${ip}\nКод: ${code}\nДействителен 5 минут. Если это не вы — проигнорируйте.\n\n` +
            `🔐 Device management requested for ${u}.\n` +
            `IP: ${ip}\nCode: ${code}\nValid for 5 minutes. If this wasn't you, ignore this message.`;
        return this.send(chatId, text);
    }

    notifyDeleted(
        chatId: string,
        username: string,
        ip: string,
        deviceLabel: string,
    ): Promise<boolean> {
        const u = sanitizeUsername(username);
        const text =
            `📱 Устройство удалено (${u}): ${deviceLabel}. IP инициатора: ${ip}.\n\n` +
            `📱 Device removed (${u}): ${deviceLabel}. Initiator IP: ${ip}.`;
        return this.send(chatId, text);
    }

    notifyDeletedAll(
        chatId: string,
        username: string,
        ip: string,
        count: number,
    ): Promise<boolean> {
        const u = sanitizeUsername(username);
        const text =
            `📱 Удалены все устройства (${u}): ${count} шт. IP инициатора: ${ip}.\n\n` +
            `📱 All devices removed (${u}): ${count}. Initiator IP: ${ip}.`;
        return this.send(chatId, text);
    }

    notifyBlocked(chatId: string, username: string, ip: string): Promise<boolean> {
        const u = sanitizeUsername(username);
        const text =
            `⚠️ Неудачные попытки управления устройствами подписки ${u}. ` +
            `IP ${ip} заблокирован на 10 минут.\n\n` +
            `⚠️ Failed device-management attempts for ${u}. IP ${ip} blocked for 10 minutes.`;
        return this.send(chatId, text);
    }
}
