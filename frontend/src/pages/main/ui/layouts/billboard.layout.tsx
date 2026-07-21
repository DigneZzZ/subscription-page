import { Box, Group, Stack, Text } from '@mantine/core'

import { DevicesButton, RawKeysWidget, ResetTrafficButton, usePaymentModal } from '@widgets/main'
import { useSubscriptionSummary } from '@entities/subscription-summary'
import { useSubscription } from '@entities/subscription-info-store'
import { useAppConfig } from '@entities/app-config-store'
import { formatDate } from '@shared/utils/config-parser'
import { getLayoutStrings } from '@shared/i18n'
import { useTranslation } from '@shared/hooks'

import { CtaButton, InstallGuide, LanguageFooter, LinkCard, StatusBadge } from './summary-cards'
import { ILayoutProps } from './layout-props.interface'
import classes from './billboard.module.css'
import base from './layouts.module.css'

/**
 * Billboard layout: poster-scale typography — a giant sheening headline with
 * the remaining share, a spinning light rim around the hero card and a static
 * facts strip built from real subscription data.
 */
export const BillboardLayout = (props: ILayoutProps) => {
    const { isMobile } = props
    const summary = useSubscriptionSummary()
    const subscription = useSubscription()
    const config = useAppConfig()
    const { t, currentLang, baseTranslations } = useTranslation()
    const s = getLayoutStrings(currentLang)
    const { hasPayment, openPayment } = usePaymentModal()

    const headline = summary.isUnlimited
        ? s.unlimitedTraffic
        : s.reserveHeadline(summary.remainingPercent)

    const untilText = summary.isIndefinite
        ? s.indefiniteSubscription
        : s.subscriptionUntil(formatDate(summary.expiresAt, currentLang, baseTranslations))

    const facts = [
        untilText,
        summary.isUnlimited
            ? s.unlimitedTraffic
            : `${s.left} ${summary.remainingLabel} ${s.leftOf(summary.trafficLimit)}`,
        `${t(baseTranslations.connectionKeysHeader)} · ${subscription.links.length}`
    ]

    return (
        <Box className={base.pageWide}>
            <Stack gap="lg">
                <Box className={classes.poster}>
                    <Box className={classes.kick}>
                        <Text c="var(--sp-acc)" className="sp-mono-label">
                            {config.brandingSettings.title} · {summary.username}
                        </Text>
                        <StatusBadge />
                    </Box>
                    <Box className={classes.giant}>{headline}</Box>
                    <Text className={classes.lead}>
                        {summary.isUnlimited ? (
                            untilText
                        ) : (
                            <>
                                {s.left}{' '}
                                <b>
                                    {summary.remainingLabel} {s.leftOf(summary.trafficLimit)}
                                </b>{' '}
                                · {untilText}
                            </>
                        )}
                    </Text>
                    <Box className={classes.ctaRow}>
                        {hasPayment && <CtaButton label={s.renew} onClick={openPayment} />}
                        <DevicesButton />
                        <ResetTrafficButton />
                    </Box>
                </Box>

                <Group className={classes.facts} component="div">
                    {facts.map((fact) => (
                        <span key={fact}>{fact}</span>
                    ))}
                </Group>

                <InstallGuide {...props} />

                <RawKeysWidget isMobile={isMobile} />

                <LinkCard />

                <LanguageFooter />
            </Stack>
        </Box>
    )
}
