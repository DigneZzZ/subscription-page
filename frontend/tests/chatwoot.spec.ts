import { expect, Page, test } from '@playwright/test'

type Call = [string, ...unknown[]]

const calls = (page: Page) =>
    page.evaluate(() => (window as unknown as { __chatwootCalls: Call[] }).__chatwootCalls)

const waitForCall = async (page: Page, name: string, after = 0) => {
    await page.waitForFunction(
        ([n, a]) => {
            const list = (window as unknown as { __chatwootCalls?: Call[] }).__chatwootCalls ?? []
            return list.slice(a as number).some((call) => call[0] === n)
        },
        [name, after]
    )
    return (await calls(page)).slice(after).filter((call) => call[0] === name)
}

const languageButton = (page: Page) =>
    page.getByRole('button').filter({ has: page.locator('svg.tabler-icon-language') })

test('the widget is not loaded unless Chatwoot is configured', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Ваш доступ. Без границ.' })).toBeVisible()
    await expect(page.locator('script[src*="/packs/js/sdk.js"]')).toHaveCount(0)
    expect(await page.evaluate(() => 'chatwootSDK' in window)).toBe(false)
})

test('the widget boots with server settings and identifies the subscriber', async ({ page }) => {
    await page.goto('/?chatwoot=1')
    const [run] = await waitForCall(page, 'run')
    expect(run[1]).toEqual({ websiteToken: 'preview-token', baseUrl: 'http://127.0.0.1:3335' })

    const settings = await page.evaluate(
        () => (window as unknown as { chatwootSettings: unknown }).chatwootSettings
    )
    expect(settings).toEqual({
        position: 'right',
        launcherTitle: '',
        hideMessageBubble: false,
        darkMode: 'dark',
        proxied: false,
        locale: 'ru'
    })

    const [setUser] = await waitForCall(page, 'setUser')
    expect(setUser[1]).toBe('demo-obsidian')
    const user = setUser[2] as Record<string, unknown>
    expect(user.identifier_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(user.name).toBe('GeologVPN_192647_6487')
    expect(user).not.toHaveProperty('email')
    expect(user.custom_attributes).toEqual(
        expect.objectContaining({
            short_uuid: 'demo-obsidian',
            username: 'GeologVPN_192647_6487',
            status: 'ACTIVE'
        })
    )

    const [attrs] = await waitForCall(page, 'setCustomAttributes')
    expect(attrs[1]).toEqual({ source: 'subscription_page' })
})

test('the widget follows the page language and color scheme', async ({ page }) => {
    await page.goto('/?chatwoot=1')
    const [locale] = await waitForCall(page, 'setLocale')
    expect(locale[1]).toBe('ru')
    const [scheme] = await waitForCall(page, 'setColorScheme')
    expect(scheme[1]).toBe('dark')

    const before = (await calls(page)).length
    await languageButton(page).click()
    await page.getByRole('menuitem', { name: 'English' }).click()
    const [changed] = await waitForCall(page, 'setLocale', before)
    expect(changed[1]).toBe('en')
})

test('proxy mode loads the SDK and runs the widget from the page origin', async ({ page }) => {
    await page.goto('/?chatwoot=proxy')
    const [run] = await waitForCall(page, 'run')
    expect(run[1]).toEqual({ websiteToken: 'preview-token', baseUrl: 'http://127.0.0.1:3335' })
    await expect(page.locator('script[src="http://127.0.0.1:3335/packs/js/sdk.js"]')).toHaveCount(1)
    const [setUser] = await waitForCall(page, 'setUser')
    expect(setUser[1]).toBe('demo-obsidian')
})
