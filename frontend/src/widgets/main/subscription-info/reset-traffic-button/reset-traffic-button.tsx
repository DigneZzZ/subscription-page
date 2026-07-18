import { IconRefresh } from '@tabler/icons-react'
import { Button, Text } from '@mantine/core'
import { modals } from '@mantine/modals'

import { useSubscriptionSummary } from '@entities/subscription-summary'
import { useSubscription } from '@entities/subscription-info-store'
import { formatAmount } from '@shared/utils/format-amount'
import { usePaymentReset } from '@entities/payment-store'
import { vibrate } from '@shared/utils/vibrate'
import { useTranslation } from '@shared/hooks'

import { getResetStrings } from './reset-traffic.i18n'

/* Видимость кнопки как отдельный хук: раскладки схлопывают колонку
   «Управление», когда ни reset, ни devices недоступны. */
export const useResetTrafficVisible = (): boolean => {
    const reset = usePaymentReset()
    const subscription = useSubscription()

    if (!reset) {
        return false
    }

    const { user } = subscription
    const limitBytes = Number(user.trafficLimitBytes ?? 0)
    const usedBytes = Number(user.trafficUsedBytes ?? 0)
    // Unlimited plans (limit 0) have no meaningful percentage → treated as 0%,
    // so they only show the button when the threshold is 0 (always show).
    const usagePercent = limitBytes > 0 ? (usedBytes / limitBytes) * 100 : 0

    return usagePercent >= reset.minPercent
}

export const ResetTrafficButton = () => {
    const reset = usePaymentReset()
    const subscription = useSubscription()
    const summary = useSubscriptionSummary()
    const { currentLang } = useTranslation()
    const visible = useResetTrafficVisible()

    if (!visible || !reset) {
        return null
    }

    const { user } = subscription

    const s = getResetStrings(currentLang)
    const priceLabel = formatAmount(reset.amount, reset.currency)

    const openReset = () => {
        const { shortUuid } = user
        const url = `/api/pay/reset?shortUuid=${encodeURIComponent(shortUuid)}`
        window.open(url, '_blank', 'noopener,noreferrer')
    }

    const handleClick = () => {
        vibrate('tap')
        // In SHM (dynamic) mode the SHM reset page shows the real price and its own
        // confirmation, so skip the local confirm modal and go straight there.
        if (reset.dynamic) {
            openReset()
            return
        }
        modals.openConfirmModal({
            centered: true,
            title: s.confirmTitle,
            children: <Text size="sm">{s.confirmBody(priceLabel)}</Text>,
            labels: { confirm: s.pay, cancel: s.cancel },
            onConfirm: openReset
        })
    }

    const baseLabel = reset.dynamic ? s.resetTraffic : `${s.resetTraffic} · ${priceLabel}`
    const label = summary.isUnlimited ? baseLabel : `${baseLabel} · ${summary.remainingLabel}`

    return (
        <Button
            color="cyan"
            fullWidth
            leftSection={<IconRefresh size={18} />}
            mt="xs"
            onClick={handleClick}
            radius="md"
            size="md"
            style={
                summary.isUnlimited
                    ? undefined
                    : {
                        background: `linear-gradient(90deg, rgba(var(--sp-acc-rgb), 0.13) ${summary.remainingPercent}%, transparent ${summary.remainingPercent}%)`,
                        borderColor: 'rgba(var(--sp-acc-rgb), 0.4)'
                    }
            }
            variant="outline"
        >
            {label}
        </Button>
    )
}
