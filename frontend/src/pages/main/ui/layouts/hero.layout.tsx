import { Box, Group, Stack, Text } from '@mantine/core'
import clsx from 'clsx'

import { DevicesButton, RawKeysWidget, ResetTrafficButton, usePaymentModal } from '@widgets/main'
import { formatDate } from '@shared/utils/config-parser'
import { useTranslation } from '@shared/hooks'
import { TrafficGauge } from '@shared/ui'

import { CtaButton, InstallGuide, LanguageFooter, LinkCard, StatusBadge } from './summary-cards'
import { useSubscriptionSummary } from './use-subscription-summary'
import { ILayoutProps } from './layout-props.interface'
import { getLayoutStrings } from './layouts.i18n'
import classes from './layouts.module.css'

/**
 * Hero layout: a big radial traffic gauge next to a status/expiry summary,
 * a renew CTA (payment-gated) and the devices/reset action row.
 */
export const HeroLayout = (props: ILayoutProps) => {
    const { isMobile } = props
    const summary = useSubscriptionSummary()
    const { t, currentLang, baseTranslations } = useTranslation()
    const s = getLayoutStrings(currentLang)
    const { hasPayment, openPayment } = usePaymentModal()

    const gaugeLabel = summary.isUnlimited ? '∞' : `${summary.remainingPercent}%`
    const gaugeCaption = summary.isUnlimited ? s.unlimited : `${s.left} ${summary.remainingLabel}`

    const expiresValue = summary.isIndefinite
        ? s.indefinite
        : `${formatDate(summary.expiresAt, currentLang, baseTranslations)} · ${s.perDays(
            summary.daysLeft
        )}`

    return (
        <Box className={classes.pageMid}>
            <Stack gap="xl">
                <Box className={clsx(classes.card, classes.hero)}>
                    <TrafficGauge
                        caption={gaugeCaption}
                        label={gaugeLabel}
                        percent={summary.remainingPercent}
                    />
                    <Stack gap="md">
                        <Box>
                            <StatusBadge />
                        </Box>

                        <Group gap="md" justify="space-between" wrap="nowrap">
                            <Text c="var(--sp-dim)" fz="14px">
                                {t(baseTranslations.expires)}
                            </Text>
                            <Text fw={600} fz="14px" ta="end">
                                {expiresValue}
                            </Text>
                        </Group>

                        <Stack gap="xs">
                            {hasPayment && <CtaButton label={s.renew} onClick={openPayment} />}
                            <Group gap="xs" grow>
                                <DevicesButton />
                                <ResetTrafficButton />
                            </Group>
                        </Stack>
                    </Stack>
                </Box>

                <InstallGuide {...props} />

                <RawKeysWidget isMobile={isMobile} />

                <LinkCard />

                <LanguageFooter />
            </Stack>
        </Box>
    )
}
