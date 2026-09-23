import { createHmac } from 'node:crypto';

import {
    buildChatwootRenderVars,
    resolveChatwootLauncher,
    resolveChatwootPosition,
    resolveChatwootProxy,
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

describe('resolveChatwootLauncher', () => {
    it('defaults to the page launcher', () => {
        expect(resolveChatwootLauncher(undefined)).toBe('page');
        expect(resolveChatwootLauncher('')).toBe('page');
        expect(resolveChatwootLauncher('bubble')).toBe('page');
    });
    it('accepts page/native/none case-insensitively', () => {
        expect(resolveChatwootLauncher('native')).toBe('native');
        expect(resolveChatwootLauncher('NONE')).toBe('none');
        expect(resolveChatwootLauncher(' Page ')).toBe('page');
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
            type: 'standard',
            launcher: 'page',
            // the page renders its own launcher, so Chatwoot's bubble stays hidden
            hideMessageBubble: true,
            darkMode: 'dark',
            proxied: false,
        });
        expect(decodeSettings(buildChatwootRenderVars(env, 'x', 'light').chatwootSettings)).toEqual(
            expect.objectContaining({ darkMode: 'light' }),
        );
    });

    it('native launcher shows the Chatwoot bubble and a title switches it to the expanded bubble', () => {
        const vars = buildChatwootRenderVars(
            { ...env, position: 'left', launcherTitle: 'Поддержка', launcher: 'native' },
            'x',
            'dark',
        );
        expect(decodeSettings(vars.chatwootSettings)).toEqual({
            position: 'left',
            launcherTitle: 'Поддержка',
            type: 'expanded_bubble',
            launcher: 'native',
            hideMessageBubble: false,
            darkMode: 'dark',
            proxied: false,
        });
    });

    it('launcher=none hides every launcher (chat opens only via #support)', () => {
        const vars = buildChatwootRenderVars({ ...env, launcher: 'none' }, 'x', 'dark');
        expect(decodeSettings(vars.chatwootSettings)).toEqual(
            expect.objectContaining({ launcher: 'none', hideMessageBubble: true }),
        );
    });

    it('serves the widget from the page origin when the proxy is enabled', () => {
        const vars = buildChatwootRenderVars({ ...env, proxy: '1' }, 'x', 'dark');
        expect(vars.chatwootBaseUrl).toBe('');
        expect(vars.chatwootWebsiteToken).toBe('tok');
        expect(vars.chatwootIdentifierHash).not.toBe('');
        expect(decodeSettings(vars.chatwootSettings)).toEqual(
            expect.objectContaining({ proxied: true }),
        );
    });

    it('ignores the proxy flag without an upstream', () => {
        const vars = buildChatwootRenderVars({ websiteToken: 'tok', proxy: '1' }, 'x', 'dark');
        expect(vars.chatwootWebsiteToken).toBe('');
        expect(vars.chatwootSettings).toBe('');
    });
});

describe('resolveChatwootProxy', () => {
    it('is off by default and on for 1/true', () => {
        expect(resolveChatwootProxy(undefined)).toBe(false);
        expect(resolveChatwootProxy('0')).toBe(false);
        expect(resolveChatwootProxy('1')).toBe(true);
        expect(resolveChatwootProxy('true')).toBe(true);
    });
});
