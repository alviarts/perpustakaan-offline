"""Pillow-based visual effects untuk UI \u2014 drop shadow + gradient (PR-V4a v0.6.0).

Tk tidak punya box-shadow / gradient native, jadi kita generate
PNG-in-memory pakai Pillow lalu wrap ke ``CTkImage``. Cocok untuk:

* **Drop shadow** lembut di belakang card / dialog Toplevel \u2014 hilangkan
  kesan "kotak datar" yang khas Tk.
* **Linear gradient** untuk background login screen, dashboard hero
  card, dll \u2014 kasih perspektif depth.

Hasil generator di-cache by parameter tuple (size, color, dll) supaya
re-render frame berikutnya gratis.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Any

from PIL import Image, ImageDraw, ImageFilter


# ---------------------------------------------------------------------------
# Color helpers (lokal, supaya effects.py tidak depend on animations.py)
# ---------------------------------------------------------------------------
def _hex_to_rgb(hex_str: str) -> tuple[int, int, int]:
    h = hex_str.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def _resolve_color(color: str | tuple[str, str]) -> str:
    """Pilih channel light / dark dari color spec CTk.

    Lazy-import ``customtkinter`` supaya module ini bisa di-import (& di-test)
    di environment tanpa Tk (mis. CI lint check di Python tanpa ``_tkinter``).
    """
    if isinstance(color, tuple):
        try:
            import customtkinter as ctk  # noqa: PLC0415

            mode = "dark" if ctk.get_appearance_mode().lower() == "dark" else "light"
        except Exception:  # noqa: BLE001 — fallback ke light kalau Tk tidak tersedia
            mode = "light"
        return color[1] if mode == "dark" else color[0]
    return color


def _ctk_image(pil: Image.Image) -> Any:
    """Wrap PIL.Image ke CTkImage. Lazy-import supaya module aman tanpa Tk."""
    import customtkinter as ctk  # noqa: PLC0415

    return ctk.CTkImage(light_image=pil, dark_image=pil, size=pil.size)


# ---------------------------------------------------------------------------
# Drop shadow generator
# ---------------------------------------------------------------------------
@lru_cache(maxsize=64)
def _make_drop_shadow_pil(
    width: int, height: int,
    radius: int, offset_y: int,
    blur: int, alpha: int,
    corner: int,
    color_rgb: tuple[int, int, int],
) -> Image.Image:
    """Generate PNG drop shadow di-cache by parameter tuple.

    Output ukuran ``(width + 2*blur, height + 2*blur + offset_y)``
    untuk memberi ruang blur bleed-out. Card aslinya akan di-place
    di atas image ini dengan offset internal ``(blur, blur)``.
    """
    pad = blur * 2
    canvas_w = width + pad
    canvas_h = height + pad + offset_y
    img = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Rounded rectangle untuk shadow shape.
    draw.rounded_rectangle(
        (blur, blur + offset_y, blur + width, blur + height + offset_y),
        radius=corner,
        fill=(*color_rgb, alpha),
    )
    # Apply Gaussian blur untuk soft shadow.
    return img.filter(ImageFilter.GaussianBlur(radius))


def make_drop_shadow(
    *,
    width: int,
    height: int,
    radius: int = 16,
    offset_y: int = 6,
    blur: int = 18,
    alpha: int = 28,
    corner_radius: int = 14,
    color: str | tuple[str, str] = ("#0f172a", "#000000"),
) -> Any:
    """Buat ``CTkImage`` drop shadow yang siap di-place di belakang card.

    Defaults dipilih untuk shadow lembut elevasi md (~Material elevation 4):
    offset 6px ke bawah, blur 18px, alpha 28/255 (~11% opacity), dan
    corner_radius 14 mengikuti :data:`design_tokens.RADIUS.lg` agar
    pas dengan card.
    """
    color_hex = _resolve_color(color)
    rgb = _hex_to_rgb(color_hex)
    pil = _make_drop_shadow_pil(
        width, height,
        max(1, radius), max(0, offset_y),
        max(1, blur), max(1, min(255, alpha)),
        max(0, corner_radius),
        rgb,
    )
    return _ctk_image(pil)


# ---------------------------------------------------------------------------
# Linear gradient generator
# ---------------------------------------------------------------------------
@lru_cache(maxsize=32)
def _make_linear_gradient_pil(
    width: int, height: int,
    rgb_from: tuple[int, int, int],
    rgb_to: tuple[int, int, int],
    angle_deg: int,
) -> Image.Image:
    """Generate gradient PNG sederhana dari 2 warna, sudut ``angle_deg``.

    angle_deg = 0: top \u2192 bottom (default)
    angle_deg = 90: left \u2192 right
    angle_deg = 45: top-left \u2192 bottom-right
    """
    import math

    img = Image.new("RGB", (width, height), rgb_from)
    pixels = img.load()
    if pixels is None:
        return img

    rad = math.radians(angle_deg)
    dx = math.sin(rad)
    dy = math.cos(rad)
    diag = abs(dx * width) + abs(dy * height)
    if diag <= 0:
        return img

    for y in range(height):
        for x in range(width):
            t = (x * dx + y * dy) / diag
            t = max(0.0, min(1.0, t))
            r = int(rgb_from[0] + (rgb_to[0] - rgb_from[0]) * t)
            g = int(rgb_from[1] + (rgb_to[1] - rgb_from[1]) * t)
            b = int(rgb_from[2] + (rgb_to[2] - rgb_from[2]) * t)
            pixels[x, y] = (r, g, b)
    return img


def make_linear_gradient(
    *,
    width: int,
    height: int,
    color_from: str | tuple[str, str],
    color_to: str | tuple[str, str],
    angle_deg: int = 0,
) -> Any:
    """Buat ``CTkImage`` gradient linear 2-warna.

    Pakai sebagai background CTkLabel via ``image=...``. Hasil di-cache
    sehingga panggilan ulang dengan parameter sama gratis.

    Untuk efek subtle "soft glow" gunakan dua warna yang dekat di palette
    indigo (mis. ``#eef2ff`` \u2192 ``#c7d2fe``). Untuk hero card pakai
    primary \u2192 primary_hover (``#4f46e5`` \u2192 ``#7c3aed``).
    """
    rgb_from = _hex_to_rgb(_resolve_color(color_from))
    rgb_to = _hex_to_rgb(_resolve_color(color_to))
    pil = _make_linear_gradient_pil(
        max(1, width), max(1, height),
        rgb_from, rgb_to,
        int(angle_deg) % 360,
    )
    return _ctk_image(pil)


# ---------------------------------------------------------------------------
# Radial gradient (subtle glow effect)
# ---------------------------------------------------------------------------
@lru_cache(maxsize=16)
def _make_radial_gradient_pil(
    width: int, height: int,
    rgb_center: tuple[int, int, int],
    rgb_outer: tuple[int, int, int],
    cx_pct: int, cy_pct: int,
    radius_pct: int,
) -> Image.Image:
    """Radial gradient dari ``rgb_center`` (di posisi cx/cy persen) ke
    ``rgb_outer``."""
    img = Image.new("RGB", (width, height), rgb_outer)
    pixels = img.load()
    if pixels is None:
        return img

    cx = width * cx_pct / 100.0
    cy = height * cy_pct / 100.0
    max_radius = max(width, height) * radius_pct / 100.0
    if max_radius <= 0:
        return img

    for y in range(height):
        for x in range(width):
            dx = x - cx
            dy = y - cy
            dist = (dx * dx + dy * dy) ** 0.5
            t = min(1.0, dist / max_radius)
            # Smooth ease-out untuk transisi center \u2192 outer
            t = t * t * (3.0 - 2.0 * t)
            r = int(rgb_center[0] + (rgb_outer[0] - rgb_center[0]) * t)
            g = int(rgb_center[1] + (rgb_outer[1] - rgb_center[1]) * t)
            b = int(rgb_center[2] + (rgb_outer[2] - rgb_center[2]) * t)
            pixels[x, y] = (r, g, b)
    return img


def make_radial_gradient(
    *,
    width: int,
    height: int,
    color_center: str | tuple[str, str],
    color_outer: str | tuple[str, str],
    center_x_pct: int = 75,
    center_y_pct: int = 25,
    radius_pct: int = 90,
) -> Any:
    """Buat ``CTkImage`` radial gradient \u2014 cocok untuk soft glow di
    pojok layar (defaults: center kanan-atas seperti spotlight)."""
    rgb_center = _hex_to_rgb(_resolve_color(color_center))
    rgb_outer = _hex_to_rgb(_resolve_color(color_outer))
    pil = _make_radial_gradient_pil(
        max(1, width), max(1, height),
        rgb_center, rgb_outer,
        max(0, min(100, int(center_x_pct))),
        max(0, min(100, int(center_y_pct))),
        max(1, min(200, int(radius_pct))),
    )
    return _ctk_image(pil)


# ---------------------------------------------------------------------------
# Cache invalidation (untuk test yang mau verify cache hit)
# ---------------------------------------------------------------------------
def clear_cache() -> None:
    """Hapus cache PIL hasil rendering. Dipakai test."""
    _make_drop_shadow_pil.cache_clear()
    _make_linear_gradient_pil.cache_clear()
    _make_radial_gradient_pil.cache_clear()


__all__ = [
    "clear_cache",
    "make_drop_shadow",
    "make_linear_gradient",
    "make_radial_gradient",
]
