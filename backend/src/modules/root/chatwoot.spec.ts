import { createHmac } from 'node:crypto';

import {
    buildChatwootRenderVars,
    resolveChatwootHideBubble,
    resolveChatwootPosition,
} from './chatwoot';

const decodeSettings = (raw: string) => JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));

describe('resolveChatwootPosition', () => {
    it('defaults to right', () => {
        expect(resolveChatwootPosition(undefined)).toBe('right');
        expect(resolveChatwootPosition('')).toBe('right');
        expect(resolveChatwootPosition('bottom')).toBe('right');
    });
    it('accepts left/right case-insensitively', () => {
        expect(resolveChatwootPosition('left')).toBe('left');
        expect(resolveChatwootPosition('LEFT')).toBe('left');
        expect(resolveChatwootPosition('Right')).toBe('right');
    });
});

describe('resolveChatwootHideBubble', () => {
    it('is off by default and on for 1/true', () => {
        expect(resolveChatwootHideBubble(undefined)).toBe(false);
        expect(resolveChatwootHideBubble('0')).toBe(false);
        expect(resolveChatwootHideBubble('false')).toBe(false);
        expect(resolveChatwootHideBubble('1')).toBe(true);
        expect(resolveChatwootHideBubble('true')).toBe(true);
    });
});

describe('buildChatwootRenderVars', () => {
    const env = {
        baseUrl: 'https://support.example.com',
        websiteToken: 'tok',
        hmacSecret: 'secret',
    };

    it('renders empty strings when the widget is not configured', () => {
        const vars = buildChatwootRenderVars({}, 'abc', 'dark');
        expect(vars.chatwootBaseUrl).toBe('');
        expect(vars.chatwootWebsiteToken).toBe('');
        expect(vars.chatwootIdentifierHash).toBe('');
        expect(vars.chatwootSettings).toBe('');
    });

    it('signs the identifier with HMAC-SHA256 hex', () => {
        const vars = buildChatwootRenderVars(env, 'short-uuid', 'dark');
        expect(vars.chatwootIdentifierHash).toBe(
            createHmac('sha256', 'secret').update('short-uuid').digest('hex'),
        );
    });

    it('leaves the hash empty without a secret or identifier', () => {
        expect(
            buildChatwootRenderVars({ ...env, hmacSecret: undefined }, 'x', 'dark')
                .chatwootIdentifierHash,
        ).toBe('');
        expect(buildChatwootRenderVars(env, undefined, 'dark').chatwootIdentifierHash).toBe('');
        expect(buildChatwootRenderVars(env, '', 'dark').chatwootIdentifierHash).toBe('');
    });

    it('strips trailing slashes from the base URL', () => {
        expect(
            buildChatwootRenderVars({ ...env, baseUrl: 'https://s.example//' }, 'x', 'dark')
                .chatwootBaseUrl,
        ).toBe('https://s.example');
    });

    it('encodes widget settings with defaults and the page color scheme', () => {
        const vars = buildChatwootRenderVars(env, 'x', 'dark');
        expect(decodeSettings(vars.chatwootSettings)).toEqual({
            position: 'right',
            launcherTitle: '',
            hideMessageBubble: false,
            darkMode: 'dark',
        });
        expect(decodeSettings(buildChatwootRenderVars(env, 'x', 'light').chatwootSettings)).toEqual(
            expect.objectContaining({ darkMode: 'light' }),
        );
    });

    it('passes configured position, title and hidden bubble through', () => {
        const vars = buildChatwootRenderVars(
            { ...env, position: 'left', launcherTitle: 'Поддержка', hideBubble: '1' },
            'x',
            'dark',
        );
        expect(decodeSettings(vars.chatwootSettings)).toEqual({
            position: 'left',
            launcherTitle: 'Поддержка',
            hideMessageBubble: true,
            darkMode: 'dark',
        });
    });
});
