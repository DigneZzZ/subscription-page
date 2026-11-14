import {
    IconBrandAndroid,
    IconBrandApple,
    IconBrandTelegram,
    IconBrandWindows,
    IconCalendar,
    IconChartBar,
    IconCheck,
    IconChevronDown,
    IconChevronRight,
    IconCopy,
    IconDeviceDesktop,
    IconDeviceMobile,
    IconDeviceTv,
    IconDownload,
    IconHome,
    IconRefresh,
    IconShare2,
    IconShieldCheck,
    IconShoppingBag,
    IconWorld
} from '@tabler/icons-react'
import {
    TSubscriptionPageButtonConfig,
    TSubscriptionPagePlatformKey
} from '@remnawave/subscription-page-types'
import { useEffect, useMemo, useState } from 'react'
import { nprogress } from '@mantine/nprogress'
import { Modal } from '@mantine/core'
import { renderSVG } from 'uqr'
import clsx from 'clsx'

import { constructSubscriptionUrl } from '@shared/utils/construct-subscription-url'
import { RawKeysWidget, usePaymentModal, useResetTraffic } from '@widgets/main'
import { useSubscriptionSummary } from '@entities/subscription-summary'
import { hasPageLauncher, openChatwoot } from '@shared/utils/chatwoot'
import { useSubscription } from '@entities/subscription-info-store'
import { getLocalizedText } from '@shared/utils/config-parser'
import { TemplateEngine } from '@shared/utils/template-engine'
import { usePaymentTariffs } from '@entities/payment-store'
import { formatAmount } from '@shared/utils/format-amount'
import { useAppConfig } from '@entities/app-config-store'
import { useSupportEmail } from '@entities/support-store'
import { useTranslation } from '@shared/hooks'

import brandLogo from '../../../../assets/frost/mark.svg'
import happIcon from '../../../../assets/frost/happ.jpg'
import incyIcon from '../../../../assets/frost/incy.jpg'
import { ILayoutProps } from './layout-props.interface'
import { LanguageFooter } from './summary-cards'
import { FrostDevices } from './frost-devices'
import theme from './frost-theme.module.css'
import { FrostShare } from './frost-share'
import classes from './frost.module.css'

type View = 'devices' | 'home' | 'shop' | 'traffic'

const platformIcons = {
    ios: IconBrandApple,
    android: IconBrandAndroid,
    macos: IconDeviceDesktop,
    windows: IconBrandWindows,
    linux: IconDeviceDesktop,
    androidTV: IconDeviceTv,
    appleTV: IconDeviceTv
}
const platformNames = {
    ios: 'iOS',
    android: 'Android',
    macos: 'macOS',
    windows: 'Windows',
    linux: 'Linux',
    androidTV: 'TV',
    appleTV: 'Apple TV'
}

const AppIcon = ({ name }: { name: string }) => {
    let src: string | undefined
    if (/incy/i.test(name)) src = incyIcon
    else if (/happ/i.test(name)) src = happIcon
    return src ? (
        <img alt="" className={classes.appIcon} src={src} />
    ) : (
        <span aria-hidden className={classes.appIcon}>
            <IconShieldCheck size={24} />
        </span>
    )
}

export const FrostLayout = (props: ILayoutProps) => {
    const config = useAppConfig()
    const supportEmail = useSupportEmail()
    const subscription = useSubscription()
    const summary = useSubscriptionSummary()
    const tariffs = usePaymentTariffs()
    const showShop = tariffs.length > 0
    const { currentLang } = useTranslation()
    const { hasPayment, openPayment } = usePaymentModal()
    const reset = useResetTraffic()
    const ru = currentLang === 'ru'
    const local = (russian: string, english: string) => (ru ? russian : english)
    const locale = ru ? 'ru-RU' : 'en-US'
    const [view, setView] = useState<View>('home')
    const [selectedPlatform, setPlatform] = useState(props.platform)
    const [manualPlatform, setManualPlatform] = useState(false)
    const [appName, setAppName] = useState('')
    const [copied, setCopied] = useState(false)
    const [shareOpen, setShareOpen] = useState(false)
    const [instructionsOpen, setInstructionsOpen] = useState(false)
    const [secondDeviceOpen, setSecondDeviceOpen] = useState(false)
    const [shopOpen, setShopOpen] = useState(false)
    const [selectedTariffIndex, setSelectedTariffIndex] = useState(0)
    const [instructionCopied, setInstructionCopied] = useState('')
    const [instructionError, setInstructionError] = useState(false)
    const [connectAttempt, setConnectAttempt] = useState(0)

    useEffect(() => {
        if (!showShop) setView((current) => (current === 'shop' ? 'home' : current))
    }, [showShop])

    useEffect(() => {
        nprogress.complete()
    }, [])
    useEffect(() => {
        if (!copied) return undefined
        const timer = setTimeout(() => setCopied(false), 2000)
        return () => clearTimeout(timer)
    }, [copied])

    const availablePlatforms = (
        Object.keys(platformNames) as TSubscriptionPagePlatformKey[]
    ).filter((key) => config.platforms[key]?.apps.length)
    const activePlatform =
        selectedPlatform && availablePlatforms.includes(selectedPlatform)
            ? selectedPlatform
            : availablePlatforms[0]
    const apps = [...(activePlatform ? (config.platforms[activePlatform]?.apps ?? []) : [])].sort(
        (a, b) => Number(b.featured) - Number(a.featured)
    )
    const activeApp = apps.find((app) => app.name === appName) ?? apps[0]
    const subscriptionUrl = constructSubscriptionUrl(
        window.location.href,
        subscription.user.shortUuid
    )
    const pageUrl = new URL(window.location.href)
    pageUrl.search = ''
    pageUrl.hash = ''
    const shareUrl = pageUrl.href
    const qr = useMemo(() => renderSVG(subscriptionUrl, { border: 2 }), [subscriptionUrl])
    const allButtons = activeApp?.blocks.flatMap((block) => block.buttons) ?? []
    const download = allButtons.find((button) => button.type === 'external')
    const connect = allButtons.find((button) => button.type === 'subscriptionLink')
    const connectUrl = connect
        ? TemplateEngine.formatWithMetaInfo(connect.link, {
            subscriptionUrl,
            username: subscription.user.username
        })
        : undefined
    const canShowLink = !config.baseSettings.hideGetLinkButton
    const hasChat = hasPageLauncher()
    const { supportUrl } = config.brandingSettings
    const supportHref = supportUrl || (supportEmail ? `mailto:${supportEmail}` : '')
    const hasSupport = hasChat || Boolean(supportHref)
    const telegramSupport = /^https?:\/\/(?:t|telegram)\.me\//i.test(supportHref)
    const supportLabel = telegramSupport
        ? local('Поможем в Telegram', 'Help on Telegram')
        : local('Напишите нам', 'Contact support')
    const { logoUrl } = config.brandingSettings
    const logo = logoUrl && !logoUrl.includes('docs.rw') ? logoUrl : brandLogo
    const selectedTariff = tariffs[selectedTariffIndex] ?? tariffs[0]
    const price = selectedTariff ? formatAmount(selectedTariff.amount, selectedTariff.currency) : ''
    const period = (months: number, days = 0) =>
        months > 0 ? `${months} ${local('мес.', 'mo.')}` : `${days} ${local('дн.', 'days')}`
    const tariffLabel = selectedTariff
        ? (selectedTariff.name ?? period(selectedTariff.months, selectedTariff.days))
        : ''
    const tariffParam =
        selectedTariff?.id != null
            ? `id=${encodeURIComponent(selectedTariff.id)}`
            : `months=${selectedTariff?.months ?? 0}`
    const paymentHref = `/api/pay?shortUuid=${encodeURIComponent(subscription.user.shortUuid)}&${tariffParam}`
    const minTariff = tariffs.length
        ? [...tariffs].sort((a, b) => a.amount - b.amount)[0]
        : undefined
    const expiresValid = Number.isFinite(summary.expiresAt.getTime())
    let dateText = local('Дата неизвестна', 'Date unavailable')
    let calendarMonth = '—'
    let calendarDay: number | string = '—'
    if (summary.isIndefinite) {
        dateText = local('Бессрочно', 'No expiry')
        calendarMonth = 'VPN'
        calendarDay = '∞'
    } else if (expiresValid) {
        dateText = summary.expiresAt
            .toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
            .replace(/ г\.$/, '')
        calendarMonth = `${summary.expiresAt.toLocaleDateString(locale, { month: 'short' }).replace('.', '').toUpperCase()} ’${String(summary.expiresAt.getFullYear()).slice(-2)}`
        calendarDay = summary.expiresAt.getDate()
    }
    const dayForms: Record<Intl.LDMLPluralRule, string> = {
        zero: 'дней',
        one: 'день',
        two: 'дня',
        few: 'дня',
        many: 'дней',
        other: 'дней'
    }
    const daysWord = ru
        ? dayForms[new Intl.PluralRules('ru').select(Math.max(0, summary.daysLeft))]
        : 'days'
    let statusText = ''
    if (
        summary.userStatus === 'EXPIRED' ||
        (!summary.isIndefinite && expiresValid && summary.expiresAt.getTime() <= Date.now())
    ) {
        statusText = local('Подписка истекла', 'Subscription expired')
    } else if (summary.userStatus === 'LIMITED') {
        statusText = local('Трафик исчерпан', 'Traffic limit reached')
    } else if (!summary.isActive) {
        statusText = local('Подписка отключена', 'Subscription disabled')
    }
    const now = new Date()
    const timelineLabels = [0, 3, 6, 9, 12].map((offset) => {
        const date = new Date(now.getFullYear(), now.getMonth() + offset, 1)
        return date.getMonth() === 0
            ? String(date.getFullYear())
            : date.toLocaleDateString(locale, { month: 'short' }).replace('.', '')
    })

    useEffect(() => {
        if (!connectAttempt) return undefined
        let leftPage = false
        const leave = () => {
            leftPage = true
        }
        const visibility = () => {
            if (document.hidden) leave()
        }
        document.addEventListener('visibilitychange', visibility)
        window.addEventListener('pagehide', leave)
        window.addEventListener('blur', leave)
        const timer = setTimeout(() => {
            if (!leftPage && !document.hidden) setInstructionsOpen(true)
        }, 1400)
        return () => {
            clearTimeout(timer)
            document.removeEventListener('visibilitychange', visibility)
            window.removeEventListener('pagehide', leave)
            window.removeEventListener('blur', leave)
        }
    }, [connectAttempt])

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(subscriptionUrl)
            setCopied(true)
        } catch {
            setShareOpen(true)
        }
    }
    const instructionAction = async (button: TSubscriptionPageButtonConfig) => {
        setInstructionError(false)
        const url =
            button.type === 'external'
                ? button.link
                : TemplateEngine.formatWithMetaInfo(button.link, {
                    subscriptionUrl,
                    username: subscription.user.username
                })
        if (button.type === 'copyButton') {
            try {
                await navigator.clipboard.writeText(url)
                setInstructionCopied(button.link)
            } catch {
                setInstructionError(true)
            }
        } else {
            window.open(url, '_blank', 'noopener,noreferrer')
        }
    }
    const navigate = (next: View) => {
        setView(next)
        window.scrollTo({ top: 0, behavior: 'instant' })
    }
    const renew = () => {
        if (tariffs.length) {
            setShopOpen(true)
            navigate('shop')
        } else openPayment()
    }
    const help = (className: string, footer = false) =>
        hasSupport && (
            <a
                className={className}
                href={hasChat ? '#support' : supportHref}
                onClick={
                    hasChat
                        ? (event) => {
                            event.preventDefault()
                            openChatwoot()
                        }
                        : undefined
                }
                rel={hasChat ? undefined : 'noopener noreferrer'}
                target={hasChat ? undefined : '_blank'}
            >
                {footer ? (
                    <>
                        <span>
                            {ru ? 'Не получается подключиться?' : 'Having trouble connecting?'}
                        </span>{' '}
                        <b>{hasChat ? local('Напишите нам', 'Contact support') : supportLabel}</b>
                    </>
                ) : (
                    <>
                        <IconBrandTelegram aria-hidden size={16} />
                        <b>{ru ? 'Помощь' : 'Help'}</b>
                    </>
                )}
            </a>
        )

    return (
        <div className={clsx(classes.page, theme.scope)} data-layout="frost">
            <div className={classes.app}>
                <header className={classes.header}>
                    <div className={classes.brand}>
                        <img alt="" className={classes.brandMark} src={logo} />
                        <span>{config.brandingSettings.title}</span>
                    </div>
                    {help(classes.help)}
                </header>

                <section aria-label={ru ? 'Подписка' : 'Subscription'} hidden={view !== 'home'}>
                    <div
                        className={clsx(classes.card, classes.expiry)}
                        data-state={statusText ? 'off' : 'active'}
                    >
                        <div className={classes.expiryTop}>
                            <div aria-hidden className={classes.calendar}>
                                <div className={classes.calendarMonth}>{calendarMonth}</div>
                                <strong className={classes.calendarDay}>{calendarDay}</strong>
                                <span className={classes.calendarWeekday}>
                                    {expiresValid && !summary.isIndefinite
                                        ? summary.expiresAt.toLocaleDateString(locale, {
                                            weekday: 'short'
                                        })
                                        : 'VPN'}
                                </span>
                            </div>
                            <div className={classes.expiryInfo}>
                                <span className={classes.muted}>
                                    {ru ? 'Действует до' : 'Valid until'}
                                </span>
                                <div className={classes.expiryDate}>{dateText}</div>
                                <p className={classes.muted} role="status">
                                    {statusText ||
                                        (summary.isIndefinite ? (
                                            local('Без ограничения срока', 'No time limit')
                                        ) : (
                                            <>
                                                {expiresValid &&
                                                    summary.expiresAt.toLocaleDateString(locale, {
                                                        weekday: 'long'
                                                    })}
                                                {' · '}
                                                {ru ? 'ещё' : ''}{' '}
                                                <b>
                                                    {Math.max(0, summary.daysLeft)} {daysWord}
                                                </b>
                                            </>
                                        ))}
                                </p>
                            </div>
                            {hasPayment && (
                                <button className={classes.renew} onClick={renew} type="button">
                                    <IconRefresh aria-hidden size={16} />
                                    {ru ? 'Продлить' : 'Renew'}
                                </button>
                            )}
                        </div>
                        <div
                            aria-label={ru ? 'Срок подписки' : 'Subscription timeline'}
                            className={classes.timeline}
                        >
                            <div
                                className={classes.timelineFill}
                                style={{
                                    width: `${summary.isIndefinite ? 100 : Math.max(0, Math.min(100, (summary.daysLeft / 365) * 100))}%`
                                }}
                            />
                            <div aria-hidden className={classes.timelineLabels}>
                                {timelineLabels.map((label, index) => (
                                    <span key={index}>{label}</span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {props.atLeastOnePlatformApp && activeApp && (
                        <section
                            className={clsx(classes.card, classes.connectionCard)}
                            style={{ marginTop: 12 }}
                        >
                            <div className={classes.connectionHeading}>
                                <h2 className={classes.sectionHeading}>
                                    {ru ? 'Подключение' : 'Connection'}
                                </h2>
                                <span className={classes.muted}>
                                    {manualPlatform
                                        ? local('выбрано вручную', 'selected manually')
                                        : local(
                                            'определили автоматически',
                                            'detected automatically'
                                        )}
                                </span>
                            </div>
                            <div
                                aria-label={ru ? 'Ваше устройство' : 'Your device'}
                                className={classes.osTabs}
                                role="group"
                            >
                                {availablePlatforms.map((key) => {
                                    const Icon = platformIcons[key]
                                    return (
                                        <button
                                            aria-label={platformNames[key]}
                                            aria-pressed={key === activePlatform}
                                            className={clsx(
                                                classes.osTab,
                                                key === activePlatform && classes.osActive
                                            )}
                                            key={key}
                                            onClick={() => {
                                                setPlatform(key)
                                                setManualPlatform(true)
                                            }}
                                            type="button"
                                        >
                                            <Icon aria-hidden size={17} />
                                            {key === activePlatform && (
                                                <span>{platformNames[key]}</span>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                            <div
                                aria-label={ru ? 'Выберите приложение' : 'Choose an app'}
                                className={classes.appGrid}
                                role="group"
                            >
                                {apps.map((app) => (
                                    <button
                                        aria-pressed={app === activeApp}
                                        className={clsx(
                                            classes.appChoice,
                                            app === activeApp && classes.appActive
                                        )}
                                        key={app.name}
                                        onClick={() => setAppName(app.name)}
                                        type="button"
                                    >
                                        <AppIcon name={app.name} />
                                        <span>
                                            <b className={classes.appName}>{app.name}</b>
                                            <span className={classes.appHint}>
                                                {app === activeApp
                                                    ? local('выбрано', 'selected')
                                                    : local('доступно', 'available')}
                                            </span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                            {canShowLink && (
                                <div className={classes.shareRow}>
                                    <div className={classes.qrWrap}>
                                        <div
                                            aria-label={
                                                ru ? 'QR-код подписки' : 'Subscription QR code'
                                            }
                                            className={classes.qr}
                                            dangerouslySetInnerHTML={{ __html: qr }}
                                            role="img"
                                        />
                                        <button
                                            aria-haspopup="dialog"
                                            aria-label={ru ? 'Показать QR-код' : 'Show QR code'}
                                            className={classes.qrShare}
                                            onClick={() => setShareOpen(true)}
                                            type="button"
                                        >
                                            <IconShare2 size={17} />
                                        </button>
                                    </div>
                                    <div className={classes.shareInfo}>
                                        <h3 className={classes.shareTitle}>
                                            {ru ? 'Другое устройство' : 'Another device'}
                                        </h3>
                                        <button
                                            aria-expanded={secondDeviceOpen}
                                            className={classes.shareHint}
                                            onClick={() => setSecondDeviceOpen(!secondDeviceOpen)}
                                            type="button"
                                        >
                                            {ru
                                                ? 'Как подключить второй телефон?'
                                                : 'How to connect a second phone?'}
                                        </button>
                                        <button
                                            className={classes.secondaryButton}
                                            onClick={copyLink}
                                            type="button"
                                        >
                                            {copied ? (
                                                <IconCheck size={16} />
                                            ) : (
                                                <IconCopy size={16} />
                                            )}
                                            {copied
                                                ? local('Скопировано', 'Copied')
                                                : local('Скопировать', 'Copy')}
                                        </button>
                                        <button
                                            aria-haspopup="dialog"
                                            className={classes.shareButton}
                                            onClick={() => setShareOpen(true)}
                                            type="button"
                                        >
                                            <IconShare2 size={16} />
                                            {ru ? 'Поделиться' : 'Share'}
                                        </button>
                                    </div>
                                </div>
                            )}
                            {secondDeviceOpen && (
                                <div className={classes.note}>
                                    {ru
                                        ? 'Откройте эту страницу на втором устройстве, установите приложение и нажмите «Подключиться». Или отсканируйте QR-код в приложении. Лимит устройств указан в разделе «Устройства».'
                                        : 'Open this page on your other device, install the app and tap Connect. You can also scan the QR code in the app. Check your device limit in Devices.'}{' '}
                                    <button
                                        className={classes.shareHint}
                                        onClick={() => setInstructionsOpen(true)}
                                        type="button"
                                    >
                                        {local(
                                            'Инструкция по подключению',
                                            'Connection instructions'
                                        )}
                                    </button>
                                </div>
                            )}
                        </section>
                    )}
                    {!props.atLeastOnePlatformApp && (
                        <p className={clsx(classes.card, classes.empty)} style={{ marginTop: 12 }}>
                            {ru
                                ? 'Приложения для подключения пока не настроены.'
                                : 'Connection apps have not been configured.'}
                        </p>
                    )}
                    {help(classes.support, true)}
                    {supportEmail && supportUrl && (
                        <a className={classes.support} href={`mailto:${supportEmail}`}>
                            {local('Написать на email', 'Email support')}
                        </a>
                    )}
                </section>

                <section hidden={view !== 'traffic'}>
                    <h1 className={classes.viewTitle}>{ru ? 'Трафик' : 'Traffic'}</h1>
                    <section className={classes.card}>
                        <div className={classes.trafficHeader}>
                            <div className={classes.iconBox}>
                                <IconWorld aria-hidden size={22} />
                            </div>
                            <div className={classes.trafficInfo}>
                                <h2 className={classes.sectionHeading}>
                                    {ru ? 'Основной трафик' : 'Main traffic'}
                                </h2>
                                <p className={classes.muted}>
                                    {ru ? 'Wi-Fi и мобильная сеть' : 'Wi-Fi and mobile data'}
                                </p>
                            </div>
                            <div className={classes.trafficAmount}>
                                <span className={classes.muted}>
                                    {ru ? 'осталось' : 'remaining'}
                                </span>
                                <strong>{summary.remainingLabel}</strong>
                                {!summary.isUnlimited && (
                                    <span className={classes.muted}>
                                        {ru ? 'из' : 'of'} {summary.trafficLimit}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div
                            aria-label={ru ? 'Остаток трафика' : 'Traffic remaining'}
                            aria-valuemax={100}
                            aria-valuemin={0}
                            aria-valuenow={summary.remainingPercent}
                            className={classes.progress}
                            role="progressbar"
                        >
                            <div
                                className={classes.progressFill}
                                style={{ width: `${summary.remainingPercent}%` }}
                            />
                        </div>
                        <p className={classes.trafficMeta}>
                            {ru ? 'использовано' : 'used'} {summary.trafficUsed}
                        </p>
                        {reset.visible && (
                            <button
                                className={classes.actionRow}
                                onClick={reset.handleReset}
                                type="button"
                            >
                                <IconRefresh aria-hidden size={19} />
                                <b>{ru ? 'Сбросить трафик' : 'Reset traffic'}</b>
                                <span>{reset.dynamic ? '' : reset.priceLabel}</span>
                                <IconChevronRight aria-hidden size={20} />
                            </button>
                        )}
                    </section>
                    {config.baseSettings.showConnectionKeys && (
                        <details className={classes.card} style={{ marginTop: 12 }}>
                            <summary>{ru ? 'Ключи подключения' : 'Connection keys'}</summary>
                            <RawKeysWidget isMobile={props.isMobile} />
                        </details>
                    )}
                </section>

                <section hidden={view !== 'devices'}>
                    <h1 className={classes.viewTitle}>{ru ? 'Устройства' : 'Devices'}</h1>
                    <FrostDevices active={view === 'devices'} ru={ru} />
                </section>

                <section hidden={view !== 'shop' || !showShop}>
                    <h1 className={classes.viewTitle}>{ru ? 'Магазин' : 'Shop'}</h1>
                    {hasPayment ? (
                        <div className={classes.shopGroup} data-open={shopOpen}>
                            <button
                                aria-expanded={shopOpen}
                                className={classes.shopSummary}
                                onClick={() => setShopOpen(!shopOpen)}
                                type="button"
                            >
                                <span className={classes.iconBox}>
                                    <IconCalendar aria-hidden size={19} />
                                </span>
                                <b>{ru ? 'Подписка' : 'Subscription'}</b>
                                {minTariff && (
                                    <span className={classes.muted}>
                                        {ru ? 'от' : 'from'}{' '}
                                        {formatAmount(minTariff.amount, minTariff.currency)}
                                    </span>
                                )}
                                <IconChevronDown aria-hidden size={17} />
                            </button>
                            {shopOpen && (
                                <div className={classes.tariffList}>
                                    {tariffs.map((tariff, index) => (
                                        <button
                                            aria-pressed={index === selectedTariffIndex}
                                            className={clsx(
                                                classes.tariff,
                                                index === selectedTariffIndex &&
                                                    classes.tariffSelected
                                            )}
                                            key={tariff.id ?? index}
                                            onClick={() => setSelectedTariffIndex(index)}
                                            type="button"
                                        >
                                            <span aria-hidden className={classes.tariffRadio} />
                                            <span>
                                                <b>
                                                    {tariff.name ??
                                                        period(tariff.months, tariff.days)}
                                                </b>
                                                {tariff.description && (
                                                    <span className={classes.tariffDescription}>
                                                        {tariff.description}
                                                    </span>
                                                )}
                                            </span>
                                            <strong className={classes.tariffPrice}>
                                                {formatAmount(tariff.amount, tariff.currency)}
                                            </strong>
                                        </button>
                                    ))}
                                    {!tariffs.length && (
                                        <button
                                            className={classes.secondaryButton}
                                            onClick={openPayment}
                                            type="button"
                                        >
                                            {ru ? 'Перейти к оплате' : 'Continue to payment'}
                                            <IconChevronRight size={18} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className={clsx(classes.card, classes.empty)}>
                            {ru
                                ? 'Тарифы для оплаты не настроены.'
                                : 'Payment plans have not been configured.'}
                        </p>
                    )}
                    {reset.visible && (
                        <div className={classes.shopGroup} style={{ marginTop: 12 }}>
                            <button
                                className={classes.shopSummary}
                                onClick={reset.handleReset}
                                type="button"
                            >
                                <span className={classes.iconBox}>
                                    <IconWorld size={19} />
                                </span>
                                <b>{ru ? 'Сброс трафика' : 'Traffic reset'}</b>
                                <span className={classes.muted}>
                                    {reset.dynamic ? '' : reset.priceLabel}
                                </span>
                                <IconChevronRight size={17} />
                            </button>
                        </div>
                    )}
                </section>
                <div className={classes.language}>
                    <LanguageFooter />
                </div>
            </div>

            <div className={classes.dock} data-home={view === 'home'}>
                {view === 'home' && activeApp && (
                    <div className={classes.connectActions}>
                        {download && (
                            <a
                                aria-label={
                                    ru ? `Скачать ${activeApp.name}` : `Download ${activeApp.name}`
                                }
                                className={classes.downloadButton}
                                href={download.link}
                                rel="noopener noreferrer"
                                target="_blank"
                            >
                                <IconDownload aria-hidden size={22} />
                            </a>
                        )}
                        {connectUrl ? (
                            <a
                                className={classes.connectButton}
                                href={connectUrl}
                                onClick={() => setConnectAttempt((attempt) => attempt + 1)}
                            >
                                <AppIcon name={activeApp.name} />
                                <span>
                                    {ru ? 'Подключиться в' : 'Connect to'} {activeApp.name}
                                </span>
                            </a>
                        ) : (
                            <button
                                className={classes.connectButton}
                                onClick={() => setInstructionsOpen(true)}
                                type="button"
                            >
                                <AppIcon name={activeApp.name} />
                                {ru ? 'Как подключиться' : 'How to connect'}
                            </button>
                        )}
                    </div>
                )}
                {showShop && view === 'shop' && shopOpen && selectedTariff && (
                    <div className={classes.checkout}>
                        <a
                            className={classes.connectButton}
                            href={paymentHref}
                            rel="noopener noreferrer"
                            target="_blank"
                        >
                            {ru ? 'Оплатить' : 'Pay'} {price} · {tariffLabel}
                        </a>
                    </div>
                )}
                <nav aria-label={ru ? 'Разделы' : 'Sections'} className={classes.nav}>
                    {(
                        [
                            ['home', IconHome, ru ? 'Подписка' : 'Subscription'],
                            ['traffic', IconChartBar, ru ? 'Трафик' : 'Traffic'],
                            ['devices', IconDeviceMobile, ru ? 'Устройства' : 'Devices'],
                            ['shop', IconShoppingBag, ru ? 'Магазин' : 'Shop']
                        ] as const
                    )
                        .filter(([key]) => key !== 'shop' || showShop)
                        .map(([key, Icon, title]) => (
                            <button
                                aria-current={view === key ? 'page' : undefined}
                                className={clsx(
                                    classes.navButton,
                                    view === key && classes.navActive
                                )}
                                key={key}
                                onClick={() => navigate(key)}
                                type="button"
                            >
                                <Icon aria-hidden size={26} stroke={1.9} />
                                <span>{title}</span>
                            </button>
                        ))}
                </nav>
            </div>

            <FrostShare
                brandName={config.brandingSettings.title}
                logo={logo}
                onClose={() => setShareOpen(false)}
                opened={shareOpen}
                pageUrl={shareUrl}
                ru={ru}
                subscriptionUrl={subscriptionUrl}
            />
            <Modal
                centered
                classNames={{
                    content: clsx(classes.modal, theme.scope),
                    header: classes.modalHeader,
                    title: classes.modalTitle
                }}
                closeButtonProps={{ 'aria-label': ru ? 'Закрыть' : 'Close' }}
                onClose={() => setInstructionsOpen(false)}
                opened={instructionsOpen}
                size="lg"
                title={`${local('Инструкция по подключению', 'Connection instructions')} · ${activeApp?.name ?? ''}`}
            >
                <div className={classes.instructions}>
                    {activeApp?.blocks.map((block, index) => (
                        <section key={index}>
                            <h3
                                dangerouslySetInnerHTML={{
                                    __html: getLocalizedText(block.title, currentLang)
                                }}
                            />
                            <div
                                dangerouslySetInnerHTML={{
                                    __html: getLocalizedText(block.description, currentLang)
                                }}
                            />
                            {block.buttons.map((button, buttonIndex) => (
                                <button
                                    className={classes.secondaryButton}
                                    key={buttonIndex}
                                    onClick={() => {
                                        instructionAction(button)
                                    }}
                                    type="button"
                                >
                                    {button.type === 'copyButton' &&
                                    instructionCopied === button.link
                                        ? local('Скопировано', 'Copied')
                                        : getLocalizedText(button.text, currentLang)}
                                </button>
                            ))}
                        </section>
                    ))}
                    {instructionError && (
                        <p role="alert">
                            {local(
                                'Не удалось скопировать ссылку. Скопируйте её вручную.',
                                'Could not copy the link. Copy it manually.'
                            )}
                        </p>
                    )}
                </div>
            </Modal>
        </div>
    )
}
