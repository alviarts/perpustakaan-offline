"""Lucide icon helper — load PNG monochrome dari ``assets/icons/lucide/``
dan recolor di runtime sesuai theme aktif.

Pemakaian:
    from perpustakaan.gui.icons import lucide_icon
    btn = ctk.CTkButton(parent, image=lucide_icon("plus", size=16))

Default color otomatis ikut design token (light/dark mode aware) — kalau mau
override, pass ``color=("#hex_light", "#hex_dark")`` atau single string.

Caching: hasil render di-cache by (name, size, color_light, color_dark) tuple
supaya tidak re-process tiap call.

Fallback: kalau icon tidak ada di disk, return ``None`` dan log warning —
caller harus handle (biasanya pakai text-only button).

Pre-rendering: PNG di-bundle 96px monochrome black on transparent.
``scripts/fetch_lucide_icons.py`` regenerate dari Lucide GitHub source.
"""
from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path

import customtkinter as ctk
from PIL import Image

from perpustakaan.config import ASSETS_DIR
from perpustakaan.gui.design_tokens import COLOR

_log = logging.getLogger("perpustakaan.gui.icons")

ICON_DIR: Path = ASSETS_DIR / "icons" / "lucide"

ColorSpec = str | tuple[str, str]


def _resolve_color(color: ColorSpec | None) -> tuple[str, str]:
    """Normalisasi color spec menjadi tuple ``(light, dark)``."""
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


def _colorize_png(src_path: Path, size: int, hex_color: str) -> Image.Image:
    """Load PNG monochrome (black + alpha), recolor jadi ``hex_color``."""
    img = Image.open(src_path).convert("RGBA")
    if img.size != (size, size):
        img = img.resize((size, size), Image.Resampling.LANCZOS)
    rgb = _hex_to_rgb(hex_color)
    # Buat layer warna solid di seluruh canvas, lalu apply alpha mask dari
    # PNG asli — hasilnya icon tetap monochrome dengan warna baru, sharp
    # edges + smooth anti-alias terjaga.
    alpha = img.split()[3]
    coloured = Image.new("RGBA", img.size, rgb + (0,))
    coloured.putalpha(alpha)
    return coloured


@lru_cache(maxsize=256)
def _build_image(
    name: str, size: int, color_light: str, color_dark: str
) -> ctk.CTkImage | None:
    src = ICON_DIR / f"{name}.png"
    if not src.exists():
        _log.warning("lucide icon tidak ditemukan: %s (cari di %s)", name, src)
        return None
    try:
        light_img = _colorize_png(src, size, color_light)
        dark_img = _colorize_png(src, size, color_dark)
    except Exception as exc:  # noqa: BLE001
        _log.warning("gagal render icon %s: %s", name, exc)
        return None
    return ctk.CTkImage(light_image=light_img, dark_image=dark_img, size=(size, size))


def lucide_icon(
    name: str, size: int = 20, color: ColorSpec | None = None
) -> ctk.CTkImage | None:
    """Return CTkImage untuk Lucide icon, atau ``None`` kalau tidak ada.

    Args:
        name: nama icon Lucide tanpa ``.svg`` (mis. ``"users"``, ``"plus"``).
            Lihat ``scripts/fetch_lucide_icons.py`` untuk daftar yang sudah
            di-bundle, atau jalankan script itu untuk download icon baru.
        size: ukuran final dalam pixel — pakai konstanta dari
            :data:`perpustakaan.gui.design_tokens.ICON_SIZE` (sm=16, md=20,
            lg=24, dst.) supaya konsisten di seluruh app.
        color: warna icon. Kalau ``None``, pakai ``COLOR.icon`` (light/dark
            theme-aware). Kalau string, dipakai untuk kedua mode. Kalau
            tuple ``(light, dark)``, sesuai mode aktif.
    """
    cl, cd = _resolve_color(color)
    return _build_image(name, size, cl, cd)


def available_icons() -> list[str]:
    """List nama icon yang tersedia di disk (utk debugging / dev)."""
    if not ICON_DIR.exists():
        return []
    return sorted(p.stem for p in ICON_DIR.glob("*.png"))


__all__ = ["lucide_icon", "available_icons", "ICON_DIR"]
