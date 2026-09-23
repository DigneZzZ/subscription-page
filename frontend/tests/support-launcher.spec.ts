import { expect, Page, test } from '@playwright/test'

type Call = [string, ...unknown[]]

const calls = (page: Page) =>
    page.evaluate(() => (window as unknown as { __chatwootCalls: Call[] }).__chatwootCalls)

const launcher = (page: Page) => page.getByRole('button', { name: /Поддержка|Закрыть чат/ })

test('no launcher without Chatwoot', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Ваш доступ. Без границ.' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Поддержка/ })).toHaveCount(0)
})

test('the page launcher opens and closes the chat and hides the native bubble', async ({
    page
}) => {
    await page.goto('/?chatwoot=1')
    const button = launcher(page)
    await expect(button).toBeVisible()
    await expect(button).toHaveAccessibleName('Поддержка')
    const settings = await page.evaluate(
        () =>
            (window as unknown as { chatwootSettings: { hideMessageBubble: boolean } })
                .chatwootSettings
    )
    expect(settings.hideMessageBubble).toBe(true)

    await button.click()
    await expect
        .poll(async () => (await calls(page)).filter((c) => c[0] === 'toggle'))
        .toEqual([['toggle', 'open']])
    await expect(button).toHaveAccessibleName('Закрыть чат')

    await button.click()
    await expect
        .poll(async () => (await calls(page)).filter((c) => c[0] === 'toggle'))
        .toEqual([
            ['toggle', 'open'],
            ['toggle', 'close']
        ])
    await expect(button).toHaveAccessibleName('Поддержка')
})

test('an incoming agent message marks the launcher until the chat is opened', async ({ page }) => {
    await page.goto('/?chatwoot=1')
    const button = launcher(page)
    await expect(button).toBeVisible()
    await page.evaluate(() => {
        window.dispatchEvent(
            new CustomEvent('chatwoot:on-message', {
                detail: { data: { message_type: 1, content: 'hi' } }
            })
        )
    })
    await expect(button).toHaveAccessibleName('Поддержка, новое сообщение')
    await button.click()
    await expect(button).toHaveAccessibleName('Закрыть чат')
    await button.click()
    await expect(button).toHaveAccessibleName('Поддержка')
})

test('the launcher follows the page language', async ({ page }) => {
    await page.goto('/?chatwoot=1')
    await expect(launcher(page)).toHaveAccessibleName('Поддержка')
    await page
        .getByRole('button')
        .filter({ has: page.locator('svg.tabler-icon-language') })
        .click()
    await page.getByRole('menuitem', { name: 'English' }).click()
    await expect(page.getByRole('button', { name: 'Support', exact: true })).toBeVisible()
})

test('native launcher mode keeps the Chatwoot bubble and renders no page button', async ({
    page
}) => {
    await page.goto('/?chatwoot=native')
    await expect(page.getByRole('heading', { name: 'Ваш доступ. Без границ.' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Поддержка/ })).toHaveCount(0)
    const settings = await page.evaluate(
        () =>
            (window as unknown as { chatwootSettings: { hideMessageBubble: boolean } })
                .chatwootSettings
    )
    expect(settings.hideMessageBubble).toBe(false)
})

test('the launcher stays inside a phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 700 })
    await page.goto('/?chatwoot=1')
    const box = await launcher(page).boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x + box!.width).toBeLessThanOrEqual(390)
    expect(box!.y + box!.height).toBeLessThanOrEqual(700)
})
