import { expect, test } from '@playwright/test'

test('multiple recommendations keep their own instructions and import URLs', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Ваш доступ. Без границ.' })).toBeVisible()
    const apps = page.getByRole('group', { name: 'Выберите приложение' })
    await expect(apps.getByRole('radio')).toHaveCount(3)
    await expect(apps.getByRole('radio').nth(0)).toHaveAccessibleName(/INCY.*Рекомендуем/)
    await expect(apps.getByRole('radio').nth(1)).toHaveAccessibleName(/Hiddify.*Рекомендуем/)
    await expect(apps.getByRole('radio').nth(2)).toHaveAccessibleName(/Happ.*Альтернатива/)
    await apps.getByRole('radio', { name: /Hiddify/ }).check()
    await expect(
        page.getByRole('heading', { name: /Инструкция по настройке · Hiddify/ })
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Скачать Hiddify' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Добавить в INCY' })).toHaveCount(0)
    await page.evaluate(() => {
        window.open = (url) => {
            document.body.dataset.openedUrl = String(url)
            return null
        }
    })
    await page.getByRole('button', { name: 'Добавить в Hiddify' }).click()
    await expect(page.locator('body')).toHaveAttribute(
        'data-opened-url',
        /hiddify:\/\/import\/.*demo-obsidian/
    )
    await page.getByRole('textbox', { name: 'Ваше устройство' }).click()
    await page.getByRole('option', { name: 'Apple TV', exact: true }).click()
    await expect(apps.getByRole('radio')).toHaveCount(1)
    await expect(apps.getByRole('radio', { name: /INCY/ })).toBeChecked()
    await expect(page.getByRole('button', { name: 'Добавить в INCY' })).toBeVisible()
})

test('device dropdown is focusable and app choices work with the keyboard', async ({ page }) => {
    await page.goto('/')
    const device = page.getByRole('textbox', { name: 'Ваше устройство' })
    await device.focus()
    await expect(device).toBeFocused()
    await device.click()
    await expect(page.getByRole('option')).toHaveCount(6)
    await expect(
        page.getByRole('option', { name: 'Android', exact: true }).locator('svg')
    ).toHaveCount(1)
    await page.getByRole('option', { name: 'Android', exact: true }).click()
    await expect(device).toHaveValue('Android')
    await device.press('Space')
    await device.press('Escape')
    await expect(page.getByRole('listbox')).not.toBeVisible()
    const incy = page.getByRole('radio', { name: /INCY/ })
    await incy.focus()
    await incy.press('ArrowRight')
    await expect(page.getByRole('radio', { name: /Hiddify/ })).toBeChecked()
})

test('renewal opens configured tariffs and uses the selected tariff ID', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Продлить подписку', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Выберите тариф')).toBeVisible()
    await page.evaluate(() => {
        window.open = (url) => {
            document.body.dataset.openedUrl = String(url)
            return null
        }
    })
    await dialog.getByRole('button', { name: /3 месяца/ }).click()
    await expect(page.locator('body')).toHaveAttribute(
        'data-opened-url',
        '/api/pay?shortUuid=demo-obsidian&id=102'
    )
    await expect(dialog).not.toBeVisible()
})

test('missing payment configuration does not show a renewal action', async ({ page }) => {
    await page.goto('/?scenario=no-payment')
    await expect(page.getByRole('heading', { name: 'Ваша подписка' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Продлить подписку|Оплатить/ })).toHaveCount(0)
})

test('single, empty and unfeatured application configurations are usable', async ({ page }) => {
    await page.goto('/?scenario=single')
    await expect(
        page.getByRole('group', { name: 'Выберите приложение' }).getByRole('radio')
    ).toHaveCount(1)
    await page.goto('/?scenario=empty')
    await expect(page.getByRole('heading', { name: 'Ваша подписка' })).toBeVisible()
    await expect(page.getByRole('group', { name: 'Выберите приложение' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Настроить устройство' })).toHaveCount(0)
    await page.goto('/?scenario=no-featured')
    await expect(page.getByRole('radio', { name: /Happ/ })).toBeChecked()
    await expect(page.getByText('Рекомендуем', { exact: true })).toHaveCount(0)
})

test('unlimited and expired subscriptions display actual status', async ({ page }) => {
    await page.goto('/?scenario=unlimited')
    await expect(page.getByText('Безлимит', { exact: true })).toBeVisible()
    await expect(page.getByRole('progressbar', { name: 'Трафик' })).toHaveCount(0)
    await page.goto('/?scenario=expired')
    await expect(page.getByText('Неактивна', { exact: true })).toBeVisible()
    await expect(page.getByText('Активна', { exact: true })).toHaveCount(0)
})

for (const width of [320, 390, 768, 1440]) {
    test(`multiple apps fit a ${width}px screen`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 })
        await page.goto('/?scenario=many')
        await expect(
            page.getByRole('combobox', { name: 'Выберите приложение' }).locator('option')
        ).toHaveCount(5)
        await page
            .getByRole('combobox', { name: 'Выберите приложение' })
            .selectOption({ label: 'Another Client' })
        await expect(page.getByRole('button', { name: 'Добавить в Another Client' })).toBeVisible()
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
        ).toBeTruthy()
        expect(
            await page
                .locator('img')
                .evaluateAll((images) =>
                    images.every((img) => img.complete && img.naturalWidth > 0)
                )
        ).toBeTruthy()
    })
}

test('reduced motion disables the crystal animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    const crystal = page.locator('picture img')
    await expect(crystal).toBeVisible()
    expect(await crystal.evaluate((el) => getComputedStyle(el).animationName)).toBe('none')
})

test('previous layout remains available and supports multiple recommendations', async ({
    page
}) => {
    await page.goto('/?layout=classic')
    await expect(
        page.getByRole('group', { name: 'Выберите приложение' }).getByRole('radio')
    ).toHaveCount(3)
    await page.getByRole('radio', { name: /Hiddify/ }).check()
    await expect(page.getByRole('button', { name: 'Добавить в Hiddify' })).toBeVisible()
})

test('crystal follows the pointer, resets on leave and respects reduced motion', async ({
    page
}) => {
    await page.goto('/')
    const crystal = page.locator('picture').locator('..')
    const intro = crystal.locator('..')
    const box = await intro.boundingBox()
    if (!box) throw new Error('Hero missing')
    await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.25)
    await expect
        .poll(() => crystal.evaluate((el) => el.style.getPropertyValue('--crystal-x')))
        .not.toBe('')
    await expect
        .poll(() => crystal.evaluate((el) => el.style.getPropertyValue('--crystal-ry')))
        .not.toBe('0deg')
    await page.mouse.move(0, 0)
    await expect
        .poll(() => crystal.evaluate((el) => el.style.getPropertyValue('--crystal-x')))
        .toBe('')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.25)
    await expect.poll(() => crystal.evaluate((el) => getComputedStyle(el).transform)).toBe('none')
    await expect(intro.getByText('Geolog VPN', { exact: true })).toHaveCount(0)
})

test('crystal shatters once and restores itself after repeated clicks', async ({ page }) => {
    await page.goto('/')
    const trigger = page.getByRole('button', { name: 'Расколоть и собрать кристалл' })
    await trigger.focus()
    await trigger.press('Enter')
    await expect(trigger).toHaveAttribute('data-burst', 'active')
    await expect(page.locator('picture img')).toHaveCSS('visibility', 'hidden')
    await trigger.press('Enter')
    await expect(trigger).not.toHaveAttribute('data-burst', 'active', { timeout: 4000 })
    await expect(page.locator('picture img')).toHaveCSS('visibility', 'visible')
    await trigger.press('Enter')
    await expect(trigger).toHaveAttribute('data-burst', 'active')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(trigger).not.toHaveAttribute('data-burst', 'active')
    await expect(page.locator('picture img')).toHaveCSS('visibility', 'visible')
})
