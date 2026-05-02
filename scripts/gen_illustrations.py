"""Generate procedural empty-state illustrations dengan Pillow.

Tujuan: menghasilkan illustration set yang **konsisten** untuk EmptyState
widget tanpa perlu bundling asset eksternal (unDraw / Midjourney). Style
mengikuti master anchor design system v0.5.x:

* palette indigo (`#4f46e5` outline, `#a5b4fc` fill) + amber accent (`#f59e0b`)
* warm cream background (`#fef9f3`)
* outline 4px, geometric shapes, isometric front view
* dimensi 1024×640 px (8:5) — bisa di-thumbnail oleh loader

Pemakaian::

    python scripts/gen_illustrations.py
    # → assets/illustrations/*.png

Idempotent: re-run akan overwrite. Aman dipanggil sebagai bagian dari
build pipeline atau saat re-style.

Setiap illustration dibuat oleh fungsi ``draw_<name>(canvas)`` supaya bisa
di-test individu. Fungsi ``main()`` iterasi semua entries di ``ILLUSTRATIONS``.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

# Allow running as `python scripts/gen_illustrations.py` from repo root
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from perpustakaan.gui.design_tokens import ILLUSTRATION  # noqa: E402

# ---------------------------------------------------------------------------
# Canvas spec
# ---------------------------------------------------------------------------
W, H = 1024, 640
CENTER = (W // 2, H // 2)

# Stroke widths — dipakai konsisten di semua illustration
STROKE_THICK = 8        # main outline
STROKE_MED = 5          # secondary outline
STROKE_THIN = 3         # detail line

# Shorthand palette (dari design tokens)
P = ILLUSTRATION.primary           # #4f46e5 (indigo-600)
PS = ILLUSTRATION.primary_soft     # #a5b4fc (indigo-300)
A = ILLUSTRATION.accent            # #f59e0b (amber-500)
BG = ILLUSTRATION.bg_warm          # #fef9f3 (cream)
LINE = ILLUSTRATION.line           # #1e293b (slate-800)


# ---------------------------------------------------------------------------
# Background & shared decoration helpers
# ---------------------------------------------------------------------------
def _new_canvas() -> Image.Image:
    """Buat canvas warm cream dengan subtle gradient soft glow di top-right."""
    img = Image.new("RGB", (W, H), BG)
    # Soft radial glow indigo subtle di top-right (5% opacity feel)
    glow = Image.new("RGBA", (W, H), (255, 255, 255, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse(
        (W - 400, -200, W + 200, 400),
        fill=(165, 180, 252, 60),  # PS @ 24% alpha
    )
    glow = glow.filter(ImageFilter.GaussianBlur(80))
    img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")
    return img


def _draw_ground_shadow(draw: ImageDraw.ImageDraw, cx: int, cy: int, w: int = 280) -> None:
    """Soft elliptical ground shadow under hero shape."""
    # Layer pakai blur — buat di image terpisah lalu paste
    shadow_img = Image.new("RGBA", (W, H), (255, 255, 255, 0))
    sd = ImageDraw.Draw(shadow_img)
    sd.ellipse(
        (cx - w // 2, cy - 18, cx + w // 2, cy + 18),
        fill=(15, 23, 42, 36),
    )
    shadow_img = shadow_img.filter(ImageFilter.GaussianBlur(8))
    # Hack: caller menyediakan draw, jadi kita return image untuk composite di main
    # Untuk simplicity, kita draw langsung pakai solid ellipse (cheap fallback)
    draw.ellipse(
        (cx - w // 2, cy - 12, cx + w // 2, cy + 12),
        fill=(220, 215, 230),
        outline=None,
    )


def _scatter_dots(draw: ImageDraw.ImageDraw, points: list[tuple[int, int, int, str]]) -> None:
    """Draw dekoratif kecil: list of (x, y, radius, color)."""
    for x, y, r, color in points:
        draw.ellipse((x - r, y - r, x + r, y + r), fill=color)


def _rounded_rect(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    radius: int,
    *,
    fill: str | None = None,
    outline: str | None = None,
    width: int = STROKE_THICK,
) -> None:
    """Wrapper rounded_rectangle dengan defaults konsisten."""
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


# ---------------------------------------------------------------------------
# Individual illustration drawers
# ---------------------------------------------------------------------------
def draw_anggota(img: Image.Image) -> None:
    """Membership card flat lay — indigo outline, blank avatar, two info lines,
    amber pencil accent floating ready to write."""
    d = ImageDraw.Draw(img)
    cx, cy = CENTER

    _draw_ground_shadow(d, cx, cy + 180)

    # Card body (slight tilt feel via offset shadow card)
    card_w, card_h = 520, 320
    cx_card, cy_card = cx - 30, cy - 20
    box = (cx_card - card_w // 2, cy_card - card_h // 2,
           cx_card + card_w // 2, cy_card + card_h // 2)
    # Soft shadow card
    _rounded_rect(d, (box[0] + 10, box[1] + 14, box[2] + 10, box[3] + 14),
                  20, fill=PS, outline=None)
    _rounded_rect(d, box, 20, fill="#ffffff", outline=P, width=STROKE_THICK)

    # Avatar circle (top-left of card)
    av_r = 60
    av_cx, av_cy = box[0] + 80, box[1] + 90
    d.ellipse((av_cx - av_r, av_cy - av_r, av_cx + av_r, av_cy + av_r),
              fill=PS, outline=P, width=STROKE_MED)
    # Avatar inside: simple person silhouette (head + shoulders)
    d.ellipse((av_cx - 22, av_cy - 28, av_cx + 22, av_cy + 14),
              fill=P)
    d.ellipse((av_cx - 38, av_cy + 18, av_cx + 38, av_cy + 70), fill=P)

    # Two info lines
    line_x_start = av_cx + 80
    line_x_end = box[2] - 40
    # Name line (longer)
    _rounded_rect(d, (line_x_start, av_cy - 12, line_x_end - 60, av_cy + 4),
                  6, fill=P, outline=None)
    # Sub line (shorter)
    _rounded_rect(d, (line_x_start, av_cy + 20, line_x_end - 160, av_cy + 32),
                  4, fill=PS, outline=None)

    # Three info rows below avatar
    for i, end_off in enumerate([0, 80, 160]):
        y = box[1] + 200 + (i * 28)
        _rounded_rect(d,
                      (box[0] + 40, y, line_x_end - end_off, y + 10),
                      4, fill="#cbd5e1", outline=None)

    # Floating amber pencil — top right
    px, py = box[2] + 40, box[1] - 20
    # Pencil body (rotated rectangle approximated)
    d.polygon([
        (px, py), (px + 20, py - 20), (px + 110, py + 70),
        (px + 90, py + 90),
    ], fill=A, outline=LINE, width=STROKE_THIN)
    # Pencil tip (triangle)
    d.polygon([
        (px + 90, py + 90), (px + 110, py + 70), (px + 130, py + 110),
    ], fill="#1e293b", outline=LINE, width=STROKE_THIN)

    # Sparkle accents
    _scatter_dots(d, [
        (180, 140, 6, A),
        (840, 480, 8, PS),
        (220, 500, 5, P),
        (880, 200, 4, A),
    ])


def draw_anggota_search(img: Image.Image) -> None:
    """Magnifying glass over membership card — search no result variant."""
    d = ImageDraw.Draw(img)
    cx, cy = CENTER

    _draw_ground_shadow(d, cx, cy + 200)

    # Faded card (smaller, lower opacity feel via lighter outline)
    card_w, card_h = 380, 220
    box = (cx - card_w // 2 - 60, cy - card_h // 2 + 30,
           cx + card_w // 2 - 60, cy + card_h // 2 + 30)
    _rounded_rect(d, box, 16, fill="#ffffff", outline=PS, width=STROKE_MED)

    # Avatar placeholder (smaller, faded)
    av_cx, av_cy = box[0] + 60, box[1] + 60
    d.ellipse((av_cx - 30, av_cy - 30, av_cx + 30, av_cy + 30),
              fill="#e2e8f0", outline=PS, width=3)

    # Magnifying glass — large, indigo outline, over the card
    glass_cx, glass_cy = cx + 100, cy - 40
    glass_r = 110
    d.ellipse((glass_cx - glass_r, glass_cy - glass_r,
               glass_cx + glass_r, glass_cy + glass_r),
              fill=BG, outline=P, width=STROKE_THICK + 2)
    # Inner highlight ring
    d.ellipse((glass_cx - glass_r + 16, glass_cy - glass_r + 16,
               glass_cx + glass_r - 16, glass_cy + glass_r - 16),
              outline=PS, width=STROKE_THIN)
    # Handle (rotated rectangle)
    handle_pts = [
        (glass_cx + 75, glass_cy + 75),
        (glass_cx + 100, glass_cy + 50),
        (glass_cx + 175, glass_cy + 125),
        (glass_cx + 150, glass_cy + 150),
    ]
    d.polygon(handle_pts, fill=P, outline=LINE, width=STROKE_THIN)

    # Question mark inside glass (amber)
    d.text((glass_cx - 18, glass_cy - 38), "?", fill=A,
           font=None)  # default font; visible cue
    # Draw a chunky question mark using arcs
    d.arc((glass_cx - 32, glass_cy - 50, glass_cx + 32, glass_cy + 14),
          start=0, end=270, fill=A, width=10)
    d.ellipse((glass_cx - 6, glass_cy + 30, glass_cx + 6, glass_cy + 42),
              fill=A)

    # Sparkle accents
    _scatter_dots(d, [
        (180, 180, 5, PS), (180, 480, 6, A),
        (860, 480, 4, P),
    ])


def draw_buku(img: Image.Image) -> None:
    """Empty bookshelf — three indigo shelves, one open book on middle shelf,
    amber dots floating above suggesting potential new entries."""
    d = ImageDraw.Draw(img)
    cx, cy = CENTER

    # Bookshelf frame — outer rect with 3 shelves
    shelf_w, shelf_h = 640, 380
    box = (cx - shelf_w // 2, cy - shelf_h // 2 + 30,
           cx + shelf_w // 2, cy + shelf_h // 2 + 30)
    _rounded_rect(d, box, 10, fill="#ffffff", outline=P, width=STROKE_THICK)

    # 2 horizontal shelves dividers
    for i in (1, 2):
        sy = box[1] + (shelf_h // 3) * i
        d.line((box[0] + 20, sy, box[2] - 20, sy), fill=P, width=STROKE_MED)

    # Open book on middle shelf
    book_cx = cx
    book_cy = box[1] + (shelf_h // 3) * 2 - 60
    bw, bh = 180, 110
    # Left page
    d.polygon([
        (book_cx - bw // 2, book_cy + bh // 2),
        (book_cx - bw // 2 + 8, book_cy - bh // 2),
        (book_cx - 4, book_cy - bh // 2 + 6),
        (book_cx - 4, book_cy + bh // 2),
    ], fill="#ffffff", outline=LINE, width=STROKE_MED)
    # Right page
    d.polygon([
        (book_cx + 4, book_cy + bh // 2),
        (book_cx + 4, book_cy - bh // 2 + 6),
        (book_cx + bw // 2 - 8, book_cy - bh // 2),
        (book_cx + bw // 2, book_cy + bh // 2),
    ], fill="#ffffff", outline=LINE, width=STROKE_MED)
    # Page lines
    for i in range(3):
        d.line((book_cx - bw // 2 + 16, book_cy - 20 + i * 14,
                book_cx - 12, book_cy - 20 + i * 14), fill=PS, width=2)
        d.line((book_cx + 12, book_cy - 20 + i * 14,
                book_cx + bw // 2 - 16, book_cy - 20 + i * 14), fill=PS, width=2)

    # Amber dots (floating, top of shelf)
    _scatter_dots(d, [
        (cx - 180, box[1] - 30, 12, A),
        (cx - 80, box[1] - 60, 10, A),
        (cx + 60, box[1] - 50, 8, PS),
        (cx + 200, box[1] - 30, 10, A),
    ])

    # Single sparkle accent top-right
    _scatter_dots(d, [(880, 140, 5, P), (160, 480, 4, P)])


def draw_buku_search(img: Image.Image) -> None:
    """Magnifying glass over a closed book with question mark — book search no result."""
    d = ImageDraw.Draw(img)
    cx, cy = CENTER

    _draw_ground_shadow(d, cx - 60, cy + 180)

    # Closed book (lying)
    book_cx, book_cy = cx - 80, cy + 30
    bw, bh = 200, 260
    # Book cover
    _rounded_rect(d, (book_cx - bw // 2, book_cy - bh // 2,
                      book_cx + bw // 2, book_cy + bh // 2),
                  10, fill=PS, outline=P, width=STROKE_THICK)
    # Spine line
    d.line((book_cx - bw // 2 + 14, book_cy - bh // 2 + 14,
            book_cx - bw // 2 + 14, book_cy + bh // 2 - 14),
           fill=P, width=STROKE_MED)
    # Title placeholder lines on cover
    for i in range(3):
        y = book_cy - 60 + i * 24
        _rounded_rect(d, (book_cx - 40, y, book_cx + 50, y + 10),
                      3, fill="#ffffff", outline=None)

    # Magnifying glass
    glass_cx, glass_cy = cx + 140, cy - 60
    glass_r = 100
    d.ellipse((glass_cx - glass_r, glass_cy - glass_r,
               glass_cx + glass_r, glass_cy + glass_r),
              fill=BG, outline=P, width=STROKE_THICK)
    # Handle
    d.polygon([
        (glass_cx + 70, glass_cy + 70),
        (glass_cx + 90, glass_cy + 50),
        (glass_cx + 165, glass_cy + 125),
        (glass_cx + 145, glass_cy + 145),
    ], fill=P, outline=LINE, width=STROKE_THIN)

    # Big amber question mark inside glass
    d.arc((glass_cx - 30, glass_cy - 50, glass_cx + 30, glass_cy + 10),
          start=0, end=270, fill=A, width=10)
    d.ellipse((glass_cx - 6, glass_cy + 26, glass_cx + 6, glass_cy + 38),
              fill=A)

    # Sparkles
    _scatter_dots(d, [
        (200, 180, 5, PS),
        (180, 500, 6, A),
        (880, 500, 4, P),
    ])


def draw_kunjungan(img: Image.Image) -> None:
    """Calendar dengan satu hari di-highlight + tiny clock floating amber."""
    d = ImageDraw.Draw(img)
    cx, cy = CENTER

    _draw_ground_shadow(d, cx, cy + 200)

    # Calendar body
    cal_w, cal_h = 460, 380
    box = (cx - cal_w // 2, cy - cal_h // 2 + 20,
           cx + cal_w // 2, cy + cal_h // 2 + 20)
    _rounded_rect(d, box, 16, fill="#ffffff", outline=P, width=STROKE_THICK)

    # Header bar (indigo)
    hb = (box[0], box[1], box[2], box[1] + 70)
    _rounded_rect(d, hb, 16, fill=P, outline=None)
    # Mask bottom corners (overlap with white body)
    d.rectangle((box[0], box[1] + 50, box[2], box[1] + 70), fill=P)

    # Two ring binders on top
    for off in (-130, 130):
        d.line((cx + off, box[1] - 18, cx + off, box[1] + 28),
               fill=LINE, width=STROKE_MED + 1)
        d.ellipse((cx + off - 12, box[1] - 28, cx + off + 12, box[1] - 8),
                  fill="#ffffff", outline=LINE, width=STROKE_THIN)

    # Date grid (5 cols x 4 rows)
    grid_top = box[1] + 100
    grid_bot = box[3] - 30
    gx0 = box[0] + 30
    gx1 = box[2] - 30
    cell_w = (gx1 - gx0) // 5
    cell_h = (grid_bot - grid_top) // 4
    for row in range(4):
        for col in range(5):
            cell_cx = gx0 + col * cell_w + cell_w // 2
            cell_cy = grid_top + row * cell_h + cell_h // 2
            r = 18
            d.ellipse((cell_cx - r, cell_cy - r, cell_cx + r, cell_cy + r),
                      fill="#f1f5f9", outline=None)

    # Highlight one day (row=1, col=2) with primary indigo
    h_cx = gx0 + 2 * cell_w + cell_w // 2
    h_cy = grid_top + 1 * cell_h + cell_h // 2
    r = 22
    d.ellipse((h_cx - r, h_cy - r, h_cx + r, h_cy + r), fill=P, outline=None)

    # Tiny clock floating top-right
    clk_cx, clk_cy = box[2] + 60, box[1] - 30
    clk_r = 40
    d.ellipse((clk_cx - clk_r, clk_cy - clk_r, clk_cx + clk_r, clk_cy + clk_r),
              fill="#ffffff", outline=A, width=STROKE_MED)
    # Hour hand
    d.line((clk_cx, clk_cy, clk_cx + 18, clk_cy - 4), fill=A, width=STROKE_THIN + 1)
    # Minute hand
    d.line((clk_cx, clk_cy, clk_cx, clk_cy - 24), fill=A, width=STROKE_THIN + 1)
    # Center dot
    d.ellipse((clk_cx - 4, clk_cy - 4, clk_cx + 4, clk_cy + 4), fill=A)

    # Sparkles
    _scatter_dots(d, [
        (200, 200, 5, A),
        (180, 480, 6, PS),
    ])


def draw_peminjaman(img: Image.Image) -> None:
    """Two hands exchanging a small open book with amber dot trail between."""
    d = ImageDraw.Draw(img)
    cx, cy = CENTER

    _draw_ground_shadow(d, cx, cy + 180)

    # Left hand — simplified mitten shape
    lh_x, lh_y = cx - 280, cy + 40
    d.polygon([
        (lh_x, lh_y), (lh_x + 100, lh_y - 60), (lh_x + 180, lh_y - 30),
        (lh_x + 180, lh_y + 60), (lh_x + 60, lh_y + 110),
        (lh_x, lh_y + 110),
    ], fill=PS, outline=P, width=STROKE_THICK)
    # Wrist cuff
    _rounded_rect(d, (lh_x - 20, lh_y + 80, lh_x + 60, lh_y + 130),
                  10, fill=P, outline=None)

    # Right hand — mirror
    rh_x, rh_y = cx + 280, cy + 40
    d.polygon([
        (rh_x, rh_y), (rh_x - 100, rh_y - 60), (rh_x - 180, rh_y - 30),
        (rh_x - 180, rh_y + 60), (rh_x - 60, rh_y + 110),
        (rh_x, rh_y + 110),
    ], fill=PS, outline=P, width=STROKE_THICK)
    _rounded_rect(d, (rh_x - 60, rh_y + 80, rh_x + 20, rh_y + 130),
                  10, fill=P, outline=None)

    # Open book in the middle (being exchanged)
    book_cx, book_cy = cx, cy - 30
    bw, bh = 220, 140
    # Left page
    d.polygon([
        (book_cx - bw // 2, book_cy + bh // 2),
        (book_cx - bw // 2 + 10, book_cy - bh // 2),
        (book_cx - 6, book_cy - bh // 2 + 8),
        (book_cx - 6, book_cy + bh // 2),
    ], fill="#ffffff", outline=LINE, width=STROKE_MED)
    # Right page
    d.polygon([
        (book_cx + 6, book_cy + bh // 2),
        (book_cx + 6, book_cy - bh // 2 + 8),
        (book_cx + bw // 2 - 10, book_cy - bh // 2),
        (book_cx + bw // 2, book_cy + bh // 2),
    ], fill="#ffffff", outline=LINE, width=STROKE_MED)
    # Page lines
    for i in range(3):
        d.line((book_cx - bw // 2 + 18, book_cy - 24 + i * 16,
                book_cx - 14, book_cy - 24 + i * 16), fill=PS, width=2)
        d.line((book_cx + 14, book_cy - 24 + i * 16,
                book_cx + bw // 2 - 18, book_cy - 24 + i * 16), fill=PS, width=2)

    # Amber motion dots between hands
    for x_off in [-160, -120, -80, 80, 120, 160]:
        sz = 8 if abs(x_off) < 110 else 6
        d.ellipse((book_cx + x_off - sz, cy + 80 - sz,
                   book_cx + x_off + sz, cy + 80 + sz),
                  fill=A)

    # Sparkles
    _scatter_dots(d, [
        (160, 160, 5, P),
        (860, 200, 6, A),
        (880, 480, 4, PS),
    ])


def draw_pengembalian(img: Image.Image) -> None:
    """Open book with curved amber arrow looping back toward stylized return slot."""
    d = ImageDraw.Draw(img)
    cx, cy = CENTER

    _draw_ground_shadow(d, cx - 100, cy + 180)

    # Open book (left side)
    book_cx, book_cy = cx - 140, cy + 30
    bw, bh = 260, 200
    # Left page
    d.polygon([
        (book_cx - bw // 2, book_cy + bh // 2),
        (book_cx - bw // 2 + 12, book_cy - bh // 2),
        (book_cx - 8, book_cy - bh // 2 + 10),
        (book_cx - 8, book_cy + bh // 2),
    ], fill="#ffffff", outline=LINE, width=STROKE_THICK)
    # Right page
    d.polygon([
        (book_cx + 8, book_cy + bh // 2),
        (book_cx + 8, book_cy - bh // 2 + 10),
        (book_cx + bw // 2 - 12, book_cy - bh // 2),
        (book_cx + bw // 2, book_cy + bh // 2),
    ], fill="#ffffff", outline=LINE, width=STROKE_THICK)
    # Page lines
    for i in range(4):
        d.line((book_cx - bw // 2 + 22, book_cy - 30 + i * 16,
                book_cx - 18, book_cy - 30 + i * 16), fill=PS, width=2)
        d.line((book_cx + 18, book_cy - 30 + i * 16,
                book_cx + bw // 2 - 22, book_cy - 30 + i * 16), fill=PS, width=2)

    # Return slot (right side) — stylized box with horizontal slot opening
    slot_cx, slot_cy = cx + 220, cy + 60
    slot_w, slot_h = 220, 200
    _rounded_rect(d,
                  (slot_cx - slot_w // 2, slot_cy - slot_h // 2,
                   slot_cx + slot_w // 2, slot_cy + slot_h // 2),
                  16, fill=PS, outline=P, width=STROKE_THICK)
    # Slot opening
    _rounded_rect(d,
                  (slot_cx - slot_w // 2 + 30, slot_cy - 50,
                   slot_cx + slot_w // 2 - 30, slot_cy - 30),
                  6, fill=LINE, outline=None)
    # Slot label dot
    d.ellipse((slot_cx - 6, slot_cy + 30, slot_cx + 6, slot_cy + 42),
              fill=P)

    # Amber arrow looping book → slot
    # Arrow body (arc-like polyline)
    arrow_pts = [
        (book_cx + bw // 2 + 10, book_cy - 80),
        (cx, cy - 140),
        (slot_cx - slot_w // 2 - 30, cy - 80),
        (slot_cx - slot_w // 2 - 10, slot_cy - 50),
    ]
    for i in range(len(arrow_pts) - 1):
        d.line((arrow_pts[i], arrow_pts[i + 1]), fill=A, width=10)

    # Arrow head
    ahx, ahy = slot_cx - slot_w // 2 - 10, slot_cy - 50
    d.polygon([
        (ahx - 18, ahy - 10),
        (ahx, ahy + 14),
        (ahx + 4, ahy - 18),
    ], fill=A)

    # Sparkles
    _scatter_dots(d, [
        (180, 180, 6, A),
        (200, 480, 4, P),
        (840, 480, 5, PS),
    ])


# ---------------------------------------------------------------------------
# Registry & main
# ---------------------------------------------------------------------------
ILLUSTRATIONS: dict[str, callable] = {
    "empty-anggota": draw_anggota,
    "empty-anggota-search": draw_anggota_search,
    "empty-buku": draw_buku,
    "empty-buku-search": draw_buku_search,
    "empty-kunjungan": draw_kunjungan,
    "empty-peminjaman": draw_peminjaman,
    "empty-pengembalian": draw_pengembalian,
}


def main() -> None:
    out_dir = Path(__file__).resolve().parents[1] / "assets" / "illustrations"
    out_dir.mkdir(parents=True, exist_ok=True)

    for name, drawer in ILLUSTRATIONS.items():
        img = _new_canvas()
        drawer(img)
        out_path = out_dir / f"{name}.png"
        img.save(out_path, "PNG", optimize=True)
        print(f"  generated  {name:<28}  → {out_path.relative_to(out_dir.parents[1])}")

    print(f"\n✓ {len(ILLUSTRATIONS)} illustrations generated in {out_dir}")


if __name__ == "__main__":
    main()
