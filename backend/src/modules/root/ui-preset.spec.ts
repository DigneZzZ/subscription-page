import {
    resolveEffects,
    resolveHeaderPayButton,
    resolveLayoutPreset,
    resolvePreviewMode,
    resolveThemePreset,
    THEME_BACKGROUNDS,
} from './ui-preset';

describe('resolveThemePreset', () => {
    it('returns valid ints 1-12 as-is', () => {
        expect(resolveThemePreset('1')).toBe(1);
        expect(resolveThemePreset('8')).toBe(8);
        expect(resolveThemePreset('9')).toBe(9);
        expect(resolveThemePreset('12')).toBe(12);
    });
    it('falls back to Emerald Night on invalid input', () => {
        expect(resolveThemePreset(undefined)).toBe(9);
        expect(resolveThemePreset('')).toBe(9);
        expect(resolveThemePreset('0')).toBe(9);
        expect(resolveThemePreset('13')).toBe(9);
        expect(resolveThemePreset('2.5')).toBe(9);
        expect(resolveThemePreset('gold')).toBe(9);
    });
});

describe('resolveLayoutPreset', () => {
    it('accepts letters', () => {
        expect(resolveLayoutPreset('a')).toBe('classic');
        expect(resolveLayoutPreset('b')).toBe('hero');
        expect(resolveLayoutPreset('c')).toBe('columns');
        expect(resolveLayoutPreset('e')).toBe('tiles');
        expect(resolveLayoutPreset('f')).toBe('banner');
        expect(resolveLayoutPreset('j')).toBe('aurora');
        expect(resolveLayoutPreset('k')).toBe('network');
        expect(resolveLayoutPreset('l')).toBe('billboard');
    });
    it('accepts full aliases case-insensitively', () => {
        expect(resolveLayoutPreset('classic')).toBe('classic');
        expect(resolveLayoutPreset('HERO')).toBe('hero');
        expect(resolveLayoutPreset(' Tiles ')).toBe('tiles');
        expect(resolveLayoutPreset('AURORA')).toBe('aurora');
    });
    it('falls back to obsidian on invalid input (incl. reserved d)', () => {
        expect(resolveLayoutPreset(undefined)).toBe('obsidian');
        expect(resolveLayoutPreset('')).toBe('obsidian');
        expect(resolveLayoutPreset('d')).toBe('obsidian');
        expect(resolveLayoutPreset('grid')).toBe('obsidian');
    });
    it('ignores inherited Object.prototype keys', () => {
        expect(resolveLayoutPreset('constructor')).toBe('obsidian');
        expect(resolveLayoutPreset('toString')).toBe('obsidian');
    });
});

describe('THEME_BACKGROUNDS', () => {
    it('covers exactly theme ids 1..12', () => {
        expect(
            Object.keys(THEME_BACKGROUNDS)
                .map(Number)
                .sort((a, b) => a - b),
        ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });
    it('marks only theme 8 as light and all others dark', () => {
        for (let id = 1; id <= 12; id++) {
            expect(THEME_BACKGROUNDS[id].colorScheme).toBe(id === 8 ? 'light' : 'dark');
        }
    });
});

describe('resolvePreviewMode', () => {
    it('is true only for "1" and "true"', () => {
        expect(resolvePreviewMode('1')).toBe(true);
        expect(resolvePreviewMode('true')).toBe(true);
        expect(resolvePreviewMode('0')).toBe(false);
        expect(resolvePreviewMode(undefined)).toBe(false);
        expect(resolvePreviewMode('yes')).toBe(false);
    });
});

describe('resolveHeaderPayButton', () => {
    it('shows by default and hides only on 0/false', () => {
        expect(resolveHeaderPayButton(undefined)).toBe(true);
        expect(resolveHeaderPayButton('')).toBe(true);
        expect(resolveHeaderPayButton('1')).toBe(true);
        expect(resolveHeaderPayButton('0')).toBe(false);
        expect(resolveHeaderPayButton('false')).toBe(false);
    });
});

describe('resolveEffects', () => {
    it('parses csv, all and none', () => {
        expect(resolveEffects(undefined)).toEqual([]);
        expect(resolveEffects('')).toEqual([]);
        expect(resolveEffects('none')).toEqual([]);
        expect(resolveEffects('all')).toEqual(['blobs', 'glass', 'shimmer', 'pulse', 'glow']);
        expect(resolveEffects('glow, blobs')).toEqual(['blobs', 'glow']);
        expect(resolveEffects('sparkles,glow')).toEqual(['glow']);
    });
});

describe('Obsidian redesign', () => {
    it('accepts the new layout name and short alias', () => {
        expect(resolveLayoutPreset('obsidian')).toBe('obsidian');
        expect(resolveLayoutPreset(' O ')).toBe('obsidian');
    });
    it('paints the emerald theme with the obsidian background before hydration', () => {
        expect(THEME_BACKGROUNDS[9]).toEqual({ bg: '#080c0d', colorScheme: 'dark' });
    });
});
