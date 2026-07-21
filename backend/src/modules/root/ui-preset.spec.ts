import {
    resolveHeaderPayButton,
    resolveLayoutPreset,
    resolvePreviewMode,
    resolveThemePreset,
    THEME_BACKGROUNDS,
} from './ui-preset';

describe('resolveThemePreset', () => {
    it('returns valid ints 1-8 as-is', () => {
        expect(resolveThemePreset('1')).toBe(1);
        expect(resolveThemePreset('8')).toBe(8);
        expect(resolveThemePreset('9')).toBe(9);
        expect(resolveThemePreset('12')).toBe(12);
    });
    it('falls back to 2 on invalid input', () => {
        expect(resolveThemePreset(undefined)).toBe(2);
        expect(resolveThemePreset('')).toBe(2);
        expect(resolveThemePreset('0')).toBe(2);
        expect(resolveThemePreset('13')).toBe(2);
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
        expect(resolveLayoutPreset('j')).toBe('aurora');
    });
    it('accepts full aliases case-insensitively', () => {
        expect(resolveLayoutPreset('classic')).toBe('classic');
        expect(resolveLayoutPreset('HERO')).toBe('hero');
        expect(resolveLayoutPreset(' Tiles ')).toBe('tiles');
        expect(resolveLayoutPreset('AURORA')).toBe('aurora');
    });
    it('falls back to hero on invalid input (incl. reserved d)', () => {
        expect(resolveLayoutPreset(undefined)).toBe('hero');
        expect(resolveLayoutPreset('')).toBe('hero');
        expect(resolveLayoutPreset('d')).toBe('hero');
        expect(resolveLayoutPreset('grid')).toBe('hero');
    });
    it('ignores inherited Object.prototype keys', () => {
        expect(resolveLayoutPreset('constructor')).toBe('hero');
        expect(resolveLayoutPreset('toString')).toBe('hero');
    });
});

describe('THEME_BACKGROUNDS', () => {
    it('covers exactly theme ids 1..8', () => {
        expect(
            Object.keys(THEME_BACKGROUNDS)
                .map(Number)
                .sort((a, b) => a - b),
        ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
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

describe('resolveHeaderPayButton', () => {
    it('shows by default and hides only on 0/false', () => {
        expect(resolveHeaderPayButton(undefined)).toBe(true);
        expect(resolveHeaderPayButton('')).toBe(true);
        expect(resolveHeaderPayButton('1')).toBe(true);
        expect(resolveHeaderPayButton('0')).toBe(false);
        expect(resolveHeaderPayButton('false')).toBe(false);
    });
});
