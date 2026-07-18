import { createTheme, CSSVariablesResolver, MantineThemeOverride } from '@mantine/core'

import { IThemePreset, LIGHT_GREEN, SAGE_GREEN } from './theme-presets'
import components from '../overrides'

// red/orange/yellow остаются семантикой «истекает/неактивна» — стоковые ramps из theme.ts
const RED = ['#ffe9e9', '#ffd0d0', '#ffb0b0', '#ff8f8f', '#f56b6b',
    '#e05656', '#c74343', '#a83232', '#872626', '#661c1c'] as const
const ORANGE = ['#fff1e5', '#ffe1c7', '#ffcda3', '#ffb87d', '#fca35c',
    '#e8894a', '#c96f38', '#a65728', '#82401b', '#5c2b10'] as const
const YELLOW = ['#fff9e1', '#fff0b8', '#ffe58a', '#ffda5c', '#ffd43b',
    '#e6b91f', '#c49a10', '#9e7a08', '#775b04', '#503c02'] as const

export const buildMantineTheme = (preset: IThemePreset): MantineThemeOverride =>
    createTheme({
        components,
        cursorType: 'pointer',
        fontFamily:
            'Inter Tight, Vazirmatn, Apple Color Emoji, Noto Sans SC, Twemoji Country Flags, sans-serif',
        fontFamilyMonospace: 'JetBrains Mono, Fira Mono, monospace',
        headings: {
            fontFamily: 'Unbounded, Vazirmatn, sans-serif',
            fontWeight: '600'
        },
        breakpoints: {
            xs: '25em', sm: '30em', md: '48em', lg: '64em',
            xl: '80em', '2xl': '96em', '3xl': '120em', '4xl': '160em'
        },
        scale: 1,
        fontSmoothing: true,
        focusRing: 'never',
        defaultRadius: 'md',
        white: preset.colorScheme === 'light' ? '#ffffff' : preset.text,
        black: preset.colorScheme === 'light' ? preset.text : preset.bg,
        colors: {
            dark: [...preset.darkRamp],
            // акцентный ramp подменяет стоковый cyan (единственный акцент контейнера) —
            // все `c="cyan"` / var(--mantine-color-cyan-*) становятся цветом пресета
            cyan: [...preset.accent],
            blue: [...preset.accent],
            teal: [...preset.accent],
            green: preset.colorScheme === 'light' ? [...LIGHT_GREEN] : [...SAGE_GREEN],
            red: [...RED],
            orange: [...ORANGE],
            yellow: [...YELLOW]
        },
        primaryColor: 'cyan',
        primaryShade: 4,
        autoContrast: true,
        luminanceThreshold: 0.3
    })

// Gotcha Mantine: при primaryShade 4 в тёмной схеме vars light/outline-вариантов
// резолвятся в бледный shade 0 — переопределяем на цвета пресета.
export const buildCssVariablesResolver = (preset: IThemePreset): CSSVariablesResolver => {
    const accentVars = (color: string) => ({
        [`--mantine-color-${color}-light`]: `rgba(${preset.accRgb}, 0.12)`,
        [`--mantine-color-${color}-light-hover`]: `rgba(${preset.accRgb}, 0.18)`,
        [`--mantine-color-${color}-light-color`]: preset.accent[4],
        [`--mantine-color-${color}-outline`]: preset.accent[4],
        [`--mantine-color-${color}-outline-hover`]: `rgba(${preset.accRgb}, 0.09)`
    })
    return () => ({
        variables: {},
        light: {},
        dark: {
            ...accentVars('cyan'),
            ...accentVars('blue'),
            ...accentVars('teal')
        }
    })
}

export const applyPresetCssVars = (preset: IThemePreset): void => {
    const root = document.documentElement
    const vars: Record<string, string> = {
        '--sp-bg': preset.bg,
        '--sp-bg-soft': preset.bgSoft,
        '--sp-card': preset.card,
        '--sp-card-border': preset.cardBorder,
        '--sp-card-edge': preset.cardEdge,
        '--sp-card-shadow': preset.cardShadow,
        '--sp-inset-bg': preset.insetBg,
        '--sp-text': preset.text,
        '--sp-dim': preset.dim,
        '--sp-mono-label': preset.monoLabel,
        '--sp-ok': preset.ok,
        '--sp-track': preset.track,
        '--sp-acc': preset.accent[4],
        '--sp-acc-bright': preset.accent[3],
        '--sp-acc-deep': preset.accent[5],
        '--sp-acc-rgb': preset.accRgb,
        '--sp-cta-text': preset.ctaText,
        '--sp-glow': preset.glow,
        '--sp-header-bg':
            preset.colorScheme === 'light'
                ? 'rgba(251, 252, 254, 0.85)'
                : `color-mix(in srgb, ${preset.bg} 82%, transparent)`
    }
    Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value))
    document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', preset.bg)
    document
        .querySelector('meta[name="color-scheme"]')
        ?.setAttribute('content', preset.colorScheme === 'light' ? 'light' : 'dark')
}
