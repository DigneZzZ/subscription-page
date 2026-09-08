# Geolog visual assets

Created for the approved Obsidian/Emerald redesign using built-in image generation. The original PNGs and generation prompts are in the Geolog asset pack delivered alongside the design; these are lightweight production exports.

- `crystal-384.webp`, `crystal-640.webp`, `crystal-960.webp`: same crystal in three resolutions, with a real alpha channel.
- `obsidian-background-1600.webp`: separate subdued background layer.
- `mark.svg`: simplified vector crystal for the header when no custom logo is configured.

Images are imported by Vite and served locally. The crystal is decorative (empty alt) and uses CSS movement with a reduced-motion alternative. No 3D model or external image service is required at runtime. Retain configured platform/app SVGs from the app config; this set does not replace them.
