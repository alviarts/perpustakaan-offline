"""Phosphor Icon (Fill variant) helper — render TTF glyph ke CTkImage.

Phosphor Icons (https://phosphoricons.com) adalah icon family open-source
(MIT) dengan 1248 icon di 6 weight. Kita bundle hanya **Fill** weight
(449 KB TTF) untuk **primary CTA** supaya hierarki visual jelas:

* Sidebar/header subtle: Lucide (existing, monoweight)
* Primary CTA (Save / Add / Print / Delete / Search): Phosphor Fill

Pemakaian::

    from perpustakaan.gui.phosphor import phosphor_icon

    btn = ctk.CTkButton(parent, image=phosphor_icon("plus", size=20))

Caching: hasil render di-cache by ``(name, size, color_light, color_dark)``
tuple via ``lru_cache`` supaya tidak re-render tiap call.

Fallback: kalau TTF / glyph tidak ada, return ``None`` dan log warning.
Caller bisa fallback ke ``lucide_icon`` atau text-only.

Dependencies: pure Pillow (sudah ada di project), tidak butuh fontTools.
PIL ``ImageFont.truetype`` cukup untuk render glyph dari Unicode codepoint.
"""
from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont

from perpustakaan.config import ASSETS_DIR
from perpustakaan.gui.design_tokens import COLOR

_log = logging.getLogger("perpustakaan.gui.phosphor")

FONT_PATH: Path = ASSETS_DIR / "fonts" / "Phosphor-Fill.ttf"

ColorSpec = str | tuple[str, str]


# ---------------------------------------------------------------------------
# Icon name -> Unicode codepoint mapping (extracted dari style.css Phosphor v2.1.0)
#
# Untuk menambahkan icon baru: ambil codepoint dari
# https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.0/src/fill/style.css
# Contoh: ``.ph-fill.ph-foo:before { content: "\e123"; }`` -> ``"foo": 0xe123``
# ---------------------------------------------------------------------------
ICON_CODEPOINTS: dict[str, int] = {
    "arrow-circle-up": 0xE030,
    "arrow-left": 0xE058,
    "arrow-right": 0xE06C,
    "bell": 0xE0CE,
    "book": 0xE0E2,
    "book-open": 0xE0E6,
    "bookmark": 0xE0E8,
    "calendar": 0xE108,
    "caret-down": 0xE136,
    "caret-left": 0xE138,
    "caret-right": 0xE13A,
    "caret-up": 0xE13C,
    "chart-bar": 0xE150,
    "chart-donut": 0xEAA6,
    "chart-line": 0xE154,
    "chart-pie": 0xE158,
    "chats-circle": 0xE17E,
    "check": 0xE182,
    "clipboard-text": 0xE198,
    "clock": 0xE19A,
    "cloud-arrow-down": 0xE1AC,
    "cloud-arrow-up": 0xE1AE,
    "copy": 0xE1CA,
    "database": 0xE1DE,
    "download": 0xE20A,
    "envelope": 0xE214,
    "export": 0xEAF0,
    "eye": 0xE220,
    "eye-slash": 0xE224,
    "file": 0xE230,
    "files": 0xE710,
    "floppy-disk": 0xE248,
    "folder": 0xE24A,
    "funnel": 0xE266,
    "gauge": 0xE628,
    "gear": 0xE270,
    "globe": 0xE288,
    "heart": 0xE2A8,
    "house": 0xE2C2,
    "info": 0xE2CE,
    "key": 0xE2D6,
    "lock": 0xE2FA,
    "magnifying-glass": 0xE30C,
    "moon": 0xE330,
    "paint-brush": 0xE6F0,
    "palette": 0xE6C8,
    "pencil": 0xE3AE,
    "plus": 0xE3D4,
    "printer": 0xE3DC,
    "question": 0xE3E8,
    "sign-in": 0xE428,
    "sign-out": 0xE42A,
    "sliders": 0xE432,
    "star": 0xE46A,
    "sun": 0xE472,
    "tag": 0xE478,
    "trash": 0xE4A6,
    "upload": 0xE4BE,
    "user": 0xE4C2,
    "users": 0xE4D6,
    "users-three": 0xE68E,
    "warning": 0xE4E0,
    "warning-circle": 0xE4E2,
    "warning-octagon": 0xE4E4,
    "x": 0xE4F6,
    "x-circle": 0xE4F8,
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _resolve_color(color: ColorSpec | None) -> tuple[str, str]:
    """Normalisasi color spec ke ``(light, dark)`` tuple."""
    if color is None:
        return COLOR.icon
    if isinstance(color, str):
        return (color, color)
    return color


def _hex_to_rgb(hex_str: str) -> tuple[int, int, int]:
    h = hex_str.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def _render_glyph(codepoint: int, size: int, hex_color: str) -> Image.Image:
    """Render satu Phosphor glyph ke RGBA Image dengan warna ``hex_color``.

    Strategy: load TTF dengan size = icon size, draw glyph putih di canvas
    transparan, lalu replace channel RGB dengan warna target (sambil
    pertahankan alpha). Hasil: anti-aliased, sharp edges.
    """
    font = ImageFont.truetype(str(FONT_PATH), size=size)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    char = chr(codepoint)

    # Bbox glyph supaya bisa center horizontally + vertically
    bbox = draw.textbbox((0, 0), char, font=font)
    glyph_w = bbox[2] - bbox[0]
    glyph_h = bbox[3] - bbox[1]
    x = (size - glyph_w) // 2 - bbox[0]
    y = (size - glyph_h) // 2 - bbox[1]
    draw.text((x, y), char, font=font, fill=(255, 255, 255, 255))

    # Recolor: ambil alpha mask, fill dengan target color
    alpha = canvas.split()[3]
    rgb = _hex_to_rgb(hex_color)
    coloured = Image.new("RGBA", canvas.size, (*rgb, 0))
    coloured.putalpha(alpha)
    return coloured


@lru_cache(maxsize=256)
def _build_image(
    name: str, size: int, color_light: str, color_dark: str
) -> Any:
    """Build CTkImage untuk Phosphor icon dengan caching.

    Lazy import customtkinter supaya module bisa di-test di env tanpa Tk.
    """
    if not FONT_PATH.exists():
        _log.warning("Phosphor TTF tidak ditemukan: %s", FONT_PATH)
        return None
    cp = ICON_CODEPOINTS.get(name)
    if cp is None:
        _log.warning("Phosphor icon name tidak terdaftar: %s", name)
        return None
    try:
        # Render @ 4x supaya sharp setelah di-downscale ke target size,
        # lalu thumbnail. ImageFont sudah anti-alias jadi 1x juga OK,
        # tapi 2x kasih extra crisp di high-DPI.
        render_size = max(size * 2, 64)
        light_img = _render_glyph(cp, render_size, color_light).resize(
            (size, size), Image.Resampling.LANCZOS
        )
        dark_img = _render_glyph(cp, render_size, color_dark).resize(
            (size, size), Image.Resampling.LANCZOS
        )
    except Exception as exc:  # noqa: BLE001
        _log.warning("Phosphor render gagal untuk %s: %s", name, exc)
        return None

    try:
        import customtkinter as ctk  # noqa: PLC0415

        return ctk.CTkImage(
            light_image=light_img, dark_image=dark_img, size=(size, size)
        )
    except Exception:  # noqa: BLE001
        return None


def phosphor_icon(
    name: str, size: int = 20, color: ColorSpec | None = None
) -> Any:
    """Return ``CTkImage`` Phosphor Fill icon.

    Args:
        name: nama icon (lihat ``ICON_CODEPOINTS`` keys atau
            https://phosphoricons.com — cari yang weight = Fill).
        size: ukuran square dalam pixel.
        color: ``"#hex"`` atau ``("light", "dark")``. ``None`` pakai
            :data:`COLOR.icon` (theme-aware).

    Return ``None`` kalau TTF / nama tidak available.
    """
    light, dark = _resolve_color(color)
    return _build_image(name, size, light, dark)


def available_icons() -> list[str]:
    """List icon name yang ter-bundle di mapping (untuk debug)."""
    return sorted(ICON_CODEPOINTS.keys())
