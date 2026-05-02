"""Konfigurasi & path runtime untuk aplikasi Perpustakaan Offline.

Semua data runtime (SQLite DB, foto, backup, exports) disimpan di:
    - Windows : %APPDATA%\\PerpustakaanOffline
    - macOS   : ~/Library/Application Support/PerpustakaanOffline
    - Linux   : ~/.local/share/PerpustakaanOffline (atau $XDG_DATA_HOME)

Asset bawaan (DDC, logo default, schema.sql) tetap di dalam package.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Final

APP_NAME: Final = "PerpustakaanOffline"
APP_DISPLAY_NAME: Final = "Perpustakaan Offline"
APP_VERSION: Final = "0.1.0"


# ---------------------------------------------------------------------------
# Resource path (bundled assets)
# ---------------------------------------------------------------------------
def _resource_root() -> Path:
    """Root direktori resource bawaan.

    - Saat dijalankan via PyInstaller (frozen), gunakan ``sys._MEIPASS``.
    - Saat development, gunakan path repo (`<repo>/`).
    """
    if getattr(sys, "frozen", False):  # PyInstaller bundle
        return Path(sys._MEIPASS)  # type: ignore[arg-type]
    # src/perpustakaan/config.py -> parents: [perpustakaan, src, repo]
    return Path(__file__).resolve().parents[2]


RESOURCE_ROOT: Final = _resource_root()
ASSETS_DIR: Final = RESOURCE_ROOT / "assets"
PACKAGE_DIR: Final = Path(__file__).resolve().parent
SCHEMA_PATH: Final = PACKAGE_DIR / "db" / "schema.sql"


# ---------------------------------------------------------------------------
# User data path (writable runtime)
# ---------------------------------------------------------------------------
def _user_data_root() -> Path:
    if sys.platform.startswith("win"):
        base = os.environ.get("APPDATA")
        if base:
            return Path(base) / APP_NAME
        return Path.home() / "AppData" / "Roaming" / APP_NAME
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / APP_NAME
    xdg = os.environ.get("XDG_DATA_HOME")
    if xdg:
        return Path(xdg) / APP_NAME
    return Path.home() / ".local" / "share" / APP_NAME


USER_DATA_DIR: Final = _user_data_root()
DB_PATH: Final = USER_DATA_DIR / "perpustakaan.db"
BACKUPS_DIR: Final = USER_DATA_DIR / "backups"
EXPORTS_DIR: Final = USER_DATA_DIR / "exports"
PHOTOS_DIR: Final = USER_DATA_DIR / "photos"
COVERS_DIR: Final = USER_DATA_DIR / "covers"
LOGS_DIR: Final = USER_DATA_DIR / "logs"
CREDENTIALS_DIR: Final = USER_DATA_DIR / "credentials"


def ensure_runtime_dirs() -> None:
    """Pastikan semua direktori runtime ada."""
    for d in (
        USER_DATA_DIR,
        BACKUPS_DIR,
        EXPORTS_DIR,
        PHOTOS_DIR,
        COVERS_DIR,
        LOGS_DIR,
        CREDENTIALS_DIR,
    ):
        d.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Default settings
# ---------------------------------------------------------------------------
DEFAULT_SETTINGS: Final[dict[str, str]] = {
    "lib.nama": "Perpustakaan Sekolah",
    "lib.alamat": "-",
    "lib.kepala": "-",
    "lib.npsn": "-",
    "lib.tahun_ajaran": "2024/2025",
    "lib.logo_path": "",
    "lib.kontak": "-",
    "kta.peraturan": (
        "1. Kartu ini wajib dibawa saat meminjam buku.\n"
        "2. Kehilangan kartu segera laporkan ke pustakawan.\n"
        "3. Kartu tidak boleh dipindahtangankan."
    ),
    "transaksi.lama_pinjam_hari": "7",
    "transaksi.maks_buku_pinjam": "2",
    "transaksi.denda_per_hari": "500",
    "transaksi.denda_buku_hilang_persen": "100",
    "ui.locale": "id",
    "ui.theme": "system",  # system | light | dark
    "ui.color_theme": "blue",  # blue | green | dark-blue
    "sync.last_export_at": "",
    "sync.spreadsheet_id": "",
    "app.first_run": "1",
}


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
DEFAULT_ADMIN_USERNAME: Final = "admin"
DEFAULT_ADMIN_PASSWORD: Final = "admin123"  # WAJIB diganti saat first login
DEFAULT_ADMIN_FULLNAME: Final = "Administrator"
