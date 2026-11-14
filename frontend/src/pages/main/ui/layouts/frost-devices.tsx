import { IconDeviceDesktop, IconDeviceMobile, IconRefresh, IconTrash } from '@tabler/icons-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { IDevice, useDevicesEnabled } from '@entities/devices-store'

import {
    deleteDevice,
    fetchDevices,
    fetchStatus
} from '../../../../widgets/main/devices/devices-api'
import { openDevicesModal } from '../../../../widgets/main/devices/devices-modal'
import classes from './frost.module.css'

type DeviceStatus = Awaited<ReturnType<typeof fetchStatus>>
type Phase = 'error' | 'loading' | 'ready' | 'unavailable' | 'verification'

export const FrostDevices = ({ active, ru }: { active: boolean; ru: boolean }) => {
    const enabled = useDevicesEnabled()
    const activeRef = useRef(false)
    const sequence = useRef(0)
    const [phase, setPhase] = useState<Phase>('loading')
    const [status, setStatus] = useState<DeviceStatus | null>(null)
    const [devices, setDevices] = useState<IDevice[]>([])
    const [error, setError] = useState('')
    const [confirmation, setConfirmation] = useState<null | string>(null)
    const [deleting, setDeleting] = useState<null | string>(null)

    const load = useCallback(async () => {
        if (!activeRef.current) return
        const request = ++sequence.current
        const isCurrent = () => activeRef.current && request === sequence.current
        setConfirmation(null)
        setDeleting(null)
        setError('')
        setStatus(null)
        setDevices([])
        if (!enabled) {
            setPhase('unavailable')
            return
        }
        setPhase('loading')
        try {
            const nextStatus = await fetchStatus()
            if (!isCurrent()) return
            if (
                !nextStatus.enabled ||
                nextStatus.mode === 'disabled' ||
                (nextStatus.mode === 'telegram' && !nextStatus.telegramLinked)
            ) {
                setPhase('unavailable')
                return
            }
            setStatus(nextStatus)
            const result = await fetchDevices()
            if (!isCurrent()) return
            if (!result.ok) {
                setPhase(
                    result.status === 403 && nextStatus.mode === 'telegram'
                        ? 'verification'
                        : 'error'
                )
                return
            }
            setDevices(result.devices)
            setStatus({
                ...nextStatus,
                deviceCount: result.total,
                deviceLimit: result.limit
            })
            setPhase('ready')
        } catch {
            if (isCurrent()) setPhase('error')
        }
    }, [enabled])

    useEffect(() => {
        activeRef.current = active
        if (active) load()
        return () => {
            activeRef.current = false
            sequence.current += 1
        }
    }, [active, load])

    const openManagement = () => {
        if (activeRef.current && status) {
            openDevicesModal(ru ? 'ru' : 'en', status.mode, () => {
                load()
            })
        }
    }

    const remove = async (hwid: string) => {
        if (!activeRef.current || !status || confirmation !== hwid || deleting) return
        const request = ++sequence.current
        const isCurrent = () => activeRef.current && request === sequence.current
        setDeleting(hwid)
        setError('')
        try {
            const result = await deleteDevice(hwid)
            if (!isCurrent()) return
            if (!result.ok) {
                if (result.status === 403 && status.mode === 'telegram') {
                    setPhase('verification')
                    openManagement()
                } else {
                    setError(
                        ru
                            ? 'Не удалось удалить устройство. Попробуйте ещё раз.'
                            : 'Could not remove the device. Try again.'
                    )
                }
                return
            }
            setDevices(result.devices)
            setStatus({ ...status, deviceCount: result.total, deviceLimit: result.limit })
            setConfirmation(null)
        } catch {
            if (isCurrent()) {
                setError(
                    ru
                        ? 'Не удалось удалить устройство. Попробуйте ещё раз.'
                        : 'Could not remove the device. Try again.'
                )
            }
        } finally {
            if (isCurrent()) setDeleting(null)
        }
    }

    if (!active) return null

    const count = status?.deviceCount ?? 0
    const limit = status?.deviceLimit
    const progress = limit && limit > 0 ? Math.min(100, (count / limit) * 100) : 0
    const removeLabel = ru ? 'Удалить' : 'Remove'
    const removingLabel = ru ? 'Удаляем…' : 'Removing…'

    return (
        <>
            {status && (
                <section className={classes.card}>
                    <div className={classes.deviceCount}>
                        <span>{ru ? 'подключено' : 'connected'}</span>
                        <b>{count}</b>{' '}
                        <span className={classes.muted}>
                            {ru ? 'из' : 'of'} {limit == null ? '∞' : limit}
                        </span>
                    </div>
                    {limit != null && limit > 0 && (
                        <div
                            aria-label={ru ? 'Использовано устройств' : 'Devices in use'}
                            aria-valuemax={limit}
                            aria-valuemin={0}
                            aria-valuenow={Math.min(count, limit)}
                            className={limit <= 20 ? classes.slots : classes.progress}
                            role="progressbar"
                        >
                            {limit <= 20 ? (
                                Array.from({ length: limit }, (_, index) => (
                                    <span
                                        className={index < count ? classes.slotActive : undefined}
                                        key={index}
                                    />
                                ))
                            ) : (
                                <div
                                    className={classes.progressFill}
                                    style={{ width: `${progress}%` }}
                                />
                            )}
                        </div>
                    )}
                </section>
            )}
            <section aria-busy={phase === 'loading'} className={classes.card}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12
                    }}
                >
                    <h2 className={classes.sectionHeading}>
                        {ru ? 'Подключённые устройства' : 'Connected devices'}
                    </h2>
                    {enabled && (
                        <button
                            aria-label={ru ? 'Обновить устройства' : 'Refresh devices'}
                            className={classes.deleteButton}
                            disabled={phase === 'loading' || deleting !== null}
                            onClick={() => {
                                load()
                            }}
                            type="button"
                        >
                            <IconRefresh aria-hidden size={18} />
                        </button>
                    )}
                </div>
                {phase === 'loading' && (
                    <p className={classes.muted} role="status">
                        {ru ? 'Загружаем устройства…' : 'Loading devices…'}
                    </p>
                )}
                {phase === 'unavailable' && (
                    <p className={classes.muted}>
                        {ru
                            ? 'Управление устройствами недоступно для этой подписки.'
                            : 'Device management is unavailable for this subscription.'}
                    </p>
                )}
                {phase === 'error' && (
                    <p role="alert">
                        {ru
                            ? 'Не удалось загрузить устройства. Нажмите кнопку обновления, чтобы повторить.'
                            : 'Could not load devices. Use the refresh button to try again.'}
                    </p>
                )}
                {phase === 'verification' && (
                    <div>
                        <p className={classes.muted}>
                            {ru
                                ? 'Подтвердите доступ в окне управления устройствами.'
                                : 'Confirm access in the device management window.'}
                        </p>
                    </div>
                )}
                {status && (
                    <button
                        className={classes.secondaryButton}
                        disabled={phase === 'loading' || deleting !== null}
                        onClick={openManagement}
                        type="button"
                    >
                        {ru ? 'Управлять устройствами' : 'Manage devices'}
                    </button>
                )}
                {error && <p role="alert">{error}</p>}
                {phase === 'ready' && devices.length === 0 && (
                    <p className={classes.muted}>
                        {ru ? 'Подключённых устройств пока нет.' : 'No devices connected yet.'}
                    </p>
                )}
                {phase === 'ready' && devices.length > 0 && (
                    <div className={classes.deviceList}>
                        {devices.map((device) => {
                            const name =
                                device.deviceModel ||
                                device.platform ||
                                (ru ? 'Устройство' : 'Device')
                            const desktop = /windows|mac|linux/i.test(device.platform || '')
                            const DeviceIcon = desktop ? IconDeviceDesktop : IconDeviceMobile
                            const created = new Date(device.createdAt)
                            const details = [
                                device.osVersion,
                                Number.isNaN(created.getTime())
                                    ? null
                                    : created.toLocaleDateString(ru ? 'ru-RU' : 'en-US')
                            ]
                                .filter(Boolean)
                                .join(' · ')
                            return (
                                <div className={classes.deviceRow} key={device.hwid}>
                                    <span aria-hidden className={classes.iconBox}>
                                        <DeviceIcon size={23} />
                                    </span>
                                    <div className={classes.deviceInfo}>
                                        <div className={classes.deviceName}>{name}</div>
                                        {details && <div className={classes.muted}>{details}</div>}
                                        {confirmation === device.hwid && (
                                            <div>
                                                <p>
                                                    {ru
                                                        ? 'Удалить это устройство?'
                                                        : 'Remove this device?'}
                                                </p>
                                                <button
                                                    disabled={deleting !== null}
                                                    onClick={() => {
                                                        remove(device.hwid)
                                                    }}
                                                    type="button"
                                                >
                                                    {deleting === device.hwid
                                                        ? removingLabel
                                                        : removeLabel}
                                                </button>{' '}
                                                <button
                                                    disabled={deleting !== null}
                                                    onClick={() => setConfirmation(null)}
                                                    type="button"
                                                >
                                                    {ru ? 'Отмена' : 'Cancel'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        aria-label={`${ru ? 'Удалить устройство' : 'Remove device'} ${name}`}
                                        className={classes.deleteButton}
                                        disabled={deleting !== null}
                                        onClick={() => setConfirmation(device.hwid)}
                                        type="button"
                                    >
                                        <IconTrash aria-hidden size={18} />
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                )}
            </section>
        </>
    )
}
