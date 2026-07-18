import { Box, Group, Stack, Text } from '@mantine/core'
import clsx from 'clsx'

import { DevicesButton, RawKeysWidget, ResetTrafficButton, usePaymentModal } from '@widgets/main'
import { useSubscriptionSummary } from '@entities/subscription-summary'
import { formatDate } from '@shared/utils/config-parser'
import { getLayoutStrings } from '@shared/i18n'
import { useTranslation } from '@shared/hooks'
import { TrafficGauge } from '@shared/ui'

import { CtaButton, InstallGuide, LanguageFooter, LinkCard, StatusBadge } from './summary-cards'
import { ILayoutProps } from './layout-props.interface'
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

    const expiresDate = formatDate(summary.expiresAt, currentLang, baseTranslations)
    const expiresCountdown =
        summary.daysLeft > 0 ? `${expiresDate} · ${s.perDays(summary.daysLeft)}` : expiresDate
    const expiresValue = summary.isIndefinite ? s.indefinite : expiresCountdown

    return (
        <Box className={classes.pageMid}>
            <Stack gap="xl">
                <Box
                    className={clsx(
                        classes.card,
                        classes.hero,
                        summary.isUnlimited && classes.heroNoGauge
                    )}
                >
                    {/* Полное кольцо «∞» при безлимите бессмысленно — гаугe только с лимитом */}
                    {!summary.isUnlimited && (
                        <TrafficGauge
                            caption={`${s.left} ${summary.remainingLabel}`}
                            label={`${summary.remainingPercent}%`}
                            percent={summary.remainingPercent}
                        />
                    )}
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
                            {/* Кнопки в столбик: в пол-ширины карты счётчик устройств
                                и цена+остаток сброса не влезают и усекаются */}
                            <Stack className={classes.btnFlush} gap="xs">
                                <DevicesButton />
                                <ResetTrafficButton />
                            </Stack>
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
