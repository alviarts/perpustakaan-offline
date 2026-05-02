"""Backup & Reset database.

Selain backup manual ada juga *backup terjadwal* yang dipicu oleh
:mod:`perpustakaan.services.backup_scheduler`. Modul ini menyediakan
primitif yang dipakai keduanya:

- :func:`backup_db`: copy file SQLite ke folder tujuan dengan timestamp.
- :func:`list_backups`: daftar file backup dalam suatu folder, terbaru duluan.
- :func:`prune_backups`: pertahankan N file terbaru, hapus sisanya.
- :func:`run_scheduled_backup`: orkestrasi backup terjadwal — backup +
  prune + tulis status ke ``settings`` + audit log.
"""
from __future__ import annotations

import logging
import shutil
from datetime import datetime
from pathlib import Path

from perpustakaan.config import BACKUPS_DIR, DB_PATH
from perpustakaan.db.connection import Database, get_db, transaction

_log = logging.getLogger("perpustakaan.backup")

_BACKUP_GLOB = "perpustakaan_*.db"


def resolve_backup_folder(folder: str | Path | None = None) -> Path:
    """Resolve folder backup; kalau ``folder`` kosong/None pakai ``BACKUPS_DIR``."""
    if folder is None or (isinstance(folder, str) and not folder.strip()):
        return BACKUPS_DIR
    return Path(folder).expanduser()


def backup_db(target_dir: Path | str | None = None, db_path: Path | None = None) -> Path:
    """Backup file SQLite ke ``target_dir`` (default ``BACKUPS_DIR``).

    Nama file mengikuti pola ``perpustakaan_YYYYMMDD_HHMMSS.db`` sehingga
    :func:`list_backups` & :func:`prune_backups` bisa mengenalinya.
    """
    target = resolve_backup_folder(target_dir)
    target.mkdir(parents=True, exist_ok=True)
    src = Path(db_path) if db_path else DB_PATH
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out = target / f"perpustakaan_{ts}.db"
    shutil.copy2(src, out)
    return out


def list_backups(folder: str | Path | None = None) -> list[dict]:
    """Daftar file backup di ``folder`` (terbaru duluan).

    Tiap entri berisi ``path`` (Path), ``name``, ``size_bytes``, ``mtime``
    (datetime), dan ``mtime_str`` (untuk display).
    """
    folder = resolve_backup_folder(folder)
    if not folder.exists():
        return []
    rows: list[dict] = []
    for p in folder.glob(_BACKUP_GLOB):
        try:
            st = p.stat()
        except OSError:
            continue
        if not p.is_file():
            continue
        mtime = datetime.fromtimestamp(st.st_mtime)
        rows.append(
            {
                "path": p,
                "name": p.name,
                "size_bytes": st.st_size,
                "mtime": mtime,
                "mtime_str": mtime.strftime("%Y-%m-%d %H:%M:%S"),
            }
        )
    rows.sort(key=lambda r: r["mtime"], reverse=True)
    return rows


def prune_backups(folder: str | Path | None = None, *, keep: int = 7) -> list[Path]:
    """Pertahankan ``keep`` backup terbaru, hapus sisanya.

    Mengembalikan list ``Path`` yang dihapus. ``keep <= 0`` artinya
    tidak ada retention (tidak ada file yang dihapus).
    """
    if keep <= 0:
        return []
    rows = list_backups(folder)
    deleted: list[Path] = []
    for row in rows[keep:]:
        try:
            row["path"].unlink()
            deleted.append(row["path"])
        except OSError as exc:
            _log.warning("Gagal hapus backup lama %s: %s", row["path"], exc)
    return deleted


def run_scheduled_backup(
    *,
    folder: str | Path | None = None,
    keep: int = 7,
    user_id: int | None = None,
    trigger: str = "scheduled",
) -> dict:
    """Jalankan satu siklus backup + prune + tulis status.

    Args:
        folder: folder tujuan; ``None`` = pakai ``BACKUPS_DIR``.
        keep: jumlah backup yang dipertahankan.
        user_id: user yang mentrigger (untuk audit log).
        trigger: ``"scheduled"`` (otomatis) atau ``"manual"`` (tombol UI).

    Returns:
        Dict ``{"status": "success"|"failed", "path": str, "error": str,
        "deleted": int, "at": iso_timestamp}``.
    """
    from perpustakaan.models import audit_log as audit_log_repo
    from perpustakaan.models import settings as settings_repo

    now_iso = datetime.now().isoformat(timespec="seconds")
    result: dict = {
        "status": "success",
        "path": "",
        "error": "",
        "deleted": 0,
        "at": now_iso,
        "trigger": trigger,
    }
    try:
        out_path = backup_db(folder)
        deleted = prune_backups(folder, keep=keep)
        result["path"] = str(out_path)
        result["deleted"] = len(deleted)
    except Exception as exc:  # noqa: BLE001
        _log.exception("Backup terjadwal gagal")
        result["status"] = "failed"
        result["error"] = f"{type(exc).__name__}: {exc}"

    try:
        settings_repo.set_many(
            {
                "backup.last_run_at": result["at"],
                "backup.last_run_status": result["status"],
                "backup.last_run_path": result["path"],
                "backup.last_run_error": result["error"],
            }
        )
    except Exception:  # noqa: BLE001
        _log.warning("Gagal simpan status backup terjadwal", exc_info=True)

    audit_log_repo.record(
        aksi=("backup_ok" if result["status"] == "success" else "backup_failed"),
        entitas="backup",
        detail=(
            f"trigger={trigger} path={Path(result['path']).name if result['path'] else '-'} "
            f"deleted={result['deleted']} error={result['error'] or '-'}"
        ),
        user_id=user_id,
    )
    return result


def reset_transaksi(*, keep_outstanding: bool = True, db: Database | None = None) -> None:
    """Reset data transaksi (peminjaman, kunjungan, kas).

    :param keep_outstanding: jika True, peminjaman yang belum dikembalikan tidak dihapus.
    """
    db = db or get_db()
    with transaction(db):
        db.execute("DELETE FROM kunjungan")
        db.execute("DELETE FROM kas")
        if keep_outstanding:
            db.execute(
                "DELETE FROM peminjaman_item "
                "WHERE peminjaman_id IN ("
                "  SELECT id FROM peminjaman WHERE status = 'dikembalikan'"
                ")"
            )
            db.execute("DELETE FROM peminjaman WHERE status = 'dikembalikan'")
        else:
            db.execute("DELETE FROM peminjaman_item")
            db.execute("DELETE FROM peminjaman")
            db.execute("UPDATE eksemplar SET status = 'tersedia' WHERE status = 'dipinjam'")
            db.execute("UPDATE buku SET jumlah_tersedia = jumlah_eksemplar")
