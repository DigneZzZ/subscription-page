import { Button, Group, Text } from '@mantine/core'
import { IconDevices } from '@tabler/icons-react'
import { useEffect, useState } from 'react'

import { useDevicesEnabled } from '@entities/devices-store'
import { vibrate } from '@shared/utils/vibrate'
import { useTranslation } from '@shared/hooks'

import { openDevicesModal } from './devices-modal'
import { getDeviceStrings } from './devices.i18n'
import { fetchStatus } from './devices-api'

export const DevicesButton = () => {
    const enabled = useDevicesEnabled()
    const { currentLang } = useTranslation()
    const s = getDeviceStrings(currentLang)

    const [telegramLinked, setTelegramLinked] = useState<boolean | null>(null)
    const [deviceCount, setDeviceCount] = useState<number>(0)
    const [deviceLimit, setDeviceLimit] = useState<null | number>(null)

    useEffect(() => {
        if (!enabled) return undefined
        let cancelled = false
        fetchStatus()
            .then((status) => {
                if (cancelled) return
                setTelegramLinked(status.telegramLinked)
                setDeviceCount(status.deviceCount)
                setDeviceLimit(status.deviceLimit)
            })
            .catch(() => {
                if (!cancelled) setTelegramLinked(false)
            })
        return () => {
            cancelled = true
        }
    }, [enabled])

    if (!enabled) return null

    const handleClick = () => {
        vibrate('tap')
        openDevicesModal(currentLang)
    }

    const countLabel = s.devicesCount(deviceCount, deviceLimit)

    return (
        <Button
            color="cyan"
            disabled={telegramLinked === false}
            fullWidth
            leftSection={<IconDevices size={18} />}
            onClick={handleClick}
            radius="md"
            size="md"
            variant="light"
        >
            <Group gap="xs" justify="space-between" w="100%" wrap="nowrap">
                <Text fw={600} size="sm">
                    {telegramLinked === false ? s.linkTelegramHint : `${s.manage} · ${countLabel}`}
                </Text>
            </Group>
        </Button>
    )
}
