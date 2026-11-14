import { expect, test } from '@playwright/test'

const device = {
    hwid: 'synthetic-managed-phone',
    deviceModel: 'Managed Phone',
    platform: 'iOS',
    osVersion: 'iOS 18',
    createdAt: '2026-01-01T00:00:00Z'
}

const list = (devices = [device]) => ({ ok: true, devices, total: devices.length, limit: 3 })

test('Frost opens the original open-mode management and confirms removal of all devices', async ({
    page
}) => {
    let deleted = false
    let deleteCalls = 0
    await page.route('**/api/devices/status?*', (route) =>
        route.fulfill({
            json: {
                mode: 'open',
                enabled: true,
                telegramLinked: false,
                deviceCount: 1,
                deviceLimit: 3
            }
        })
    )
    await page.route('**/api/devices?*', (route) =>
        route.fulfill({ json: list(deleted ? [] : [device]) })
    )
    await page.route('**/api/devices/delete-all', async (route) => {
        deleteCalls += 1
        deleted = true
        await route.fulfill({ json: list([]) })
    })
    await page.goto('/?layout=frost')
    await page
        .getByRole('navigation')
        .getByRole('button', { name: 'Устройства', exact: true })
        .click()
    await page.getByRole('button', { name: 'Управлять устройствами', exact: true }).click()
    const management = page.getByRole('dialog', { name: 'Устройства', exact: true })
    await expect(management.getByText('Managed Phone · iOS')).toBeVisible()
    await expect(management.getByRole('button', { name: 'Отправить код в Telegram' })).toHaveCount(
        0
    )
    await management.getByRole('button', { name: 'Удалить все устройства', exact: true }).click()
    const confirmation = page.getByRole('dialog', { name: 'Удаление всех устройств', exact: true })
    await expect(confirmation).toBeVisible()
    expect(deleteCalls).toBe(0)
    await confirmation.getByRole('button', { name: 'Отмена', exact: true }).click()
    expect(deleteCalls).toBe(0)
    await management.getByRole('button', { name: 'Удалить все устройства', exact: true }).click()
    await confirmation.getByRole('button', { name: 'Удалить все устройства', exact: true }).click()
    await expect.poll(() => deleteCalls).toBe(1)
    await expect(management.getByText('Устройств нет', { exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(management).not.toBeVisible()
    await expect(page.getByText('Подключённых устройств пока нет.', { exact: true })).toBeVisible()
})

test('Frost keeps Telegram verification, its session timer and expired-session authorization', async ({
    page
}) => {
    let authorized = false
    let challenges = 0
    let deleteCalls = 0
    await page.route('**/api/devices/status?*', (route) =>
        route.fulfill({
            json: {
                mode: 'telegram',
                enabled: true,
                telegramLinked: true,
                deviceCount: 1,
                deviceLimit: 3
            }
        })
    )
    await page.route('**/api/devices?*', (route) =>
        authorized
            ? route.fulfill({ json: { ...list(), sessionTtlSec: 600 } })
            : route.fulfill({ status: 403, json: { ok: false } })
    )
    await page.route('**/api/devices/challenge', async (route) => {
        challenges += 1
        await route.fulfill({ json: { ok: true, cooldownSec: 60 } })
    })
    await page.route('**/api/devices/verify', async (route) => {
        authorized = route.request().postDataJSON().code === '123456'
        await route.fulfill({ json: { ok: authorized } })
    })
    await page.route('**/api/devices/delete-all', async (route) => {
        deleteCalls += 1
        await route.fulfill({ status: 403, json: { ok: false } })
    })
    await page.goto('/?layout=frost')
    await page
        .getByRole('navigation')
        .getByRole('button', { name: 'Устройства', exact: true })
        .click()
    await page.getByRole('button', { name: 'Управлять устройствами', exact: true }).click()
    const management = page.getByRole('dialog', { name: 'Устройства', exact: true })
    const sendCode = management.getByRole('button', {
        name: 'Отправить код в Telegram',
        exact: true
    })
    await expect(sendCode).toBeVisible()
    await expect(management.getByText('Managed Phone · iOS')).toHaveCount(0)
    expect(challenges).toBe(0)
    expect(deleteCalls).toBe(0)
    await sendCode.click()
    await expect(management.getByText('Введите код', { exact: true })).toBeVisible()
    await expect(management.getByRole('button', { name: /Повтор через/ })).toBeDisabled()
    const digits = management.locator('input:not([type="hidden"])')
    await expect(digits).toHaveCount(6)
    await digits.first().pressSequentially('123456')
    await expect(management.getByText('Managed Phone · iOS')).toBeVisible()
    await expect(management.getByText(/Сессия завершится через/)).toBeVisible()
    expect(challenges).toBe(1)
    authorized = false
    await management.getByRole('button', { name: 'Удалить все устройства', exact: true }).click()
    await page
        .getByRole('dialog', { name: 'Удаление всех устройств', exact: true })
        .getByRole('button', { name: 'Удалить все устройства', exact: true })
        .click()
    await expect.poll(() => deleteCalls).toBe(1)
    await expect(sendCode).toBeVisible()
    await expect(
        management.getByRole('button', { name: 'Удалить все устройства', exact: true })
    ).toHaveCount(0)
})

test('Frost reports an open-mode list failure without asking for Telegram verification', async ({
    page
}) => {
    await page.route('**/api/devices/status?*', (route) =>
        route.fulfill({
            json: {
                mode: 'open',
                enabled: true,
                telegramLinked: false,
                deviceCount: 1,
                deviceLimit: 3
            }
        })
    )
    await page.route('**/api/devices?*', (route) =>
        route.fulfill({ status: 403, json: { ok: false } })
    )
    await page.goto('/?layout=frost')
    await page
        .getByRole('navigation')
        .getByRole('button', { name: 'Устройства', exact: true })
        .click()
    await expect(page.getByRole('alert')).toContainText('Не удалось загрузить устройства')
    await expect(page.getByText(/Подтвердите доступ/)).toHaveCount(0)
    await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('Frost reports an open-mode removal failure without opening a verification modal', async ({
    page
}) => {
    await page.route('**/api/devices/status?*', (route) =>
        route.fulfill({
            json: {
                mode: 'open',
                enabled: true,
                telegramLinked: false,
                deviceCount: 1,
                deviceLimit: 3
            }
        })
    )
    await page.route('**/api/devices?*', (route) => route.fulfill({ json: list() }))
    await page.route('**/api/devices/delete', (route) =>
        route.fulfill({ status: 403, json: { ok: false } })
    )
    await page.goto('/?layout=frost')
    await page
        .getByRole('navigation')
        .getByRole('button', { name: 'Устройства', exact: true })
        .click()
    await page
        .getByRole('button', { name: 'Удалить устройство Managed Phone', exact: true })
        .click()
    await page.getByRole('button', { name: 'Удалить', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Не удалось удалить устройство')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByText(/Подтвердите доступ/)).toHaveCount(0)
})
