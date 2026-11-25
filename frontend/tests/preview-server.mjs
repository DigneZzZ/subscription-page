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
import { createHmac } from 'node:crypto'
import ejs from 'ejs'

import { THEME_PRESETS } from '../src/shared/constants/theme/presets/theme-presets.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../dist')
const base64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64')
const previewOrigin = 'http://127.0.0.1:3335'
const expiryScenarios = {
    'expiry-today': { daysLeft: 0, expiresAt: '2026-11-25T14:00:00Z' },
    'expiry-short': { daysLeft: 4, expiresAt: '2026-11-29T12:00:00Z' },
    'expiry-monthly': { daysLeft: 181, expiresAt: '2027-05-25T12:00:00Z' },
    'expiry-long': { daysLeft: 1826, expiresAt: '2031-11-25T12:00:00Z' },
    'expiry-indefinite': { daysLeft: 26000, expiresAt: '2099-01-01T12:00:00Z' }
}
const trafficScenarios = new Map([
    ['traffic-partial', { limit: 100, used: 28 }],
    ['traffic-low', { limit: 100, used: 80 }],
    ['traffic-critical', { limit: 100, used: 95 }],
    ['traffic-nearly-depleted', { limit: 100, used: 99.75 }],
    ['traffic-depleted', { limit: 100, used: 100 }],
    ['expired-depleted', { limit: 100, used: 100 }],
    ['unlimited', { limit: 0, used: 0 }]
])
// Stand-in for Chatwoot's /packs/js/sdk.js: records every SDK call on
// window.__chatwootCalls and fires chatwoot:ready, exactly like the real SDK
// does after boot. No network, no iframe.
const chatwootSdkStub = `
window.__chatwootCalls = [];
(function () {
  var record = function (name) {
    return function () {
      window.__chatwootCalls.push([name].concat(Array.prototype.slice.call(arguments)));
    };
  };
  window.chatwootSDK = {
    run: function (options) {
      window.__chatwootCalls.push(['run', options]);
      window.$chatwoot = {
        isOpen: false,
        setUser: record('setUser'),
        setCustomAttributes: record('setCustomAttributes'),
        setLocale: record('setLocale'),
        setColorScheme: record('setColorScheme'),
        toggle: function (state) {
          record('toggle').apply(null, arguments);
          var open = state === 'open' ? true : state === 'close' ? false : !window.$chatwoot.isOpen;
          window.$chatwoot.isOpen = open;
          window.dispatchEvent(new CustomEvent(open ? 'chatwoot:opened' : 'chatwoot:closed'));
        }
      };
      setTimeout(function () {
        window.dispatchEvent(new CustomEvent('chatwoot:ready'));
      }, 0);
    }
  };
})();
`
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
                        : scenario === 'compact'
                            ? [app('INCY', true), app('Happ', false)]
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
    const expired = scenario === 'expired' || scenario === 'expired-depleted'
    const trafficLimited = scenario === 'traffic-depleted'
    const halfYearExpiry = scenario === 'compact' || scenario === 'traffic-partial'
    const traffic = trafficScenarios.get(scenario) ?? { limit: 999, used: 0 }
    const user = {
        shortUuid: 'demo-obsidian',
        username: scenario === 'long-name' ? 'W'.repeat(36) : 'GeologVPN_192647_6487',
        userStatus: expired ? 'EXPIRED' : trafficLimited ? 'LIMITED' : 'ACTIVE',
        isActive: !expired && !trafficLimited,
        daysLeft: expired ? -1 : scenario === 'today' ? 0 : halfYearExpiry ? 180 : 3650,
        expiresAt: expired ? '2026-01-01T00:00:00Z' : scenario === 'today'
            ? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
            : halfYearExpiry ? new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString()
                : '2036-09-07T00:00:00Z',
        ...expiryScenarios[scenario],
        trafficLimitBytes: traffic.limit * 1024 ** 3,
        trafficUsedBytes: traffic.used * 1024 ** 3,
        trafficLimit: traffic.limit ? `${traffic.limit} GiB` : '∞',
        trafficUsed: `${traffic.used} GiB`
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
            res.end(chatwootSdkStub)
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
            const themeNumber = Number(options.get('theme'))
            const themeId = Number.isInteger(themeNumber) && themeNumber >= 1 && themeNumber <= 12
                ? themeNumber : 9
            const theme = THEME_PRESETS[themeId]
            const rendered = ejs.render(html, {
                panelData: base64(panel),
                paymentUrl: scenario === 'external-payment' ? 'https://payment.example/renew' : '',
                paymentTariffs: base64(
                    ['no-payment', 'external-payment'].includes(scenario) ||
                    options.get('catalog') === 'off'
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
                paymentReset:
                    ['1', 'shm'].includes(options.get('reset'))
                        ? base64({
                            amount: 99,
                            currency: 'RUB',
                            minPercent: Number(options.get('reset-min')) || 0,
                            dynamic: options.get('reset') === 'shm'
                        })
                        : '',
                supportEmail: options.get('support') === 'email' ? 'support@example.test' : '',
                hwidData: base64({ enabled: true }),
                metaTitle: 'Geolog VPN — preview',
                metaDescription: 'Local synthetic preview',
                // ?chatwoot=1 → widget on an "external" base URL (the preview origin), page launcher;
                // ?chatwoot=proxy → CHATWOOT_PROXY mode: empty base URL, SDK from the page origin;
                // ?chatwoot=native → CHATWOOT_LAUNCHER=native: Chatwoot's own bubble, no page button.
                ...(['1', 'proxy', 'native'].includes(options.get('chatwoot') || '')
                    ? {
                        chatwootBaseUrl: options.get('chatwoot') === 'proxy' ? '' : previewOrigin,
                        chatwootWebsiteToken: 'preview-token',
                        chatwootIdentifierHash: createHmac('sha256', 'preview-secret')
                            .update(panel.response.user.shortUuid)
                            .digest('hex'),
                        chatwootSettings: base64({
                            position: 'right',
                            launcherTitle: '',
                            type: 'standard',
                            launcher: options.get('chatwoot') === 'native' ? 'native' : 'page',
                            hideMessageBubble: options.get('chatwoot') !== 'native',
                            darkMode: 'dark',
                            proxied: options.get('chatwoot') === 'proxy'
                        })
                    }
                    : {
                        chatwootBaseUrl: '',
                        chatwootWebsiteToken: '',
                        chatwootIdentifierHash: '',
                        chatwootSettings: ''
                    }),
                uiPreset: base64({
                    theme: themeId,
                    layout: options.get('layout') || 'obsidian',
                    preview: options.get('preview') === '1',
                    frostTrafficPreview: options.get('traffic-preview') ?? undefined,
                    headerPay: true,
                    fx: []
                }),
                uiThemeColor: theme.bg,
                uiColorScheme: theme.colorScheme
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
