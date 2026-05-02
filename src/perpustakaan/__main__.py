"""Entry point untuk `python -m perpustakaan` dan PyInstaller bootloader."""
from __future__ import annotations

import sys


def main() -> int:
    """Bootstrap aplikasi GUI."""
    from perpustakaan.app import run

    return run()


if __name__ == "__main__":
    sys.exit(main())
