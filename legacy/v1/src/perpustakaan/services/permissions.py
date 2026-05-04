"""Service permission (RBAC v0.4.3).

API tingkat tinggi: ``has_permission``, ``current_has``, ``set_user_permissions``,
``grant``, ``revoke``. Setiap perubahan grant otomatis tercatat di audit log
(``permission_granted`` / ``permission_revoked``).
"""
from __future__ import annotations

import json
from collections.abc import Iterable

from perpustakaan.db.connection import Database, get_db
from perpustakaan.models import audit_log as audit_log_repo
from perpustakaan.models import permissions as permissions_repo
from perpustakaan.services import auth as auth_service
from perpustakaan.services.permissions_registry import (
    PERMISSION_KEYS,
    default_permissions_for_role,
    permissions_by_area,
)

__all__ = [
    "PermissionError",
    "current_has",
    "current_user_permissions",
    "grant",
    "grant_many",
    "has_permission",
    "permissions_by_area",
    "require",
    "revoke",
    "set_user_permissions",
    "user_permissions",
]


class PermissionError(Exception):
    """Akses ditolak / permission key tidak dikenal."""


# ---------------------------------------------------------------------------
# Validasi key
# ---------------------------------------------------------------------------
def _ensure_known(key: str) -> None:
    if key not in PERMISSION_KEYS:
        raise PermissionError(f"unknown_permission:{key}")


# ---------------------------------------------------------------------------
# Read API
# ---------------------------------------------------------------------------
def has_permission(
    user_id: int | None,
    permission_key: str,
    *,
    db: Database | None = None,
) -> bool:
    """``True`` jika user (by id) punya permission. Untuk user_id None / 0
    selalu return ``False``.
    """
    if not user_id:
        return False
    _ensure_known(permission_key)
    return permissions_repo.has_grant(int(user_id), permission_key, db=db)


def current_has(permission_key: str, *, db: Database | None = None) -> bool:
    """Cek permission untuk user yang sedang login (session aktif).

    Return ``False`` kalau tidak ada session aktif.
    """
    user = auth_service.current_user()
    if user is None:
        return False
    return has_permission(user.id, permission_key, db=db)


def user_permissions(user_id: int, *, db: Database | None = None) -> list[str]:
    return permissions_repo.list_grants_for_user(user_id, db=db)


def current_user_permissions(*, db: Database | None = None) -> list[str]:
    user = auth_service.current_user()
    if user is None:
        return []
    return user_permissions(user.id, db=db)


def require(permission_key: str, *, db: Database | None = None) -> None:
    """Raise :class:`PermissionError` kalau current user belum punya permission.

    Berguna untuk hard-gate di service layer; UI biasanya pakai
    ``current_has`` agar tombol tinggal di-disable.
    """
    if not current_has(permission_key, db=db):
        raise PermissionError(f"access_denied:{permission_key}")


# ---------------------------------------------------------------------------
# Mutations (grant / revoke) — audit-logged
# ---------------------------------------------------------------------------
def grant(
    user_id: int,
    permission_key: str,
    *,
    granted_by: int | None = None,
    db: Database | None = None,
) -> bool:
    """Grant satu permission. Return ``True`` kalau baru di-insert."""
    _ensure_known(permission_key)
    db = db or get_db()
    inserted = permissions_repo.grant(
        user_id, permission_key, granted_by=granted_by, db=db
    )
    if inserted:
        audit_log_repo.record(
            aksi="permission_granted",
            entitas="user_permissions",
            entitas_id=user_id,
            detail=json.dumps(
                {"permission_key": permission_key, "granted_by": granted_by},
                ensure_ascii=False,
            ),
            user_id=granted_by,
            db=db,
        )
    return inserted


def grant_many(
    user_id: int,
    permission_keys: Iterable[str],
    *,
    granted_by: int | None = None,
    db: Database | None = None,
) -> int:
    """Bulk-grant. Validasi setiap key, lalu satu audit entry per insert."""
    keys = list(permission_keys)
    for k in keys:
        _ensure_known(k)
    db = db or get_db()
    existing = set(permissions_repo.list_grants_for_user(user_id, db=db))
    new_keys = [k for k in keys if k not in existing]
    if not new_keys:
        return 0
    inserted = permissions_repo.grant_many(
        user_id, new_keys, granted_by=granted_by, db=db
    )
    for k in new_keys:
        audit_log_repo.record(
            aksi="permission_granted",
            entitas="user_permissions",
            entitas_id=user_id,
            detail=json.dumps(
                {"permission_key": k, "granted_by": granted_by},
                ensure_ascii=False,
            ),
            user_id=granted_by,
            db=db,
        )
    return inserted


def revoke(
    user_id: int,
    permission_key: str,
    *,
    revoked_by: int | None = None,
    db: Database | None = None,
) -> bool:
    """Cabut satu permission. Return ``True`` kalau benar-benar dihapus."""
    _ensure_known(permission_key)
    db = db or get_db()
    deleted = permissions_repo.revoke(user_id, permission_key, db=db)
    if deleted:
        audit_log_repo.record(
            aksi="permission_revoked",
            entitas="user_permissions",
            entitas_id=user_id,
            detail=json.dumps(
                {"permission_key": permission_key, "revoked_by": revoked_by},
                ensure_ascii=False,
            ),
            user_id=revoked_by,
            db=db,
        )
    return deleted


def set_user_permissions(
    user_id: int,
    desired_keys: Iterable[str],
    *,
    granted_by: int | None = None,
    db: Database | None = None,
) -> tuple[int, int]:
    """Sync permission user agar **persis** sama dengan ``desired_keys``.

    - Permission yang ada di ``desired_keys`` tapi belum di-grant → grant.
    - Permission yang sudah di-grant tapi tidak ada di ``desired_keys`` → revoke.
    - Permission yang sudah di-grant dan ada di ``desired_keys`` → tidak diapa-apakan.

    Return ``(jumlah_grant_baru, jumlah_revoke)``.

    Setiap perubahan tetap menulis satu audit log entry per permission.
    """
    desired = list(desired_keys)
    for k in desired:
        _ensure_known(k)
    db = db or get_db()

    current = set(permissions_repo.list_grants_for_user(user_id, db=db))
    desired_set = set(desired)

    to_grant = sorted(desired_set - current)
    to_revoke = sorted(current - desired_set)

    granted_count = grant_many(
        user_id, to_grant, granted_by=granted_by, db=db
    ) if to_grant else 0
    revoked_count = 0
    for k in to_revoke:
        if revoke(user_id, k, revoked_by=granted_by, db=db):
            revoked_count += 1
    return granted_count, revoked_count


def apply_default_permissions_for_role(
    user_id: int,
    role: str,
    *,
    granted_by: int | None = None,
    db: Database | None = None,
) -> int:
    """Grant default permission set milik role tertentu ke user.

    Idempotent — kalau user sudah punya beberapa, hanya yang missing yang
    di-grant. Berguna saat user baru dibuat atau saat upgrade dari versi lama
    (lihat ``seed.seed_default_user_permissions``).

    Return jumlah grant baru yang dimasukkan.
    """
    defaults = default_permissions_for_role(role)
    if not defaults:
        return 0
    return grant_many(user_id, defaults, granted_by=granted_by, db=db)
