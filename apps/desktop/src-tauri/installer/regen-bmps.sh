#!/usr/bin/env bash
#
# Regenerate the four installer bitmaps (NSIS sidebar/header, WiX banner/dialog)
# from the per-aspect-ratio SVG sources in `sources/`.
#
# Each SVG is designed natively for its target resolution — DO NOT edit a
# single source and stretch it across all four ratios. The previous
# `logo.svg`-as-single-source pipeline is what produced the v1.0.2 distorted
# WiX banner that this script replaces.
#
# Requirements: rsvg-convert (librsvg2-bin) + ImageMagick (`convert`).
# On Debian/Ubuntu: `sudo apt-get install -y librsvg2-bin imagemagick`.
#
# Output:
#   ../icons/source/nsis-sidebar.bmp  (164 x 314)
#   ../icons/source/nsis-header.bmp   (150 x  57)
#   ../icons/source/wix-banner.bmp    (493 x  58)
#   ../icons/source/wix-dialog.bmp    (493 x 312)
#
# Tauri's NSIS / WiX bundlers expect 24-bit BMP3 with no alpha channel; the
# `BMP3:` prefix and the `-alpha remove -alpha off -type TrueColor` chain
# below produce exactly that.

set -euo pipefail

cd "$(dirname "$0")"
SOURCE_DIR="sources"
OUT_DIR="../icons/source"

declare -a TARGETS=(
  "nsis-sidebar 164 314"
  "nsis-header  150  57"
  "wix-banner   493  58"
  "wix-dialog   493 312"
)

mkdir -p "$OUT_DIR"

for entry in "${TARGETS[@]}"; do
  read -r name w h <<< "$entry"
  src="$SOURCE_DIR/$name.svg"
  out="$OUT_DIR/$name.bmp"
  tmp="$(mktemp --suffix=.png)"
  trap 'rm -f "$tmp"' EXIT

  if [ ! -f "$src" ]; then
    echo "missing source: $src" >&2
    exit 1
  fi

  echo "rendering $name (${w}x${h}) -> $out"
  rsvg-convert --width "$w" --height "$h" "$src" --output "$tmp"
  convert "$tmp" \
    -background "#0b1e3f" -alpha remove -alpha off \
    -type TrueColor -define bmp:format=bmp3 \
    "BMP3:$out"

  actual="$(identify -format '%wx%h' "$out")"
  if [ "$actual" != "${w}x${h}" ]; then
    echo "size mismatch for $out: expected ${w}x${h}, got $actual" >&2
    exit 1
  fi
done

echo "done. four BMPs regenerated."
