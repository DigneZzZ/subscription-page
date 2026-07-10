import { createTheme, CSSVariablesResolver } from '@mantine/core'

import components from './overrides'

/**
 * Geolog VPN brand theme for the Remnawave subscription page.
 *
 * STRATEGY — recolor with (almost) zero component edits:
 * The stock container uses `cyan` as its single accent token everywhere
 * (`color="cyan"`, `c="cyan"`, `var(--mantine-color-cyan-*)`). We REDEFINE the
 * `cyan` palette here as the Geolog green (#5fe9a4 at index 4), so every one of
 * those references turns brand-green automatically. `blue`/`teal`/`green` are
 * mapped to the same green for the monochrome look; `orange`/`yellow`/`red`
 * stay semantic for "expiring" / "inactive" states.
 *
 * The `dark` palette is retuned to the near-black geological surfaces
 * (dark[6] = cards). The page background itself is pinned in global.css.
 *
 * Fonts: Golos Text (body) · Oswald (headings) · JetBrains Mono (mono).
 */
export const theme = createTheme({
    components,
    cursorType: 'pointer',
    fontFamily:
        'Golos Text, Vazirmatn, Apple Color Emoji, Noto Sans SC, Twemoji Country Flags, sans-serif',
    fontFamilyMonospace: 'JetBrains Mono, Fira Mono, monospace',
    breakpoints: {
        xs: '25em',
        sm: '30em',
        md: '48em',
        lg: '64em',
        xl: '80em',
        '2xl': '96em',
        '3xl': '120em',
        '4xl': '160em'
    },
    scale: 1,
    fontSmoothing: true,
    focusRing: 'never',
    white: '#e7efe9',
    black: '#070a09',
    colors: {
        // Near-black geological surfaces. dark[6] = card/paper, dark[2] = dimmed text.
        dark: [
            '#c8d6cc',
            '#aebcb2',
            '#8fa793',
            '#6a8271',
            '#4a5b50',
            '#141c18',
            '#0e1513',
            '#0b100e',
            '#080b0a',
            '#050706'
        ],
        // Geolog green — REPLACES the stock cyan accent app-wide. index 4 = #5fe9a4.
        cyan: [
            '#e7fdf2',
            '#c3f8df',
            '#9bf2ca',
            '#74ecb5',
            '#5fe9a4',
            '#41c586',
            '#2fa06c',
            '#237c54',
            '#18583b',
            '#0c3623'
        ],
        // Monochrome brand: map blue / teal / green to the same green ramp.
        blue: [
            '#e7fdf2',
            '#c3f8df',
            '#9bf2ca',
            '#74ecb5',
            '#5fe9a4',
            '#41c586',
            '#2fa06c',
            '#237c54',
            '#18583b',
            '#0c3623'
        ],
        teal: [
            '#e7fdf2',
            '#c3f8df',
            '#9bf2ca',
            '#74ecb5',
            '#5fe9a4',
            '#41c586',
            '#2fa06c',
            '#237c54',
            '#18583b',
            '#0c3623'
        ],
        green: [
            '#e7fdf2',
            '#c3f8df',
            '#9bf2ca',
            '#74ecb5',
            '#5fe9a4',
            '#41c586',
            '#2fa06c',
            '#237c54',
            '#18583b',
            '#0c3623'
        ],
        // Semantic — kept warm so "expiring soon" / "inactive" still read clearly.
        red: [
            '#ffe9e9',
            '#ffd0d0',
            '#ffb0b0',
            '#ff8f8f',
            '#f56b6b',
            '#e05656',
            '#c74343',
            '#a83232',
            '#872626',
            '#661c1c'
        ],
        orange: [
            '#fff1e5',
            '#ffd8b5',
            '#ffb77c',
            '#fb8f44',
            '#e16f24',
            '#bc4c00',
            '#953800',
            '#762c00',
            '#5c2200',
            '#471700'
        ],
        yellow: [
            '#fff8c5',
            '#fae17d',
            '#eac54f',
            '#d4a72c',
            '#bf8700',
            '#9a6700',
            '#7d4e00',
            '#633c01',
            '#4d2d00',
            '#3b2300'
        ]
    },
    // Bright accent used for filled buttons (was 8 = dark cyan in stock).
    primaryShade: 4,
    primaryColor: 'cyan',
    autoContrast: true,
    luminanceThreshold: 0.45,
    headings: {
        fontFamily: 'Oswald, Vazirmatn, Apple Color Emoji, Noto Sans SC, sans-serif',
        fontWeight: '600'
    },
    defaultRadius: 'md'
})

/**
 * With primaryShade 4, Mantine's dark-scheme virtual vars resolve light/outline
 * variants to pale shade-0 mint. Pin them to the brand green instead
 * (design spec: light buttons are rgba(95,233,164,.1) + #5fe9a4 text).
 */
const brandVariantVars = (color: string) => ({
    [`--mantine-color-${color}-light`]: 'rgba(95, 233, 164, 0.1)',
    [`--mantine-color-${color}-light-hover`]: 'rgba(95, 233, 164, 0.16)',
    [`--mantine-color-${color}-light-color`]: `var(--mantine-color-${color}-4)`,
    [`--mantine-color-${color}-outline`]: `var(--mantine-color-${color}-4)`,
    [`--mantine-color-${color}-outline-hover`]: 'rgba(95, 233, 164, 0.12)'
})

export const cssVariablesResolver: CSSVariablesResolver = () => ({
    variables: {},
    light: {},
    dark: {
        ...brandVariantVars('cyan'),
        ...brandVariantVars('blue'),
        ...brandVariantVars('teal'),
        ...brandVariantVars('green')
    }
})
