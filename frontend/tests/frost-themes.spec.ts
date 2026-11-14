import { expect, test } from '@playwright/test'

import { THEME_PRESETS } from '../src/shared/constants/theme/presets/theme-presets'

const rgb = (hex: string) => {
    const value = hex.replace('#', '')
    return `rgb(${[0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)).join(', ')})`
}

const contrast = (foreground: number[], background: number[]) => {
    const luminance = (color: number[]) => {
        const channels = color.slice(0, 3).map((channel) => {
            const value = channel / 255
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
        })
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
    }
    const a = luminance(foreground)
    const b = luminance(background)
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

for (const preset of Object.values(THEME_PRESETS)) {
    test(`Frost renders ${preset.name} throughout the page and share portal`, async ({ page }) => {
        await page.goto(`/?layout=frost&scenario=compact&theme=${preset.id}`)
        const root = page.locator('[data-layout="frost"]')
        const connect = page.getByRole('link', { name: 'Подключиться в INCY' })
        await expect(root).toHaveCSS('--primary', preset.accent[4])
        await expect(root).toHaveCSS('--background', preset.bg)
        await expect(root).toHaveCSS('color', rgb(preset.text))
        await expect(connect).toHaveCSS('background-color', rgb(preset.accent[4]))
        await expect(connect).toHaveCSS('color', rgb(preset.ctaText))
        await expect(page.locator('html')).toHaveAttribute(
            'data-mantine-color-scheme',
            preset.colorScheme
        )

        const card = page
            .getByRole('region', { name: 'Подписка', exact: true })
            .locator(':scope > div')
            .first()
        const surface = await card.evaluate((element) => {
            const style = getComputedStyle(element)
            const canvas = document.createElement('canvas')
            canvas.width = 1
            canvas.height = 1
            const context = canvas.getContext('2d')!
            context.fillStyle = style.backgroundColor
            context.fillRect(0, 0, 1, 1)
            return { filter: style.backdropFilter, alpha: context.getImageData(0, 0, 1, 1).data[3] }
        })
        expect(surface.filter).toMatch(/blur\([\d.]+px\)/)
        expect(surface.alpha).toBeGreaterThan(0)
        expect(surface.alpha).toBeLessThan(255)

        await page.getByRole('button', { name: 'Поделиться', exact: true }).click()
        const dialog = page.getByRole('dialog', { name: 'Поделиться', exact: true })
        await expect(dialog).toBeVisible()
        await expect(dialog).toHaveCSS('--primary', preset.accent[4])
        await expect(dialog).toHaveCSS('--background', preset.bg)
        await expect(dialog).toHaveCSS('color', rgb(preset.text))
        const colors = await dialog.evaluate((element) => {
            const canvas = document.createElement('canvas')
            canvas.width = 1
            canvas.height = 1
            const context = canvas.getContext('2d')!
            const parse = (value: string) => {
                context.clearRect(0, 0, 1, 1)
                context.fillStyle = value
                context.fillRect(0, 0, 1, 1)
                return [...context.getImageData(0, 0, 1, 1).data]
            }
            const style = getComputedStyle(element)
            const base = parse(style.getPropertyValue('--background'))
            const surfaceColor = parse(style.backgroundColor)
            const opacity = surfaceColor[3] / 255
            const background = surfaceColor
                .slice(0, 3)
                .map((channel, index) => channel * opacity + base[index] * (1 - opacity))
            return {
                foreground: parse(style.color),
                background,
                filter: style.backdropFilter,
                primary: parse(style.getPropertyValue('--primary')),
                primaryForeground: parse(style.getPropertyValue('--primary-foreground'))
            }
        })
        expect(colors.filter).toMatch(/blur\([\d.]+px\)/)
        expect(contrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5)
        expect(contrast(colors.primaryForeground, colors.primary)).toBeGreaterThanOrEqual(4.5)
        await expect(
            dialog.getByRole('img', { name: 'QR-код подписки' }).locator('svg')
        ).toHaveCount(1)
    })
}

test('Frost switches an existing dark preset to Light Minimal without reloading', async ({
    page
}) => {
    await page.goto('/?layout=frost&scenario=compact&theme=9&preview=1')
    const origin = await page.evaluate(() => performance.timeOrigin)
    const root = page.locator('[data-layout="frost"]')
    await page.getByRole('button', { name: 'Поделиться', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCSS('--primary', THEME_PRESETS[9].accent[4])
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: /^8\s*Light Minimal$/ }).click()
    await expect(root).toHaveCSS('--primary', THEME_PRESETS[8].accent[4])
    await expect(root).toHaveCSS('color', rgb(THEME_PRESETS[8].text))
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(origin)
    await page.getByRole('button', { name: 'Поделиться', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCSS('--primary', THEME_PRESETS[8].accent[4])
    await expect(page.getByRole('dialog')).toHaveCSS('color', rgb(THEME_PRESETS[8].text))
})

for (const theme of [8, 9]) {
    for (const width of [320, 390]) {
        test(`Frost theme ${theme} keeps glass panels and sharing within ${width}px`, async ({
            page
        }) => {
            await page.setViewportSize({ width, height: 844 })
            await page.goto(`/?layout=frost&scenario=compact&theme=${theme}`)
            await expect(page.getByRole('link', { name: 'Подключиться в INCY' })).toBeInViewport()
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
            ).toBe(true)
            await page.getByRole('button', { name: 'Поделиться', exact: true }).click()
            const dialog = page.getByRole('dialog')
            await expect(dialog).toBeVisible()
            await expect
                .poll(async () => {
                    const bounds = await dialog.boundingBox()
                    return Boolean(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width)
                })
                .toBe(true)
            await expect(
                dialog.getByRole('button', { name: 'Копировать', exact: true })
            ).toBeInViewport()
        })
    }
}

for (const value of ['0', '13', '8.5', 'invalid']) {
    test(`the preview rejects invalid theme value ${value}`, async ({ page }) => {
        await page.goto(`/?layout=frost&theme=${value}`)
        await expect(page.locator('[data-layout="frost"]')).toHaveCSS(
            '--primary',
            THEME_PRESETS[9].accent[4]
        )
    })
}
