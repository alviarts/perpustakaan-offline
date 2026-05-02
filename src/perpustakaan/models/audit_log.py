"""Repository untuk tabel audit_log."""
from __future__ import annotations

from perpustakaan.db.connection import Database, get_db, transaction


def record(
    *,
    aksi: str,
    entitas: str,
    entitas_id: int | None = None,
    detail: str | None = None,
    user_id: int | None = None,
    db: Database | None = None,
) -> int:
    """Tulis satu entri audit log.

    Mengembalikan id baris yang dibuat. Tidak melempar — error di-log
    via warning saja supaya operasi inti (mis. backup, login) tetap jalan
    walau tabel audit_log kebetulan locked.
    """
    db = db or get_db()
    try:
        with transaction(db):
            cur = db.execute(
                "INSERT INTO audit_log (user_id, aksi, entitas, entitas_id, detail) "
                "VALUES (?, ?, ?, ?, ?)",
                (user_id, aksi, entitas, entitas_id, detail),
            )
            return int(cur.lastrowid or 0)
    except Exception:  # noqa: BLE001 - audit log harus tahan banting
        import logging

        logging.getLogger("perpustakaan.audit_log").warning(
            "Gagal tulis audit log: %s/%s", aksi, entitas, exc_info=True
        )
        return 0


def list_all(
    *,
    search: str = "",
    limit: int = 200,
    db: Database | None = None,
) -> list[dict]:
    """Ambil daftar audit log, terbaru duluan."""
    db = db or get_db()
    sql = (
        "SELECT al.id, al.aksi, al.entitas, al.entitas_id, al.detail, "
        "al.created_at, COALESCE(u.username, '—') AS username "
        "FROM audit_log al "
        "LEFT JOIN users u ON u.id = al.user_id "
    )
    params: list[str] = []
    if search:
        sql += "WHERE al.aksi LIKE ? OR al.entitas LIKE ? OR u.username LIKE ? "
        pat = f"%{search}%"
        params = [pat, pat, pat]
    sql += "ORDER BY al.created_at DESC LIMIT ?"
    params.append(str(limit))
    return db.query_all(sql, tuple(params))


def count(db: Database | None = None) -> int:
    db = db or get_db()
    return int(db.scalar("SELECT COUNT(*) FROM audit_log") or 0)
