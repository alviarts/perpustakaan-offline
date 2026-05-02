"""Test backup terjadwal: backup_service + backup_scheduler."""
from __future__ import annotations

import time
from datetime import datetime, timedelta
from pathlib import Path


def _seed_backup_files(folder: Path, count: int, *, base_time: float | None = None) -> list[Path]:
    """Buat ``count`` file backup palsu dengan mtime yang dijamin terurut."""
    folder.mkdir(parents=True, exist_ok=True)
    base = base_time or time.time()
    paths: list[Path] = []
    for i in range(count):
        ts = datetime.fromtimestamp(base - i * 3600).strftime("%Y%m%d_%H%M%S")
        # Tambah suffix supaya nama unik walau timestamp sama.
        p = folder / f"perpustakaan_{ts}_{i}.db"
        p.write_bytes(f"db-{i}".encode())
        # Set mtime eksplisit supaya urutan terbaru→terlama jelas.
        os_mtime = base - i * 3600
        import os as _os
        _os.utime(p, (os_mtime, os_mtime))
        paths.append(p)
    return paths


# ---------------------------------------------------------------------------
# backup_service primitives
# ---------------------------------------------------------------------------
class TestBackupService:
    def test_backup_db_creates_copy(self, fresh_db, tmp_path):
        from perpustakaan.services import backup_service

        target = tmp_path / "backups"
        out = backup_service.backup_db(target)
        assert out.exists()
        assert out.parent == target
        assert out.name.startswith("perpustakaan_") and out.suffix == ".db"

    def test_backup_db_default_folder(self, fresh_db):
        from perpustakaan.config import BACKUPS_DIR
        from perpustakaan.services import backup_service

        out = backup_service.backup_db()
        assert out.parent == BACKUPS_DIR
        out.unlink(missing_ok=True)

    def test_resolve_backup_folder_blank(self, fresh_db):
        from perpustakaan.config import BACKUPS_DIR
        from perpustakaan.services import backup_service

        assert backup_service.resolve_backup_folder(None) == BACKUPS_DIR
        assert backup_service.resolve_backup_folder("") == BACKUPS_DIR
        assert backup_service.resolve_backup_folder("   ") == BACKUPS_DIR

    def test_list_backups_sorted_newest_first(self, fresh_db, tmp_path):
        from perpustakaan.services import backup_service

        folder = tmp_path / "bk"
        _seed_backup_files(folder, 5)
        rows = backup_service.list_backups(folder)
        assert len(rows) == 5
        # Mtime descending.
        for i in range(len(rows) - 1):
            assert rows[i]["mtime"] >= rows[i + 1]["mtime"]

    def test_list_backups_ignores_non_matching(self, fresh_db, tmp_path):
        from perpustakaan.services import backup_service

        folder = tmp_path / "bk"
        _seed_backup_files(folder, 2)
        (folder / "random.txt").write_text("ignore me")
        (folder / "perpustakaan_invalid.db").write_text("x")  # masih cocok glob
        rows = backup_service.list_backups(folder)
        names = [r["name"] for r in rows]
        assert all(n.endswith(".db") for n in names)
        assert "random.txt" not in names

    def test_list_backups_missing_folder(self, fresh_db, tmp_path):
        from perpustakaan.services import backup_service

        rows = backup_service.list_backups(tmp_path / "does-not-exist")
        assert rows == []

    def test_prune_keeps_latest_n(self, fresh_db, tmp_path):
        from perpustakaan.services import backup_service

        folder = tmp_path / "bk"
        _seed_backup_files(folder, 10)
        deleted = backup_service.prune_backups(folder, keep=3)
        assert len(deleted) == 7
        remaining = backup_service.list_backups(folder)
        assert len(remaining) == 3

    def test_prune_keep_zero_or_negative_no_op(self, fresh_db, tmp_path):
        from perpustakaan.services import backup_service

        folder = tmp_path / "bk"
        _seed_backup_files(folder, 5)
        assert backup_service.prune_backups(folder, keep=0) == []
        assert backup_service.prune_backups(folder, keep=-1) == []
        assert len(backup_service.list_backups(folder)) == 5

    def test_run_scheduled_backup_writes_status_and_audit(self, fresh_db, tmp_path):
        from perpustakaan.models import audit_log as audit_log_repo
        from perpustakaan.models import settings as settings_repo
        from perpustakaan.services import backup_service

        folder = tmp_path / "bk"
        result = backup_service.run_scheduled_backup(
            folder=folder, keep=5, trigger="manual"
        )
        assert result["status"] == "success"
        assert result["path"]
        assert Path(result["path"]).exists()
        assert settings_repo.get_value("backup.last_run_at") == result["at"]
        assert settings_repo.get_value("backup.last_run_status") == "success"

        # Audit log harus tercatat.
        rows = audit_log_repo.list_all(search="backup", limit=20)
        assert any(r["aksi"] == "backup_ok" for r in rows)

    def test_run_scheduled_backup_failure_marked(self, fresh_db, monkeypatch, tmp_path):
        from perpustakaan.models import settings as settings_repo
        from perpustakaan.services import backup_service

        def boom(*_a, **_kw):
            raise RuntimeError("disk full")

        monkeypatch.setattr(backup_service, "backup_db", boom)
        result = backup_service.run_scheduled_backup(
            folder=tmp_path / "bk", trigger="scheduled"
        )
        assert result["status"] == "failed"
        assert "disk full" in result["error"]
        assert settings_repo.get_value("backup.last_run_status") == "failed"


# ---------------------------------------------------------------------------
# backup_scheduler logic
# ---------------------------------------------------------------------------
class TestBackupSchedulerCompute:
    def test_off_returns_none(self, fresh_db):
        from perpustakaan.services import backup_scheduler as bs

        cfg = bs.BackupConfig(schedule="off")
        assert bs.compute_next_run(cfg) is None

    def test_daily_in_future_today(self, fresh_db):
        from perpustakaan.services import backup_scheduler as bs

        now = datetime(2026, 1, 1, 8, 0, 0)
        cfg = bs.BackupConfig(schedule="daily", hour=20, minute=30)
        nxt = bs.compute_next_run(cfg, now=now)
        assert nxt == datetime(2026, 1, 1, 20, 30, 0)

    def test_daily_already_passed_means_tomorrow(self, fresh_db):
        from perpustakaan.services import backup_scheduler as bs

        now = datetime(2026, 1, 1, 23, 0, 0)
        cfg = bs.BackupConfig(schedule="daily", hour=2, minute=0)
        nxt = bs.compute_next_run(cfg, now=now)
        assert nxt == datetime(2026, 1, 2, 2, 0, 0)

    def test_weekly_picks_correct_weekday(self, fresh_db):
        from perpustakaan.services import backup_scheduler as bs

        # 2026-01-01 = Kamis (weekday=3)
        now = datetime(2026, 1, 1, 8, 0, 0)
        # weekday=0 (Senin), jam 02:00 -> Senin berikutnya 2026-01-05.
        cfg = bs.BackupConfig(schedule="weekly", hour=2, minute=0, weekday=0)
        nxt = bs.compute_next_run(cfg, now=now)
        assert nxt == datetime(2026, 1, 5, 2, 0, 0)

    def test_weekly_same_weekday_already_passed_means_next_week(self, fresh_db):
        from perpustakaan.services import backup_scheduler as bs

        # Kamis 23:00, jadwal Kamis 02:00 -> harusnya Kamis depan.
        now = datetime(2026, 1, 1, 23, 0, 0)
        cfg = bs.BackupConfig(schedule="weekly", hour=2, minute=0, weekday=3)
        nxt = bs.compute_next_run(cfg, now=now)
        assert nxt == datetime(2026, 1, 8, 2, 0, 0)

    def test_should_catchup_no_last_run(self, fresh_db):
        from perpustakaan.services import backup_scheduler as bs

        cfg = bs.BackupConfig(schedule="daily")
        assert bs.should_catchup(cfg) is False

    def test_should_catchup_recent_run(self, fresh_db):
        from perpustakaan.services import backup_scheduler as bs

        now = datetime(2026, 1, 2, 9, 0, 0)
        cfg = bs.BackupConfig(
            schedule="daily",
            last_run_at=(now - timedelta(hours=12)).isoformat(),
        )
        assert bs.should_catchup(cfg, now=now) is False

    def test_should_catchup_overdue_daily(self, fresh_db):
        from perpustakaan.services import backup_scheduler as bs

        now = datetime(2026, 1, 5, 9, 0, 0)
        cfg = bs.BackupConfig(
            schedule="daily",
            last_run_at=(now - timedelta(days=2)).isoformat(),
        )
        assert bs.should_catchup(cfg, now=now) is True

    def test_should_catchup_overdue_weekly(self, fresh_db):
        from perpustakaan.services import backup_scheduler as bs

        now = datetime(2026, 1, 20, 9, 0, 0)
        cfg = bs.BackupConfig(
            schedule="weekly",
            last_run_at=(now - timedelta(days=10)).isoformat(),
        )
        assert bs.should_catchup(cfg, now=now) is True

    def test_should_catchup_off_returns_false(self, fresh_db):
        from perpustakaan.services import backup_scheduler as bs

        now = datetime(2026, 1, 5, 9, 0, 0)
        cfg = bs.BackupConfig(
            schedule="off",
            last_run_at=(now - timedelta(days=10)).isoformat(),
        )
        assert bs.should_catchup(cfg, now=now) is False


class TestBackupSchedulerConfig:
    def test_from_settings_defaults_to_off(self, fresh_db):
        from perpustakaan.services import backup_scheduler as bs

        cfg = bs.BackupConfig.from_settings()
        assert cfg.schedule == "off"
        assert cfg.hour == 2
        assert cfg.retention == 7

    def test_from_settings_round_trip(self, fresh_db):
        from perpustakaan.models import settings as settings_repo
        from perpustakaan.services import backup_scheduler as bs

        settings_repo.set_many(
            {
                "backup.schedule": "weekly",
                "backup.time": "23:45",
                "backup.weekday": "5",
                "backup.folder": "/tmp/foo",
                "backup.retention": "12",
            }
        )
        cfg = bs.BackupConfig.from_settings()
        assert cfg.schedule == "weekly"
        assert (cfg.hour, cfg.minute) == (23, 45)
        assert cfg.weekday == 5
        assert cfg.folder == "/tmp/foo"
        assert cfg.retention == 12

    def test_invalid_time_falls_back_to_default(self, fresh_db):
        from perpustakaan.models import settings as settings_repo
        from perpustakaan.services import backup_scheduler as bs

        settings_repo.set_value("backup.time", "garbage")
        cfg = bs.BackupConfig.from_settings()
        assert (cfg.hour, cfg.minute) == (2, 0)

    def test_invalid_schedule_falls_back_to_off(self, fresh_db):
        from perpustakaan.models import settings as settings_repo
        from perpustakaan.services import backup_scheduler as bs

        settings_repo.set_value("backup.schedule", "monthly")
        cfg = bs.BackupConfig.from_settings()
        assert cfg.schedule == "off"


class TestBackupSchedulerLifecycle:
    def test_singleton_returns_same_instance(self, fresh_db):
        from perpustakaan.services import backup_scheduler as bs

        bs.reset_scheduler_for_tests()
        try:
            a = bs.get_scheduler()
            b = bs.get_scheduler()
            assert a is b
        finally:
            bs.reset_scheduler_for_tests()

    def test_trigger_now_runs_backup(self, fresh_db, tmp_path):
        from perpustakaan.models import settings as settings_repo
        from perpustakaan.services import backup_scheduler as bs

        bs.reset_scheduler_for_tests()
        try:
            settings_repo.set_many(
                {"backup.folder": str(tmp_path / "bk"), "backup.retention": "3"}
            )
            sched = bs.get_scheduler()
            result = sched.trigger_now()
            assert result["status"] == "success"
            assert Path(result["path"]).exists()
            assert sched.last_result is not None
        finally:
            bs.reset_scheduler_for_tests()

    def test_callback_called_on_trigger(self, fresh_db, tmp_path):
        from perpustakaan.models import settings as settings_repo
        from perpustakaan.services import backup_scheduler as bs

        bs.reset_scheduler_for_tests()
        try:
            settings_repo.set_value("backup.folder", str(tmp_path / "bk"))
            received: list[dict] = []
            sched = bs.get_scheduler()
            sched.set_callback(received.append)
            sched.trigger_now()
            assert len(received) == 1
            assert received[0]["status"] == "success"
        finally:
            bs.reset_scheduler_for_tests()


# ---------------------------------------------------------------------------
# Audit log helper
# ---------------------------------------------------------------------------
class TestAuditLogRecord:
    def test_record_inserts_row(self, fresh_db):
        from perpustakaan.models import audit_log as audit_log_repo

        rid = audit_log_repo.record(
            aksi="backup_ok", entitas="backup", detail="trigger=manual"
        )
        assert rid > 0
        rows = audit_log_repo.list_all(search="backup_ok", limit=10)
        assert any(r["id"] == rid for r in rows)


# ---------------------------------------------------------------------------
# Tutorial flag (settings-based)
# ---------------------------------------------------------------------------
class TestTutorialFlag:
    def test_default_empty(self, fresh_db):
        from perpustakaan.models import settings as settings_repo

        assert (settings_repo.get_value("tutorial.completed") or "") == ""

    def test_mark_completed(self, fresh_db):
        from perpustakaan.models import settings as settings_repo

        settings_repo.set_value("tutorial.completed", "1")
        assert settings_repo.get_value("tutorial.completed") == "1"
