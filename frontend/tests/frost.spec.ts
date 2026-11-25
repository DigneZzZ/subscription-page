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
