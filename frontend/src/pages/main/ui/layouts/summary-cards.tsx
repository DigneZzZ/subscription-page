import { Badge, Box, Button, Center, CopyButton, Group, Progress, Text } from '@mantine/core'
import { ReactNode } from 'react'
import clsx from 'clsx'

import {
    useAppConfig,
    useAppConfigStoreActions,
    useCurrentLang
} from '@entities/app-config-store'
import { LanguagePicker } from '@shared/ui/language-picker/language-picker.shared'
import { useSubscriptionSummary } from '@entities/subscription-summary'
import { useSubscription } from '@entities/subscription-info-store'
import { InstallationGuideConnector } from '@widgets/main'
import { formatDate } from '@shared/utils/config-parser'
import { getLayoutStrings } from '@shared/i18n'
import { useTranslation } from '@shared/hooks'

import { ILayoutProps } from './layout-props.interface'
import classes from './layouts.module.css'

/**
 * Status pill. Colour follows stock semantics: green when active, orange for a
 * LIMITED user, red for EXPIRED/DISABLED. Label reuses the base translations.
 */
export const StatusBadge = () => {
    const { isActive, userStatus } = useSubscriptionSummary()
    const { t, baseTranslations } = useTranslation()

    let color = 'red.4'
    if (isActive) {
        color = 'green.4'
    } else if (userStatus === 'LIMITED') {
        color = 'orange.4'
    }

    const label = isActive ? t(baseTranslations.active) : t(baseTranslations.inactive)

    return (
        <Badge color={color} radius="sm" size="lg" variant="dot">
            {label}
        </Badge>
    )
}

/** Uppercase mono-flavoured section heading (mockup `.section-head`). */
export const SectionHead = ({ children }: { children: ReactNode }) => (
    <Box className={classes.sectionHead}>{children}</Box>
)

/** Primary accent call-to-action button (mockup `.btn-cta`). */
export const CtaButton = ({
    fullWidth = true,
    label,
    onClick
}: {
    fullWidth?: boolean
    label: string
    onClick: () => void
}) => (
    <Button
        fullWidth={fullWidth}
        onClick={onClick}
        radius="md"
        size="md"
        styles={{
            root: {
                background: 'linear-gradient(135deg, var(--sp-acc-bright), var(--sp-acc-deep))',
                color: 'var(--sp-cta-text)',
                boxShadow: '0 6px 18px rgba(var(--sp-acc-rgb), 0.25)'
            }
        }}
    >
        {label}
    </Button>
)

/**
 * Traffic meter row + bar (mockup traffic-card body). Always in «осталось» terms:
 * shows the remaining label plus `of <limit>`. Unlimited plans show the label with
 * no bar and no `of` suffix.
 */
export const TrafficMeter = () => {
    const summary = useSubscriptionSummary()
    const { t, currentLang, baseTranslations } = useTranslation()
    const s = getLayoutStrings(currentLang)

    return (
        <>
            <Group align="baseline" justify="space-between" wrap="nowrap">
                <Text className="sp-mono-label">
                    {`${t(baseTranslations.bandwidth)} · ${s.left}`}
                </Text>
                <Text fw={600} fz="15.5px">
                    {summary.remainingLabel}
                    {!summary.isUnlimited && (
                        <Text c="var(--sp-dim)" component="span" fw={400} fz="13px">
                            {` ${s.leftOf(summary.trafficLimit)}`}
                        </Text>
                    )}
                </Text>
            </Group>
            {!summary.isUnlimited && (
                <Progress.Root radius="xl" size={8} style={{ background: 'var(--sp-track)' }}>
                    <Progress.Section
                        style={{
                            background:
                                'linear-gradient(90deg, var(--sp-acc-bright), var(--sp-acc-deep))'
                        }}
                        value={summary.remainingPercent}
                    />
                </Progress.Root>
            )}
        </>
    )
}

/** Subscription-link copy card. Copies `subscription.subscriptionUrl` verbatim. */
export const LinkCard = () => {
    const subscription = useSubscription()
    const { t, currentLang, baseTranslations } = useTranslation()
    const s = getLayoutStrings(currentLang)
    const url = subscription.subscriptionUrl

    return (
        <Box className={clsx(classes.card, classes.linkCard)}>
            <Text className="sp-mono-label">{s.subscriptionLink}</Text>
            <Box className={classes.linkRow}>
                <span className={classes.linkUrl}>{url}</span>
                <CopyButton timeout={2000} value={url}>
                    {({ copied, copy }) => (
                        <Button
                            onClick={copy}
                            radius="md"
                            size="xs"
                            styles={{
                                root: {
                                    color: 'var(--sp-acc)',
                                    background: 'rgba(var(--sp-acc-rgb), 0.1)',
                                    border: '1px solid rgba(var(--sp-acc-rgb), 0.32)'
                                }
                            }}
                            variant="light"
                        >
                            {copied ? t(baseTranslations.linkCopied) : t(baseTranslations.copyLink)}
                        </Button>
                    )}
                </CopyButton>
            </Box>
        </Box>
    )
}

/** Installation guide, gated on there being at least one platform app (stock behaviour). */
export const InstallGuide = (props: ILayoutProps) => {
    if (!props.atLeastOnePlatformApp) {
        return null
    }

    return (
        <InstallationGuideConnector
            BlockRenderer={props.BlockRenderer}
            hasPlatformApps={props.hasPlatformApps}
            isMobile={props.isMobile}
            platform={props.platform}
        />
    )
}

/** Centered language picker — the common footer for every layout. */
export const LanguageFooter = () => {
    const config = useAppConfig()
    const currentLang = useCurrentLang()
    const { setLanguage } = useAppConfigStoreActions()

    return (
        <Center>
            <LanguagePicker
                currentLang={currentLang}
                locales={config.locales}
                onLanguageChange={setLanguage}
            />
        </Center>
    )
}

/**
 * Shared summary block (mockup «A-инфогрид»): Status / Expires cards plus a wide
 * traffic bar, laid out in two columns. Devices count is not sourced here (it is
 * fetched asynchronously inside DevicesButton), so its card is replaced by the
 * traffic bar. Used by the columns layout's left rail.
 */
export const SummaryCards = () => {
    const summary = useSubscriptionSummary()
    const { t, currentLang, baseTranslations } = useTranslation()
    const s = getLayoutStrings(currentLang)

    const expiresValue = summary.isIndefinite
        ? s.indefinite
        : formatDate(summary.expiresAt, currentLang, baseTranslations)

    return (
        <Box className={classes.infoGridTwo}>
            <Box className={clsx(classes.card, classes.infoCard, classes.trafficSpanTwo)}>
                <Text className="sp-mono-label">{t(baseTranslations.name)}</Text>
                <Text fw={600} fz="16.5px">
                    {summary.username}
                </Text>
            </Box>

            <Box className={clsx(classes.card, classes.infoCard)}>
                <Text className="sp-mono-label">{t(baseTranslations.status)}</Text>
                <StatusBadge />
            </Box>

            <Box className={clsx(classes.card, classes.infoCard)}>
                <Text className="sp-mono-label">{t(baseTranslations.expires)}</Text>
                <Text fw={600} fz="16.5px">
                    {expiresValue}
                </Text>
                {!summary.isIndefinite && summary.daysLeft > 0 && (
                    <Text c="var(--sp-dim)" fz="12px">
                        {s.perDays(summary.daysLeft)}
                    </Text>
                )}
            </Box>

            <Box className={clsx(classes.card, classes.trafficCard, classes.trafficSpanTwo)}>
                <TrafficMeter />
            </Box>
        </Box>
    )
}
