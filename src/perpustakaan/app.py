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


def _init_database(demo: bool = False) -> None:
    from perpustakaan.db.connection import init_db
    from perpustakaan.db.seed import seed_all, seed_demo

    init_db()
    seed_all()
    if demo:
        log = logging.getLogger("perpustakaan.app")
        result = seed_demo()
        if any(result.values()):
            log.info(
                "Demo data seeded: %d anggota, %d buku, %d peminjaman",
                result["anggota"], result["buku"], result["peminjaman"],
            )
        else:
            log.info("Demo data dilewati (database sudah berisi data).")


def _apply_locale_from_settings() -> None:
    from perpustakaan.i18n import set_locale
    from perpustakaan.models import settings as settings_repo

    locale = settings_repo.get_value("ui.locale", "id")
    try:
        set_locale(locale or "id")
    except ValueError:
        set_locale("id")


def _start_backup_scheduler() -> None:
    """Mulai daemon scheduler backup terjadwal."""
    from perpustakaan.services.backup_scheduler import get_scheduler

    get_scheduler().start()


def run(demo: bool = False, headless: bool = False) -> int:
    """Entry point — return exit code.

    Args:
        demo: kalau True, seed demo data (5 anggota + 10 buku + 2 peminjaman)
            saat DB masih kosong. Idempotent — di-skip kalau sudah ada data.
        headless: kalau True, tidak buka GUI; hanya init DB lalu exit
            (berguna untuk CI / scripting).
    """
    _setup_logging()
    log = logging.getLogger("perpustakaan.app")
    try:
        _init_database(demo=demo)
        _apply_locale_from_settings()
    except Exception:  # pragma: no cover - bootstrap error
        log.exception("Gagal inisialisasi database")
        traceback.print_exc()
        return 2

    if headless:
        log.info("Mode --no-gui: inisialisasi selesai, exit.")
        return 0

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
        _start_backup_scheduler()
    except Exception:  # noqa: BLE001 - scheduler tidak boleh blokir app
        log.exception("Gagal start backup scheduler (lanjut tanpa backup terjadwal)")

    try:
        return run_login_then_main()
    except Exception:  # pragma: no cover
        log.exception("Aplikasi crash")
        traceback.print_exc()
        return 1
    finally:
        try:
            from perpustakaan.services.backup_scheduler import get_scheduler

            get_scheduler().stop(timeout=1.0)
        except Exception:  # noqa: BLE001
            log.warning("Gagal stop backup scheduler", exc_info=True)
