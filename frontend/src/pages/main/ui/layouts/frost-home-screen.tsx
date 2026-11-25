import { IconDownload } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { Modal } from '@mantine/core'
import clsx from 'clsx'

import theme from './frost-theme.module.css'
import classes from './frost.module.css'

type ReceiveEvent = (event: string, data?: { status?: string }) => void
type EventReceiver = { receiveEvent?: ReceiveEvent }

interface HomeScreenWindow extends Window {
    Telegram?: { WebView?: EventReceiver }
    TelegramGameProxy?: EventReceiver
    TelegramWebviewProxy?: { postEvent: (event: string, payload: string) => void }
}

const observeHomeScreen = (setAvailable: (available: boolean) => void) => {
    const host: HomeScreenWindow = window
    const proxy = host.TelegramWebviewProxy
    if (!proxy) return undefined

    const receive: ReceiveEvent = (event, data) => {
        if (event === 'home_screen_checked') {
            setAvailable(data?.status === 'missed' || data?.status === 'unknown')
        } else if (event === 'home_screen_added' || event === 'home_screen_failed') {
            setAvailable(false)
        }
    }

    // Telegram clients use either WebView or the legacy GameProxy to deliver events.
    host.Telegram ??= {}
    host.Telegram.WebView ??= {}
    host.TelegramGameProxy ??= {}
    const receivers = [host.Telegram.WebView, host.TelegramGameProxy]
    const cleanups = receivers.map((receiver) => {
        const previous = receiver.receiveEvent
        const wrapped: ReceiveEvent = (event, data) => {
            receive(event, data)
            previous?.call(receiver, event, data)
        }
        Object.assign(receiver, { receiveEvent: wrapped })
        return () => {
            if (receiver.receiveEvent === wrapped) {
                Object.assign(receiver, { receiveEvent: previous })
            }
        }
    })

    try {
        proxy.postEvent('web_app_check_home_screen', '""')
    } catch {
        setAvailable(false)
    }
    return () => cleanups.forEach((cleanup) => cleanup())
}

const isAppleMobile = (browser: Navigator) =>
    /iPad|iPhone|iPod/i.test(browser.userAgent) ||
    (/Macintosh/i.test(browser.userAgent) && browser.maxTouchPoints > 1)

export const FrostHomeScreen = ({ ru }: { ru: boolean }) => {
    const host: HomeScreenWindow = window
    const proxy = host.TelegramWebviewProxy
    const browser: Navigator & { standalone?: boolean } = navigator
    const appleMobile = isAppleMobile(browser)
    const [nativeAvailable, setNativeAvailable] = useState(false)
    const [guideOpen, setGuideOpen] = useState(false)

    useEffect(() => observeHomeScreen(setNativeAvailable), [])

    const mobileBrowser = appleMobile || /Android/i.test(browser.userAgent)
    const standalone = browser.standalone || host.matchMedia('(display-mode: standalone)').matches
    if (proxy ? !nativeAvailable : !mobileBrowser || standalone) return null

    const title = ru ? 'На экран «Домой»' : 'Add to Home Screen'
    const addShortcut = () => {
        if (!proxy) {
            setGuideOpen(true)
            return
        }
        try {
            proxy.postEvent('web_app_add_to_home_screen', '""')
        } catch {
            setNativeAvailable(false)
        }
    }

    return (
        <>
            <button className={classes.homeShortcut} onClick={addShortcut} type="button">
                <IconDownload aria-hidden size={16} />
                {title}
            </button>
            {!proxy && (
                <Modal
                    centered
                    classNames={{
                        content: clsx(classes.modal, theme.scope),
                        header: classes.modalHeader,
                        title: classes.modalTitle
                    }}
                    closeButtonProps={{ 'aria-label': ru ? 'Закрыть' : 'Close' }}
                    onClose={() => setGuideOpen(false)}
                    opened={guideOpen}
                    title={title}
                >
                    {appleMobile ? (
                        <p>
                            {ru
                                ? 'Откройте эту страницу в Safari. Нажмите «Поделиться», выберите «На экран „Домой“» и нажмите «Добавить».'
                                : 'Open this page in Safari. Tap Share, choose Add to Home Screen, then tap Add.'}
                        </p>
                    ) : (
                        <p>
                            {ru
                                ? 'Откройте эту страницу в Chrome. В меню ⋮ выберите добавление на главный экран, затем «Создать ярлык».'
                                : 'Open this page in Chrome. From the ⋮ menu, choose Add to home screen, then Create shortcut.'}
                        </p>
                    )}
                </Modal>
            )}
        </>
    )
}
