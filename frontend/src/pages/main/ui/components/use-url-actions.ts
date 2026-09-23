import { useEffect, useRef } from 'react'

import { fetchStatus, openDevicesModal, usePaymentModal, useResetTraffic } from '@widgets/main'
import { usePaymentTariffs, usePaymentUrl } from '@entities/payment-store'
import { useDevicesEnabled } from '@entities/devices-store'
import { openChatwoot } from '@shared/utils/chatwoot'
import { useTranslation } from '@shared/hooks'

/**
 * URL hash commands: `https://sub.example/<shortUuid>#pay` opens the tariff
 * picker, `#support` the Chatwoot chat, `#devices` the HWID modal and `#reset`
 * the traffic-reset flow. The fragment never reaches the server (no logs, no
 * cache keys, no effect on VPN clients fetching the same URL). A recognised
 * command is removed from the address bar right away so the link stays clean
 * and works again on the next click; unknown fragments are left alone.
 */
export const URL_ACTIONS = ['pay', 'support', 'devices', 'reset'] as const
export type TUrlAction = (typeof URL_ACTIONS)[number]

export const parseUrlAction = (hash: string): null | TUrlAction => {
    const name = hash.replace(/^#/, '').trim().toLowerCase()
    return (URL_ACTIONS as readonly string[]).includes(name) ? (name as TUrlAction) : null
}

const clearHash = () => {
    const { pathname, search } = window.location
    window.history.replaceState(window.history.state, '', `${pathname}${search}`)
}

export function useUrlActions(): void {
    const { hasPayment, openPayment } = usePaymentModal()
    const tariffs = usePaymentTariffs()
    const paymentUrl = usePaymentUrl()
    const { handleReset, visible: resetVisible } = useResetTraffic()
    const devicesEnabled = useDevicesEnabled()
    const { currentLang } = useTranslation()

    // Handlers are refreshed every render so the hashchange listener, which is
    // registered once, always sees the current store state.
    const handlers = useRef<Record<TUrlAction, () => void>>({
        pay: () => {},
        support: () => {},
        devices: () => {},
        reset: () => {}
    })
    handlers.current = {
        pay: () => {
            if (!hasPayment) return
            // window.open() without a user gesture is blocked as a popup, so a
            // bare PAYMENT_URL (no tariffs → no modal) navigates in this tab.
            if (tariffs.length === 0 && paymentUrl !== '') {
                window.location.assign(paymentUrl)
                return
            }
            openPayment()
        },
        support: openChatwoot,
        devices: () => {
            if (!devicesEnabled) return
            fetchStatus()
                .then((status) => {
                    if (status.mode === 'disabled') return
                    if (status.mode === 'telegram' && !status.telegramLinked) return
                    openDevicesModal(currentLang, status.mode)
                })
                .catch(() => {})
        },
        reset: () => {
            if (resetVisible) handleReset()
        }
    }

    useEffect(() => {
        const run = () => {
            const action = parseUrlAction(window.location.hash)
            if (!action) return
            clearHash()
            handlers.current[action]()
        }
        run()
        window.addEventListener('hashchange', run)
        return () => window.removeEventListener('hashchange', run)
    }, [])
}
