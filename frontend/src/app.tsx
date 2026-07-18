import '@mantine/core/styles.layer.css'
import '@mantine/notifications/styles.layer.css'
import '@mantine/nprogress/styles.layer.css'
import '@gfazioli/mantine-spinner/styles.css'

import './global.css'

import { polyfillCountryFlagEmojis } from 'country-flag-emoji-polyfill'
import { DirectionProvider, MantineProvider } from '@mantine/core'
import { enableMainThreadBlocking } from 'ios-vibrator-pro-max'
import { NavigationProgress } from '@mantine/nprogress'
import { Notifications } from '@mantine/notifications'
import { ModalsProvider } from '@mantine/modals'
import { useMediaQuery } from '@mantine/hooks'
import { useEffect, useMemo } from 'react'

import {
    applyPresetCssVars,
    buildCssVariablesResolver,
    buildMantineTheme,
    getThemePreset
} from '@shared/constants'
import { useThemePreset } from '@entities/ui-preset-store'
import { initDayjs } from '@shared/utils/time-utils'

import { Router } from './app/router/router'

polyfillCountryFlagEmojis()

enableMainThreadBlocking(false)

initDayjs()

export function App() {
    const mq = useMediaQuery('(min-width: 40em)')
    const themePresetId = useThemePreset()
    const preset = getThemePreset(themePresetId)
    const theme = useMemo(() => buildMantineTheme(preset), [preset])
    const cssVariablesResolver = useMemo(() => buildCssVariablesResolver(preset), [preset])

    useEffect(() => {
        applyPresetCssVars(preset)
    }, [preset])

    return (
        <DirectionProvider>
            <MantineProvider
                cssVariablesResolver={cssVariablesResolver}
                forceColorScheme={preset.colorScheme}
                theme={theme}
            >
                <ModalsProvider>
                    <Notifications position={mq ? 'top-right' : 'bottom-right'} />
                    <NavigationProgress />

                    <Router />
                </ModalsProvider>
            </MantineProvider>
        </DirectionProvider>
    )
}
