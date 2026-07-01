import { ofetch } from 'ofetch'

import { IDevice } from '@entities/devices-store'

// Same-origin requests; the session cookie and hwid_mgmt cookie ride along automatically.
const base = '/api/devices'

interface ListPayload {
    devices?: IDevice[]
    limit?: null | number
    ok: boolean
    status?: number
    total?: number
}

const normalizeList = (payload: ListPayload, status: number) => ({
    ok: Boolean(payload?.ok),
    devices: Array.isArray(payload?.devices) ? payload.devices : [],
    total: typeof payload?.total === 'number' ? payload.total : 0,
    limit: typeof payload?.limit === 'number' ? payload.limit : null,
    status
})

export async function fetchStatus() {
    return ofetch<{
        deviceCount: number
        deviceLimit: null | number
        enabled: boolean
        telegramLinked: boolean
    }>(`${base}/status?v=${Date.now()}`, { credentials: 'same-origin' })
}

export async function requestChallenge() {
    return ofetch<{ cooldownSec?: number; ok: boolean; reason?: string }>(`${base}/challenge`, {
        method: 'POST',
        credentials: 'same-origin',
        // ofetch does not throw for our JSON error bodies if we ignore non-2xx; capture them:
        ignoreResponseError: true
    })
}

export async function verifyCode(code: string) {
    return ofetch<{ ok: boolean }>(`${base}/verify`, {
        method: 'POST',
        credentials: 'same-origin',
        body: { code },
        ignoreResponseError: true
    })
}

export async function fetchDevices() {
    let status = 0
    const payload = await ofetch<ListPayload>(`${base}?v=${Date.now()}`, {
        credentials: 'same-origin',
        ignoreResponseError: true,
        onResponse({ response }) {
            status = response.status
        }
    })
    return normalizeList(payload, status)
}

export async function deleteDevice(hwid: string) {
    let status = 0
    const payload = await ofetch<ListPayload>(`${base}/delete`, {
        method: 'POST',
        credentials: 'same-origin',
        body: { hwid },
        ignoreResponseError: true,
        onResponse({ response }) {
            status = response.status
        }
    })
    return normalizeList(payload, status)
}

export async function deleteAllDevices() {
    let status = 0
    const payload = await ofetch<ListPayload>(`${base}/delete-all`, {
        method: 'POST',
        credentials: 'same-origin',
        ignoreResponseError: true,
        onResponse({ response }) {
            status = response.status
        }
    })
    return normalizeList(payload, status)
}
