"""Download & render Lucide icons ke PNG monochrome utk dipakai di runtime.

Penggunaan:
    .venv/bin/python scripts/fetch_lucide_icons.py

Script ini:
1. Download SVG dari ``raw.githubusercontent.com/lucide-icons/lucide/main/icons/``
2. Render tiap SVG → PNG monochrome (stroke hitam di atas transparent bg) via
   ``cairosvg`` (dev-only dep, tidak butuh di runtime)
3. Simpan ke ``assets/icons/lucide/<name>.png`` ukuran 96px (HiDPI-safe)

Runtime app pakai ``perpustakaan.gui.icons.lucide_icon(name, size, color)``
yang load PNG ini lalu re-color via PIL alpha-compositing — supaya satu PNG
bisa dipakai di light mode (gelap), dark mode (terang), atau accent color.

Lucide MIT-licensed: https://github.com/lucide-icons/lucide/blob/main/LICENSE
"""
from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = REPO_ROOT / "assets" / "icons" / "lucide"

LUCIDE_BASE = "https://raw.githubusercontent.com/lucide-icons/lucide/main/icons"

# Render ukuran besar supaya HiDPI tetap tajam saat di-resize ke 16/20/24.
RENDER_SIZE = 96

# ~50 icon inti — coverage utk sidebar + toolbar + status + dialog.
ICON_NAMES: tuple[str, ...] = (
    # Navigation / sidebar
    "layout-dashboard",
    "users",
    "book-open",
    "calendar-days",
    "arrow-right-left",  # peminjaman
    "rotate-ccw",        # pengembalian
    "chart-bar",        # laporan
    "settings",
    "circle-question-mark",
    "log-out",
    "library",
    # Theme toggle
    "sun",
    "moon",
    "monitor",
    # Auth / security
    "key-round",
    "lock",
    "lock-open",
    "shield",
    "user-cog",
    "user-plus",
    "user-check",
    "eye",
    "eye-off",
    # Action toolbar
    "plus",
    "pencil",
    "trash-2",
    "search",
    "funnel",
    "download",
    "upload",
    "copy",
    "save",
    "x",
    "check",
    "ellipsis",
    "printer",
    "refresh-cw",
    "file-text",
    "clipboard-list",
    # Feedback / status
    "circle-check",
    "circle-x",
    "triangle-alert",
    "circle-alert",
    "info",
    "clock",
    "bell",
    # Navigation chevrons
    "chevron-down",
    "chevron-right",
    "chevron-left",
    "chevron-up",
    "arrow-left",
    "arrow-right",
    # Empty-state pictograms
    "inbox",
    "package-open",
    "frown",
    "sparkles",
)


def download_svg(name: str) -> str:
    url = f"{LUCIDE_BASE}/{name}.svg"
    with urllib.request.urlopen(url, timeout=20) as resp:  # noqa: S310
        if resp.status != 200:
            raise RuntimeError(f"download gagal {url} → status {resp.status}")
        return resp.read().decode("utf-8")


def render_to_png(svg_text: str, out_path: Path, size: int) -> None:
    # Lucide pakai stroke="currentColor" — ganti ke hitam supaya hasilnya
    # monochrome solid, lalu di runtime kita re-color via alpha mask.
    svg = svg_text.replace('stroke="currentColor"', 'stroke="#000000"')
    import cairosvg

    cairosvg.svg2png(
        bytestring=svg.encode("utf-8"),
        write_to=str(out_path),
        output_width=size,
        output_height=size,
    )


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    failed: list[str] = []
    for name in ICON_NAMES:
        out = OUT_DIR / f"{name}.png"
        if out.exists():
            print(f"  skip (exists): {name}")
            continue
        try:
            svg = download_svg(name)
            render_to_png(svg, out, RENDER_SIZE)
            print(f"  ok: {name}")
        except Exception as exc:  # noqa: BLE001
            print(f"  FAIL: {name} → {exc}", file=sys.stderr)
            failed.append(name)

    print()
    print(f"Total: {len(ICON_NAMES)} icon, {len(failed)} gagal.")
    if failed:
        print("Gagal:", ", ".join(failed))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
