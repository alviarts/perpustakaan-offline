"""Generate procedural animation frame sequences dengan Pillow (PR-V4b v0.6.1).

Tujuan: menghasilkan animasi UI yang \"hidup\" tanpa dependency Lottie atau
runtime SVG renderer. Pattern: setiap animasi adalah folder ``assets/animations/<name>/``
berisi frame_NN.png yang di-cycle widget :class:`AnimationPlayer` lewat
``after()``.

Animasi yang di-generate:

* ``loader_dots`` \u2014 8 dot circular yang fade-in/out berurutan (24 frame)
* ``success_check`` \u2014 checkmark drawing animation (15 frame)
* ``pulse_heart`` \u2014 heart yang scale 1.0 \u2192 1.15 \u2192 1.0 (10 frame)
* ``bounce_book`` \u2014 buku bouncing up/down dengan squash & stretch (12 frame)

Pemakaian::

    python scripts/gen_animations.py
    # \u2192 assets/animations/<name>/frame_NN.png

Idempotent: re-run akan overwrite frame existing.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from perpustakaan.gui.design_tokens import ILLUSTRATION  # noqa: E402

# ---------------------------------------------------------------------------
# Output config
# ---------------------------------------------------------------------------
OUT_ROOT = Path(__file__).resolve().parents[1] / "assets" / "animations"

# Palette
P = ILLUSTRATION.primary           # indigo-600
PS = ILLUSTRATION.primary_soft     # indigo-300
A = ILLUSTRATION.accent            # amber-500


def _hex_to_rgba(hex_str: str, alpha: int = 255) -> tuple[int, int, int, int]:
    h = hex_str.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), alpha)


def _ease_out_cubic(t: float) -> float:
    return 1.0 - (1.0 - t) ** 3


def _ease_in_out_cubic(t: float) -> float:
    return 4 * t * t * t if t < 0.5 else 1 - ((-2 * t + 2) ** 3) / 2


# ---------------------------------------------------------------------------
# loader_dots \u2014 8 circular dots, fade trailing
# ---------------------------------------------------------------------------
def make_loader_dots(*, size: int = 96, n_dots: int = 8, n_frames: int = 24) -> list[Image.Image]:
    """8 dot susun melingkar, dengan opacity sesuai sudut antara dot index
    dan frame index \u2014 effect rotating spinner."""
    frames: list[Image.Image] = []
    cx, cy = size // 2, size // 2
    radius = size * 0.32
    dot_radius = size * 0.08

    for f in range(n_frames):
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        for i in range(n_dots):
            angle = 2 * math.pi * i / n_dots
            x = cx + radius * math.cos(angle - math.pi / 2)
            y = cy + radius * math.sin(angle - math.pi / 2)
            # Distance dari leading dot (index = round(f / n_frames * n_dots))
            head = int(f * n_dots / n_frames)
            distance = (i - head) % n_dots
            # Fade berdasarkan posisi: leading bright, trailing dim
            alpha = max(40, int(255 * (1 - distance / n_dots) ** 1.5))
            draw.ellipse(
                (x - dot_radius, y - dot_radius, x + dot_radius, y + dot_radius),
                fill=_hex_to_rgba(P, alpha),
            )
        frames.append(img)
    return frames


# ---------------------------------------------------------------------------
# success_check \u2014 checkmark drawing animation
# ---------------------------------------------------------------------------
def make_success_check(*, size: int = 128, n_frames: int = 15) -> list[Image.Image]:
    """Lingkaran fill-in lalu checkmark drawn dengan ease-out cubic.

    Frame 0..5: lingkaran fill bertahap dari 0% \u2192 100% area
    Frame 6..14: checkmark stroke drawn progressively
    """
    frames: list[Image.Image] = []
    cx, cy = size // 2, size // 2
    circle_radius = size * 0.4
    stroke_w = max(4, size // 16)

    # Path checkmark: 3 titik (start, knee, end)
    p1 = (cx - circle_radius * 0.45, cy + circle_radius * 0.05)
    p2 = (cx - circle_radius * 0.10, cy + circle_radius * 0.40)
    p3 = (cx + circle_radius * 0.50, cy - circle_radius * 0.30)

    color_circle = _hex_to_rgba("#16a34a")  # green-600
    color_check = (255, 255, 255, 255)

    n_circle = 6
    n_check = n_frames - n_circle

    for f in range(n_frames):
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        if f < n_circle:
            # Lingkaran tumbuh: scale dari 0 \u2192 1
            t = _ease_out_cubic((f + 1) / n_circle)
            r = circle_radius * t
            draw.ellipse(
                (cx - r, cy - r, cx + r, cy + r),
                fill=color_circle,
            )
        else:
            # Lingkaran sudah penuh
            draw.ellipse(
                (cx - circle_radius, cy - circle_radius, cx + circle_radius, cy + circle_radius),
                fill=color_circle,
            )
            # Checkmark progress
            t = _ease_out_cubic((f - n_circle + 1) / n_check)
            # Stroke 1: p1 \u2192 p2 (50% pertama)
            # Stroke 2: p2 \u2192 p3 (50% kedua)
            if t <= 0.5:
                local_t = t * 2
                end_x = p1[0] + (p2[0] - p1[0]) * local_t
                end_y = p1[1] + (p2[1] - p1[1]) * local_t
                draw.line([p1, (end_x, end_y)], fill=color_check, width=stroke_w)
            else:
                draw.line([p1, p2], fill=color_check, width=stroke_w)
                local_t = (t - 0.5) * 2
                end_x = p2[0] + (p3[0] - p2[0]) * local_t
                end_y = p2[1] + (p3[1] - p2[1]) * local_t
                draw.line([p2, (end_x, end_y)], fill=color_check, width=stroke_w)
        frames.append(img)
    return frames


# ---------------------------------------------------------------------------
# pulse_heart \u2014 heart yang pulsing
# ---------------------------------------------------------------------------
def _draw_heart(draw: ImageDraw.ImageDraw, cx: float, cy: float, scale: float, color: tuple) -> None:
    """Draw heart shape via 2 circles + triangle."""
    # 2 lobus atas
    r = 18 * scale
    lobe_offset_x = 14 * scale
    lobe_offset_y = -4 * scale
    draw.ellipse(
        (cx - lobe_offset_x - r, cy + lobe_offset_y - r,
         cx - lobe_offset_x + r, cy + lobe_offset_y + r),
        fill=color,
    )
    draw.ellipse(
        (cx + lobe_offset_x - r, cy + lobe_offset_y - r,
         cx + lobe_offset_x + r, cy + lobe_offset_y + r),
        fill=color,
    )
    # Triangle bawah
    bottom_y = cy + 30 * scale
    side = 28 * scale
    draw.polygon(
        [
            (cx - side, cy + lobe_offset_y - 2),
            (cx + side, cy + lobe_offset_y - 2),
            (cx, bottom_y),
        ],
        fill=color,
    )


def make_pulse_heart(*, size: int = 96, n_frames: int = 10) -> list[Image.Image]:
    """Heart pulse 1.0 \u2192 1.15 \u2192 1.0 dengan ease-in-out."""
    frames: list[Image.Image] = []
    cx, cy = size // 2, size // 2
    color = _hex_to_rgba("#ef4444")  # red-500

    for f in range(n_frames):
        # Sine wave: 0 -> 1 -> 0 over n_frames
        progress = f / (n_frames - 1) if n_frames > 1 else 0.0
        # Map ke scale range
        t = math.sin(progress * math.pi)  # 0 → 1 → 0
        scale = 1.0 + 0.15 * t

        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        _draw_heart(draw, cx, cy, scale, color)
        frames.append(img)
    return frames


# ---------------------------------------------------------------------------
# bounce_book \u2014 book bouncing up/down with squash/stretch
# ---------------------------------------------------------------------------
def _draw_book(draw: ImageDraw.ImageDraw, cx: float, cy: float,
                width: float, height: float, color: tuple) -> None:
    """Draw simple book shape: rounded rectangle with spine line."""
    half_w = width / 2
    half_h = height / 2
    # Body
    draw.rounded_rectangle(
        (cx - half_w, cy - half_h, cx + half_w, cy + half_h),
        radius=int(min(width, height) * 0.08),
        fill=color,
    )
    # Spine line (kiri)
    spine_x = cx - half_w + width * 0.18
    draw.line(
        [(spine_x, cy - half_h + 6), (spine_x, cy + half_h - 6)],
        fill=(255, 255, 255, 200),
        width=max(2, int(width * 0.025)),
    )
    # Pages (3 horizontal lines kanan)
    for frac in (0.30, 0.50, 0.70):
        ly = cy - half_h + height * frac
        draw.line(
            [(cx - half_w + width * 0.30, ly), (cx + half_w - width * 0.10, ly)],
            fill=(255, 255, 255, 180),
            width=max(1, int(height * 0.02)),
        )


def make_bounce_book(*, size: int = 128, n_frames: int = 12) -> list[Image.Image]:
    """Buku bouncing up/down dengan squash di titik terendah & stretch di apex."""
    frames: list[Image.Image] = []
    cx = size // 2
    base_y = size * 0.65  # ground line
    book_w = size * 0.55
    book_h = size * 0.65
    color = _hex_to_rgba(P)

    for f in range(n_frames):
        # Cycle: 0 \u2192 1 \u2192 0 (full bounce cycle)
        progress = f / n_frames
        # Use cosine: dip at progress=0 (rest), peak at 0.25, etc — for simple bounce:
        # Actually do: sin(2*pi*progress) for up/down, with squash on bottom
        bounce_y_offset = -size * 0.18 * abs(math.sin(math.pi * progress))
        # Squash factor: at bottom (progress=0 or 1), squash a bit; at peak (0.5), stretch
        if progress < 0.05 or progress > 0.95:
            squash = 0.92  # slight squash
            stretch = 1.06
        elif 0.45 < progress < 0.55:
            squash = 1.10  # slight stretch up
            stretch = 0.94
        else:
            squash = 1.0
            stretch = 1.0

        scaled_w = book_w * stretch
        scaled_h = book_h * squash
        cy = base_y + bounce_y_offset
        # Anchor bottom: cy is bottom-of-book, so center y = cy - h/2
        center_y = cy - scaled_h / 2

        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        # Ground shadow (smaller when book is up)
        shadow_alpha = int(50 * (1 - abs(bounce_y_offset) / (size * 0.18 + 1)))
        shadow_w = book_w * (0.85 - 0.3 * abs(bounce_y_offset) / (size * 0.18 + 1))
        draw.ellipse(
            (cx - shadow_w / 2, base_y + book_h / 2 - 6,
             cx + shadow_w / 2, base_y + book_h / 2 + 6),
            fill=(15, 23, 42, shadow_alpha),
        )
        _draw_book(draw, cx, center_y, scaled_w, scaled_h, color)
        frames.append(img)
    return frames


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------
ANIMATIONS: dict[str, callable] = {
    "loader_dots": make_loader_dots,
    "success_check": make_success_check,
    "pulse_heart": make_pulse_heart,
    "bounce_book": make_bounce_book,
}


def write_animation(name: str, frames: list[Image.Image]) -> Path:
    """Tulis frame_NN.png ke ``assets/animations/<name>/``."""
    out_dir = OUT_ROOT / name
    out_dir.mkdir(parents=True, exist_ok=True)
    # Hapus frame existing yang lebih tinggi dari len(frames)
    for old in out_dir.glob("frame_*.png"):
        old.unlink()
    for i, img in enumerate(frames):
        img.save(out_dir / f"frame_{i:02d}.png", "PNG", optimize=True)
    return out_dir


def main() -> int:
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    print(f"Generating animations \u2192 {OUT_ROOT}")
    for name, gen in ANIMATIONS.items():
        frames = gen()
        out = write_animation(name, frames)
        print(f"  \u2713 {name}: {len(frames)} frame \u2192 {out.relative_to(OUT_ROOT.parent.parent)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
