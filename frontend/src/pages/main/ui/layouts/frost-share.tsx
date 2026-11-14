import {
    IconBrandTelegram,
    IconBrandVk,
    IconBrandWhatsapp,
    IconCheck,
    IconCopy,
    IconDots,
    IconMaximize,
    IconMinimize
} from '@tabler/icons-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { useReducedMotion } from '@mantine/hooks'
import { Modal } from '@mantine/core'
import { renderSVG } from 'uqr'
import clsx from 'clsx'

import classes from './frost-share.module.css'
import theme from './frost-theme.module.css'

interface FrostShareProps {
    brandName: string
    logo: string
    onClose: () => void
    opened: boolean
    pageUrl: string
    ru: boolean
    subscriptionUrl: string
}

export const FrostShare = ({
    brandName,
    logo,
    onClose,
    opened,
    pageUrl,
    ru,
    subscriptionUrl
}: FrostShareProps) => {
    const [copied, setCopied] = useState(false)
    const [error, setError] = useState(false)
    const [zoomed, setZoomed] = useState(false)
    const reducedMotion = useReducedMotion()
    const pathId = `share-ring-${useId().replace(/:/g, '')}`
    const local = (russian: string, english: string) => (ru ? russian : english)
    const qr = useMemo(
        () =>
            renderSVG(subscriptionUrl, {
                border: 3,
                whiteColor: '#F3F0E8',
                blackColor: '#1B1A17'
            }),
        [subscriptionUrl]
    )
    const title = local('Поделиться', 'Share')
    const caption = local('Подписка VPN', 'VPN subscription')
    const shareText = `${brandName} · ${caption}`
    const ringText = `${brandName} · ${caption} · ${brandName} · ${caption} · `
    const encodedPageUrl = encodeURIComponent(pageUrl)

    useEffect(() => {
        if (opened) return
        setZoomed(false)
        setCopied(false)
        setError(false)
    }, [opened])

    useEffect(() => {
        if (!copied) return undefined
        const timer = setTimeout(() => setCopied(false), 2200)
        return () => clearTimeout(timer)
    }, [copied])

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(subscriptionUrl)
            setCopied(true)
            setError(false)
        } catch {
            setError(true)
        }
    }

    const nativeShare = async () => {
        if (typeof navigator.share !== 'function') return
        try {
            await navigator.share({ title: brandName, text: caption, url: pageUrl })
            setError(false)
        } catch (shareError) {
            if (!(shareError instanceof DOMException && shareError.name === 'AbortError')) {
                setError(true)
            }
        }
    }

    const canShare = typeof navigator.share === 'function'

    return (
        <Modal
            classNames={{
                inner: classes.inner,
                content: clsx(theme.scope, classes.sheet, zoomed && classes.zoomed),
                header: classes.header,
                title: classes.title,
                close: classes.close,
                body: classes.body
            }}
            closeButtonProps={{ 'aria-label': local('Закрыть', 'Close') }}
            onClose={onClose}
            opened={opened}
            overlayProps={{ backgroundOpacity: 0.68, color: '#000' }}
            padding={0}
            radius={0}
            size={440}
            title={title}
            transitionProps={{ transition: 'slide-up', duration: reducedMotion ? 0 : 260 }}
            xOffset={0}
            yOffset={0}
        >
            <p className={classes.intro}>
                {local('Откройте на другом устройстве', 'Open on another device')}
            </p>
            <div className={classes.qrStage}>
                <svg aria-hidden className={classes.ring} viewBox="0 0 328 328">
                    <defs>
                        <path
                            d="M 50 11 H 278 Q 317 11 317 50 V 278 Q 317 317 278 317 H 50 Q 11 317 11 278 V 50 Q 11 11 50 11 Z"
                            id={pathId}
                        />
                    </defs>
                    <text>
                        <textPath href={`#${pathId}`} lengthAdjust="spacing" textLength={1170}>
                            {ringText.repeat(3)}
                        </textPath>
                    </text>
                </svg>
                <button
                    aria-label={
                        zoomed
                            ? local('Уменьшить QR-код', 'Reduce QR code')
                            : local('Показать код крупно', 'Enlarge QR code')
                    }
                    className={classes.qrCard}
                    onClick={() => setZoomed(!zoomed)}
                    type="button"
                >
                    <span
                        aria-label={local('QR-код подписки', 'Subscription QR code')}
                        className={classes.qr}
                        dangerouslySetInnerHTML={{ __html: qr }}
                        role="img"
                    />
                    <span aria-hidden className={classes.zoomIcon}>
                        {zoomed ? <IconMinimize size={15} /> : <IconMaximize size={15} />}
                    </span>
                </button>
            </div>
            <div className={classes.linkRow}>
                <span>{local('Ссылка', 'Link')}</span>
                <span className={classes.brand}>
                    <img alt="" src={logo} />
                    <b>{brandName}</b>
                </span>
            </div>
            <label className={classes.linkLabel}>
                <span>{local('Ссылка подписки', 'Subscription link')}</span>
                <input
                    className={classes.url}
                    onFocus={(event) => event.currentTarget.select()}
                    readOnly
                    value={subscriptionUrl}
                />
            </label>
            <div
                className={classes.channels}
                style={{ gridTemplateColumns: `repeat(${canShare ? 5 : 4}, minmax(0, 1fr))` }}
            >
                <a
                    href={`https://t.me/share/url?url=${encodedPageUrl}&text=${encodeURIComponent(shareText)}`}
                    rel="noopener noreferrer"
                    target="_blank"
                >
                    <span className={clsx(classes.channelIcon, classes.telegram)}>
                        <IconBrandTelegram aria-hidden fill="currentColor" size={31} />
                    </span>
                    <span>Telegram</span>
                </a>
                <a
                    href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${pageUrl}`)}`}
                    rel="noopener noreferrer"
                    target="_blank"
                >
                    <span className={clsx(classes.channelIcon, classes.whatsapp)}>
                        <IconBrandWhatsapp aria-hidden size={30} />
                    </span>
                    <span>WhatsApp</span>
                </a>
                <a
                    href={`https://vk.com/share.php?url=${encodedPageUrl}&title=${encodeURIComponent(shareText)}`}
                    rel="noopener noreferrer"
                    target="_blank"
                >
                    <span className={clsx(classes.channelIcon, classes.vk)}>
                        <IconBrandVk aria-hidden fill="currentColor" size={31} />
                    </span>
                    <span>{local('ВКонтакте', 'VK')}</span>
                </a>
                <button onClick={copy} type="button">
                    <span className={clsx(classes.channelIcon, classes.neutral)}>
                        {copied ? (
                            <IconCheck aria-hidden size={23} />
                        ) : (
                            <IconCopy aria-hidden size={23} />
                        )}
                    </span>
                    <span>
                        {copied ? local('Скопировано', 'Copied') : local('Копировать', 'Copy')}
                    </span>
                </button>
                {canShare && (
                    <button onClick={nativeShare} type="button">
                        <span className={clsx(classes.channelIcon, classes.neutral)}>
                            <IconDots aria-hidden size={25} />
                        </span>
                        <span>{local('Ещё', 'More')}</span>
                    </button>
                )}
            </div>
            {error && (
                <p className={classes.error} role="status">
                    {local(
                        'Выделите и скопируйте ссылку вручную.',
                        'Select and copy the link manually.'
                    )}
                </p>
            )}
            {copied && (
                <span className={classes.srOnly} role="status">
                    {local('Ссылка скопирована', 'Link copied')}
                </span>
            )}
        </Modal>
    )
}
