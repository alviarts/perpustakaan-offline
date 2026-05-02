"""Auth service: hashing password (bcrypt) + login + session state."""
from __future__ import annotations

from dataclasses import dataclass

import bcrypt

from perpustakaan.db.connection import Database, get_db, transaction


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------------------------
# Session state
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class SessionUser:
    id: int
    username: str
    full_name: str
    role: str


_current: SessionUser | None = None


def current_user() -> SessionUser | None:
    return _current


def _set_current(user: SessionUser | None) -> None:
    global _current
    _current = user


# ---------------------------------------------------------------------------
# Login / logout / register
# ---------------------------------------------------------------------------
class AuthError(Exception):
    """Login / register error."""


def login(username: str, password: str, db: Database | None = None) -> SessionUser:
    db = db or get_db()
    row = db.query_one(
        "SELECT id, username, password_hash, full_name, role, aktif "
        "FROM users WHERE username = ?",
        (username,),
    )
    if row is None or not int(row["aktif"]):
        raise AuthError("invalid_credentials")
    if not verify_password(password, row["password_hash"]):
        raise AuthError("invalid_credentials")

    user = SessionUser(
        id=int(row["id"]),
        username=row["username"],
        full_name=row["full_name"],
        role=row["role"],
    )
    _set_current(user)
    db.execute(
        "UPDATE users SET last_login_at = datetime('now') WHERE id = ?",
        (user.id,),
    )
    return user


def logout() -> None:
    _set_current(None)


def register(
    username: str,
    password: str,
    full_name: str,
    role: str = "pustakawan",
    db: Database | None = None,
) -> int:
    db = db or get_db()
    if not username or not password or not full_name:
        raise AuthError("required_fields")
    if len(password) < 6:
        raise AuthError("password_too_short")
    existing = db.query_one("SELECT id FROM users WHERE username = ?", (username,))
    if existing is not None:
        raise AuthError("username_taken")
    pw_hash = hash_password(password)
    with transaction(db):
        cur = db.execute(
            "INSERT INTO users (username, password_hash, full_name, role) "
            "VALUES (?, ?, ?, ?)",
            (username, pw_hash, full_name, role),
        )
    new_id = int(cur.lastrowid or 0)
    # Auto-grant default permission untuk role yang dipilih (RBAC v0.4.3).
    # Import lokal supaya tidak circular dengan services.permissions yang
    # mengimpor auth_service untuk current_user().
    if new_id:
        try:
            from perpustakaan.services import permissions as permissions_service

            granter = _current.id if _current is not None else None
            permissions_service.apply_default_permissions_for_role(
                new_id, role, granted_by=granter, db=db,
            )
        except Exception:  # noqa: BLE001 - jangan gagalkan register kalau audit error
            import logging

            logging.getLogger("perpustakaan.auth").warning(
                "Gagal apply default permissions utk user %s", username,
                exc_info=True,
            )
    return new_id


def change_password(
    user_id: int,
    old_password: str,
    new_password: str,
    db: Database | None = None,
) -> None:
    db = db or get_db()
    row = db.query_one("SELECT password_hash FROM users WHERE id = ?", (user_id,))
    if row is None:
        raise AuthError("user_not_found")
    if not verify_password(old_password, row["password_hash"]):
        raise AuthError("invalid_credentials")
    if len(new_password) < 6:
        raise AuthError("password_too_short")
    with transaction(db):
        db.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (hash_password(new_password), user_id),
        )


def delete_user(user_id: int, db: Database | None = None) -> None:
    db = db or get_db()
    with transaction(db):
        db.execute("DELETE FROM users WHERE id = ?", (user_id,))


def list_users(db: Database | None = None) -> list[dict]:
    db = db or get_db()
    return db.query_all(
        "SELECT u.id, u.username, u.full_name, u.role, u.aktif, "
        "       u.last_login_at, u.created_at, "
        "       (SELECT COUNT(*) FROM user_permissions up WHERE up.user_id = u.id) "
        "         AS permission_count "
        "FROM users u ORDER BY u.username"
    )
