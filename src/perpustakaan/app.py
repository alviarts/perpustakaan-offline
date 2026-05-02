"""Bootstrap aplikasi Perpustakaan Offline."""
from __future__ import annotations

import logging
import sys
import traceback
from pathlib import Path

from perpustakaan import __version__
from perpustakaan.config import LOGS_DIR, ensure_runtime_dirs


def _setup_logging() -> None:
    ensure_runtime_dirs()
    log_path: Path = LOGS_DIR / "app.log"
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.FileHandler(log_path, encoding="utf-8"),
            logging.StreamHandler(sys.stderr),
        ],
    )
    logging.getLogger("perpustakaan").info(
        "Perpustakaan Offline v%s starting up", __version__
    )


def _init_database() -> None:
    from perpustakaan.db.connection import init_db
    from perpustakaan.db.seed import seed_all

    init_db()
    seed_all()


def _apply_locale_from_settings() -> None:
    from perpustakaan.i18n import set_locale
    from perpustakaan.models import settings as settings_repo

    locale = settings_repo.get_value("ui.locale", "id")
    try:
        set_locale(locale or "id")
    except ValueError:
        set_locale("id")


def run() -> int:
    """Entry point — return exit code."""
    _setup_logging()
    log = logging.getLogger("perpustakaan.app")
    try:
        _init_database()
        _apply_locale_from_settings()
    except Exception:  # pragma: no cover - bootstrap error
        log.exception("Gagal inisialisasi database")
        traceback.print_exc()
        return 2

    try:
        from perpustakaan.gui.login import run_login_then_main
    except ImportError as exc:
        log.error("GUI dependencies belum terinstal: %s", exc)
        print(
            "[ERROR] Dependency GUI belum terinstal. Jalankan:\n"
            "    pip install -r requirements.txt\n",
            file=sys.stderr,
        )
        return 3

    try:
        return run_login_then_main()
    except Exception:  # pragma: no cover
        log.exception("Aplikasi crash")
        traceback.print_exc()
        return 1
