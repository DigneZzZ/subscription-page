import { create } from 'zustand'

export type TLayoutPreset = 'banner' | 'classic' | 'columns' | 'hero' | 'tiles'

interface IUiPresetState {
    actions: {
        setLayoutPreset: (layout: TLayoutPreset) => void
        setThemePreset: (theme: number) => void
    }
    headerPay: boolean
    layoutPreset: TLayoutPreset
    preview: boolean
    themePreset: number
}

const LAYOUTS: TLayoutPreset[] = ['banner', 'classic', 'columns', 'hero', 'tiles']

const readInitialPreset = (): { headerPay: boolean; layout: TLayoutPreset; preview: boolean; theme: number } => {
    const fallback = { headerPay: true, layout: 'hero' as TLayoutPreset, preview: false, theme: 2 }
    try {
        const div = document.getElementById('ui')
        if (!div?.dataset.preset) return fallback
        const parsed = JSON.parse(atob(div.dataset.preset))
        return {
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
    headerPay: initial.headerPay,
    themePreset: initial.theme,
    layoutPreset: initial.layout,
    preview: initial.preview,
    actions: {
        setThemePreset: (theme) => set({ themePreset: theme }),
        setLayoutPreset: (layout) => set({ layoutPreset: layout })
    }
}))

export const useHeaderPayButton = () => useUiPresetStore((state) => state.headerPay)
export const useThemePreset = () => useUiPresetStore((state) => state.themePreset)
export const useLayoutPreset = () => useUiPresetStore((state) => state.layoutPreset)
export const usePreviewMode = () => useUiPresetStore((state) => state.preview)
export const useUiPresetActions = () => useUiPresetStore((state) => state.actions)
