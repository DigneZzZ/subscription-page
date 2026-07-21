export type TLayoutPreset = 'aurora' | 'banner' | 'classic' | 'columns' | 'hero' | 'tiles';

export const DEFAULT_THEME_PRESET = 2;
export const DEFAULT_LAYOUT_PRESET: TLayoutPreset = 'hero';

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
    j: 'aurora',
    aurora: 'aurora',
};

// Server-side mirror of each theme preset's page background + color scheme, used
// to paint the correct <meta>/<html> background before the JS bundle hydrates
// (avoids a dark flash on the light preset). Keep in sync with
// frontend/src/shared/constants/theme/presets/theme-presets.ts (the `bg` and
// `colorScheme` fields of each entry).
export const THEME_BACKGROUNDS: Record<number, { bg: string; colorScheme: 'dark' | 'light' }> = {
    1: { bg: '#131114', colorScheme: 'dark' },
    2: { bg: '#070b14', colorScheme: 'dark' },
    3: { bg: '#131114', colorScheme: 'dark' },
    4: { bg: '#141114', colorScheme: 'dark' },
    5: { bg: '#141113', colorScheme: 'dark' },
    6: { bg: '#08090b', colorScheme: 'dark' },
    7: { bg: '#0b0a12', colorScheme: 'dark' },
    8: { bg: '#f2f4f7', colorScheme: 'light' },
    9: { bg: '#0a120d', colorScheme: 'dark' },
    10: { bg: '#0b1219', colorScheme: 'dark' },
    11: { bg: '#140b0e', colorScheme: 'dark' },
    12: { bg: '#12101a', colorScheme: 'dark' },
};

export function resolveThemePreset(raw: string | undefined): number {
    if (!raw) return DEFAULT_THEME_PRESET;
    const value = Number(raw);
    return Number.isInteger(value) && value >= 1 && value <= 12 ? value : DEFAULT_THEME_PRESET;
}

export function resolveLayoutPreset(raw: string | undefined): TLayoutPreset {
    if (!raw) return DEFAULT_LAYOUT_PRESET;
    const key = raw.trim().toLowerCase();
    // Object.hasOwn guards against inherited keys (e.g. 'constructor', 'toString')
    // resolving to a prototype value instead of falling back to the default.
    return Object.hasOwn(LAYOUT_ALIASES, key) ? LAYOUT_ALIASES[key] : DEFAULT_LAYOUT_PRESET;
}

export function resolvePreviewMode(raw: string | undefined): boolean {
    return raw === '1' || raw === 'true';
}

/* HEADER_PAY_BUTTON: '0'/'false' прячут кнопку «Оплатить» в шапке
   (в раскладках b/c/e/f есть своя CTA «Продлить»; в classic шапочная —
   единственная точка оплаты, там прятать не стоит). Дефолт — показывать. */
export function resolveHeaderPayButton(raw: string | undefined): boolean {
    return !(raw === '0' || raw === 'false');
}

/* EFFECTS: csv из blobs|glass|shimmer|pulse|glow, либо all/none.
   Дефолт — пусто (текущий вид). Aurora несёт свои blobs/glass всегда. */
export const EFFECT_FLAGS = ['blobs', 'glass', 'shimmer', 'pulse', 'glow'] as const;
export type TEffectFlag = (typeof EFFECT_FLAGS)[number];

export function resolveEffects(raw: string | undefined): TEffectFlag[] {
    if (!raw) return [];
    const key = raw.trim().toLowerCase();
    if (key === 'none' || key === '0') return [];
    if (key === 'all' || key === '1') return [...EFFECT_FLAGS];
    const parts = key.split(',').map((part) => part.trim());
    return EFFECT_FLAGS.filter((flag) => parts.includes(flag));
}
