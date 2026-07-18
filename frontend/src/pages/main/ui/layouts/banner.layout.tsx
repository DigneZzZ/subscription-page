import { Box, Stack, Text, Title } from '@mantine/core'

import {
    DevicesButton,
    RawKeysWidget,
    ResetTrafficButton,
    usePaymentModal
} from '@widgets/main'
import { formatDate } from '@shared/utils/config-parser'
import { useTranslation } from '@shared/hooks'
import { TrafficGauge } from '@shared/ui'

import {
    CtaButton,
    InstallGuide,
    LanguageFooter,
    LinkCard,
    SectionHead,
    StatusBadge
} from './summary-cards'
import { useSubscriptionSummary } from './use-subscription-summary'
import { ILayoutProps } from './layout-props.interface'
import { getLayoutStrings } from './layouts.i18n'
import classes from './layouts.module.css'

/**
 * Banner layout (default): a wide accent banner with status, an expiry title,
 * a remaining-traffic sub-line and renew CTA next to the gauge; below it a
 * two-column split of installation guide and a sticky management column.
 */
export const BannerLayout = (props: ILayoutProps) => {
    const { isMobile } = props
    const summary = useSubscriptionSummary()
    const { currentLang, baseTranslations } = useTranslation()
    const s = getLayoutStrings(currentLang)
    const { hasPayment, openPayment } = usePaymentModal()

    const titleText = summary.isIndefinite
        ? s.indefinite
        : s.subscriptionUntil(formatDate(summary.expiresAt, currentLang, baseTranslations))

    const subLine = summary.isUnlimited
        ? s.unlimited
        : `${summary.remainingLabel} ${s.leftOf(summary.trafficLimit)}`

    const gaugeLabel = summary.isUnlimited ? '∞' : `${summary.remainingPercent}%`
    const gaugeCaption = summary.isUnlimited ? s.unlimited : `${s.left} ${summary.remainingLabel}`

    return (
        <Box className={classes.pageWide}>
            <Stack gap="xl">
                <Box className={classes.banner}>
                    <Box className={classes.bannerLeft}>
                        <StatusBadge />
                        <Title ff="heading" fw={600} fz="19px" order={2}>
                            {titleText}
                        </Title>
                        <Text c="var(--sp-dim)" fz="13.5px">
                            {subLine}
                        </Text>
                        {hasPayment && (
                            <CtaButton fullWidth={false} label={s.renew} onClick={openPayment} />
                        )}
                    </Box>
                    <TrafficGauge
                        caption={gaugeCaption}
                        label={gaugeLabel}
                        percent={summary.remainingPercent}
                    />
                </Box>

                <Box className={classes.twocolF}>
                    <Box>
                        <InstallGuide {...props} />
                    </Box>
                    <Box className={classes.twocolFRight}>
                        <SectionHead>{s.management}</SectionHead>
                        <DevicesButton />
                        <ResetTrafficButton />
                        <LinkCard />
                    </Box>
                </Box>

                <RawKeysWidget isMobile={isMobile} />

                <LanguageFooter />
            </Stack>
        </Box>
    )
}
