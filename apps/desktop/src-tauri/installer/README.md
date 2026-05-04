# Windows installer artwork

Source SVGs and a regen script for the four bitmaps that the Tauri Windows
bundler embeds into the NSIS `.exe` and WiX `.msi` installers.

## Why per-aspect-ratio sources

The bitmaps live in four very different aspect ratios:

| File | Resolution | Aspect | Used in |
|---|---|---|---|
| `sources/nsis-sidebar.svg` | 164 × 314 | 0.52 (tall) | NSIS Welcome / Finish sidebar |
| `sources/nsis-header.svg` | 150 × 57 | 2.63 | NSIS in-progress header |
| `sources/wix-banner.svg` | 493 × 58 | 8.50 (very wide) | MSI top banner |
| `sources/wix-dialog.svg` | 493 × 312 | 1.58 | MSI dialog background |

Up to v1.0.2 every bitmap was exported by stretching the square 1024 × 1024
`icons/source/logo.svg` into each ratio. That produced a recognisable
sidebar but a heavily distorted WiX banner (book becomes ~8× wider than
tall, sun ornament squished into a slit). v1.0.3 replaces the single
square source with four native sources, each laid out for its own canvas.

## Regenerating

```sh
sudo apt-get install -y librsvg2-bin imagemagick   # one-off
apps/desktop/src-tauri/installer/regen-bmps.sh
```

The script writes 24-bit BMP3 outputs into
`apps/desktop/src-tauri/icons/source/`, which is the path the Tauri config
in `tauri.conf.json` (`bundle.windows.wix.bannerPath` etc.) already points
at. After regenerating, commit both the SVG source change and the rebuilt
BMP.

## Editing the artwork

* Keep the brand palette: blue gradient `#1d4ed8` → `#0b1e3f`, sun mark
  `#fbbf24` → `#f59e0b`, page tone `#fefefe` → `#cbd5e1`.
* The NSIS / WiX renderers accept only 24-bit BMP3 with no alpha; the
  regen script enforces that with `convert -alpha remove -alpha off
  -type TrueColor BMP3:`.
* If you change resolution, update both the `<svg width/height>` and the
  matching row in `regen-bmps.sh` `TARGETS=`. The script asserts the
  output dimensions match before exiting.
* Fonts are referenced by name (Segoe UI / Arial fallback) so the SVG
  renders correctly on any developer machine that has those fonts. Do
  not embed bitmap font glyphs.
