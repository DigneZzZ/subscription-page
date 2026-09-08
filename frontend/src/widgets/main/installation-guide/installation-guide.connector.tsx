import {
    IconBrandAndroid,
    IconBrandApple,
    IconBrandWindows,
    IconCheck,
    IconChevronDown,
    IconDeviceDesktop,
    IconDeviceTv
} from '@tabler/icons-react'
import {
    TSubscriptionPageAppConfig,
    TSubscriptionPageButtonConfig,
    TSubscriptionPagePlatformKey
} from '@remnawave/subscription-page-types'
import { Button, ButtonVariant, Card, Group, Select, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useClipboard } from '@mantine/hooks'
import { useId, useState } from 'react'
import clsx from 'clsx'

import { constructSubscriptionUrl } from '@shared/utils/construct-subscription-url'
import { getIconFromLibrary, getLocalizedText } from '@shared/utils/config-parser'
import { useSubscription } from '@entities/subscription-info-store'
import { getObsidianStrings } from '@shared/i18n/obsidian.i18n'
import { TemplateEngine } from '@shared/utils/template-engine'
import { useAppConfig } from '@entities/app-config-store'
import { getLayoutStrings } from '@shared/i18n'
import { vibrate } from '@shared/utils/vibrate'
import { useTranslation } from '@shared/hooks'

import { IBlockRendererProps } from './components/blocks/renderer-block.interface'
import classes from './installation-guide.module.css'

const PlatformIcon = ({ platform }: { platform: string | undefined }) => {
    const icons = {
        ios: IconBrandApple,
        macos: IconBrandApple,
        android: IconBrandAndroid,
        windows: IconBrandWindows,
        androidTV: IconBrandAndroid,
        appleTV: IconBrandApple
    }
    const Icon = icons[platform as keyof typeof icons] ?? IconDeviceDesktop
    return (
        <span aria-hidden className={classes.osIcon}>
            <Icon size={19} />
            {platform?.endsWith('TV') && <IconDeviceTv className={classes.tvBadge} size={11} />}
        </span>
    )
}

export type TBlockVariant = 'accordion' | 'cards' | 'minimal' | 'timeline'

interface IProps {
    appearance?: 'default' | 'obsidian'
    BlockRenderer: React.ComponentType<IBlockRendererProps>
    hasPlatformApps: Record<TSubscriptionPagePlatformKey, boolean>
    isMobile: boolean
    platform: TSubscriptionPagePlatformKey | undefined
}

export const InstallationGuideConnector = (props: IProps) => {
    const { isMobile, hasPlatformApps, BlockRenderer, platform, appearance = 'default' } = props
    const id = useId()
    const modern = appearance === 'obsidian'

    const { t, currentLang, baseTranslations } = useTranslation()

    const { platforms, svgLibrary } = useAppConfig()
    const { copy } = useClipboard({ timeout: 2_000 })
    const subscription = useSubscription()

    const s = getLayoutStrings(currentLang)
    const labels = getObsidianStrings(currentLang)

    const [selectedAppIndex, setSelectedAppIndex] = useState(0)
    const [selectedPlatform, setSelectedPlatform] = useState<
        TSubscriptionPagePlatformKey | undefined
    >(() => {
        if (platform && hasPlatformApps[platform]) {
            return platform
        }

        const firstAvailable = (
            Object.keys(hasPlatformApps) as TSubscriptionPagePlatformKey[]
        ).find((key) => hasPlatformApps[key])
        return firstAvailable
    })

    const activePlatform =
        selectedPlatform && platforms[selectedPlatform]?.apps.length
            ? selectedPlatform
            : (Object.keys(platforms) as TSubscriptionPagePlatformKey[]).find(
                (key) => platforms[key]?.apps.length
            )
    const platformApps = activePlatform ? platforms[activePlatform]!.apps : []
    // Featured apps surface first — everything below (selection, render, BlockRenderer
    // source) reads from this sorted array so `selectedAppIndex` always maps consistently.
    const sortedApps = [...platformApps].sort((a, b) => Number(b.featured) - Number(a.featured))
    const activeAppIndex = sortedApps[selectedAppIndex] ? selectedAppIndex : 0
    const selectedApp = sortedApps[activeAppIndex]

    const availablePlatforms = (
        Object.entries(hasPlatformApps) as [TSubscriptionPagePlatformKey, boolean][]
    )
        .filter(([_, hasApps]) => hasApps)
        .map(([platform]) => {
            const platformConfig = platforms[platform]!
            return {
                value: platform,
                label: t(platformConfig.displayName),
                icon: platformConfig.svgIconKey
            }
        })

    const subscriptionUrl = constructSubscriptionUrl(
        window.location.href,
        subscription.user.shortUuid
    )

    const handleButtonClick = (button: TSubscriptionPageButtonConfig) => {
        let formattedUrl: string | undefined

        if (button.type === 'subscriptionLink' || button.type === 'copyButton') {
            formattedUrl = TemplateEngine.formatWithMetaInfo(button.link, {
                username: subscription.user.username,
                subscriptionUrl
            })
        }

        switch (button.type) {
            case 'copyButton': {
                if (!formattedUrl) return

                copy(formattedUrl)
                notifications.show({
                    title: t(baseTranslations.linkCopied),
                    message: t(baseTranslations.linkCopiedToClipboard),
                    color: 'cyan'
                })
                break
            }
            case 'external': {
                window.open(button.link, '_blank', 'noopener,noreferrer')
                break
            }
            case 'subscriptionLink': {
                if (!formattedUrl) return

                window.open(formattedUrl, '_blank', 'noopener,noreferrer')
                break
            }
            default:
                break
        }
    }

    const renderBlockButtons = (
        buttons: TSubscriptionPageButtonConfig[],
        variant: ButtonVariant
    ) => {
        if (buttons.length === 0) return null

        return (
            <Group gap="xs" wrap="wrap">
                {buttons.map((button, index) => (
                    <Button
                        className={
                            modern
                                ? clsx(
                                    classes.stepButton,
                                    button.type === 'subscriptionLink' && classes.importButton
                                )
                                : undefined
                        }
                        key={index}
                        leftSection={
                            <span
                                dangerouslySetInnerHTML={{
                                    __html: getIconFromLibrary(button.svgIconKey, svgLibrary)
                                }}
                                style={{ display: 'flex', alignItems: 'center' }}
                            />
                        }
                        onClick={() => handleButtonClick(button)}
                        radius="md"
                        variant={modern ? 'default' : variant}
                    >
                        {t(button.text)}
                    </Button>
                ))}
            </Group>
        )
    }

    const getIcon = (iconKey: string) => getIconFromLibrary(iconKey, svgLibrary)

    if (!selectedApp) return null

    return (
        <Card
            className={clsx(classes.guide, modern && classes.modern)}
            p={modern ? undefined : { base: 'sm', xs: 'md', sm: 'lg', md: 'xl' }}
            radius="lg"
        >
            <div className={classes.guideHeading}>
                <div>
                    <Title c="var(--sp-text)" className={classes.guideTitle} fw={600} order={2}>
                        {modern ? labels.connection : t(baseTranslations.installationGuideHeader)}
                    </Title>
                    {modern && (
                        <Text c="var(--sp-dim)" mt={6} size="sm">
                            {labels.connectionHint}
                        </Text>
                    )}
                </div>
                {modern && sortedApps.some((app) => app.featured) && (
                    <span className={classes.guideNote}>
                        <IconCheck aria-hidden size={15} />
                        {s.recommended}
                    </span>
                )}
            </div>

            <div className={classes.selectionRow}>
                <div className={classes.platformFieldset}>
                    <label className={classes.fieldLabel} htmlFor={`${id}-platform`}>
                        {labels.device}
                    </label>
                    <Select
                        allowDeselect={false}
                        classNames={{
                            input: classes.osSelect,
                            dropdown: classes.osDropdown,
                            option: classes.osOption
                        }}
                        comboboxProps={{
                            transitionProps: { duration: 120, transition: 'fade' },
                            shadow: 'lg'
                        }}
                        data={availablePlatforms.map(({ value, label }) => ({ value, label }))}
                        id={`${id}-platform`}
                        leftSection={<PlatformIcon platform={activePlatform} />}
                        leftSectionPointerEvents="none"
                        maxDropdownHeight={320}
                        onChange={(value) => {
                            if (!value) return
                            vibrate('toggle')
                            setSelectedPlatform(value as TSubscriptionPagePlatformKey)
                            setSelectedAppIndex(0)
                        }}
                        renderOption={({ option, checked }) => (
                            <span className={classes.osOptionContent}>
                                <PlatformIcon platform={option.value} />
                                <span>{option.label}</span>
                                {checked && (
                                    <IconCheck className={classes.osSelectedCheck} size={16} />
                                )}
                            </span>
                        )}
                        rightSection={<IconChevronDown aria-hidden size={16} />}
                        rightSectionPointerEvents="none"
                        value={activePlatform}
                    />
                </div>

                <fieldset className={classes.appFieldset}>
                    <legend className={classes.fieldLabel}>{labels.chooseApp}</legend>
                    {sortedApps.length > 3 ? (
                        <div className={classes.selectWrap}>
                            <select
                                aria-controls={`${id}-instructions`}
                                aria-label={labels.chooseApp}
                                className={clsx(classes.select, classes.appSelect)}
                                onChange={(event) => {
                                    vibrate('toggle')
                                    setSelectedAppIndex(Number(event.target.value))
                                }}
                                value={activeAppIndex}
                            >
                                {sortedApps.map((app, index) => (
                                    <option key={`${app.name}-${index}`} value={index}>
                                        {app.name}
                                        {app.featured ? ` · ${s.recommended}` : ''}
                                    </option>
                                ))}
                            </select>
                            <IconChevronDown
                                aria-hidden
                                className={classes.selectChevron}
                                size={16}
                            />
                        </div>
                    ) : (
                        <div className={classes.appGrid}>
                            {sortedApps.map((app: TSubscriptionPageAppConfig, index: number) => (
                                <label className={classes.choiceLabel} key={`${app.name}-${index}`}>
                                    <input
                                        aria-controls={`${id}-instructions`}
                                        checked={index === activeAppIndex}
                                        className={classes.choiceInput}
                                        name={`${id}-app`}
                                        onChange={() => {
                                            vibrate('toggle')
                                            setSelectedAppIndex(index)
                                        }}
                                        type="radio"
                                        value={index}
                                    />
                                    <span
                                        className={clsx(
                                            classes.appChoice,
                                            index === activeAppIndex && classes.appChoiceActive
                                        )}
                                    >
                                        <span className={classes.appInfo}>
                                            <span className={classes.appName}>{app.name}</span>
                                            <span
                                                className={clsx(
                                                    classes.appBadge,
                                                    app.featured && classes.recommendedBadge
                                                )}
                                            >
                                                {app.featured ? s.recommended : s.alternative}
                                            </span>
                                        </span>
                                        <span aria-hidden className={classes.appRadio}>
                                            {index === activeAppIndex && <IconCheck size={12} />}
                                        </span>
                                    </span>
                                </label>
                            ))}
                        </div>
                    )}
                </fieldset>
            </div>

            <section
                aria-labelledby={`${id}-instructions-title`}
                className={classes.instructions}
                id={`${id}-instructions`}
            >
                <h3 className={classes.instructionsTitle} id={`${id}-instructions-title`}>
                    {labels.instructions} <span aria-live="polite">· {selectedApp.name}</span>
                </h3>
                <div
                    className={classes.stepsTransition}
                    key={`${activePlatform}-${activeAppIndex}`}
                >
                    {modern ? (
                        <ol className={classes.steps}>
                            {selectedApp.blocks.map((block, index) => (
                                <li className={classes.step} key={index}>
                                    <span aria-hidden className={classes.stepNumber}>
                                        {String(index + 1).padStart(2, '0')}
                                    </span>
                                    <div className={classes.stepContent}>
                                        <h4
                                            className={classes.stepTitle}
                                            dangerouslySetInnerHTML={{
                                                __html: getLocalizedText(block.title, currentLang)
                                            }}
                                        />
                                        <div
                                            className={classes.stepDescription}
                                            dangerouslySetInnerHTML={{
                                                __html: getLocalizedText(
                                                    block.description,
                                                    currentLang
                                                )
                                            }}
                                        />
                                        {renderBlockButtons(block.buttons, 'default')}
                                    </div>
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <BlockRenderer
                            blocks={selectedApp.blocks}
                            currentLang={currentLang}
                            getIconFromLibrary={getIcon}
                            isMobile={isMobile}
                            renderBlockButtons={renderBlockButtons}
                            svgLibrary={svgLibrary}
                        />
                    )}
                </div>
            </section>
        </Card>
    )
}
