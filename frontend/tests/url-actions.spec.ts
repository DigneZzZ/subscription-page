import { expect, Page, test } from '@playwright/test'

type Call = [string, ...unknown[]]

const hash = (page: Page) => page.evaluate(() => window.location.hash)

const heading = (page: Page) => page.getByRole('heading', { name: 'Ваш доступ. Без границ.' })

test('#pay opens the tariff picker and clears the hash', async ({ page }) => {
    await page.goto('/#pay')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Выберите тариф')).toBeVisible()
    expect(await hash(page)).toBe('')
})

test('#pay is ignored when payment is not configured', async ({ page }) => {
    await page.goto('/?scenario=no-payment#pay')
    await expect(page.getByRole('heading', { name: 'Ваша подписка' })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(await hash(page)).toBe('')
})

test('#support opens the Chatwoot widget when it is configured', async ({ page }) => {
    await page.goto('/?chatwoot=1#support')
    await page.waitForFunction(() => {
        const calls = (window as unknown as { __chatwootCalls?: Call[] }).__chatwootCalls ?? []
        return calls.some((call) => call[0] === 'toggle')
    })
    const calls = await page.evaluate(
        () => (window as unknown as { __chatwootCalls: Call[] }).__chatwootCalls
    )
    expect(calls.filter((call) => call[0] === 'toggle')).toEqual([['toggle', 'open']])
    expect(await hash(page)).toBe('')
})

test('#support without Chatwoot leaves the page as is', async ({ page }) => {
    await page.goto('/#support')
    await expect(heading(page)).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(await page.evaluate(() => window.location.pathname)).toBe('/')
    expect(await hash(page)).toBe('')
})

test('#devices opens the device management modal', async ({ page }) => {
    await page.goto('/#devices')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Устройства')).toBeVisible()
    expect(await hash(page)).toBe('')
})

test('#reset opens the traffic reset confirmation', async ({ page }) => {
    await page.goto('/?reset=1#reset')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Сброс трафика')).toBeVisible()
    expect(await hash(page)).toBe('')
})

test('#reset is ignored when traffic reset is unavailable', async ({ page }) => {
    await page.goto('/#reset')
    await expect(heading(page)).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(await hash(page)).toBe('')
})

test('changing the hash on an open page triggers the action', async ({ page }) => {
    await page.goto('/')
    await expect(heading(page)).toBeVisible()
    await page.evaluate(() => {
        window.location.hash = '#pay'
    })
    await expect(page.getByRole('dialog').getByText('Выберите тариф')).toBeVisible()
    expect(await hash(page)).toBe('')
})

test('unknown hashes are left untouched', async ({ page }) => {
    await page.goto('/#something-else')
    await expect(heading(page)).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(await hash(page)).toBe('#something-else')
})
