import { Box, Group, Stack, Text, Title, UnstyledButton } from '@mantine/core'
import clsx from 'clsx'

import { DevicesButton, RawKeysWidget, usePaymentModal, useResetTraffic } from '@widgets/main'
import { useSubscriptionSummary } from '@entities/subscription-summary'
import { formatDate } from '@shared/utils/config-parser'
import { getLayoutStrings } from '@shared/i18n'
import { useTranslation } from '@shared/hooks'
import { TrafficGauge } from '@shared/ui'

import { CtaButton, InstallGuide, LanguageFooter, LinkCard, StatusBadge } from './summary-cards'
import { ILayoutProps } from './layout-props.interface'
import classes from './aurora.module.css'
import base from './layouts.module.css'

/**
 * Aurora layout: animated accent blobs behind a glass hero card; the traffic
 * ring doubles as the reset-traffic button (with a price pill underneath).
 */
export const AuroraLayout = (props: ILayoutProps) => {
    const { isMobile } = props
    const summary = useSubscriptionSummary()
    const { currentLang, baseTranslations } = useTranslation()
    const s = getLayoutStrings(currentLang)
    const { hasPayment, openPayment } = usePaymentModal()
    const reset = useResetTraffic()

    const untilText = summary.isIndefinite
        ? s.indefiniteSubscription
        : s.subscriptionUntil(formatDate(summary.expiresAt, currentLang, baseTranslations))

    const subLine = summary.isUnlimited
        ? s.unlimitedTraffic
        : `${summary.remainingLabel} ${s.leftOf(summary.trafficLimit)}`

    const gauge = (
        <TrafficGauge
            caption={s.trafficLeftCaption}
            label={`${summary.remainingPercent}%`}
            percent={summary.remainingPercent}
            size={140}
            sub={`${summary.remainingLabel} ${s.leftOf(summary.trafficLimit)}`}
        />
    )

    return (
        <Box className={base.pageWide}>
            <Stack gap="xl">
                <Box className={classes.stage}>
                    <div aria-hidden className={classes.blobs}>
                        <i />
                        <i />
                        <i />
                    </div>

                    <Box className={clsx(classes.glass, classes.hero)}>
                        <Box className={classes.heroLeft}>
                            <StatusBadge />
                            <Title ff="heading" fw={700} fz="24px" mt={6} order={2}>
                                {summary.username}
                            </Title>
                            <Text fw={600} fz="15px">
                                {untilText}
                            </Text>
                            <Text c="var(--sp-dim)" fz="13.5px">
                                {subLine}
                            </Text>
                            <Group gap={10} mt={14} wrap="wrap">
                                {hasPayment && (
                                    <CtaButton
                                        fullWidth={false}
                                        label={s.renew}
                                        onClick={openPayment}
                                    />
                                )}
                                <DevicesButton />
                            </Group>
                        </Box>

                        {/* Кольцо-кнопка: клик = сброс трафика; без reset-конфига —
                            просто шкала; при безлимите кольца нет вовсе */}
                        {!summary.isUnlimited &&
                            (reset.visible ? (
                                <UnstyledButton
                                    className={classes.ringBtn}
                                    onClick={reset.handleReset}
                                >
                                    {gauge}
                                    <span className={classes.resetPill}>
                                        ↻ {s.resetShort} · {reset.priceLabel}
                                    </span>
                                </UnstyledButton>
                            ) : (
                                gauge
                            ))}
                    </Box>

                    <Box className={classes.row}>
                        <Box>
                            <InstallGuide {...props} />
                        </Box>
                        <Box className={classes.sideCol}>
                            <LinkCard />
                            <RawKeysWidget isMobile={isMobile} />
                        </Box>
                    </Box>
                </Box>

                <LanguageFooter />
            </Stack>
        </Box>
    )
}
