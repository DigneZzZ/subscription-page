import { createHmac } from 'node:crypto';

export type TChatwootPosition = 'left' | 'right';

export interface IChatwootEnv {
    baseUrl?: string;
    websiteToken?: string;
    hmacSecret?: string;
    position?: string;
    launcherTitle?: string;
    hideBubble?: string;
    // CHATWOOT_PROXY: serve the widget through this backend (see common/chatwoot-proxy)
    proxy?: string;
}

// Template variables consumed by frontend/index.html (see the Chatwoot block).
export interface IChatwootRenderVars {
    chatwootBaseUrl: string;
    chatwootWebsiteToken: string;
    chatwootIdentifierHash: string;
    // base64(JSON) of window.chatwootSettings; empty when the widget is off.
    chatwootSettings: string;
}

// Subset of Chatwoot's window.chatwootSettings that this page controls.
// `locale` is intentionally absent: the browser knows the page language, the
// server does not (see index.html / use-chatwoot-sync).
export interface IChatwootSettings {
    position: TChatwootPosition;
    launcherTitle: string;
    hideMessageBubble: boolean;
    darkMode: 'dark' | 'light';
    // true → index.html loads the SDK from window.location.origin instead of chatwootBaseUrl
    proxied: boolean;
}

const parseFlag = (raw: string | undefined): boolean => {
    const value = raw?.trim().toLowerCase();
    return value === '1' || value === 'true';
};

export function resolveChatwootPosition(raw: string | undefined): TChatwootPosition {
    return raw?.trim().toLowerCase() === 'left' ? 'left' : 'right';
}

export function resolveChatwootHideBubble(raw: string | undefined): boolean {
    return parseFlag(raw);
}

export function resolveChatwootProxy(raw: string | undefined): boolean {
    return parseFlag(raw);
}

export function buildChatwootRenderVars(
    env: IChatwootEnv,
    identifier: string | undefined,
    colorScheme: 'dark' | 'light',
): IChatwootRenderVars {
    const baseUrl = (env.baseUrl ?? '').trim().replace(/\/+$/, '');
    const websiteToken = (env.websiteToken ?? '').trim();

    if (!baseUrl || !websiteToken) {
        return {
            chatwootBaseUrl: '',
            chatwootWebsiteToken: '',
            chatwootIdentifierHash: '',
            chatwootSettings: '',
        };
    }

    const secret = env.hmacSecret ?? '';
    const chatwootIdentifierHash =
        secret && identifier ? createHmac('sha256', secret).update(identifier).digest('hex') : '';

    const proxied = resolveChatwootProxy(env.proxy);
    const settings: IChatwootSettings = {
        position: resolveChatwootPosition(env.position),
        launcherTitle: env.launcherTitle ?? '',
        hideMessageBubble: resolveChatwootHideBubble(env.hideBubble),
        darkMode: colorScheme,
        proxied,
    };

    return {
        // In proxy mode the browser must never see the upstream host.
        chatwootBaseUrl: proxied ? '' : baseUrl,
        chatwootWebsiteToken: websiteToken,
        chatwootIdentifierHash,
        chatwootSettings: Buffer.from(JSON.stringify(settings)).toString('base64'),
    };
}
