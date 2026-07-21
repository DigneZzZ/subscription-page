import { Box, Group, Stack, Text, Title } from '@mantine/core'

import { DevicesButton, RawKeysWidget, ResetTrafficButton, usePaymentModal } from '@widgets/main'
import { useSubscriptionSummary } from '@entities/subscription-summary'
import { useAppConfig } from '@entities/app-config-store'
import { formatDate } from '@shared/utils/config-parser'
import { getLayoutStrings } from '@shared/i18n'
import { useTranslation } from '@shared/hooks'

import { CtaButton, InstallGuide, LanguageFooter, LinkCard, StatusBadge } from './summary-cards'
import { ILayoutProps } from './layout-props.interface'
import classes from './network.module.css'
import base from './layouts.module.css'

/**
 * Network layout: an animated node-map (server constellation) behind a single
 * stage — big username, glowing remaining-percent figure and a shimmering
 * traffic bar above the standard actions and install guide.
 */
export const NetworkLayout = (props: ILayoutProps) => {
    const { isMobile } = props
    const summary = useSubscriptionSummary()
    const config = useAppConfig()
    const { currentLang, baseTranslations } = useTranslation()
    const s = getLayoutStrings(currentLang)
    const { hasPayment, openPayment } = usePaymentModal()

    const untilText = summary.isIndefinite
        ? s.indefiniteSubscription
        : s.subscriptionUntil(formatDate(summary.expiresAt, currentLang, baseTranslations))

    return (
        <Box className={base.pageWide}>
            <Stack gap="xl">
                <Box className={classes.stage}>
                    <svg
                        aria-hidden
                        className={classes.net}
                        preserveAspectRatio="xMidYMid slice"
                        viewBox="0 0 1000 620"
                    >
                        <line x1="60" x2="330" y1="80" y2="180" />
                        <line x1="330" x2="620" y1="180" y2="90" />
                        <line x1="620" x2="900" y1="90" y2="210" />
                        <line x1="120" x2="330" y1="420" y2="180" />
                        <line x1="330" x2="560" y1="180" y2="380" />
                        <line x1="560" x2="900" y1="380" y2="210" />
                        <line x1="560" x2="820" y1="380" y2="520" />
                        <line x1="120" x2="400" y1="420" y2="560" />
                        <line x1="400" x2="820" y1="560" y2="520" />
                        <line x1="60" x2="120" y1="80" y2="420" />
                        <circle className={classes.big} cx="60" cy="80" r="4" />
                        <circle cx="330" cy="180" r="3" />
                        <circle className={classes.big} cx="620" cy="90" r="4" />
                        <circle cx="900" cy="210" r="3" />
                        <circle cx="120" cy="420" r="3" />
                        <circle className={classes.big} cx="560" cy="380" r="4" />
                        <circle cx="820" cy="520" r="3" />
                        <circle cx="400" cy="560" r="3" />
                    </svg>

                    <Box className={classes.inner}>
                        <Box className={classes.top}>
                            <Box>
                                <Text c="var(--sp-acc)" className="sp-mono-label">
                                    {config.brandingSettings.title}
                                </Text>
                                <Title ff="heading" fw={700} fz="30px" mt={8} order={2}>
                                    {summary.username}
                                </Title>
                                <Group gap={10} mt={8}>
                                    <StatusBadge />
                                    <Text fw={600} fz="14px">
                                        {untilText}
                                    </Text>
                                </Group>
                            </Box>
                            <Box className={classes.stat}>
                                <Box className={classes.statNum}>
                                    {summary.isUnlimited ? '∞' : `${summary.remainingPercent}%`}
                                </Box>
                                <Text c="var(--sp-dim)" fz="12.5px">
                                    {summary.isUnlimited
                                        ? s.unlimitedTraffic
                                        : `${s.left} ${summary.remainingLabel} ${s.leftOf(summary.trafficLimit)}`}
                                </Text>
                            </Box>
                        </Box>

                        {!summary.isUnlimited && (
                            <Box className={classes.bar}>
                                <span
                                    className={classes.barFill}
                                    style={{ width: `${summary.remainingPercent}%` }}
                                />
                            </Box>
                        )}

                        <Box className={classes.actions}>
                            {hasPayment && <CtaButton label={s.renew} onClick={openPayment} />}
                            <DevicesButton />
                            <ResetTrafficButton />
                        </Box>

                        <InstallGuide {...props} />

                        <LinkCard />
                    </Box>
                </Box>

                <RawKeysWidget isMobile={isMobile} />

                <LanguageFooter />
            </Stack>
        </Box>
    )
}
