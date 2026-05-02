"""Repository untuk tabel audit_log."""
from __future__ import annotations

from perpustakaan.db.connection import Database, get_db


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
