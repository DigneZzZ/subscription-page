import { ActionIcon, Badge, Button, Group, Loader, PinInput, Stack, Text } from '@mantine/core'
import { IconDeviceMobile, IconTrash } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useEffect, useRef, useState } from 'react'
import { modals } from '@mantine/modals'

import { IDevice } from '@entities/devices-store'

import {
    deleteAllDevices,
    deleteDevice,
    DeviceMode,
    fetchDevices,
    requestChallenge,
    verifyCode
} from './devices-api'
import { getDeviceStrings, IDeviceStrings } from './devices.i18n'

const SESSION_SECONDS = 600

function mmss(total: number): string {
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${m}:${String(s).padStart(2, '0')}`
}

type Step = 'code' | 'intro' | 'list' | 'loading'

function DevicesFlow({ s, mode }: { mode: DeviceMode; s: IDeviceStrings }) {
    // Telegram mode starts in a short 'loading' probe (resume a live session if any);
    // open mode has no session and goes straight to the list.
    const [step, setStep] = useState<Step>(mode === 'open' ? 'list' : 'loading')
    const [busy, setBusy] = useState(false)
    const [cooldown, setCooldown] = useState(0)
    const [code, setCode] = useState('')
    const [devices, setDevices] = useState<IDevice[]>([])
    const [_limit, setLimit] = useState<null | number>(null)
    const [sessionLeft, setSessionLeft] = useState(SESSION_SECONDS)
    const cooldownTimer = useRef<null | ReturnType<typeof setInterval>>(null)
    const sessionTimer = useRef<null | ReturnType<typeof setInterval>>(null)

    useEffect(() => {
        return () => {
            if (cooldownTimer.current) clearInterval(cooldownTimer.current)
            if (sessionTimer.current) clearInterval(sessionTimer.current)
        }
    }, [])

    const startCooldown = (sec: number) => {
        setCooldown(sec)
        if (cooldownTimer.current) clearInterval(cooldownTimer.current)
        cooldownTimer.current = setInterval(() => {
            setCooldown((c) => {
                if (c <= 1 && cooldownTimer.current) clearInterval(cooldownTimer.current)
                return c > 0 ? c - 1 : 0
            })
        }, 1000)
    }

    // Starts (or restarts) the visible session countdown from the server's real remaining TTL.
    const startSessionCountdown = (fromSec: number) => {
        const start = Math.max(0, Math.floor(fromSec))
        setSessionLeft(start)
        if (sessionTimer.current) clearInterval(sessionTimer.current)
        if (start <= 0) {
            setStep('intro')
            return
        }
        sessionTimer.current = setInterval(() => {
            setSessionLeft((v) => {
                if (v <= 1) {
                    if (sessionTimer.current) clearInterval(sessionTimer.current)
                    setStep('intro') // session expired → back to start
                    return 0
                }
                return v - 1
            })
        }, 1000)
    }

    const onSendCode = async () => {
        setBusy(true)
        try {
            const res = await requestChallenge()
            if (res.ok) {
                setStep('code')
                startCooldown(res.cooldownSec ?? 60)
            } else if (res.reason === 'cooldown') {
                setStep('code')
                startCooldown(res.cooldownSec ?? 60)
            } else if (res.reason === 'blocked') {
                notifications.show({ color: 'red', message: s.errorBlocked })
            } else if (res.reason === 'not_linked') {
                notifications.show({ color: 'red', message: s.errorNotLinked })
            } else if (res.reason === 'tg_send_failed') {
                notifications.show({ color: 'red', message: s.errorTgSend })
            } else {
                notifications.show({ color: 'red', message: s.errorGeneric })
            }
        } finally {
            setBusy(false)
        }
    }

    const loadDevices = async () => {
        const res = await fetchDevices()
        if (res.ok) {
            setDevices(res.devices)
            setLimit(res.limit)
        }
        return res
    }

    useEffect(() => {
        let cancelled = false
        // Probe on open: a live hwid_mgmt session (telegram) resumes straight to the list
        // with the real remaining TTL; no session → the send-code step. Open mode always lists.
        // eslint-disable-next-line no-void
        void loadDevices()
            .then((res) => {
                if (cancelled) return
                if (res.ok) {
                    setStep('list')
                    if (mode === 'telegram' && typeof res.sessionTtlSec === 'number') {
                        startSessionCountdown(res.sessionTtlSec)
                    }
                } else if (mode === 'open') {
                    notifications.show({ color: 'red', message: s.errorGeneric })
                } else {
                    setStep('intro')
                }
            })
            .catch(() => {
                // Network-layer failure (ofetch rejects only here; HTTP errors are captured
                // above). Leave 'loading' → fall back so the modal is never stuck on the spinner.
                if (cancelled) return
                setStep(mode === 'open' ? 'list' : 'intro')
            })
        return () => {
            cancelled = true
        }
    }, [])

    const onVerify = async (value: string) => {
        setBusy(true)
        try {
            const res = await verifyCode(value)
            if (!res.ok) {
                notifications.show({ color: 'red', message: s.errorGeneric })
                setCode('')
                return
            }
            const loaded = await loadDevices()
            if (loaded.ok) {
                setStep('list')
                startSessionCountdown(
                    typeof loaded.sessionTtlSec === 'number'
                        ? loaded.sessionTtlSec
                        : SESSION_SECONDS
                )
            } else {
                notifications.show({ color: 'red', message: s.errorGeneric })
            }
        } finally {
            setBusy(false)
        }
    }

    const onDelete = async (hwid: string) => {
        setBusy(true)
        try {
            const res = await deleteDevice(hwid)
            if (res.ok) {
                setDevices(res.devices)
                setLimit(res.limit)
            } else if (res.status === 403) {
                if (mode === 'telegram') setStep('intro')
                else notifications.show({ color: 'red', message: s.errorGeneric })
            } else {
                notifications.show({ color: 'red', message: s.errorGeneric })
            }
        } finally {
            setBusy(false)
        }
    }

    const onDeleteAll = () => {
        modals.openConfirmModal({
            centered: true,
            title: s.confirmDeleteAllTitle,
            children: <Text size="sm">{s.confirmDeleteAllBody}</Text>,
            labels: { confirm: s.deleteAll, cancel: s.cancel },
            confirmProps: { color: 'red', variant: 'filled' },
            onConfirm: async () => {
                setBusy(true)
                try {
                    const res = await deleteAllDevices()
                    if (res.ok) {
                        setDevices(res.devices)
                        setLimit(res.limit)
                    } else if (res.status === 403) {
                        if (mode === 'telegram') setStep('intro')
                        else notifications.show({ color: 'red', message: s.errorGeneric })
                    } else {
                        notifications.show({ color: 'red', message: s.errorGeneric })
                    }
                } finally {
                    setBusy(false)
                }
            }
        })
    }

    if (step === 'loading') {
        return (
            <Stack align="center" gap="md" py="lg">
                <Loader color="cyan" />
            </Stack>
        )
    }

    if (step === 'intro') {
        return (
            <Stack gap="md">
                <Text size="sm">{s.sendCodePrompt}</Text>
                <Button color="cyan" loading={busy} onClick={onSendCode} radius="md" size="md">
                    {s.sendCode}
                </Button>
            </Stack>
        )
    }

    if (step === 'code') {
        return (
            <Stack align="center" gap="md">
                <Text size="sm" ta="center">
                    {s.codeSentTo}
                </Text>
                <Text size="sm">{s.enterCode}</Text>
                <PinInput
                    inputType="tel"
                    length={6}
                    onChange={setCode}
                    onComplete={onVerify}
                    oneTimeCode
                    type="number"
                    value={code}
                />
                <Button
                    disabled={cooldown > 0 || busy}
                    onClick={onSendCode}
                    size="xs"
                    variant="subtle"
                >
                    {s.resend(cooldown)}
                </Button>
            </Stack>
        )
    }

    return (
        <Stack gap="sm">
            {mode === 'telegram' && (
                <Group justify="flex-end">
                    <Badge color="cyan" variant="light">
                        {s.sessionEndsIn(mmss(sessionLeft))}
                    </Badge>
                </Group>
            )}
            {devices.length === 0 ? (
                <Text c="dimmed" size="sm" ta="center">
                    {s.empty}
                </Text>
            ) : (
                devices.map((d) => (
                    <Group gap="sm" justify="space-between" key={d.hwid} wrap="nowrap">
                        <Group gap="xs" style={{ minWidth: 0 }} wrap="nowrap">
                            <IconDeviceMobile size={18} style={{ flexShrink: 0 }} />
                            <Stack gap={0} style={{ minWidth: 0 }}>
                                <Text fw={600} size="sm" truncate>
                                    {[d.deviceModel, d.platform].filter(Boolean).join(' · ') ||
                                        d.hwid}
                                </Text>
                                <Text c="dimmed" size="xs" truncate>
                                    {[d.osVersion, `${s.added}: ${d.createdAt.slice(0, 10)}`]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </Text>
                            </Stack>
                        </Group>
                        <ActionIcon
                            color="red"
                            disabled={busy}
                            onClick={() => onDelete(d.hwid)}
                            variant="light"
                        >
                            <IconTrash size={18} />
                        </ActionIcon>
                    </Group>
                ))
            )}
            {devices.length > 0 && (
                <Button
                    color="red"
                    disabled={busy}
                    leftSection={<IconTrash size={16} />}
                    onClick={onDeleteAll}
                    variant="light"
                >
                    {s.deleteAll}
                </Button>
            )}
        </Stack>
    )
}

export function openDevicesModal(lang: string, mode: DeviceMode): void {
    const s = getDeviceStrings(lang)
    modals.open({
        title: s.title,
        centered: true,
        fullScreen: window.matchMedia('(max-width: 30rem)').matches,
        children: <DevicesFlow mode={mode} s={s} />
    })
}
