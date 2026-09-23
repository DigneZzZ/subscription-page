import { createProxyMiddleware, RequestHandler } from 'http-proxy-middleware';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Duplex } from 'node:stream';
import { Socket } from 'node:net';

import { Logger } from '@nestjs/common';

/**
 * Same-origin relay for the Chatwoot live-chat widget (CHATWOOT_PROXY=1).
 *
 * Some subscribers sit behind DNS filters or ad blockers that drop the Chatwoot
 * host entirely. With the proxy on, the browser only ever talks to the
 * subscription page origin: the SDK loader, the widget iframe, its assets, the
 * widget REST API and the ActionCable websocket are all forwarded to one fixed
 * upstream. Only the prefixes below are relayed, so this is not an open proxy,
 * and none of them overlap the page's own routes (/api/pay, /api/devices,
 * /assets, /:shortUuid).
 */
const PREFIXES = [
    '/packs/', // sdk.js loader
    '/vite/', // widget JS/CSS bundles
    '/api/v1/widget/', // widget REST API
    '/rails/active_storage/', // attachments, avatars
    '/brand-assets/', // logos
    '/audio/', // notification sounds
];
const EXACT = ['/widget', '/cable'];

// Cookie the page sets for its own API; must never reach Chatwoot.
const OWN_COOKIES = new Set(['session']);

export interface IChatwootProxyOptions {
    enabled: boolean;
    upstream: string | undefined;
}

export interface IChatwootProxy {
    middleware: RequestHandler;
    // Matches http.Server's 'upgrade' listener signature.
    upgrade: (req: IncomingMessage, socket: Duplex, head: Buffer) => void;
}

export function isChatwootProxiedPath(pathname: string): boolean {
    return (
        EXACT.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
        PREFIXES.some((p) => pathname.startsWith(p))
    );
}

export function stripOwnCookies(header: string | undefined): string | undefined {
    if (!header) return undefined;
    const kept = header
        .split(';')
        .map((part) => part.trim())
        .filter((part) => part && !OWN_COOKIES.has(part.split('=')[0].trim()));
    return kept.length > 0 ? kept.join('; ') : undefined;
}

export function createChatwootProxy(options: IChatwootProxyOptions): IChatwootProxy | null {
    const upstream = (options.upstream ?? '').trim().replace(/\/+$/, '');
    if (!options.enabled || !upstream) return null;

    const logger = new Logger('ChatwootProxy');

    const middleware = createProxyMiddleware<IncomingMessage, ServerResponse>({
        target: upstream,
        changeOrigin: true,
        ws: true,
        xfwd: true,
        pathFilter: (pathname) => isChatwootProxiedPath(pathname),
        on: {
            proxyReq: (proxyReq, req) => {
                const cookie = stripOwnCookies(req.headers.cookie);
                if (cookie) proxyReq.setHeader('cookie', cookie);
                else proxyReq.removeHeader('cookie');
            },
            proxyReqWs: (proxyReq, req) => {
                const cookie = stripOwnCookies(req.headers.cookie);
                if (cookie) proxyReq.setHeader('cookie', cookie);
                else proxyReq.removeHeader('cookie');
            },
            error: (err, req, res) => {
                logger.warn(`Upstream error for ${req.url}: ${err.message}`);
                if (res instanceof ServerResponse && !res.headersSent) {
                    res.writeHead(502, { 'content-type': 'application/json' });
                    res.end(JSON.stringify({ error: 'chatwoot_upstream_unavailable' }));
                } else if (res instanceof Socket) {
                    res.destroy();
                }
            },
        },
    });

    logger.log(`Relaying Chatwoot widget traffic to ${upstream}`);

    return {
        middleware,
        upgrade: (req, socket, head) => middleware.upgrade(req, socket as Socket, head),
    };
}
