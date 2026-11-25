import type { Page } from '@playwright/test'

import { devices, expect, test } from '@playwright/test'

const homeScreenLabel = 'На экран «Домой»'
const telegramFrostUrl = (platform: string) =>
    `/?layout=frost#tgWebAppVersion=8.0&tgWebAppPlatform=${platform}`

const mockTelegramHomeScreen = (
    page: Page,
    status: 'added' | 'missed' | 'unsupported',
    platform: 'android' | 'ios'
) =>
    page.addInitScript(
        ({ platform, status }) => {
            type Receiver = { receiveEvent: (event: string, data?: unknown) => void }
            const telegramWindow = window as Window & {
                Telegram?: { WebView: Receiver }
                TelegramGameProxy?: Receiver
                TelegramWebviewProxy?: { postEvent: (event: string) => void }
            }
            const emit = (event: string, data?: unknown) => {
                const receiver =
                    platform === 'ios'
                        ? telegramWindow.TelegramGameProxy
                        : telegramWindow.Telegram?.WebView
                queueMicrotask(() => receiver?.receiveEvent(event, data))
            }
            telegramWindow.TelegramWebviewProxy = {
                postEvent(event) {
                    if (event === 'web_app_check_home_screen') {
                        document.documentElement.dataset.telegramHomeScreenChecked = 'true'
                        emit('home_screen_checked', { status })
                    } else if (event === 'web_app_add_to_home_screen') {
                        document.documentElement.dataset.telegramHomeScreenAdded = 'true'
                        emit('home_screen_added')
                    }
                }
            }
        },
        { platform, status }
    )

test('Frost fits the full subscription name in its header at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 })
    await page.goto('/?layout=frost&scenario=long-name')

    const name = page.locator('header').getByRole('heading', {
        exact: true,
        level: 1,
        name: 'W'.repeat(36)
    })
    await expect(name).toBeInViewport({ ratio: 1 })
    const textFits = await name.evaluate((heading) => {
        const range = document.createRange()
        range.selectNodeContents(heading)
        const lines = Array.from(range.getClientRects())
        const bounds = heading.getBoundingClientRect()
        return (
            lines.length > 1 &&
            heading.scrollHeight <= heading.clientHeight &&
            lines.every(
                (line) =>
                    line.left >= 0 &&
                    line.left >= bounds.left &&
                    line.right <= bounds.right &&
                    line.right <= window.innerWidth
            )
        )
    })
    expect(textFits).toBe(true)
})

test('Frost places the Telegram shortcut below support and hides it after pinning', async ({
    page
}) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await mockTelegramHomeScreen(page, 'missed', 'ios')
    await page.goto(telegramFrostUrl('ios'))
    await expect(page.locator('html')).toHaveAttribute('data-telegram-home-screen-checked', 'true')

    const pin = page.getByRole('button', { name: homeScreenLabel, exact: true })
    await expect(pin).toBeVisible()
    const support = page.getByRole('link', { name: /Не получается подключиться/ })
    const supportBottom = await support.evaluate(
        (element) => element.getBoundingClientRect().bottom
    )
    const pinTop = await pin.evaluate((element) => element.getBoundingClientRect().top)
    expect(pinTop).toBeGreaterThan(supportBottom)

    await pin.click()
    await expect(page.locator('html')).toHaveAttribute('data-telegram-home-screen-added', 'true')
    await expect(pin).not.toBeVisible()
})

for (const status of ['added', 'unsupported'] as const) {
    test(`Frost hides the Telegram shortcut for status ${status}`, async ({ page }) => {
        await mockTelegramHomeScreen(page, status, 'android')
        await page.goto(telegramFrostUrl('android'))
        await expect(page.locator('html')).toHaveAttribute(
            'data-telegram-home-screen-checked',
            'true'
        )
        await expect(page.getByRole('button', { name: homeScreenLabel, exact: true })).toHaveCount(
            0
        )
    })
}

test.describe('Frost in the iPhone browser', () => {
    test.use({ userAgent: devices['iPhone 13'].userAgent, viewport: { width: 390, height: 844 } })

    test('opens instructions for pinning the page', async ({ page }) => {
        await page.goto('/?layout=frost')
        const pin = page.getByRole('button', { name: homeScreenLabel, exact: true })
        await expect(pin).toBeVisible()
        await pin.click()
        await expect(page.getByRole('dialog', { name: homeScreenLabel })).toContainText('Safari')
    })
})

test.describe('Frost expiry timeline', () => {
    test.use({ timezoneId: 'UTC', viewport: { width: 320, height: 844 } })

    test.beforeEach(async ({ page }) => {
        await page.clock.setFixedTime(new Date('2026-11-25T12:00:00Z'))
    })

    for (const expiry of [
        {
            scenario: 'expiry-today',
            iso: '2026-11-25T14:00:00Z',
            label: '25 ноября 2026',
            minDays: 1,
            maxDays: 1
        },
        {
            scenario: 'expiry-short',
            iso: '2026-11-29T12:00:00Z',
            label: '29 ноября 2026',
            minDays: 4,
            maxDays: 45
        },
        {
            scenario: 'expiry-monthly',
            iso: '2027-05-25T12:00:00Z',
            label: '25 мая 2027',
            minDays: 181,
            maxDays: 366
        },
        {
            scenario: 'expiry-long',
            iso: '2031-11-25T12:00:00Z',
            label: '25 ноября 2031',
            minDays: 365,
            maxDays: 8 * 365
        }
    ]) {
        test(`fits the ${expiry.scenario} dates and positions the expiry marker proportionally`, async ({
            page
        }) => {
            await page.goto(`/?layout=frost&scenario=${expiry.scenario}`)

            const timeline = page.getByRole('img', { name: /Срок подписки/ })
            await expect(timeline).toHaveAccessibleName(new RegExp(expiry.label))
            await expect(timeline).toBeInViewport({ ratio: 1 })
            await expect(timeline.locator('time').first()).toHaveText('Сегодня')
            const ticks = await timeline.locator('time').evaluateAll((elements) =>
                elements.map((element) => {
                    const { left, right } = element.getBoundingClientRect()
                    return {
                        date: Date.parse((element as HTMLTimeElement).dateTime),
                        inViewport: left >= 0 && right <= window.innerWidth,
                        left,
                        right
                    }
                })
            )
            const dates = ticks.map((tick) => tick.date)
            expect(dates).toHaveLength(4)
            expect(dates).toEqual([...dates].sort((left, right) => left - right))
            expect(
                ticks.every(
                    (tick, index) => tick.inViewport && (!index || ticks[index - 1].right < tick.left)
                )
            ).toBe(true)
            const today = dates[0]
            const end = dates[dates.length - 1]
            const horizonDays = (end - today) / (24 * 60 * 60 * 1000)
            expect(horizonDays).toBeGreaterThanOrEqual(expiry.minDays)
            expect(horizonDays).toBeLessThanOrEqual(expiry.maxDays)

            const marker = timeline.locator('[data-frost-expiry-marker]')
            await expect(marker).toBeVisible()
            const position = await marker.evaluate((element) =>
                Number.parseFloat(element.style.left)
            )
            expect(position).toBeGreaterThan(0)
            expect(position).toBeLessThanOrEqual(100)
            expect(position).toBeCloseTo(
                ((Date.parse(expiry.iso) - today) / (end - today)) * 100,
                2
            )
        })
    }

    test('omits the dated scale for expired or indefinite subscriptions', async ({ page }) => {
        await page.goto('/?layout=frost&scenario=expired')
        await expect(page.getByRole('status')).toHaveText('Подписка истекла')
        await expect(page.locator('[aria-label^="Срок подписки"]')).toHaveCount(0)

        await page.goto('/?layout=frost&scenario=expiry-indefinite')
        await expect(page.getByRole('status')).toHaveText('Без ограничения срока')
        await expect(page.locator('[aria-label^="Срок подписки"]')).toHaveCount(0)
    })
})

test('Frost uses a desktop sidebar and places expiry and connection side by side', async ({
    page
}) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/?layout=frost')
    const nav = page.getByRole('navigation', { name: 'Разделы' })
    const home = page.getByRole('region', { name: 'Подписка' })
    const expiry = home.locator('[data-state="active"]')
    const connection = home.locator('section').filter({
        has: page.getByRole('heading', { exact: true, name: 'Подключение' })
    })
    await expect(connection).toBeVisible()
    const [navBox, expiryBox, connectionBox] = await Promise.all([
        nav.boundingBox(),
        expiry.boundingBox(),
        connection.boundingBox()
    ])
    if (!navBox || !expiryBox || !connectionBox) throw new Error('Frost desktop cards are missing')
    expect(navBox.x + navBox.width).toBeLessThan(expiryBox.x)
    expect(expiryBox.x + expiryBox.width).toBeLessThan(connectionBox.x)
    expect(expiryBox.y).toBeCloseTo(connectionBox.y, 0)
    await expect(expiry.getByRole('button', { name: 'Продлить' })).toBeInViewport()
    await expect(page.getByRole('link', { name: /Подключиться в/ })).toBeInViewport()
})

test('Frost enters once across tab changes and respects reduced motion', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.addInitScript(() => {
        let entries = 0
        document.addEventListener('animationstart', (event) => {
            if (event.animationName.includes('frost-enter')) {
                entries += 1
                document.documentElement.dataset.frostEntries = String(entries)
            }
        })
    })
    await page.goto('/?layout=frost')
    const html = page.locator('html')
    const nav = page.getByRole('navigation')
    await expect(html).toHaveAttribute('data-frost-entries', '1')
    await nav.getByRole('button', { name: 'Трафик', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Основной трафик' })).toBeVisible()
    await nav.getByRole('button', { name: 'Подписка', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Подключение' })).toBeVisible()
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.evaluate(
        () =>
            new Promise<void>((resolve) => {
                window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()))
            })
    )
    await expect(html).toHaveAttribute('data-frost-entries', '1')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()
    await expect(page.locator('[data-layout="frost"]')).toHaveCSS('animation-name', 'none')
    await expect(html).not.toHaveAttribute('data-frost-entries', /\d/)
})

test('Frost keeps app selection, configuration links and QR sharing functional', async ({
    page
}) => {
    await page.goto('/?layout=frost')
    const apps = page.getByRole('group', { name: 'Выберите приложение' })
    await expect(apps.getByRole('button')).toHaveCount(3)
    await apps.getByRole('button', { name: /Hiddify/ }).click()
    await expect(page.getByRole('link', { name: 'Подключиться в Hiddify' })).toHaveAttribute(
        'href',
        /hiddify:\/\/import\/http.*demo-obsidian/
    )
    await page.getByRole('button', { name: 'Android', exact: true }).click()
    await expect(apps.getByRole('button', { name: /Hiddify/ })).toHaveAttribute(
        'aria-pressed',
        'true'
    )
    await expect(page.getByRole('link', { name: 'Скачать Hiddify' })).toHaveAttribute(
        'href',
        'https://download.example/hiddify'
    )
    await page.getByRole('button', { name: 'Поделиться', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('img', { name: 'QR-код подписки' }).locator('svg')).toHaveCount(1)
    await expect(dialog.getByRole('textbox')).toHaveValue('http://127.0.0.1:3335/demo-obsidian')
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    const connect = page.getByRole('link', { name: 'Подключиться в Hiddify' })
    await connect.evaluate((element) =>
        element.addEventListener('click', (event) => event.preventDefault())
    )
    await connect.click()
    await expect(page.getByRole('dialog')).toContainText('Инструкция по подключению · Hiddify')
    await expect(
        page.getByRole('dialog').getByRole('button', { name: 'Добавить в Hiddify' })
    ).toBeVisible()
})

test('Frost renewal uses configured tariff IDs and preserves traffic reset', async ({ page }) => {
    await page.goto('/?layout=frost&reset=1')
    await page.getByRole('button', { name: 'Продлить', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Магазин', exact: true })).toBeVisible()
    await page.getByRole('button', { name: /3 месяца/ }).click()
    await expect(page.getByRole('link', { name: /Оплатить/ })).toHaveAttribute(
        'href',
        '/api/pay?shortUuid=demo-obsidian&id=102'
    )
    await page.getByRole('button', { name: 'Трафик', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Основной трафик' })).toBeVisible()
    await expect(page.getByRole('progressbar', { name: 'Остаток трафика' })).toHaveAttribute(
        'aria-valuenow',
        '100'
    )
    await expect(page.getByRole('button', { name: /Сбросить трафик/ })).toBeVisible()
})

test.describe('Frost traffic preview', () => {
    test.use({ viewport: { width: 320, height: 844 } })

    test('is hidden for older payloads, off and unknown modes', async ({ page }) => {
        const url = '/?layout=frost&scenario=traffic-partial'
        const navTraffic = page
            .getByRole('navigation')
            .getByRole('button', { name: 'Трафик', exact: true })

        await page.goto(url)
        await expect(navTraffic).toBeVisible()
        await expect(page.locator('[data-traffic-preview]')).toHaveCount(0)

        await page.goto(`${url}&traffic-preview=off`)
        await expect(navTraffic).toBeVisible()
        await expect(page.locator('[data-traffic-preview]')).toHaveCount(0)

        await page.goto(`${url}&traffic-preview=unknown`)
        await expect(navTraffic).toBeVisible()
        await expect(page.locator('[data-traffic-preview]')).toHaveCount(0)
    })

    for (const mode of ['separate', 'inline', 'nav'] as const) {
        test(`shows the ${mode} placement and opens traffic management`, async ({ page }) => {
            await page.goto(
                `/?layout=frost&scenario=traffic-partial&traffic-preview=${mode}&reset=1&reset-min=20`
            )

            const home = page.getByRole('region', { name: 'Подписка' })
            const expiry = home.locator('[data-state="active"]')
            const navTraffic = page
                .getByRole('navigation')
                .getByRole('button', { name: 'Трафик', exact: true })
            const summaryButton = { name: 'Остаток трафика', exact: true }
            const preview = {
                separate: home
                    .locator('[data-state="active"] + [data-traffic-preview="separate"]')
                    .and(home.getByRole('button', summaryButton)),
                inline: expiry.getByRole('button', summaryButton),
                nav: navTraffic
            }[mode]

            await expect(preview).toHaveAttribute('data-traffic-preview', mode)
            await expect(preview).toHaveAttribute('data-traffic-state', 'normal')
            await expect(preview).toHaveAccessibleDescription(/72(?:[.,]0)? Gi?B.*72%/)
            await expect(page.locator('[data-traffic-preview]')).toHaveCount(1)
            if (mode !== 'nav') await expect(preview).toContainText('72%')
            await preview.click()

            await expect(navTraffic).toHaveAttribute('aria-current', 'page')
            await expect(page.getByRole('heading', { name: 'Основной трафик' })).toBeVisible()
            await expect(page.getByRole('dialog')).toHaveCount(0)
            await expect(
                page.getByRole('progressbar', { name: 'Остаток трафика' })
            ).toHaveAttribute('aria-valuenow', '72')
            await expect(page.getByRole('button', { name: /Сбросить трафик/ })).toBeVisible()
            await expect(page.locator(`[data-traffic-preview="${mode}"]`)).not.toBeVisible()
        })
    }

    for (const { mode, percent, scenario, state } of [
        { mode: 'inline', percent: 20, scenario: 'traffic-low', state: 'low' },
        { mode: 'nav', percent: 5, scenario: 'traffic-critical', state: 'critical' },
        { mode: 'separate', percent: 0, scenario: 'traffic-nearly-depleted', state: 'critical' }
    ]) {
        test(`marks ${scenario} on the ${mode} preview and Traffic without a Home reset CTA`, async ({
            page
        }) => {
            await page.goto(`/?layout=frost&scenario=${scenario}&traffic-preview=${mode}&reset=1`)
            const preview = page.locator(`[data-traffic-preview="${mode}"]`)
            await expect(preview).toHaveAttribute('data-traffic-state', state)
            const warningColor = await preview.evaluate(
                (element, token) => getComputedStyle(element).getPropertyValue(token).trim(),
                state === 'low' ? '--fr-warning' : '--fr-destructive'
            )
            expect(warningColor).not.toBe('')
            await expect(preview).toHaveCSS('--fr-traffic-color', warningColor)
            if (percent === 0) await expect(preview).toHaveAccessibleDescription(/<1%/)
            await expect(page.locator('[data-traffic-reset]')).toHaveCount(0)
            await preview.click()

            const progress = page.getByRole('progressbar', { name: 'Остаток трафика' })
            const card = page.locator('[data-traffic-state]').filter({ has: progress })
            await expect(card).toHaveAttribute('data-traffic-state', state)
            await expect(card).toHaveCSS('--fr-traffic-color', warningColor)
            await expect(progress).toHaveAttribute('aria-valuenow', String(percent))
            await expect(page.getByRole('dialog')).toHaveCount(0)
        })
    }

    test('represents depleted and unlimited traffic without a misleading gauge', async ({
        page
    }) => {
        await page.goto('/?layout=frost&scenario=traffic-depleted&traffic-preview=inline')
        const preview = page.getByRole('button', { name: 'Остаток трафика', exact: true })
        await expect(preview).toHaveAccessibleDescription(/0 B.*0%/)
        await expect(preview).toHaveAttribute('data-traffic-state', 'exhausted')
        await expect(page.locator('[data-traffic-reset]')).toHaveCount(0)

        await page.goto('/?layout=frost&scenario=unlimited&traffic-preview=nav&reset=1&reset-min=0')
        const navTraffic = page
            .getByRole('navigation')
            .getByRole('button', { name: 'Трафик', exact: true })
        await expect(navTraffic).toHaveAccessibleDescription('Безлимит')
        await expect(navTraffic.getByText('∞', { exact: true })).toBeVisible()
        await expect(navTraffic).not.toContainText('%')
        await expect(page.locator('[data-traffic-reset]')).toHaveCount(0)
    })

    test('does not change the Obsidian layout', async ({ page }) => {
        await page.goto('/?layout=obsidian&scenario=traffic-partial&traffic-preview=separate')
        const summary = page.getByRole('region', { name: 'Ваша подписка' })
        await expect(summary.getByRole('progressbar', { name: 'Трафик' })).toHaveAttribute(
            'aria-valuenow',
            '28'
        )
        await expect(page.locator('[data-traffic-preview]')).toHaveCount(0)
    })
})

test.describe('Frost exhausted traffic reset', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.open = (url) => {
                document.body.dataset.openedUrl = String(url)
                return null
            }
        })
    })

    test('opens the existing confirmation from Home with traffic preview off', async ({ page }) => {
        await page.goto('/?layout=frost&scenario=traffic-depleted&traffic-preview=off&reset=1')
        const resetButton = page
            .getByRole('button', { name: 'Сбросить трафик', exact: true })
            .and(page.locator('[data-traffic-reset]'))
        await expect(resetButton).toBeVisible()
        await expect(page.locator('[data-traffic-preview]')).toHaveCount(0)
        await resetButton.click()

        const dialog = page.getByRole('dialog')
        await expect(dialog).toContainText('Сбросить трафик за 99')
        await expect(page.locator('body')).not.toHaveAttribute('data-opened-url')
        const progress = page.getByRole('progressbar', {
            includeHidden: true,
            name: 'Остаток трафика'
        })
        const card = page.locator('[data-traffic-state]').filter({ has: progress })
        await expect(card).toBeVisible()
        await expect(card).toHaveAttribute('data-traffic-state', 'exhausted')
        await dialog.getByRole('button', { name: 'Оплатить', exact: true }).click()
        await expect(page.locator('body')).toHaveAttribute(
            'data-opened-url',
            '/api/pay/reset?shortUuid=demo-obsidian'
        )
    })

    test('opens the SHM provider from Home in the same click', async ({ page }) => {
        await page.goto('/?layout=frost&scenario=traffic-depleted&traffic-preview=nav&reset=shm')
        const resetButton = page
            .getByRole('button', { name: 'Сбросить трафик', exact: true })
            .and(page.locator('[data-traffic-reset]'))
        await expect(resetButton).toBeVisible()
        await resetButton.click()

        await expect(page.locator('body')).toHaveAttribute(
            'data-opened-url',
            '/api/pay/reset?shortUuid=demo-obsidian'
        )
        await expect(page.getByRole('heading', { name: 'Основной трафик' })).toBeVisible()
        await expect(page.getByRole('dialog')).toHaveCount(0)
    })

    test('prioritizes expired renewal and keeps the filled reset button on Traffic', async ({
        page
    }) => {
        await page.setViewportSize({ width: 320, height: 844 })
        await page.goto('/?layout=frost&scenario=expired-depleted&traffic-preview=inline&reset=1')

        const expiry = page.locator('[data-expired]')
        const status = expiry.getByRole('status')
        const dateLabel = expiry.getByText('Действовала до', { exact: true })
        await expect(status).toHaveText('Подписка истекла')
        await expect(dateLabel).toBeVisible()
        const [statusY, dateLabelY] = await Promise.all([
            status.evaluate((element) => element.getBoundingClientRect().top),
            dateLabel.evaluate((element) => element.getBoundingClientRect().top)
        ])
        expect(statusY).toBeLessThan(dateLabelY)
        await expect(
            page.locator('[data-renewal-needed]').getByRole('link', { name: /Подключиться в/ })
        ).toBeVisible()
        await expect(page.locator('[data-traffic-reset]')).toHaveCount(0)

        const renew = expiry.getByRole('button', { name: 'Продлить подписку', exact: true })
        await expect(renew).toBeInViewport({ ratio: 1 })
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
        ).toBe(true)
        await renew.click()
        await expect(page.getByRole('heading', { name: 'Магазин', exact: true })).toBeVisible()
        await page.getByRole('button', { name: /3 месяца/ }).click()
        await expect(page.getByRole('link', { name: /Оплатить/ })).toHaveAttribute(
            'href',
            '/api/pay?shortUuid=demo-obsidian&id=102'
        )

        await page
            .getByRole('navigation')
            .getByRole('button', { name: 'Подписка', exact: true })
            .click()
        const preview = page.getByRole('button', { name: 'Остаток трафика', exact: true })
        await expect(preview).toHaveAttribute('data-traffic-state', 'exhausted')
        await preview.click()
        await expect(page.getByRole('heading', { name: 'Основной трафик' })).toBeVisible()
        await expect(page.getByRole('dialog')).toHaveCount(0)
        await expect(page.locator('body')).not.toHaveAttribute('data-opened-url')

        const reset = page
            .getByRole('button', { name: /Сбросить трафик/ })
            .and(page.locator('[data-traffic-reset-action]'))
        await expect(reset).toHaveAttribute('aria-haspopup', 'dialog')
        await expect(reset).toContainText(/99\s*₽/)
        const hasAccentFill = await reset.evaluate((element) => {
            const style = getComputedStyle(element)
            const accent = style.getPropertyValue('--fr-accent').trim()
            const context = document.createElement('canvas').getContext('2d')
            if (!context || !accent) return false
            context.fillStyle = accent
            const accentColor = context.fillStyle
            context.fillStyle = style.backgroundColor
            return context.fillStyle === accentColor
        })
        expect(hasAccentFill).toBe(true)
        await reset.click()
        await expect(page.getByRole('dialog')).toContainText('Сбросить трафик за 99')
        await expect(page.locator('body')).not.toHaveAttribute('data-opened-url')
    })
})

test('Frost device removal requires confirmation and handles authorization expiry', async ({
    page
}) => {
    let deletions = 0
    await page.route('**/api/devices/status?*', async (route) =>
        route.fulfill({
            json: {
                enabled: true,
                mode: 'telegram',
                telegramLinked: true,
                deviceCount: 1,
                deviceLimit: 5
            }
        })
    )
    await page.route('**/api/devices?*', async (route) =>
        route.fulfill({
            json: {
                ok: true,
                devices: [
                    {
                        hwid: 'synthetic-phone',
                        deviceModel: 'Test Phone',
                        platform: 'iOS',
                        osVersion: 'iOS 18',
                        createdAt: '2026-01-01T00:00:00Z'
                    }
                ],
                total: 1,
                limit: 5
            }
        })
    )
    await page.route('**/api/devices/delete', async (route) => {
        deletions += 1
        await route.fulfill({ status: 403, json: { ok: false } })
    })
    await page.goto('/?layout=frost')
    await page.getByRole('button', { name: 'Устройства', exact: true }).click()
    await expect(page.getByText('Test Phone', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Удалить устройство Test Phone' }).click()
    expect(deletions).toBe(0)
    await page.getByRole('button', { name: 'Отмена', exact: true }).click()
    expect(deletions).toBe(0)
    await page.getByRole('button', { name: 'Удалить устройство Test Phone' }).click()
    await page.getByRole('button', { name: 'Удалить', exact: true }).click()
    await expect.poll(() => deletions).toBe(1)
    await expect(page.getByRole('dialog')).toBeVisible()
})

for (const width of [320, 390, 768, 1440]) {
    test(`Frost stays within ${width}px and all sections remain reachable`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 })
        await page.goto('/?layout=frost&scenario=many')
        await page.getByRole('button', { name: 'Поделиться', exact: true }).click()
        const dialog = page.getByRole('dialog')
        await expect(dialog).toBeVisible()
        await expect
            .poll(async () => {
                const bounds = await dialog.boundingBox()
                return Boolean(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width)
            })
            .toBe(true)
        await page.keyboard.press('Escape')
        await expect(dialog).not.toBeVisible()
        for (const name of ['Подписка', 'Трафик', 'Устройства', 'Магазин']) {
            await page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
            await expect(page.getByRole('navigation')).toBeInViewport()
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
            ).toBe(true)
        }
    })
}

test('Frost handles empty apps, missing payment and expired subscription', async ({ page }) => {
    await page.goto('/?layout=frost&scenario=empty')
    await expect(page.getByText('Приложения для подключения пока не настроены.')).toBeVisible()
    await expect(page.getByRole('link', { name: /Подключиться в/ })).toHaveCount(0)
    await page.goto('/?layout=frost&scenario=no-payment')
    await expect(page.getByRole('button', { name: 'Продлить', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Магазин', exact: true })).toHaveCount(0)
    await page.goto('/?layout=frost&scenario=expired')
    await expect(page.getByRole('status')).toContainText('Подписка истекла')
})

test('Frost keeps access active during its last day and preserves email support', async ({
    page
}) => {
    await page.goto('/?layout=frost&scenario=today&support=email')
    await expect(page.getByRole('status')).not.toContainText('Подписка истекла')
    await expect(
        page.getByRole('link', { name: 'Написать на email', exact: true })
    ).toHaveAttribute('href', 'mailto:support@example.test')
})

test('Frost hides the catalog for an external payment link and keeps renewal working', async ({
    page
}) => {
    await page.goto('/?layout=frost&scenario=external-payment')
    await expect(page.getByRole('button', { name: 'Магазин', exact: true })).toHaveCount(0)
    await page.evaluate(() => {
        window.open = (url) => {
            document.body.dataset.openedUrl = String(url)
            return null
        }
    })
    await page.getByRole('button', { name: 'Продлить', exact: true }).click()
    await expect(page.locator('body')).toHaveAttribute(
        'data-opened-url',
        'https://payment.example/renew'
    )
})

test('Frost keeps static reset confirmation and respects the usage threshold', async ({ page }) => {
    await page.goto('/?layout=frost&reset=1&reset-min=50')
    await page.getByRole('button', { name: 'Трафик', exact: true }).click()
    await expect(page.getByRole('button', { name: /Сбросить трафик/ })).toHaveCount(0)

    await page.goto('/?layout=frost&reset=1')
    await page.evaluate(() => {
        window.open = (url) => {
            document.body.dataset.openedUrl = String(url)
            return null
        }
    })
    await page.getByRole('button', { name: 'Трафик', exact: true }).click()
    await page.getByRole('button', { name: /Сбросить трафик/ }).click()
    await expect(page.getByRole('dialog')).toContainText('Сбросить трафик за 99')
    await expect(page.locator('body')).not.toHaveAttribute('data-opened-url')
    await page.getByRole('dialog').getByRole('button', { name: 'Оплатить', exact: true }).click()
    await expect(page.locator('body')).toHaveAttribute(
        'data-opened-url',
        '/api/pay/reset?shortUuid=demo-obsidian'
    )
})

test('Frost opens SHM reset even with no subscription catalog', async ({ page }) => {
    await page.goto('/?layout=frost&scenario=no-payment&reset=shm')
    await expect(page.getByRole('button', { name: 'Магазин', exact: true })).toHaveCount(0)
    await page.evaluate(() => {
        window.open = (url) => {
            document.body.dataset.openedUrl = String(url)
            return null
        }
    })
    await page.getByRole('button', { name: 'Трафик', exact: true }).click()
    await page.getByRole('button', { name: /Сбросить трафик/ }).click()
    await expect(page.locator('body')).toHaveAttribute(
        'data-opened-url',
        '/api/pay/reset?shortUuid=demo-obsidian'
    )
    await expect(page.getByRole('dialog')).toHaveCount(0)
})
