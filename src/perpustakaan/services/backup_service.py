"""Backup & Reset database."""
from __future__ import annotations

import shutil
from datetime import datetime
from pathlib import Path

from perpustakaan.config import BACKUPS_DIR, DB_PATH
from perpustakaan.db.connection import Database, get_db, transaction


def backup_db(target_dir: Path | None = None) -> Path:
    target_dir = target_dir or BACKUPS_DIR
    target_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out = target_dir / f"perpustakaan_{ts}.db"
    shutil.copy2(DB_PATH, out)
    return out


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
