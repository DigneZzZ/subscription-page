import { IconRefresh } from '@tabler/icons-react'
import { Button, Text } from '@mantine/core'
import { modals } from '@mantine/modals'

import { useSubscription } from '@entities/subscription-info-store'
import { formatAmount } from '@shared/utils/format-amount'
import { usePaymentReset } from '@entities/payment-store'
import { vibrate } from '@shared/utils/vibrate'
import { useTranslation } from '@shared/hooks'

import { getResetStrings } from './reset-traffic.i18n'

export const ResetTrafficButton = () => {
    const reset = usePaymentReset()
    const subscription = useSubscription()
    const { currentLang } = useTranslation()

    if (!reset) {
        return null
    }

    const s = getResetStrings(currentLang)
    const priceLabel = formatAmount(reset.amount, reset.currency)

    const handleClick = () => {
        vibrate('tap')
        modals.openConfirmModal({
            centered: true,
            title: s.confirmTitle,
            children: <Text size="sm">{s.confirmBody(priceLabel)}</Text>,
            labels: { confirm: s.pay, cancel: s.cancel },
            onConfirm: () => {
                const { shortUuid } = subscription.user
                const url = `/api/pay/reset?shortUuid=${encodeURIComponent(shortUuid)}`
                window.open(url, '_blank', 'noopener,noreferrer')
            }
        })
    }

    return (
        <Button
            fullWidth
            leftSection={<IconRefresh size={18} />}
            mt="xs"
            onClick={handleClick}
            radius="md"
            size="md"
            variant="light"
        >
            {`${s.resetTraffic} · ${priceLabel}`}
        </Button>
    )
}
