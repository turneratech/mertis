# Icon package

Everything is generated from one vector recreation of your pulse logo, so every size is crisp
(no upscaled blur). Small sizes (16–64 px) use a slightly bolder, simplified glyph so they stay legible.

## Folders

| Folder | What's inside |
|---|---|
| `logo/svg/` | `logo.svg` (tile), `mark.svg` (glyph only, dark bg), `mark-on-light.svg`, `mark-mono-white.svg`, `mark-mono-black.svg` |
| `logo/png/` | **Transparent** tile logo at 16, 20, 24, 29, 32, 40, 48, 57, 58, 60, 64, 72, 76, 80, 87, 96, 114, 120, 128, 144, 152, 167, 180, 192, 256, 384, 512, 1024, 2048 px |
| `mark/` | **Transparent** glyph-only PNGs (no tile) in 256/512/1024/2048: glowing (for dark bg), `on-light`, `white`, `black` |
| `favicon/` | `favicon.ico` (16/24/32/48/64), `favicon.svg`, PNG favicons, `apple-touch-icon.png`, Android/PWA icons incl. maskable, `safari-pinned-tab.svg`, Windows `mstile-*`, `site.webmanifest`, `browserconfig.xml` |
| `ios/` | App icon set (20 → 1024 px), opaque full-bleed as Apple requires |
| `android/` | `mipmap-*` launcher icons (square + round), adaptive-icon foreground/background layers, `ic_launcher.xml`, Play Store icon |
| `social/` | OG image, Twitter/X card + header, LinkedIn share + banner, GitHub social preview, YouTube banner, avatars |
| `product-page/` | Hero (dark/light, desktop/mobile), glow backgrounds, Play feature graphic, splash screens, App Store / Play Store icons |
| `head-snippet.html` | Ready-to-paste `<head>` tags |

## Notes

- **Transparent vs. opaque:** the logo PNGs, marks, Android "any" icons and Windows tiles are transparent
  (outside the rounded corners). iOS, Apple touch icon, maskable and store icons are intentionally **opaque** and
  full-bleed, because those platforms add their own mask/rounding and reject or black-fill transparency.
- **Text-free:** social and hero images contain no text, so you can add your product name in any design tool.
- Replace "Your App Name" in `site.webmanifest` and the placeholders in `head-snippet.html`.
- Brand colours: tile `#050B09`, green `#56E9AB → #2FDA95`, purple tip `#A78BFF`, teal echo `#3DBFB9`.
