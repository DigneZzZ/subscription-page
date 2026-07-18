import { Box, Stack, Text, UnstyledButton } from '@mantine/core'
import clsx from 'clsx'

import {
    DevicesButton,
    RawKeysWidget,
    ResetTrafficButton,
    usePaymentModal
} from '@widgets/main'
import { formatDate } from '@shared/utils/config-parser'
import { useTranslation } from '@shared/hooks'

import {
    InstallGuide,
    LanguageFooter,
    LinkCard,
    StatusBadge,
    TrafficMeter
} from './summary-cards'
import { useSubscriptionSummary } from './use-subscription-summary'
import { ILayoutProps } from './layout-props.interface'
import { getLayoutStrings } from './layouts.i18n'
import classes from './layouts.module.css'

/**
 * Tiles layout: a compact 4-up grid of status/expiry tiles, the devices and
 * reset buttons rendered directly as cells, a wide traffic tile and a wide
 * renew CTA tile (payment-gated).
 */
export const TilesLayout = (props: ILayoutProps) => {
    const { isMobile } = props
    const summary = useSubscriptionSummary()
    const { t, currentLang, baseTranslations } = useTranslation()
    const s = getLayoutStrings(currentLang)
    const { hasPayment, openPayment } = usePaymentModal()

    const expiresDate = formatDate(summary.expiresAt, currentLang, baseTranslations)
    const ctaSub = summary.isIndefinite ? s.indefinite : s.subscriptionUntil(expiresDate)

    return (
        <Box className={classes.pageMid}>
            <Stack gap="xl">
                <Box className={classes.tiles}>
                    <Box className={clsx(classes.card, classes.tile)}>
                        <Text className="sp-mono-label">{t(baseTranslations.status)}</Text>
                        <StatusBadge />
                    </Box>

                    <Box className={clsx(classes.card, classes.tile)}>
                        <Text className="sp-mono-label">{t(baseTranslations.expires)}</Text>
                        <Text fw={600} fz="15.5px">
                            {summary.isIndefinite ? s.indefinite : s.perDays(summary.daysLeft)}
                        </Text>
                        {!summary.isIndefinite && (
                            <Text c="var(--sp-dim)" fz="11.5px">
                                {expiresDate}
                            </Text>
                        )}
                    </Box>

                    {/* Rendered directly as grid cells; `.tiles > button` makes each
                        span two columns so the reset label fits and null (hwid-off)
                        DevicesButton leaves no empty cell. */}
                    <DevicesButton />
                    <ResetTrafficButton />

                    <Box className={clsx(classes.card, classes.tile, classes.tileSpan2)}>
                        <TrafficMeter />
                    </Box>

                    {hasPayment && (
                        <UnstyledButton
                            className={clsx(classes.card, classes.ctaTile)}
                            onClick={openPayment}
                        >
                            <Box>
                                <Text ff="heading" fw={600} fz="14.5px">
                                    {s.renew}
                                </Text>
                                <Text fz="11.5px" opacity={0.7}>
                                    {ctaSub}
                                </Text>
                            </Box>
                            <Text className={classes.ctaArrow} fz="22px">
                                →
                            </Text>
                        </UnstyledButton>
                    )}
                </Box>

                <InstallGuide {...props} />

                <RawKeysWidget isMobile={isMobile} />

                <LinkCard />

                <LanguageFooter />
            </Stack>
        </Box>
    )
}
