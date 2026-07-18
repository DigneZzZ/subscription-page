export type TLayoutPreset = 'banner' | 'classic' | 'columns' | 'hero' | 'tiles';

export const DEFAULT_THEME_PRESET = 2;
export const DEFAULT_LAYOUT_PRESET: TLayoutPreset = 'banner';

const LAYOUT_ALIASES: Record<string, TLayoutPreset> = {
    a: 'classic',
    classic: 'classic',
    b: 'hero',
    hero: 'hero',
    c: 'columns',
    columns: 'columns',
    e: 'tiles',
    tiles: 'tiles',
    f: 'banner',
    banner: 'banner',
};

export function resolveThemePreset(raw: string | undefined): number {
    if (!raw) return DEFAULT_THEME_PRESET;
    const value = Number(raw);
    return Number.isInteger(value) && value >= 1 && value <= 8 ? value : DEFAULT_THEME_PRESET;
}

export function resolveLayoutPreset(raw: string | undefined): TLayoutPreset {
    if (!raw) return DEFAULT_LAYOUT_PRESET;
    return LAYOUT_ALIASES[raw.trim().toLowerCase()] ?? DEFAULT_LAYOUT_PRESET;
}

export function resolvePreviewMode(raw: string | undefined): boolean {
    return raw === '1' || raw === 'true';
}
