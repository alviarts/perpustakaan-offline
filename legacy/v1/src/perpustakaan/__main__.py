"""Entry point untuk `python -m perpustakaan` dan PyInstaller bootloader."""
from __future__ import annotations

import argparse
import sys


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="perpustakaan",
        description="Perpustakaan Offline — SIM-Perpus reborn (Python + SQLite + CustomTkinter)",
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help=(
            "Seed demo data (5 anggota + 10 buku + 2 peminjaman aktif) saat database masih kosong. "
            "Berguna untuk demo/training tanpa input data manual."
        ),
    )
    parser.add_argument(
        "--no-gui",
        action="store_true",
        help="Hanya inisialisasi DB + (opsional) seed demo, lalu exit. Tidak buka GUI.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """Bootstrap aplikasi GUI."""
    args = _parse_args(argv)
    from perpustakaan.app import run

    return run(demo=args.demo, headless=args.no_gui)


if __name__ == "__main__":
    sys.exit(main())
