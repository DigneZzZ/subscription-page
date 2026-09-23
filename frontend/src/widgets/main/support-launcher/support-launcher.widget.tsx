import { IconHeadset, IconX } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import cx from 'clsx'

import {
    closeChatwoot,
    getChatwootSettings,
    isChatwootOpen,
    openChatwoot
} from '@shared/utils/chatwoot'
import { vibrate } from '@shared/utils/vibrate'
import { useTranslation } from '@shared/hooks'

import { getSupportLauncherStrings } from './support-launcher.i18n'
import classes from './support-launcher.module.css'

interface IChatwootMessageEvent extends Event {
    detail?: { data?: { message_type?: number } }
}

// Chatwoot message_type: 0 incoming (visitor), 1 outgoing (agent)
const AGENT_MESSAGE = 1

/**
 * Page-styled replacement for Chatwoot's floating bubble (CHATWOOT_LAUNCHER=page).
 * Reads window.chatwootSettings written by the inline bootstrap; renders
 * nothing when Chatwoot is off or another launcher mode is configured.
 */
export const SupportLauncher = () => {
    const settings = getChatwootSettings()
    const { currentLang } = useTranslation()
    const [open, setOpen] = useState(isChatwootOpen)
    const [unread, setUnread] = useState(false)

    useEffect(() => {
        const onOpened = () => {
            setOpen(true)
            setUnread(false)
        }
        const onClosed = () => setOpen(false)
        const onMessage = (event: Event) => {
            const type = (event as IChatwootMessageEvent).detail?.data?.message_type
            if (type === AGENT_MESSAGE && !isChatwootOpen()) setUnread(true)
        }
        window.addEventListener('chatwoot:opened', onOpened)
        window.addEventListener('chatwoot:closed', onClosed)
        window.addEventListener('chatwoot:on-message', onMessage)
        return () => {
            window.removeEventListener('chatwoot:opened', onOpened)
            window.removeEventListener('chatwoot:closed', onClosed)
            window.removeEventListener('chatwoot:on-message', onMessage)
        }
    }, [])

    if (!settings || settings.launcher !== 'page') return null

    const s = getSupportLauncherStrings(currentLang)
    const label = settings.launcherTitle || s.support
    let name = label
    if (open) name = s.close
    else if (unread) name = `${label}${s.unreadSuffix}`

    const handleClick = () => {
        vibrate('tap')
        if (open) closeChatwoot()
        else openChatwoot()
    }

    return (
        <button
            aria-label={name}
            className={cx(classes.launcher, classes[settings.position], open && classes.open)}
            onClick={handleClick}
            type="button"
        >
            {open ? (
                <IconX className={classes.icon} size={22} stroke={2} />
            ) : (
                <IconHeadset className={classes.icon} size={24} stroke={1.9} />
            )}
            <span className={classes.label}>{open ? s.close : label}</span>
            {unread && !open ? <span aria-hidden className={classes.dot} /> : null}
        </button>
    )
}
