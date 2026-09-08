import { IconArrowUpRight, IconChevronDown } from '@tabler/icons-react'
import { Button, Group, Progress, Stack } from '@mantine/core'
import { useEffect, useRef } from 'react'

import {
    DevicesButton,
    InstallationGuideConnector,
    RawKeysWidget,
    ResetTrafficButton,
    usePaymentModal
} from '@widgets/main'
import { useSubscriptionSummary } from '@entities/subscription-summary'
import { getObsidianStrings } from '@shared/i18n/obsidian.i18n'
import { useAppConfig } from '@entities/app-config-store'
import { formatDate } from '@shared/utils/config-parser'
import { getLayoutStrings } from '@shared/i18n'
import { useTranslation } from '@shared/hooks'

import { LanguageFooter, LinkCard, StatusBadge } from './summary-cards'
import crystalMedium from '../../../../assets/geolog/crystal-640.webp'
import crystalSmall from '../../../../assets/geolog/crystal-384.webp'
import crystalLarge from '../../../../assets/geolog/crystal-960.webp'
import { ILayoutProps } from './layout-props.interface'
import { CrystalBurst } from './crystal-burst'
import classes from './obsidian.module.css'

export const ObsidianLayout = (props: ILayoutProps) => {
    const introRef = useRef<HTMLDivElement>(null)
    const crystalRef = useRef<HTMLDivElement>(null)
    const imageRef = useRef<HTMLImageElement>(null)

    useEffect(() => {
        const intro = introRef.current
        const crystal = crystalRef.current
        if (!intro || !crystal) return undefined

        const motion = window.matchMedia(
            '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'
        )
        const reset = () => {
            crystal.style.removeProperty('--crystal-x')
            crystal.style.removeProperty('--crystal-y')
            crystal.style.removeProperty('--crystal-rx')
            crystal.style.removeProperty('--crystal-ry')
        }
        const move = (event: PointerEvent) => {
            if (!motion.matches || event.pointerType === 'touch') return
            const bounds = intro.getBoundingClientRect()
            const x = Math.max(
                -1,
                Math.min(1, ((event.clientX - bounds.left) / bounds.width - 0.5) * 2)
            )
            const y = Math.max(
                -1,
                Math.min(1, ((event.clientY - bounds.top) / bounds.height - 0.5) * 2)
            )
            crystal.style.setProperty('--crystal-x', `${x * 14}px`)
            crystal.style.setProperty('--crystal-y', `${y * 10}px`)
            crystal.style.setProperty('--crystal-rx', `${-y * 7}deg`)
            crystal.style.setProperty('--crystal-ry', `${x * 10}deg`)
        }
        intro.addEventListener('pointermove', move)
        intro.addEventListener('pointerleave', reset)
        intro.addEventListener('pointercancel', reset)
        motion.addEventListener('change', reset)
        window.addEventListener('blur', reset)
        return () => {
            intro.removeEventListener('pointermove', move)
            intro.removeEventListener('pointerleave', reset)
            intro.removeEventListener('pointercancel', reset)
            motion.removeEventListener('change', reset)
            window.removeEventListener('blur', reset)
        }
    }, [])

    const summary = useSubscriptionSummary()
    const { currentLang, t, baseTranslations } = useTranslation()
    const { hasPayment, openPayment } = usePaymentModal()
    const config = useAppConfig()
    const s = getObsidianStrings(currentLang)
    const layoutStrings = getLayoutStrings(currentLang)
    const usedPercent = 100 - summary.remainingPercent
    const hasManualSetup =
        !config.baseSettings.hideGetLinkButton || config.baseSettings.showConnectionKeys

    return (
        <div className={classes.page}>
            <section className={classes.hero}>
                <div className={classes.intro} ref={introRef}>
                    <h1 className={classes.headline}>
                        {s.headline}
                        <br />
                        {s.headlineEnd}
                    </h1>
                    <p className={classes.introText}>{s.intro}</p>
                    {props.atLeastOnePlatformApp && (
                        <Button
                            className={classes.setupButton}
                            component="a"
                            href="#connection"
                            rightSection={<IconArrowUpRight aria-hidden size={18} />}
                            size="md"
                            variant="default"
                        >
                            {s.configure}
                        </Button>
                    )}
                    <div className={classes.crystalWrap} ref={crystalRef}>
                        <picture>
                            <img
                                alt=""
                                className={classes.crystal}
                                fetchPriority="high"
                                height={960}
                                ref={imageRef}
                                sizes="(max-width: 600px) 210px, (max-width: 1000px) 320px, 380px"
                                src={crystalLarge}
                                srcSet={`${crystalSmall} 384w, ${crystalMedium} 640w, ${crystalLarge} 960w`}
                                width={960}
                            />
                        </picture>
                        <CrystalBurst
                            imageRef={imageRef}
                            label={
                                currentLang === 'ru'
                                    ? 'Расколоть и собрать кристалл'
                                    : 'Shatter and reassemble the crystal'
                            }
                        />
                    </div>
                </div>

                <section aria-label={s.subscription} className={classes.subscription}>
                    <Group align="center" gap="sm" justify="space-between">
                        <h2 className={classes.cardTitle}>{s.subscription}</h2>
                        <StatusBadge />
                    </Group>
                    <div className={classes.traffic}>
                        <div className={classes.trafficValue}>
                            {summary.isUnlimited ? layoutStrings.unlimited : summary.trafficLimit}
                        </div>
                        <span className={classes.caption}>
                            {summary.isUnlimited ? layoutStrings.unlimitedTraffic : s.included}
                        </span>
                    </div>
                    {!summary.isUnlimited && (
                        <Progress
                            aria-label={t(baseTranslations.bandwidth)}
                            radius="xl"
                            size={5}
                            value={usedPercent}
                        />
                    )}
                    <p className={classes.used}>
                        {s.used} <strong>{summary.trafficUsed}</strong>
                    </p>
                    <dl className={classes.details}>
                        <div>
                            <dt>{t(baseTranslations.expires)}</dt>
                            <dd>{formatDate(summary.expiresAt, currentLang, baseTranslations)}</dd>
                        </div>
                        <div>
                            <dt>{t(baseTranslations.name)}</dt>
                            <dd className={classes.username} title={summary.username}>
                                {summary.username}
                            </dd>
                        </div>
                    </dl>
                    {hasPayment && (
                        <div className={classes.payment}>
                            <Button
                                className={classes.renewButton}
                                fullWidth
                                onClick={openPayment}
                                rightSection={<IconArrowUpRight aria-hidden size={19} />}
                                size="lg"
                            >
                                {layoutStrings.renew}
                            </Button>
                            <p className={classes.paymentHint}>{s.paymentHint}</p>
                        </div>
                    )}
                    <Stack className={classes.management} gap="xs">
                        <DevicesButton />
                        <ResetTrafficButton />
                    </Stack>
                </section>
            </section>

            {props.atLeastOnePlatformApp && (
                <section className={classes.connection} id="connection">
                    <InstallationGuideConnector
                        appearance="obsidian"
                        BlockRenderer={props.BlockRenderer}
                        hasPlatformApps={props.hasPlatformApps}
                        isMobile={props.isMobile}
                        platform={props.platform}
                    />
                </section>
            )}

            <div className={classes.bottomRow}>
                {hasManualSetup && (
                    <details className={classes.manual}>
                        <summary>
                            {s.manual}
                            <IconChevronDown aria-hidden size={17} />
                        </summary>
                        <div className={classes.manualContent}>
                            {!config.baseSettings.hideGetLinkButton && <LinkCard />}
                            {config.baseSettings.showConnectionKeys && (
                                <RawKeysWidget isMobile={props.isMobile} />
                            )}
                        </div>
                    </details>
                )}
                {config.brandingSettings.supportUrl && (
                    <a
                        className={classes.support}
                        href={config.brandingSettings.supportUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                    >
                        <span>{s.help}</span> {s.contact} <IconArrowUpRight aria-hidden size={16} />
                    </a>
                )}
            </div>
            <footer className={classes.footer}>
                <span>
                    {config.brandingSettings.title} <span className={classes.footerDivider}>/</span>{' '}
                    {s.footer}
                </span>
                <LanguageFooter />
            </footer>
        </div>
    )
}
