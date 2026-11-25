import { create } from 'zustand'

export const EFFECT_FLAGS = ['blobs', 'glass', 'shimmer', 'pulse', 'glow'] as const
export type TEffectFlag = (typeof EFFECT_FLAGS)[number]

const FROST_TRAFFIC_PREVIEWS = ['off', 'separate', 'inline', 'nav'] as const
export type TFrostTrafficPreview = (typeof FROST_TRAFFIC_PREVIEWS)[number]

export type TLayoutPreset =
    | 'aurora'
    | 'banner'
    | 'billboard'
    | 'classic'
    | 'columns'
    | 'frost'
    | 'hero'
    | 'network'
    | 'obsidian'
    | 'tiles'

interface IUiPresetState {
    actions: {
        setLayoutPreset: (layout: TLayoutPreset) => void
        setThemePreset: (theme: number) => void
        toggleEffect: (flag: TEffectFlag) => void
    }
    effects: TEffectFlag[]
    frostTrafficPreview: TFrostTrafficPreview
    headerPay: boolean
    layoutPreset: TLayoutPreset
    preview: boolean
    themePreset: number
}

const LAYOUTS: TLayoutPreset[] = [
    'obsidian',
    'aurora',
    'banner',
    'billboard',
    'classic',
    'columns',
    'frost',
    'hero',
    'network',
    'tiles'
]

const readInitialPreset = (): Omit<IUiPresetState, 'actions'> => {
    const fallback = {
        effects: [],
        frostTrafficPreview: 'off',
        headerPay: true,
        layoutPreset: 'obsidian',
        preview: false,
        themePreset: 9
    } as const satisfies Omit<IUiPresetState, 'actions'>
    try {
        const div = document.getElementById('ui')
        if (!div?.dataset.preset) return fallback
        const parsed = JSON.parse(atob(div.dataset.preset))
        return {
            effects: Array.isArray(parsed.fx)
                ? EFFECT_FLAGS.filter((flag) => parsed.fx.includes(flag))
                : [],
            frostTrafficPreview: FROST_TRAFFIC_PREVIEWS.includes(parsed.frostTrafficPreview)
                ? parsed.frostTrafficPreview
                : fallback.frostTrafficPreview,
            headerPay: parsed.headerPay !== false,
            layoutPreset: LAYOUTS.includes(parsed.layout) ? parsed.layout : fallback.layoutPreset,
            preview: parsed.preview === true,
            themePreset:
                Number.isInteger(parsed.theme) && parsed.theme >= 1 && parsed.theme <= 12
                    ? parsed.theme
                    : fallback.themePreset
        }
    } catch {
        return fallback
    }
}

export const useUiPresetStore = create<IUiPresetState>()((set) => ({
    ...readInitialPreset(),
    actions: {
        setThemePreset: (theme) => set({ themePreset: theme }),
        setLayoutPreset: (layout) => set({ layoutPreset: layout }),
        toggleEffect: (flag) =>
            set((state) => ({
                effects: state.effects.includes(flag)
                    ? state.effects.filter((current) => current !== flag)
                    : [...state.effects, flag]
            }))
    }
}))

export const useEffects = () => useUiPresetStore((state) => state.effects)
export const useFrostTrafficPreview = () => useUiPresetStore((state) => state.frostTrafficPreview)
export const useHeaderPayButton = () => useUiPresetStore((state) => state.headerPay)
export const useThemePreset = () => useUiPresetStore((state) => state.themePreset)
export const useLayoutPreset = () => useUiPresetStore((state) => state.layoutPreset)
export const usePreviewMode = () => useUiPresetStore((state) => state.preview)
export const useUiPresetActions = () => useUiPresetStore((state) => state.actions)
