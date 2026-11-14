# Frost assets

- `onest-*.woff2`: local Onest font subsets.
- `happ.jpg` and `incy.jpg`: VPN client icons.
- `mark.svg`: a neutral fallback icon, used only when no brand logo is configured.

Brand names, support contacts and connection links come from the application's
configuration and current subscription. No third-party account data is embedded
in this layout.

Select the layout with `LAYOUT_PRESET=frost`. Existing layout defaults remain
unchanged. For a local preview, build the frontend and run
`node tests/preview-server.mjs` from `frontend`, then open
`http://127.0.0.1:3335/?layout=frost`.

All twelve existing `THEME_PRESET` palettes apply to the layout and its dialogs.
Glass surfaces use the preset's background and paired foreground colors. Controls
follow the shadcn/ui semantic token roles. QR codes retain their high contrast
background for scanning. Browsers without backdrop blur, or with reduced
transparency enabled, use opaque surfaces from the same palette.

The shop is shown only when the backend supplies subscription tariffs through a
configured payment provider or SHM. An external payment URL keeps the renewal
action available without displaying an empty catalog.

Device management opens the existing flow, including optional Telegram
verification and bulk removal. The inline device list refreshes when that flow
closes. Traffic reset uses the existing threshold and confirmation rules; SHM
calculates its own reset price.
