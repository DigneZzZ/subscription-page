import {
    BASE_TRANSLATION_KEYS,
    BASE_TRANSLATION_LABELS,
    SubscriptionPageRawConfigSchema
} from '@remnawave/subscription-page-types'
import { dirname, extname, resolve, sep } from 'node:path'
import { readFile } from 'node:fs/promises'
// Local-only synthetic preview. No panel credentials or real payment endpoints.
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import ejs from 'ejs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../dist')
const base64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64')
const localize = (ru, en = ru) => ({ ru, en })
const icon =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 7h6m-5 10h4"/></svg>'
const ru = {
    installationGuideHeader: 'Установка',
    connectionKeysHeader: 'Ключи подключения',
    linkCopied: 'Скопировано',
    linkCopiedToClipboard: 'Ссылка скопирована',
    getLink: 'Получить ссылку',
    scanQrCode: 'Сканируйте QR-код',
    scanQrCodeDescription: 'Добавьте подписку в приложение',
    copyLink: 'Копировать ссылку',
    name: 'Имя пользователя',
    status: 'Статус',
    active: 'Активна',
    inactive: 'Неактивна',
    expires: 'Действует до',
    bandwidth: 'Трафик',
    scanToImport: 'Импорт',
    expiresIn: 'Истекает через',
    expired: 'Истекла',
    unknown: 'Неизвестно',
    indefinitely: 'Бессрочно'
}
const app = (name, featured) => ({
    name,
    featured,
    blocks: [
        {
            svgIconKey: 'Device',
            svgIconColor: 'cyan',
            title: localize(`Установите ${name}`, `Install ${name}`),
            description: localize(
                'Скачайте приложение для вашего устройства.',
                'Download the app for your device.'
            ),
            buttons: [
                {
                    type: 'external',
                    svgIconKey: 'Device',
                    link: `https://download.example/${name.toLowerCase()}`,
                    text: localize(`Скачать ${name}`, `Download ${name}`)
                }
            ]
        },
        {
            svgIconKey: 'Device',
            svgIconColor: 'cyan',
            title: localize('Добавьте подписку', 'Add your subscription'),
            description: localize(
                'Приложение откроется и импортирует настройки.',
                'The app will open and import your settings.'
            ),
            buttons: [
                {
                    type: 'subscriptionLink',
                    svgIconKey: 'Device',
                    link: `${name.toLowerCase()}://import/{{SUBSCRIPTION_LINK}}`,
                    text: localize(`Добавить в ${name}`, `Add to ${name}`)
                }
            ]
        },
        {
            svgIconKey: 'Device',
            svgIconColor: 'cyan',
            title: localize('Включите VPN', 'Turn on VPN'),
            description: localize(
                'Выберите сервер в приложении и подключитесь.',
                'Choose a server in the app and connect.'
            ),
            buttons: []
        }
    ]
})

export function fixture(scenario = 'multiple', lang = 'ru') {
    const labels = {
        ios: 'iOS',
        android: 'Android',
        macos: 'macOS',
        windows: 'Windows',
        androidTV: 'Android TV',
        appleTV: 'Apple TV'
    }
    const platforms = Object.fromEntries(
        Object.entries(labels).map(([key, name]) => [
            key,
            {
                displayName: localize(name),
                svgIconKey: 'Device',
                apps:
                    key === 'appleTV' || scenario === 'single'
                        ? [app('INCY', true)]
                        : [app('Happ', false), app('INCY', true), app('Hiddify', true)]
            }
        ])
    )
    for (const platform of Object.values(platforms)) {
        if (scenario === 'empty') platform.apps = []
        if (scenario === 'many') platform.apps.push(app('Long Application Name Desktop Edition', true), app('Another Client', false))
        if (scenario === 'no-featured') platform.apps = platform.apps.map(item => ({ ...item, featured: false }))
    }
    const config = SubscriptionPageRawConfigSchema.parse({
        version: '1',
        locales: lang === 'en' ? ['en', 'ru'] : ['ru', 'en'],
        brandingSettings: {
            title: 'Geolog VPN',
            logoUrl: '',
            supportUrl: 'https://support.example'
        },
        baseSettings: { showConnectionKeys: false, hideGetLinkButton: false },
        uiConfig: { subscriptionInfoBlockType: 'cards', installationGuidesBlockType: 'cards' },
        baseTranslations: Object.fromEntries(
            BASE_TRANSLATION_KEYS.map((k) => [k, localize(ru[k], BASE_TRANSLATION_LABELS[k])])
        ),
        svgLibrary: { Device: icon },
        platforms
    })
    const unlimited = scenario === 'unlimited'
    const expired = scenario === 'expired'
    const user = {
        shortUuid: 'demo-obsidian',
        username: 'GeologVPN_192647_6487',
        userStatus: expired ? 'EXPIRED' : 'ACTIVE',
        isActive: !expired,
        daysLeft: expired ? -1 : 3650,
        expiresAt: expired ? '2026-01-01T00:00:00Z' : '2036-09-07T00:00:00Z',
        trafficLimitBytes: unlimited ? 0 : 999 * 1024 ** 3,
        trafficUsedBytes: 0,
        trafficLimit: unlimited ? '∞' : '999 GiB',
        trafficUsed: '0 GiB'
    }
    return {
        config,
        panel: {
            response: {
                user,
                isFound: true,
                subscriptionUrl: 'https://subscription.example/demo-obsidian',
                links: [],
                ssConfLinks: {}
            }
        }
    }
}

const server = createServer(async (req, res) => {
    try {
        const url = new URL(req.url, 'http://127.0.0.1')
        const referer = new URL(req.headers.referer || 'http://127.0.0.1')
        const options = url.pathname.startsWith('/assets/')
            ? referer.searchParams
            : url.searchParams
        const scenario = options.get('scenario') || 'multiple'
        const { config, panel } = fixture(scenario, options.get('lang'))
        if (url.pathname === '/packs/js/sdk.js') {
            res.setHeader('Content-Type', 'application/javascript')
            res.end('/* Chatwoot is disabled in this synthetic preview. */')
            return
        }
        if (url.pathname === '/assets/.app-config-v2.json') {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(config))
            return
        }
        if (url.pathname === '/api/devices/status') {
            res.setHeader('Content-Type', 'application/json')
            res.end(
                JSON.stringify({
                    mode: 'open',
                    enabled: true,
                    telegramLinked: false,
                    deviceCount: 2,
                    deviceLimit: 5
                })
            )
            return
        }
        if (url.pathname === '/api/devices' && req.method === 'GET') {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, devices: [], total: 0, limit: 5 }))
            return
        }
        if (url.pathname.startsWith('/api/')) {
            res.writeHead(405, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, preview: true }))
            return
        }
        if (url.pathname === '/' || url.pathname === '/demo-obsidian') {
            const html = await readFile(resolve(root, 'index.html'), 'utf8')
            const rendered = ejs.render(html, {
                panelData: base64(panel),
                paymentUrl: '',
                paymentTariffs: base64(
                    scenario === 'no-payment'
                        ? []
                        : [
                            { id: 101, months: 1, amount: 199, currency: 'RUB', name: '1 месяц' },
                            {
                                id: 102,
                                months: 3,
                                amount: 499,
                                currency: 'RUB',
                                name: '3 месяца'
                            },
                            {
                                id: 103,
                                months: 12,
                                amount: 1490,
                                currency: 'RUB',
                                name: '12 месяцев'
                            }
                        ]
                ),
                paymentReset: '',
                supportEmail: '',
                hwidData: base64({ enabled: true }),
                metaTitle: 'Geolog VPN — preview',
                metaDescription: 'Local synthetic preview',
                chatwootBaseUrl: '',
                chatwootWebsiteToken: '',
                chatwootIdentifierHash: '',
                uiPreset: base64({
                    theme: 9,
                    layout: options.get('layout') || 'obsidian',
                    preview: false,
                    headerPay: true,
                    fx: []
                }),
                uiThemeColor: '#080c0d',
                uiColorScheme: 'dark'
            })
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.end(rendered)
            return
        }
        const file = resolve(root, `.${  decodeURIComponent(url.pathname)}`)
        if (!file.startsWith(root + sep)) {
            res.writeHead(403).end()
            return
        }
        const body = await readFile(file)
        const types = {
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
            '.png': 'image/png',
            '.woff2': 'font/woff2'
        }
        res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream')
        res.end(body)
    } catch (error) {
        res.writeHead(404).end(String(error.message))
    }
})
server.listen(3335, '127.0.0.1', () => process.stdout.write('Synthetic preview: http://127.0.0.1:3335\n'))
