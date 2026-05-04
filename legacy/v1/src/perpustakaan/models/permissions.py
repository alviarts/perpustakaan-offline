"""Repository tabel ``permissions`` & ``user_permissions`` (RBAC v0.4.3).

Layer ini hanya bertanggung jawab atas akses DB. Logic bisnis (audit log,
default presets, validasi key) ditangani oleh
``services.permissions``.
"""
from __future__ import annotations

from collections.abc import Iterable

from perpustakaan.db.connection import Database, get_db, transaction


# ---------------------------------------------------------------------------
# Catalog (permissions table)
# ---------------------------------------------------------------------------
def upsert_permission(
    *,
    key: str,
    label: str,
    description: str,
    area: str,
    sort_order: int,
    db: Database | None = None,
) -> None:
    """Insert (atau update label/area/sort_order) permission key.

    Sengaja dibuat idempotent supaya bisa dipanggil ulang setiap startup tanpa
    efek samping selain meng-sync label.
    """
    db = db or get_db()
    with transaction(db):
        db.execute(
            "INSERT INTO permissions (key, label, description, area, sort_order) "
            "VALUES (?, ?, ?, ?, ?) "
            "ON CONFLICT(key) DO UPDATE SET "
            "    label = excluded.label, "
            "    description = excluded.description, "
            "    area = excluded.area, "
            "    sort_order = excluded.sort_order",
            (key, label, description, area, sort_order),
        )


def list_permissions(db: Database | None = None) -> list[dict]:
    """Daftar semua permission key yang ter-register, urut sesuai ``sort_order``."""
    db = db or get_db()
    return db.query_all(
        "SELECT key, label, description, area, sort_order "
        "FROM permissions ORDER BY sort_order, key"
    )


# ---------------------------------------------------------------------------
# Grants (user_permissions table)
# ---------------------------------------------------------------------------
def has_grant(user_id: int, permission_key: str, db: Database | None = None) -> bool:
    """``True`` jika user punya grant aktif untuk permission_key."""
    db = db or get_db()
    row = db.query_one(
        "SELECT 1 FROM user_permissions WHERE user_id = ? AND permission_key = ? LIMIT 1",
        (user_id, permission_key),
    )
    return row is not None


def list_grants_for_user(user_id: int, db: Database | None = None) -> list[str]:
    """Return list permission_key yang sudah di-grant ke user."""
    db = db or get_db()
    rows = db.query_all(
        "SELECT permission_key FROM user_permissions WHERE user_id = ? ORDER BY permission_key",
        (user_id,),
    )
    return [r["permission_key"] for r in rows]


def grant(
    user_id: int,
    permission_key: str,
    *,
    granted_by: int | None = None,
    db: Database | None = None,
) -> bool:
    """Grant permission ke user. Idempotent — return ``True`` kalau benar-benar
    membuat baris baru, ``False`` kalau sudah ada sebelumnya.
    """
    db = db or get_db()
    if has_grant(user_id, permission_key, db=db):
        return False
    with transaction(db):
        db.execute(
            "INSERT OR IGNORE INTO user_permissions "
            "(user_id, permission_key, granted_by) VALUES (?, ?, ?)",
            (user_id, permission_key, granted_by),
        )
    return True


def grant_many(
    user_id: int,
    permission_keys: Iterable[str],
    *,
    granted_by: int | None = None,
    db: Database | None = None,
) -> int:
    """Bulk-grant. Return jumlah baris baru yang benar-benar dimasukkan."""
    db = db or get_db()
    keys = list(permission_keys)
    if not keys:
        return 0
    existing = set(list_grants_for_user(user_id, db=db))
    to_insert = [(user_id, k, granted_by) for k in keys if k not in existing]
    if not to_insert:
        return 0
    with transaction(db):
        db.executemany(
            "INSERT OR IGNORE INTO user_permissions "
            "(user_id, permission_key, granted_by) VALUES (?, ?, ?)",
            to_insert,
        )
    return len(to_insert)


def revoke(
    user_id: int,
    permission_key: str,
    *,
    db: Database | None = None,
) -> bool:
    """Cabut permission. Return ``True`` kalau benar-benar menghapus baris."""
    db = db or get_db()
    with transaction(db):
        cur = db.execute(
            "DELETE FROM user_permissions WHERE user_id = ? AND permission_key = ?",
            (user_id, permission_key),
        )
        return (cur.rowcount or 0) > 0


def revoke_all_for_user(user_id: int, db: Database | None = None) -> int:
    """Hapus semua grant milik user (dipakai saat reset hak akses)."""
    db = db or get_db()
    with transaction(db):
        cur = db.execute(
            "DELETE FROM user_permissions WHERE user_id = ?", (user_id,)
        )
        return cur.rowcount or 0


def count_grants(user_id: int, db: Database | None = None) -> int:
    db = db or get_db()
    return int(
        db.scalar(
            "SELECT COUNT(*) FROM user_permissions WHERE user_id = ?",
            (user_id,),
        )
        or 0
    )


def users_without_grants(db: Database | None = None) -> list[dict]:
    """User yang belum punya grant satupun (dipakai migrasi default per role)."""
    db = db or get_db()
    return db.query_all(
        "SELECT u.id, u.username, u.role "
        "FROM users u "
        "LEFT JOIN user_permissions up ON up.user_id = u.id "
        "WHERE up.user_id IS NULL"
    )
