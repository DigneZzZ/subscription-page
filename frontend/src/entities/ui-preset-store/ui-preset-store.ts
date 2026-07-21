import { create } from 'zustand'

export const EFFECT_FLAGS = ['blobs', 'glass', 'shimmer', 'pulse', 'glow'] as const
export type TEffectFlag = (typeof EFFECT_FLAGS)[number]

export type TLayoutPreset =
    | 'aurora'
    | 'banner'
    | 'billboard'
    | 'classic'
    | 'columns'
    | 'hero'
    | 'network'
    | 'tiles'

interface IUiPresetState {
    actions: {
        setLayoutPreset: (layout: TLayoutPreset) => void
        setThemePreset: (theme: number) => void
        toggleEffect: (flag: TEffectFlag) => void
    }
    effects: TEffectFlag[]
    headerPay: boolean
    layoutPreset: TLayoutPreset
    preview: boolean
    themePreset: number
}

const LAYOUTS: TLayoutPreset[] = [
    'aurora',
    'banner',
    'billboard',
    'classic',
    'columns',
    'hero',
    'network',
    'tiles'
]

const readInitialPreset = (): { effects: TEffectFlag[]; headerPay: boolean; layout: TLayoutPreset; preview: boolean; theme: number } => {
    const fallback = { effects: [] as TEffectFlag[], headerPay: true, layout: 'hero' as TLayoutPreset, preview: false, theme: 2 }
    try {
        const div = document.getElementById('ui')
        if (!div?.dataset.preset) return fallback
        const parsed = JSON.parse(atob(div.dataset.preset))
        return {
            effects: Array.isArray(parsed.fx)
                ? EFFECT_FLAGS.filter((flag) => parsed.fx.includes(flag))
                : [],
            headerPay: parsed.headerPay !== false,
            layout: LAYOUTS.includes(parsed.layout) ? parsed.layout : fallback.layout,
            preview: parsed.preview === true,
            theme:
                Number.isInteger(parsed.theme) && parsed.theme >= 1 && parsed.theme <= 12
                    ? parsed.theme
                    : fallback.theme
        }
    } catch {
        return fallback
    }
}

const initial = readInitialPreset()

export const useUiPresetStore = create<IUiPresetState>()((set) => ({
    effects: initial.effects,
    headerPay: initial.headerPay,
    themePreset: initial.theme,
    layoutPreset: initial.layout,
    preview: initial.preview,
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
export const useHeaderPayButton = () => useUiPresetStore((state) => state.headerPay)
export const useThemePreset = () => useUiPresetStore((state) => state.themePreset)
export const useLayoutPreset = () => useUiPresetStore((state) => state.layoutPreset)
export const usePreviewMode = () => useUiPresetStore((state) => state.preview)
export const useUiPresetActions = () => useUiPresetStore((state) => state.actions)
