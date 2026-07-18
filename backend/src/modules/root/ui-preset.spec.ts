import {
    resolveLayoutPreset,
    resolvePreviewMode,
    resolveThemePreset,
    THEME_BACKGROUNDS,
} from './ui-preset';

describe('resolveThemePreset', () => {
    it('returns valid ints 1-8 as-is', () => {
        expect(resolveThemePreset('1')).toBe(1);
        expect(resolveThemePreset('8')).toBe(8);
    });
    it('falls back to 2 on invalid input', () => {
        expect(resolveThemePreset(undefined)).toBe(2);
        expect(resolveThemePreset('')).toBe(2);
        expect(resolveThemePreset('0')).toBe(2);
        expect(resolveThemePreset('9')).toBe(2);
        expect(resolveThemePreset('2.5')).toBe(2);
        expect(resolveThemePreset('gold')).toBe(2);
    });
});

describe('resolveLayoutPreset', () => {
    it('accepts letters', () => {
        expect(resolveLayoutPreset('a')).toBe('classic');
        expect(resolveLayoutPreset('b')).toBe('hero');
        expect(resolveLayoutPreset('c')).toBe('columns');
        expect(resolveLayoutPreset('e')).toBe('tiles');
        expect(resolveLayoutPreset('f')).toBe('banner');
    });
    it('accepts full aliases case-insensitively', () => {
        expect(resolveLayoutPreset('classic')).toBe('classic');
        expect(resolveLayoutPreset('HERO')).toBe('hero');
        expect(resolveLayoutPreset(' Tiles ')).toBe('tiles');
    });
    it('falls back to banner on invalid input (incl. reserved d)', () => {
        expect(resolveLayoutPreset(undefined)).toBe('banner');
        expect(resolveLayoutPreset('')).toBe('banner');
        expect(resolveLayoutPreset('d')).toBe('banner');
        expect(resolveLayoutPreset('grid')).toBe('banner');
    });
    it('ignores inherited Object.prototype keys', () => {
        expect(resolveLayoutPreset('constructor')).toBe('banner');
        expect(resolveLayoutPreset('toString')).toBe('banner');
    });
});

describe('THEME_BACKGROUNDS', () => {
    it('covers exactly theme ids 1..8', () => {
        expect(
            Object.keys(THEME_BACKGROUNDS)
                .map(Number)
                .sort((a, b) => a - b),
        ).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });
    it('marks only theme 8 as light and all others dark', () => {
        for (let id = 1; id <= 8; id++) {
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
