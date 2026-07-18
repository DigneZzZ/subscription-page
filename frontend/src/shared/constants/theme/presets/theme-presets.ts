type TColorRamp = [
    string, string, string, string, string,
    string, string, string, string, string
]

export interface IThemePreset {
    accent: TColorRamp
    accRgb: string
    bg: string
    bgSoft: string
    card: string
    cardBorder: string
    cardEdge: string
    cardShadow: string
    colorScheme: 'dark' | 'light'
    ctaText: string
    darkRamp: TColorRamp
    dim: string
    glow: string
    id: number
    insetBg: string
    monoLabel: string
    name: string
    ok: string
    text: string
    track: string
}

const GRAPHITE_DARK: TColorRamp = [
    '#d8d2ce', '#b8b1ac', '#98908b', '#6e6660', '#3a3134',
    '#292427', '#201c1f', '#1a1719', '#131114', '#0b0a0c'
]

export const THEME_PRESETS: Record<number, IThemePreset> = {
    1: {
        id: 1, name: 'Graphite Amber', colorScheme: 'dark',
        bg: '#131114', bgSoft: '#1a1719', card: '#201c1f',
        cardBorder: 'transparent', cardEdge: 'rgba(255,255,255,0.05)',
        cardShadow: '0 8px 24px rgba(0,0,0,0.45)', insetBg: '#171416',
        text: '#ece7e3', dim: '#a89d97', monoLabel: '#8a7f78',
        ok: '#7dbb8a', track: '#2b2528',
        accent: ['#fdf3e0', '#f9e3b8', '#f4d28e', '#f0c274', '#e6a94f',
            '#c78a35', '#a06d26', '#7a521b', '#553912', '#33220a'],
        accRgb: '230, 169, 79', ctaText: '#191008', glow: 'transparent',
        darkRamp: GRAPHITE_DARK
    },
    2: {
        id: 2, name: 'Midnight Gold', colorScheme: 'dark',
        bg: '#070b14', bgSoft: '#0c1322', card: '#101a2e',
        cardBorder: 'rgba(232,197,107,0.14)', cardEdge: 'rgba(255,255,255,0.04)',
        cardShadow: '0 8px 24px rgba(0,0,0,0.5)', insetBg: '#0b1222',
        text: '#eae6dc', dim: '#9aa3b5', monoLabel: '#8d94a8',
        ok: '#7dbb8a', track: '#1b2438',
        accent: ['#fdf6e3', '#f9ecc2', '#f4e09e', '#f0d48a', '#e8c56b',
            '#c9a24d', '#a48138', '#7d6128', '#57431a', '#33270e'],
        accRgb: '232, 197, 107', ctaText: '#1a1408', glow: 'rgba(232,197,107,0.10)',
        darkRamp: ['#dfe3ec', '#bcc4d4', '#99a5bb', '#6c7995', '#3a4763',
            '#16223c', '#101a2e', '#0c1322', '#070b14', '#04070d']
    },
    3: {
        id: 3, name: 'Graphite Copper', colorScheme: 'dark',
        bg: '#131114', bgSoft: '#1a1719', card: '#201c1f',
        cardBorder: 'transparent', cardEdge: 'rgba(255,255,255,0.05)',
        cardShadow: '0 8px 24px rgba(0,0,0,0.45)', insetBg: '#171416',
        text: '#ece7e3', dim: '#a89d97', monoLabel: '#8a7f78',
        ok: '#7dbb8a', track: '#2b2528',
        accent: ['#fdeee4', '#fbd9c2', '#f8c29e', '#ffb07e', '#ef9a67',
            '#d0784a', '#a95d36', '#824626', '#5c3018', '#361b0c'],
        accRgb: '239, 154, 103', ctaText: '#1a0f08', glow: 'transparent',
        darkRamp: GRAPHITE_DARK
    },
    4: {
        id: 4, name: 'Rose Gold', colorScheme: 'dark',
        bg: '#141114', bgSoft: '#1b1719', card: '#211c1f',
        cardBorder: 'transparent', cardEdge: 'rgba(255,255,255,0.05)',
        cardShadow: '0 8px 24px rgba(0,0,0,0.45)', insetBg: '#181416',
        text: '#ece7e3', dim: '#a89d9c', monoLabel: '#8a7f7d',
        ok: '#7dbb8a', track: '#2b2528',
        accent: ['#fbeee8', '#f7dccf', '#f2c5b1', '#f2b49c', '#e79c82',
            '#c97a5e', '#a45f47', '#7e4733', '#583022', '#331a12'],
        accRgb: '231, 156, 130', ctaText: '#1a0f0a', glow: 'transparent',
        darkRamp: ['#d8d2d0', '#b8b1af', '#98908e', '#6e6663', '#3a3136',
            '#292428', '#211c1f', '#1b1719', '#141114', '#0b0a0c']
    },
    5: {
        id: 5, name: 'Graphite Wine', colorScheme: 'dark',
        bg: '#141113', bgSoft: '#1b1719', card: '#211c1e',
        cardBorder: 'transparent', cardEdge: 'rgba(255,255,255,0.05)',
        cardShadow: '0 8px 24px rgba(0,0,0,0.45)', insetBg: '#181415',
        text: '#ece7e5', dim: '#a89da0', monoLabel: '#8a7f82',
        ok: '#7dbb8a', track: '#2b2527',
        accent: ['#f9e9eb', '#f0cbd0', '#e6adb4', '#e08a93', '#c96a72',
            '#a94f57', '#8a3d44', '#6a2e33', '#4a1f23', '#2b1114'],
        accRgb: '201, 106, 114', ctaText: '#1c0d0f', glow: 'transparent',
        darkRamp: ['#d8d2d3', '#b8b1b2', '#989091', '#6e6667', '#3a3133',
            '#292426', '#211c1e', '#1b1719', '#141113', '#0b0a0b']
    },
    6: {
        id: 6, name: 'Obsidian Platinum', colorScheme: 'dark',
        bg: '#08090b', bgSoft: '#0e1013', card: '#14161a',
        cardBorder: 'rgba(201,214,232,0.10)', cardEdge: 'rgba(255,255,255,0.03)',
        cardShadow: '0 8px 24px rgba(0,0,0,0.55)', insetBg: '#0e1013',
        text: '#e8ebef', dim: '#8b94a1', monoLabel: '#788292',
        ok: '#7dbb8a', track: '#1e2229',
        accent: ['#ffffff', '#f0f5fb', '#e2ebf7', '#d5e0ef', '#c9d6e8',
            '#9fb0c7', '#7d8da3', '#5d6a7d', '#3f4855', '#232830'],
        accRgb: '201, 214, 232', ctaText: '#101318', glow: 'transparent',
        darkRamp: ['#dfe3e8', '#bac1c9', '#959ea9', '#6a7480', '#39404a',
            '#1b1f25', '#14161a', '#0e1013', '#08090b', '#040506']
    },
    7: {
        id: 7, name: 'Neon Cyber', colorScheme: 'dark',
        bg: '#0b0a12', bgSoft: '#141224', card: '#17152a',
        cardBorder: 'rgba(139,123,255,0.18)', cardEdge: 'rgba(255,255,255,0.04)',
        cardShadow: '0 8px 28px rgba(0,0,0,0.5)', insetBg: '#100e1f',
        text: '#eceaf7', dim: '#9d97b8', monoLabel: '#867fa8',
        ok: '#6fe3a5', track: '#241f3d',
        accent: ['#f1eeff', '#ddd6ff', '#c4b9ff', '#a99bff', '#8b7bff',
            '#6a58e8', '#5244bd', '#3d3292', '#292267', '#17133d'],
        accRgb: '139, 123, 255', ctaText: '#0e0b1e', glow: 'rgba(139,123,255,0.16)',
        darkRamp: ['#e4e1f2', '#c3bedd', '#a29bc8', '#7a71a8', '#4a4275',
            '#1f1c38', '#17152a', '#141224', '#0b0a12', '#06050c']
    },
    8: {
        id: 8, name: 'Light Minimal', colorScheme: 'light',
        bg: '#f2f4f7', bgSoft: '#fbfcfe', card: '#ffffff',
        cardBorder: 'rgba(15,23,42,0.08)', cardEdge: 'rgba(255,255,255,0.9)',
        cardShadow: '0 6px 18px rgba(15,23,42,0.07)', insetBg: '#eef0f4',
        text: '#17202b', dim: '#5c6672', monoLabel: '#7a828d',
        ok: '#2e9e57', track: '#e2e6ec',
        accent: ['#e8eefc', '#c8d6f8', '#a4bbf4', '#6f92ee', '#3563e9',
            '#2b53c9', '#2244a4', '#1a357f', '#12255a', '#0a1636'],
        accRgb: '53, 99, 233', ctaText: '#ffffff', glow: 'transparent',
        darkRamp: ['#c9d1d9', '#a7b0ba', '#8b949e', '#6e7681', '#484f58',
            '#30363d', '#21262d', '#161b22', '#0d1117', '#010409']
    }
}

export const SAGE_GREEN: TColorRamp = [
    '#eaf5ec', '#cfe7d4', '#b2d8ba', '#96caa1', '#7dbb8a',
    '#5f9e6e', '#4a7f57', '#376142', '#25442e', '#14281a'
]

export const LIGHT_GREEN: TColorRamp = [
    '#e6f6ec', '#c2e8d0', '#9bd9b2', '#71c893', '#2e9e57',
    '#268a4b', '#1f753f', '#186033', '#114a27', '#0a331b'
]

export const getThemePreset = (id: number): IThemePreset =>
    THEME_PRESETS[id] ?? THEME_PRESETS[2]
