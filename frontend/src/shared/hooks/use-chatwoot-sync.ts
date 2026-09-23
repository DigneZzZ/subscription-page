import consola from 'consola/browser'
import { useEffect } from 'react'

import { useCurrentLang, useIsConfigLoaded } from '@entities/app-config-store'
import { useThemePreset } from '@entities/ui-preset-store'
import { getThemePreset } from '@shared/constants'

// Minimal surface of window.$chatwoot that the page drives. The widget itself
// is bootstrapped by the inline script in index.html; this hook only keeps its
// locale and color scheme aligned with the page after the widget is ready.
interface IChatwootApi {
    setColorScheme: (scheme: 'auto' | 'dark' | 'light') => void
    setLocale: (locale: string) => void
}

const getChatwoot = (): IChatwootApi | undefined =>
    (window as unknown as { $chatwoot?: IChatwootApi }).$chatwoot

export function useChatwootSync(): void {
    const isConfigLoaded = useIsConfigLoaded()
    const lang = useCurrentLang()
    const { colorScheme } = getThemePreset(useThemePreset())

    useEffect(() => {
        // Before the app config loads currentLang is a placeholder; wait for the
        // detected language so the widget never flashes the wrong locale.
        if (!isConfigLoaded) return undefined

        const apply = () => {
            const chatwoot = getChatwoot()
            if (!chatwoot) return
            try {
                chatwoot.setLocale(lang)
                chatwoot.setColorScheme(colorScheme)
            } catch (error) {
                consola.warn('Chatwoot sync failed:', error)
            }
        }

        apply()
        window.addEventListener('chatwoot:ready', apply)
        return () => window.removeEventListener('chatwoot:ready', apply)
    }, [isConfigLoaded, lang, colorScheme])
}
