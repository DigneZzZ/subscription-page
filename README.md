## Remnawave Subscription Page

Learn more about Remnawave [here](https://remna.st/).

## Appearance presets

Configure the theme and layout via environment variables:

| Variable | Options | Default | Description |
|----------|---------|---------|-------------|
| `THEME_PRESET` | 1–12 | 9 | Color theme: 1 Graphite+Amber, 2 Midnight+Gold, 3 Graphite+Copper, 4 Rose Gold, 5 Graphite+Wine, 6 Obsidian+Platinum, 7 Neon/Cyber, 8 Light Minimal, 9 Emerald Night, 10 Deep Sapphire, 11 Ruby Noir, 12 Lavender Dusk |
| `LAYOUT_PRESET` | a\|b\|c\|e\|f\|j\|k\|l\|o | o | Page layout: a=classic, b=hero, c=columns, e=tiles, f=banner, j=aurora (animated glass), k=network (node map), l=billboard (poster type), o=obsidian (crystal, subscription and multi-app setup) |
| `PREVIEW` | 0\|1 | 0 | Show on-page design picker (theme/layout switcher); selection not persisted |
| `HEADER_PAY_BUTTON` | 0\|1 | 1 | Header Pay button; hide (0) when a layout's own Renew CTA is enough (classic has no own CTA — keep 1) |
| `EFFECTS` | csv\|all\|none | none | Visual effects on any layout: blobs, glass, shimmer, pulse, glow (respects prefers-reduced-motion) |

**Note:** Layouts other than `classic` render their own subscription summary; `uiConfig.subscriptionInfoBlockType` applies to `classic` only.

## Health check

The container ships a `HEALTHCHECK` that performs a TCP connect to `APP_PORT` on
loopback, so `docker ps` and orchestrators report liveness correctly.

An HTTP probe cannot be used for this. The application deliberately destroys the
socket instead of returning a status for unauthorised or unknown requests -- a
request without `X-Forwarded-For` and `X-Forwarded-Proto: https`, or for a
subscription the panel does not know, receives no response at all. That is
intentional, but it means a reverse proxy or monitoring script sees the same
empty reply whether the service is healthy or broken.

The liveness contract is therefore:

| observation | meaning |
| --- | --- |
| connection refused | service is down |
| connection accepted, then closed with no response | service is up, request was rejected |
| HTTP response | service is up, request was accepted |

# Contributors

Check [open issues](https://github.com/remnawave/subscription-page/issues) to help the progress of this project.

<p align="center">
Thanks to the all contributors who have helped improve Remnawave:
</p>
<p align="center">
<a href="https://github.com/remnawave/subscription-page/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=remnawave/subscription-page" />
</a>
</p>

## Obsidian design

The default appearance is now `THEME_PRESET=9` + `LAYOUT_PRESET=o` (or `obsidian`). Explicit existing environment presets still take precedence; change those two variables and restart to enable the redesign on an existing deployment. Obsidian keeps its payment CTA in the subscription card and omits the duplicate header payment button. Payment is only shown when a URL or tariffs are configured. Devices and traffic-reset actions retain their existing conditions and API flows.

The installation guide lists devices first, then all apps configured for that device. Set `featured: true` on **each** recommended app in the existing v2 config's `platforms.<platform>.apps` array. Multiple recommendations are supported; featured apps come first, preserving their configuration order. Each app keeps its own `blocks`, download buttons and import links. Changing devices selects that device's first recommended app. No schema migration or hardcoded production app list is needed.

Assets live in `frontend/src/assets/geolog`: transparent responsive WebP crystals, a background plate and the fallback vector mark. Vite bundles them locally; no image CDN is required. Motion respects reduced-motion preferences. The crystal uses lightweight 2D movement, not a 3D engine.

### Local verification

Run `npm run typecheck` and `npm run cb` in `frontend`, then `node tests/preview-server.mjs`. This serves the built page at `http://127.0.0.1:3335` with synthetic data and multiple recommended apps, without calling a real panel or payment provider. The preview binds only to loopback, and its mock API rejects payments and device mutations. Query options include `?scenario=single`, `empty`, `unlimited`, `expired`, `many`, `no-payment`, `?layout=classic`, and `?lang=en`.

Run the automated browser checks with `cd frontend && npm run test:ui`. The test configuration uses Google Chrome (`npx playwright install chrome` if it is not installed). Obsidian renders configured instruction blocks as responsive steps; other layouts continue to use `installationGuidesBlockType`. Preview tariffs and app links are synthetic fixtures, not production settings.
