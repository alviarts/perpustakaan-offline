"""Scheduler in-process untuk backup terjadwal (harian / mingguan).

Implementasi sengaja sederhana — tanpa dependency tambahan (APScheduler dsb.)
supaya bundle PyInstaller tidak membengkak. Karakteristik:

- Satu daemon thread (singleton) yang loop sambil menunggu deadline
  via :class:`threading.Event` — bisa di-stop / di-reload kapan saja.
- "Catch-up" di startup: kalau jadwal terlewat (mis. PC mati semalam
  saat seharusnya backup), backup langsung dijalankan begitu app dibuka.
- Settings (frekuensi, jam, weekday, folder, retention) diambil ulang
  dari tabel ``settings`` setiap iterasi loop, jadi perubahan UI
  langsung berlaku tanpa perlu restart.
- Notifikasi GUI dilewatkan via callback opsional (dipanggil dari
  worker thread; pemanggil GUI bertanggung jawab marshal ke main loop
  via ``Tk.after``).
"""
from __future__ import annotations

import logging
import threading
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

from perpustakaan.services import backup_service

_log = logging.getLogger("perpustakaan.backup_scheduler")


SCHEDULE_OFF = "off"
SCHEDULE_DAILY = "daily"
SCHEDULE_WEEKLY = "weekly"
VALID_SCHEDULES = (SCHEDULE_OFF, SCHEDULE_DAILY, SCHEDULE_WEEKLY)

# Toleransi catch-up: kalau jadwal terlewat dalam window ini, jalankan
# segera saat startup. (24 jam = aman untuk schedule harian, 7 hari +
# margin = aman untuk schedule mingguan.)
_CATCHUP_GRACE = timedelta(hours=2)


@dataclass(frozen=True)
class BackupConfig:
    """Snapshot config backup dari tabel ``settings``."""

    schedule: str = SCHEDULE_OFF
    hour: int = 2
    minute: int = 0
    weekday: int = 0  # 0 = Senin
    folder: str = ""
    retention: int = 7
    last_run_at: str = ""

    @classmethod
    def from_settings(cls) -> BackupConfig:
        from perpustakaan.models import settings as settings_repo

        schedule = (settings_repo.get_value("backup.schedule") or SCHEDULE_OFF).strip().lower()
        if schedule not in VALID_SCHEDULES:
            schedule = SCHEDULE_OFF
        time_str = (settings_repo.get_value("backup.time") or "02:00").strip()
        hour, minute = _parse_hhmm(time_str)
        weekday = _coerce_int(settings_repo.get_value("backup.weekday"), default=0, lo=0, hi=6)
        retention = _coerce_int(
            settings_repo.get_value("backup.retention"), default=7, lo=0, hi=999
        )
        folder = (settings_repo.get_value("backup.folder") or "").strip()
        last_run_at = (settings_repo.get_value("backup.last_run_at") or "").strip()
        return cls(
            schedule=schedule,
            hour=hour,
            minute=minute,
            weekday=weekday,
            folder=folder,
            retention=retention,
            last_run_at=last_run_at,
        )


def _parse_hhmm(s: str) -> tuple[int, int]:
    try:
        hh_str, mm_str = s.split(":", 1)
        hh = max(0, min(23, int(hh_str)))
        mm = max(0, min(59, int(mm_str)))
        return hh, mm
    except (ValueError, AttributeError):
        return 2, 0


def _coerce_int(val: object, *, default: int, lo: int, hi: int) -> int:
    try:
        n = int(str(val).strip())
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, n))


def compute_next_run(cfg: BackupConfig, *, now: datetime | None = None) -> datetime | None:
    """Hitung kapan backup berikutnya seharusnya jalan.

    Mengembalikan ``None`` kalau ``cfg.schedule == "off"``. Untuk
    ``daily``/``weekly`` selalu mengembalikan datetime di masa depan
    (relatif terhadap ``now``).
    """
    if cfg.schedule == SCHEDULE_OFF:
        return None
    now = now or datetime.now()
    target = now.replace(hour=cfg.hour, minute=cfg.minute, second=0, microsecond=0)
    if cfg.schedule == SCHEDULE_DAILY:
        if target <= now:
            target += timedelta(days=1)
        return target
    if cfg.schedule == SCHEDULE_WEEKLY:
        # weekday di Python: Monday=0
        delta_days = (cfg.weekday - now.weekday()) % 7
        target = target + timedelta(days=delta_days)
        if target <= now:
            target += timedelta(days=7)
        return target
    return None


def should_catchup(cfg: BackupConfig, *, now: datetime | None = None) -> bool:
    """True kalau startup harus langsung jalankan backup karena terlewat.

    Logika: kalau schedule aktif dan ``last_run_at`` lebih lama dari
    interval (24 jam untuk daily / 7 hari untuk weekly) ditambah
    :data:`_CATCHUP_GRACE`, jalankan sekarang. Kalau ``last_run_at``
    kosong (pertama kali setting diaktifkan), tunggu jadwal pertama —
    jangan langsung backup.
    """
    if cfg.schedule == SCHEDULE_OFF:
        return False
    if not cfg.last_run_at:
        return False
    try:
        last = datetime.fromisoformat(cfg.last_run_at)
    except ValueError:
        return False
    now = now or datetime.now()
    if cfg.schedule == SCHEDULE_DAILY:
        return (now - last) > timedelta(days=1) + _CATCHUP_GRACE
    if cfg.schedule == SCHEDULE_WEEKLY:
        return (now - last) > timedelta(days=7) + _CATCHUP_GRACE
    return False


# ---------------------------------------------------------------------------
# Scheduler thread
# ---------------------------------------------------------------------------
class BackupScheduler:
    """Singleton scheduler thread.

    Pemakaian normal lewat :func:`get_scheduler`, :func:`start`,
    :func:`stop`, :func:`reload`, :func:`trigger_now`.
    """

    # Berapa lama maksimal sekali ``wait`` — dipotong agar reload settings
    # cepat berlaku walau jadwal masih jauh.
    _POLL_INTERVAL_SEC = 60.0

    def __init__(self, on_result: Callable[[dict], None] | None = None) -> None:
        self._on_result = on_result
        self._wakeup = threading.Event()
        self._stop_evt = threading.Event()
        self._thread: threading.Thread | None = None
        self._lock = threading.Lock()
        self._last_result: dict | None = None
        self._next_run_at: datetime | None = None

    @property
    def is_running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    @property
    def last_result(self) -> dict | None:
        return self._last_result

    @property
    def next_run_at(self) -> datetime | None:
        return self._next_run_at

    def set_callback(self, cb: Callable[[dict], None] | None) -> None:
        self._on_result = cb

    def start(self) -> None:
        with self._lock:
            if self.is_running:
                return
            self._stop_evt.clear()
            self._wakeup.clear()
            self._thread = threading.Thread(
                target=self._run_loop, name="backup-scheduler", daemon=True
            )
            self._thread.start()
        _log.info("Backup scheduler started")

    def stop(self, *, timeout: float = 2.0) -> None:
        with self._lock:
            t = self._thread
            self._stop_evt.set()
            self._wakeup.set()
        if t is not None and t.is_alive():
            t.join(timeout=timeout)
        with self._lock:
            self._thread = None
        _log.info("Backup scheduler stopped")

    def reload(self) -> None:
        """Wake worker thread supaya re-evaluate config dari settings."""
        self._wakeup.set()

    def trigger_now(self, *, user_id: int | None = None) -> dict:
        """Jalankan satu siklus backup sekarang (synchronous, untuk tombol UI).

        Hasilnya juga tercatat ke ``last_result`` & dipanggil callback.
        """
        cfg = BackupConfig.from_settings()
        return self._run_once(cfg, trigger="manual", user_id=user_id)

    # ------------------------------------------------------------------
    def _run_loop(self) -> None:
        # Catch-up di startup
        try:
            cfg = BackupConfig.from_settings()
            if should_catchup(cfg):
                _log.info("Backup terjadwal terlewat, menjalankan catch-up.")
                self._run_once(cfg, trigger="catchup", user_id=None)
        except Exception:  # noqa: BLE001
            _log.exception("Catch-up gagal")

        while not self._stop_evt.is_set():
            try:
                cfg = BackupConfig.from_settings()
            except Exception:  # noqa: BLE001
                _log.exception("Gagal baca config backup")
                cfg = BackupConfig()

            if cfg.schedule == SCHEDULE_OFF:
                self._next_run_at = None
                # Tidur sampai di-wake (set settings = on) atau di-stop.
                self._wakeup.clear()
                self._wakeup.wait(timeout=self._POLL_INTERVAL_SEC)
                continue

            now = datetime.now()
            target = compute_next_run(cfg, now=now)
            self._next_run_at = target
            if target is None:
                self._wakeup.clear()
                self._wakeup.wait(timeout=self._POLL_INTERVAL_SEC)
                continue

            wait_sec = (target - now).total_seconds()
            wait_sec = min(max(wait_sec, 0.0), self._POLL_INTERVAL_SEC)
            self._wakeup.clear()
            woken = self._wakeup.wait(timeout=wait_sec)
            if self._stop_evt.is_set():
                return
            if woken:
                # Settings mungkin berubah — re-evaluate dari atas.
                continue
            # Cek lagi: kalau sudah lewat target, jalankan.
            if datetime.now() >= target:
                self._run_once(cfg, trigger="scheduled", user_id=None)

    def _run_once(self, cfg: BackupConfig, *, trigger: str, user_id: int | None) -> dict:
        folder: str | Path | None = cfg.folder or None
        result = backup_service.run_scheduled_backup(
            folder=folder,
            keep=cfg.retention,
            user_id=user_id,
            trigger=trigger,
        )
        self._last_result = result
        cb = self._on_result
        if cb is not None:
            try:
                cb(result)
            except Exception:  # noqa: BLE001
                _log.exception("Backup result callback raised")
        return result


_scheduler: BackupScheduler | None = None
_scheduler_lock = threading.Lock()


def get_scheduler() -> BackupScheduler:
    """Akses singleton scheduler."""
    global _scheduler
    if _scheduler is None:
        with _scheduler_lock:
            if _scheduler is None:
                _scheduler = BackupScheduler()
    return _scheduler


def reset_scheduler_for_tests() -> None:
    """Reset singleton (HANYA untuk tests)."""
    global _scheduler
    with _scheduler_lock:
        if _scheduler is not None:
            _scheduler.stop(timeout=0.1)
        _scheduler = None
