## Remnawave Subscription Page

Learn more about Remnawave [here](https://remna.st/).

## Appearance presets

Configure the theme and layout via environment variables:

| Variable | Options | Default | Description |
|----------|---------|---------|-------------|
| `THEME_PRESET` | 1–12 | 2 | Color theme: 1 Graphite+Amber, 2 Midnight+Gold, 3 Graphite+Copper, 4 Rose Gold, 5 Graphite+Wine, 6 Obsidian+Platinum, 7 Neon/Cyber, 8 Light Minimal, 9 Emerald Night, 10 Deep Sapphire, 11 Ruby Noir, 12 Lavender Dusk |
| `LAYOUT_PRESET` | a\|b\|c\|e\|f\|j | b | Page layout: a=classic, b=hero, c=columns, e=tiles, f=banner, j=aurora (animated glass) |
| `PREVIEW` | 0\|1 | 0 | Show on-page design picker (theme/layout switcher); selection not persisted |
| `HEADER_PAY_BUTTON` | 0\|1 | 1 | Header Pay button; hide (0) when a layout's own Renew CTA is enough (classic has no own CTA — keep 1) |
| `EFFECTS` | csv\|all\|none | none | Visual effects on any layout: blobs, glass, shimmer, pulse, glow (respects prefers-reduced-motion) |

**Note:** Layouts other than `classic` render their own subscription summary; `uiConfig.subscriptionInfoBlockType` applies to `classic` only.

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
