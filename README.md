## Remnawave Subscription Page

Learn more about Remnawave [here](https://remna.st/).

## Appearance presets

Configure the theme and layout via environment variables:

| Variable | Options | Default | Description |
|----------|---------|---------|-------------|
| `THEME_PRESET` | 1–12 | 2 | Color theme: 1 Graphite+Amber, 2 Midnight+Gold, 3 Graphite+Copper, 4 Rose Gold, 5 Graphite+Wine, 6 Obsidian+Platinum, 7 Neon/Cyber, 8 Light Minimal, 9 Emerald Night, 10 Deep Sapphire, 11 Ruby Noir, 12 Lavender Dusk |
| `LAYOUT_PRESET` | a\|b\|c\|e\|f\|j\|k\|l | b | Page layout: a=classic, b=hero, c=columns, e=tiles, f=banner, j=aurora (animated glass), k=network (node map), l=billboard (poster type) |
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
