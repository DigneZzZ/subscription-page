import { createHmac } from 'node:crypto';

export type TChatwootPosition = 'left' | 'right';
// page   → the subscription page renders its own launcher button, Chatwoot's bubble is hidden
// native → Chatwoot's own bubble (expanded with text when CHATWOOT_LAUNCHER_TITLE is set)
// none   → no launcher at all; the chat opens only via the #support URL command
export type TChatwootLauncher = 'native' | 'none' | 'page';

export interface IChatwootEnv {
    baseUrl?: string;
    websiteToken?: string;
    hmacSecret?: string;
    position?: string;
    launcherTitle?: string;
    launcher?: string;
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
    // Chatwoot only shows launcherTitle in its 'expanded_bubble' launcher.
    type: 'expanded_bubble' | 'standard';
    launcher: TChatwootLauncher;
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

export function resolveChatwootLauncher(raw: string | undefined): TChatwootLauncher {
    const value = raw?.trim().toLowerCase();
    return value === 'native' || value === 'none' ? value : 'page';
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
    const launcher = resolveChatwootLauncher(env.launcher);
    const launcherTitle = (env.launcherTitle ?? '').trim();
    const settings: IChatwootSettings = {
        position: resolveChatwootPosition(env.position),
        launcherTitle,
        type: launcherTitle ? 'expanded_bubble' : 'standard',
        launcher,
        hideMessageBubble: launcher !== 'native',
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
