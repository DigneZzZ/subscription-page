import { Box, Center, Container, Group, Image, Stack, Title } from '@mantine/core'
import { TSubscriptionPagePlatformKey } from '@remnawave/subscription-page-types'

import {
    AccordionBlockRenderer,
    CardsBlockRenderer,
    InstallationGuideConnector,
    MinimalBlockRenderer,
    RawKeysWidget,
    SubscriptionInfoCardsWidget,
    SubscriptionInfoCollapsedWidget,
    SubscriptionInfoExpandedWidget,
    SubscriptionLinkWidget,
    TimelineBlockRenderer
} from '@widgets/main'
import { useAppConfig, useAppConfigStoreActions, useCurrentLang } from '@entities/app-config-store'
import { LanguagePicker } from '@shared/ui/language-picker/language-picker.shared'
import { usePaymentUrl } from '@entities/payment-store'
import { useSupportEmail } from '@entities/support-store'
import { Page } from '@shared/ui'

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

export const MainPageComponent = ({ isMobile, platform }: IMainPageComponentProps) => {
    const config = useAppConfig()
    const currentLang = useCurrentLang()
    const { setLanguage } = useAppConfigStoreActions()
    const paymentUrl = usePaymentUrl()
    const supportEmail = useSupportEmail()

    const brandName = config.brandingSettings.title
    // Geolog wordmark: last word of the brand title gets the green accent
    // («GEOLOG VPN» → GEOLOG white + VPN green), per the design spec.
    const brandWords = brandName.trim().split(/\s+/)
    const brandHead = brandWords.slice(0, -1).join(' ')
    const brandTail = brandWords[brandWords.length - 1]
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

    return (
        <Page>
            <Box className="header-wrapper" py="md">
                <Container maw={1200} px={{ base: 'md', sm: 'lg', md: 'xl' }}>
                    <Group justify="space-between">
                        <Group gap="sm" style={{ userSelect: 'none' }} wrap="nowrap">
                            {hasCustomLogo ? (
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
                            ) : (
                                // Geolog diamond drill-bit mark (design spec: 16px, rotate 45°, green glow)
                                <Box
                                    aria-hidden
                                    style={{
                                        width: 16,
                                        height: 16,
                                        flexShrink: 0,
                                        margin: '0 8px',
                                        background: 'var(--mantine-color-cyan-4)',
                                        transform: 'rotate(45deg)',
                                        boxShadow: '0 0 16px rgba(95, 233, 164, 0.6)'
                                    }}
                                />
                            )}
                            <Title
                                fw={600}
                                order={4}
                                size="lg"
                                style={{ letterSpacing: '0.16em', textTransform: 'uppercase' }}
                            >
                                {brandHead && (
                                    <span className="logo-text-normal">{brandHead} </span>
                                )}
                                <span className="logo-text-highlight">{brandTail}</span>
                            </Title>
                        </Group>

                        <SubscriptionLinkWidget
                            hideGetLink={config.baseSettings.hideGetLinkButton}
                            paymentUrl={paymentUrl}
                            supportEmail={supportEmail}
                            supportUrl={config.brandingSettings.supportUrl}
                        />
                    </Group>
                </Container>
            </Box>

            <Container
                maw={1200}
                px={{ base: 'md', sm: 'lg', md: 'xl' }}
                py="xl"
                style={{ position: 'relative', zIndex: 1 }}
            >
                <Stack gap="xl">
                    {SubscriptionInfoBlockRenderer && (
                        <SubscriptionInfoBlockRenderer isMobile={isMobile} />
                    )}

                    {atLeastOnePlatformApp && (
                        <InstallationGuideConnector
                            BlockRenderer={
                                BLOCK_RENDERERS[config.uiConfig.installationGuidesBlockType]
                            }
                            hasPlatformApps={hasPlatformApps}
                            isMobile={isMobile}
                            platform={platform}
                        />
                    )}

                    <RawKeysWidget isMobile={isMobile} />

                    <Center>
                        <LanguagePicker
                            currentLang={currentLang}
                            locales={config.locales}
                            onLanguageChange={setLanguage}
                        />
                    </Center>

                    <Group className="page-footer" gap="xs" justify="space-between">
                        <span>
                            {brandName} © {new Date().getFullYear()}
                        </span>
                        <span>{window.location.hostname}</span>
                    </Group>
                </Stack>
            </Container>
        </Page>
    )
}
