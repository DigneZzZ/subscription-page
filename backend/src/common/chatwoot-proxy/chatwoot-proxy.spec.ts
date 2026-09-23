import { AddressInfo, Socket } from 'node:net';
import express from 'express';
import http from 'node:http';

import { createChatwootProxy, isChatwootProxiedPath } from './chatwoot-proxy';

interface ISeen {
    cookie?: string;
    host?: string;
    method: string;
    url: string;
}

const listen = (server: http.Server): Promise<number> =>
    new Promise((resolve) =>
        server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port)),
    );

const get = (
    port: number,
    path: string,
    headers: Record<string, string> = {},
): Promise<{ body: string; status: number }> =>
    new Promise((resolve, reject) => {
        http.get({ host: '127.0.0.1', port, path, headers }, (res) => {
            let body = '';
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
        }).on('error', reject);
    });

describe('isChatwootProxiedPath', () => {
    it('matches the widget, its assets, API and websocket', () => {
        for (const p of [
            '/packs/js/sdk.js',
            '/widget',
            '/widget/',
            '/vite/assets/widget-abc.js',
            '/api/v1/widget/contact',
            '/cable',
            '/rails/active_storage/blobs/x',
            '/brand-assets/logo.svg',
            '/audio/ding.mp3',
        ]) {
            expect(isChatwootProxiedPath(p)).toBe(true);
        }
    });
    it('leaves the subscription page routes alone', () => {
        for (const p of [
            '/',
            '/abc123',
            '/api/pay',
            '/api/pay/reset',
            '/api/devices/status',
            '/assets/index.js',
            '/widgets',
            '/cables',
            '/packsy',
        ]) {
            expect(isChatwootProxiedPath(p)).toBe(false);
        }
    });
});

describe('createChatwootProxy', () => {
    it('returns null when disabled or without an upstream', () => {
        expect(createChatwootProxy({ enabled: false, upstream: 'https://cw.example' })).toBeNull();
        expect(createChatwootProxy({ enabled: true, upstream: undefined })).toBeNull();
        expect(createChatwootProxy({ enabled: true, upstream: '' })).toBeNull();
    });

    describe('with a live upstream', () => {
        const seen: ISeen[] = [];
        let upstream: http.Server;
        let app: http.Server;
        let port: number;

        beforeAll(async () => {
            upstream = http.createServer((req, res) => {
                seen.push({
                    method: req.method ?? '',
                    url: req.url ?? '',
                    host: req.headers.host,
                    cookie: req.headers.cookie,
                });
                res.setHeader('content-type', 'text/plain');
                res.end(`upstream:${req.url}`);
            });
            const upstreamPort = await listen(upstream);

            const proxy = createChatwootProxy({
                enabled: true,
                upstream: `http://127.0.0.1:${upstreamPort}/`,
            });
            const server = express();
            server.use(proxy!.middleware);
            server.get('/api/pay', (_req, res) => res.send('own-pay'));
            server.get('/:shortUuid', (req, res) => res.send(`page:${req.params.shortUuid}`));
            app = http.createServer(server);
            port = await listen(app);
        });

        afterAll(async () => {
            await new Promise((r) => app.close(r));
            await new Promise((r) => upstream.close(r));
        });

        beforeEach(() => {
            seen.length = 0;
        });

        it('forwards widget paths with query string and the upstream Host header', async () => {
            const res = await get(port, '/widget?website_token=abc&locale=ru');
            expect(res.status).toBe(200);
            expect(res.body).toBe('upstream:/widget?website_token=abc&locale=ru');
            expect(seen[0].host).toMatch(/^127\.0\.0\.1:\d+$/);
        });

        it('forwards the SDK loader and widget API', async () => {
            expect((await get(port, '/packs/js/sdk.js')).body).toBe('upstream:/packs/js/sdk.js');
            expect((await get(port, '/api/v1/widget/contact?website_token=x')).body).toBe(
                'upstream:/api/v1/widget/contact?website_token=x',
            );
        });

        it('strips the subscription session cookie but keeps Chatwoot cookies', async () => {
            await get(port, '/api/v1/widget/messages', {
                cookie: 'session=jwt-secret; cw_conversation=abc; _chatwoot_session=def',
            });
            expect(seen[0].cookie).toBe('cw_conversation=abc; _chatwoot_session=def');
        });

        it('drops the cookie header entirely when only the session cookie is present', async () => {
            await get(port, '/api/v1/widget/messages', { cookie: 'session=jwt-secret' });
            expect(seen[0].cookie).toBeUndefined();
        });

        it('lets the page routes through untouched', async () => {
            expect((await get(port, '/api/pay')).body).toBe('own-pay');
            expect((await get(port, '/abc123')).body).toBe('page:abc123');
            expect(seen).toHaveLength(0);
        });

        it('relays websocket upgrades on /cable to the upstream', async () => {
            // Minimal upgrade handshake without a websocket library: the upstream
            // answers 101 and echoes the first bytes it receives.
            const wsUpstream = http.createServer();
            // Upgraded sockets leave http.Server's connection tracking, so keep
            // them to destroy explicitly; otherwise close() waits forever.
            const upstreamSockets: Socket[] = [];
            wsUpstream.on('upgrade', (req, socket) => {
                upstreamSockets.push(socket as Socket);
                seen.push({ method: 'UPGRADE', url: req.url ?? '', cookie: req.headers.cookie });
                socket.write(
                    'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n',
                );
                socket.on('data', (chunk) => socket.write(chunk));
            });
            const wsUpstreamPort = await listen(wsUpstream);
            const proxy = createChatwootProxy({
                enabled: true,
                upstream: `http://127.0.0.1:${wsUpstreamPort}`,
            })!;
            const server = http.createServer(express().use(proxy.middleware));
            server.on('upgrade', proxy.upgrade);
            const serverPort = await listen(server);

            const echoed = await new Promise<string>((resolve, reject) => {
                const req = http.request({
                    host: '127.0.0.1',
                    port: serverPort,
                    path: '/cable',
                    headers: {
                        connection: 'Upgrade',
                        upgrade: 'websocket',
                        'sec-websocket-version': '13',
                        'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
                        cookie: 'session=jwt-secret; cw_conversation=abc',
                    },
                });
                req.on('upgrade', (_res, socket) => {
                    socket.once('data', (chunk) => {
                        socket.destroy();
                        resolve(chunk.toString());
                    });
                    socket.write('ping');
                });
                req.on('error', reject);
                req.end();
            });

            expect(echoed).toBe('ping');
            expect(seen[0]).toEqual({
                method: 'UPGRADE',
                url: '/cable',
                cookie: 'cw_conversation=abc',
            });

            upstreamSockets.forEach((socket) => socket.destroy());
            server.closeAllConnections();
            await new Promise((r) => server.close(r));
            await new Promise((r) => wsUpstream.close(r));
        });
    });

    it('answers 502 when the upstream is unreachable', async () => {
        const proxy = createChatwootProxy({ enabled: true, upstream: 'http://127.0.0.1:1' });
        const server = express();
        server.use(proxy!.middleware);
        const app = http.createServer(server);
        const port = await listen(app);
        const res = await get(port, '/packs/js/sdk.js');
        await new Promise((r) => app.close(r));
        expect(res.status).toBe(502);
    });
});
