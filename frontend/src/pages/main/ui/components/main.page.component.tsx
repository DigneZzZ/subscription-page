import { TSubscriptionPagePlatformKey } from '@remnawave/subscription-page-types'
import { Box, Container, Group, Image, Title } from '@mantine/core'
import { useEffect } from 'react'

import {
    AccordionBlockRenderer,
    CardsBlockRenderer,
    MinimalBlockRenderer,
    PreviewPanel,
    SubscriptionInfoCardsWidget,
    SubscriptionInfoCollapsedWidget,
    SubscriptionInfoExpandedWidget,
    SubscriptionLinkWidget,
    TimelineBlockRenderer
} from '@widgets/main'
import {
    AuroraLayout,
    BannerLayout,
    ClassicLayout,
    ColumnsLayout,
    HeroLayout,
    ILayoutProps,
    TilesLayout
} from '@pages/main/ui/layouts'
import { EFFECT_FLAGS, useEffects, useLayoutPreset, usePreviewMode } from '@entities/ui-preset-store'
import { useSupportEmail } from '@entities/support-store'
import { useAppConfig } from '@entities/app-config-store'
import { FxBlobs, Page, Wordmark } from '@shared/ui'

interface IMainPageComponentProps {
    isMobile: boolean
    platform: TSubscriptionPagePlatformKey | undefined
}

const BLOCK_RENDERERS = {
    cards: CardsBlockRenderer,
    timeline: TimelineBlockRenderer,
    accordion: AccordionBlockRenderer,
    minimal: MinimalBlockRenderer
} as const

const SUBSCRIPTION_INFO_BLOCK_RENDERERS = {
    cards: SubscriptionInfoCardsWidget,
    collapsed: SubscriptionInfoCollapsedWidget,
    expanded: SubscriptionInfoExpandedWidget,
    hidden: null
} as const

const LAYOUT_RENDERERS = {
    aurora: AuroraLayout,
    banner: BannerLayout,
    classic: ClassicLayout,
    columns: ColumnsLayout,
    hero: HeroLayout,
    tiles: TilesLayout
} as const

export const MainPageComponent = ({ isMobile, platform }: IMainPageComponentProps) => {
    const config = useAppConfig()
    const supportEmail = useSupportEmail()
    const layoutPreset = useLayoutPreset()
    const effects = useEffects()

    useEffect(() => {
        EFFECT_FLAGS.forEach((flag) => {
            document.body.classList.toggle(`fx-${flag}`, effects.includes(flag))
        })
        return () => {
            EFFECT_FLAGS.forEach((flag) => document.body.classList.remove(`fx-${flag}`))
        }
    }, [effects])
    const preview = usePreviewMode()

    const brandName = config.brandingSettings.title
    let hasCustomLogo = !!config.brandingSettings.logoUrl

    if (hasCustomLogo) {
        if (config.brandingSettings.logoUrl.includes('docs.rw')) {
            hasCustomLogo = false
        }
    }

    const hasPlatformApps: Record<TSubscriptionPagePlatformKey, boolean> = {
        ios: Boolean(config.platforms.ios?.apps.length),
        android: Boolean(config.platforms.android?.apps.length),
        linux: Boolean(config.platforms.linux?.apps.length),
        macos: Boolean(config.platforms.macos?.apps.length),
        windows: Boolean(config.platforms.windows?.apps.length),
        androidTV: Boolean(config.platforms.androidTV?.apps.length),
        appleTV: Boolean(config.platforms.appleTV?.apps.length)
    }

    const atLeastOnePlatformApp = Object.values(hasPlatformApps).some((value) => value)

    const SubscriptionInfoBlockRenderer =
        SUBSCRIPTION_INFO_BLOCK_RENDERERS[config.uiConfig.subscriptionInfoBlockType]

    const Layout = LAYOUT_RENDERERS[layoutPreset] ?? HeroLayout

    const layoutProps: ILayoutProps = {
        atLeastOnePlatformApp,
        BlockRenderer: BLOCK_RENDERERS[config.uiConfig.installationGuidesBlockType],
        hasPlatformApps,
        isMobile,
        platform,
        SubscriptionInfoBlockRenderer
    }

    return (
        <Page>
            {effects.includes('blobs') && layoutPreset !== 'aurora' && <FxBlobs />}
            <Box className="header-wrapper" py="md">
                <Container maw={1200} px={{ base: 'md', sm: 'lg', md: 'xl' }}>
                    <Group justify="space-between">
                        <Group gap="sm" style={{ userSelect: 'none' }} wrap="nowrap">
                            {hasCustomLogo ? (
                                <>
                                    <Image
                                        alt="logo"
                                        fit="contain"
                                        src={config.brandingSettings.logoUrl}
                                        style={{
                                            width: '32px',
                                            height: '32px',
                                            flexShrink: 0
                                        }}
                                    />
                                    <Title c="var(--sp-text)" fw={700} order={4} size="lg">
                                        {brandName}
                                    </Title>
                                </>
                            ) : (
                                <Wordmark title={brandName} />
                            )}
                        </Group>

                        <SubscriptionLinkWidget
                            hideGetLink={config.baseSettings.hideGetLinkButton}
                            supportEmail={supportEmail}
                            supportUrl={config.brandingSettings.supportUrl}
                        />
                    </Group>
                </Container>
            </Box>

            {/* Rendered OUTSIDE the content Container: that container is a
                `zIndex: 1` stacking context which would trap the sticky panel's
                own z-index below the `.header-wrapper` (z 10) and let it slide
                underneath. As a direct Page child it shares the tall containing
                block (so it stays sticky through the whole scroll) and its
                z-index is honoured against the header. */}
            {preview && <PreviewPanel />}

            <Container
                maw={1200}
                px={{ base: 'md', sm: 'lg', md: 'xl' }}
                py="xl"
                style={{ position: 'relative', zIndex: 1 }}
            >
                <Layout {...layoutProps} />
            </Container>
        </Page>
    )
}
