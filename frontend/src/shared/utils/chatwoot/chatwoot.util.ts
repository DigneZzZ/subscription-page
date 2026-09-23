/**
 * Thin access layer over the Chatwoot SDK globals. The widget itself is
 * bootstrapped by the inline script in index.html, which also defines
 * window.chatwootSettings only when Chatwoot is configured.
 */
export interface IChatwootSettings {
    darkMode: 'dark' | 'light'
    hideMessageBubble: boolean
    launcher: 'native' | 'none' | 'page'
    launcherTitle: string
    locale?: string
    position: 'left' | 'right'
    proxied: boolean
    type: 'expanded_bubble' | 'standard'
}

interface IChatwootApi {
    isOpen?: boolean
    toggle: (state: 'close' | 'open') => void
}

interface IChatwootWindow {
    $chatwoot?: IChatwootApi
    chatwootSettings?: IChatwootSettings
}

const win = () => window as unknown as IChatwootWindow

export const getChatwootSettings = (): IChatwootSettings | null => win().chatwootSettings ?? null

export const isChatwootConfigured = (): boolean => 'chatwootSettings' in win()

/** True when the page draws its own floating launcher (CHATWOOT_LAUNCHER=page). */
export const hasPageLauncher = (): boolean => getChatwootSettings()?.launcher === 'page'

/** Bottom padding that keeps page content (footer, language picker) clear of the launcher. */
export const PAGE_LAUNCHER_CLEARANCE = 'calc(84px + env(safe-area-inset-bottom, 0px))'

export const isChatwootOpen = (): boolean => win().$chatwoot?.isOpen === true

/** Opens the chat now, or as soon as the SDK reports ready. No-op when not configured. */
export const openChatwoot = (): void => {
    const w = win()
    if (w.$chatwoot) {
        w.$chatwoot.toggle('open')
        return
    }
    if (!isChatwootConfigured()) return
    window.addEventListener('chatwoot:ready', () => w.$chatwoot?.toggle('open'), { once: true })
}

export const closeChatwoot = (): void => {
    win().$chatwoot?.toggle('close')
}
