import { Box, Stack, Text, Title } from '@mantine/core'

import {
    DevicesButton,
    RawKeysWidget,
    ResetTrafficButton,
    usePaymentModal,
    useResetTrafficVisible
} from '@widgets/main'
import { useSubscriptionSummary } from '@entities/subscription-summary'
import { useDevicesEnabled } from '@entities/devices-store'
import { formatDate } from '@shared/utils/config-parser'
import { getLayoutStrings } from '@shared/i18n'
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
import { ILayoutProps } from './layout-props.interface'
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
    // Колонка «Управление» существует только когда в ней есть хотя бы одна
    // кнопка; иначе гайд получает всю ширину, а ссылка встаёт под баннер.
    const devicesEnabled = useDevicesEnabled()
    const resetVisible = useResetTrafficVisible()
    const hasManagement = devicesEnabled || resetVisible

    const titleText = summary.isIndefinite
        ? s.indefiniteSubscription
        : s.subscriptionUntil(formatDate(summary.expiresAt, currentLang, baseTranslations))

    const subLine = summary.isUnlimited
        ? s.unlimitedTraffic
        : `${summary.remainingLabel} ${s.leftOf(summary.trafficLimit)}`

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
                    {/* Полное кольцо «∞» при безлимите бессмысленно — гаугe только с лимитом */}
                    {!summary.isUnlimited && (
                        <TrafficGauge
                            caption={`${s.left} ${summary.remainingLabel}`}
                            label={`${summary.remainingPercent}%`}
                            percent={summary.remainingPercent}
                        />
                    )}
                </Box>

                {hasManagement ? (
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
                ) : (
                    <>
                        <LinkCard />
                        <InstallGuide {...props} />
                    </>
                )}

                <RawKeysWidget isMobile={isMobile} />

                <LanguageFooter />
            </Stack>
        </Box>
    )
}
