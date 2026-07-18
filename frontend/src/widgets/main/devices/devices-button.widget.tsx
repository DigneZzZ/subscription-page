import { Button, Group, Text } from '@mantine/core'
import { IconDevices } from '@tabler/icons-react'
import { useEffect, useState } from 'react'

import { useDevicesEnabled } from '@entities/devices-store'
import { vibrate } from '@shared/utils/vibrate'
import { useTranslation } from '@shared/hooks'

import { DeviceMode, fetchStatus } from './devices-api'
import { openDevicesModal } from './devices-modal'
import { getDeviceStrings } from './devices.i18n'

interface DeviceStatus {
    deviceCount: number
    deviceLimit: null | number
    mode: DeviceMode
    telegramLinked: boolean
}

export const DevicesButton = () => {
    const enabled = useDevicesEnabled()
    const { currentLang } = useTranslation()
    const s = getDeviceStrings(currentLang)

    const [status, setStatus] = useState<DeviceStatus | null>(null)

    useEffect(() => {
        if (!enabled) return undefined
        let cancelled = false
        fetchStatus()
            .then((st) => {
                if (cancelled) return
                setStatus({
                    mode: st.mode,
                    telegramLinked: st.telegramLinked,
                    deviceCount: st.deviceCount,
                    deviceLimit: st.deviceLimit
                })
            })
            .catch(() => {
                if (!cancelled) setStatus(null)
            })
        return () => {
            cancelled = true
        }
    }, [enabled])

    // Render nothing until we know the mode. Then:
    //  - disabled → never (defensive; the div flag already gates this)
    //  - telegram + not linked → hidden entirely (no "link Telegram" stub)
    //  - telegram + linked → shown (opens the code flow)
    //  - open → always shown (opens the device list directly)
    if (!enabled || !status) return null
    if (status.mode === 'disabled') return null
    if (status.mode === 'telegram' && !status.telegramLinked) return null

    const handleClick = () => {
        vibrate('tap')
        openDevicesModal(currentLang, status.mode)
    }

    const countLabel = s.devicesCount(status.deviceCount, status.deviceLimit)

    return (
        <Button
            color="cyan"
            fullWidth
            leftSection={<IconDevices size={18} />}
            onClick={handleClick}
            radius="md"
            size="md"
            variant="outline"
        >
            <Group gap="xs" justify="space-between" w="100%" wrap="nowrap">
                <Text fw={600} size="sm">
                    {`${s.manage} · ${countLabel}`}
                </Text>
            </Group>
        </Button>
    )
}
