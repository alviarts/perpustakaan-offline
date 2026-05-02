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
    row = db.query_one("SELECT password_hash, username FROM users WHERE id = ?", (user_id,))
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
    _audit(
        "password_changed",
        entitas="user",
        entitas_id=user_id,
        detail={"username": row["username"]},
        user_id=user_id,
        db=db,
    )


def delete_user(user_id: int, db: Database | None = None) -> None:
    db = db or get_db()
    with transaction(db):
        db.execute("DELETE FROM users WHERE id = ?", (user_id,))


# ---------------------------------------------------------------------------
# Security question (PR-C v0.4.4) — utk reset password kalau user lupa.
# Jawaban di-hash bcrypt persis seperti password.
# ---------------------------------------------------------------------------
DEFAULT_SECURITY_QUESTIONS: tuple[str, ...] = (
    "Nama hewan peliharaan pertama Anda?",
    "Kota tempat lahir ibu Anda?",
    "Nama sekolah dasar Anda?",
    "Buku favorit masa kecil Anda?",
    "Nama tengah ayah Anda?",
)


def _normalize_answer(answer: str) -> str:
    """Normalisasi jawaban: lowercase + strip whitespace di awal/akhir + collapse spasi.

    Supaya jawaban "Bandung " dan "bandung" cocok. Tidak menormalkan tanda
    baca / aksen — kalau user pakai aksen pertama kali, harus pakai aksen
    saat reset juga.
    """
    return " ".join(answer.strip().lower().split())


def _hash_answer(answer: str) -> str:
    return bcrypt.hashpw(
        _normalize_answer(answer).encode("utf-8"),
        bcrypt.gensalt(rounds=10),
    ).decode("utf-8")


def _verify_answer(answer: str, answer_hash: str) -> bool:
    try:
        return bcrypt.checkpw(
            _normalize_answer(answer).encode("utf-8"),
            answer_hash.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False


def needs_security_setup(user_id: int, db: Database | None = None) -> bool:
    """True jika user belum pernah set security question (kolom NULL/kosong).

    Dipakai oleh login flow untuk memunculkan first-login wizard wajib bagi
    user lama yang dibuat di v0.4.0–v0.4.3 sebelum security question feature
    di-introduce.
    """
    db = db or get_db()
    row = db.query_one(
        "SELECT security_question, security_answer_hash FROM users WHERE id = ?",
        (user_id,),
    )
    if row is None:
        return False
    q = (row.get("security_question") or "").strip()
    h = (row.get("security_answer_hash") or "").strip()
    return not (q and h)


def get_security_question(username: str, db: Database | None = None) -> str | None:
    """Return security question untuk ``username`` atau ``None`` kalau tidak
    ada / user tidak set.

    Sengaja TIDAK membedakan antara "user tidak ada" vs "user belum set"
    untuk hindari user enumeration via reset flow.
    """
    db = db or get_db()
    row = db.query_one(
        "SELECT security_question FROM users "
        "WHERE username = ? AND aktif = 1",
        (username,),
    )
    if row is None:
        return None
    q = (row.get("security_question") or "").strip()
    return q or None


def set_security_question(
    user_id: int,
    question: str,
    answer: str,
    db: Database | None = None,
) -> None:
    """Set / update security question + jawaban untuk ``user_id``.

    Question harus non-empty; answer minimal 2 char setelah normalisasi.
    Audit log: ``security_question_set``.
    """
    db = db or get_db()
    q = (question or "").strip()
    a = _normalize_answer(answer or "")
    if not q:
        raise AuthError("question_required")
    if len(a) < 2:
        raise AuthError("answer_too_short")
    row = db.query_one("SELECT username FROM users WHERE id = ?", (user_id,))
    if row is None:
        raise AuthError("user_not_found")
    with transaction(db):
        db.execute(
            "UPDATE users SET security_question = ?, security_answer_hash = ? "
            "WHERE id = ?",
            (q, _hash_answer(a), user_id),
        )
    _audit(
        "security_question_set",
        entitas="user",
        entitas_id=user_id,
        detail={"username": row["username"], "question": q},
        user_id=_current.id if _current is not None else user_id,
        db=db,
    )


def reset_password_via_security_question(
    username: str,
    answer: str,
    new_password: str,
    db: Database | None = None,
) -> None:
    """Reset password tanpa password lama, asalkan jawaban security question
    cocok.

    Validasi:
    - User ada & aktif
    - Security question + answer_hash sudah di-set (tidak NULL)
    - Jawaban cocok (case + whitespace insensitive)
    - Password baru minimal 6 char

    Audit: ``password_reset_via_security_question`` (success only).

    Untuk hindari user enumeration, error message generik
    (``invalid_credentials``) dipakai untuk: user tidak ada, user tidak
    aktif, security question belum di-set, atau jawaban salah.
    """
    db = db or get_db()
    if len(new_password) < 6:
        raise AuthError("password_too_short")
    row = db.query_one(
        "SELECT id, security_question, security_answer_hash "
        "FROM users WHERE username = ? AND aktif = 1",
        (username,),
    )
    if row is None:
        raise AuthError("invalid_credentials")
    answer_hash = (row.get("security_answer_hash") or "").strip()
    question = (row.get("security_question") or "").strip()
    if not (answer_hash and question):
        raise AuthError("invalid_credentials")
    if not _verify_answer(answer, answer_hash):
        raise AuthError("invalid_credentials")
    user_id = int(row["id"])
    with transaction(db):
        db.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (hash_password(new_password), user_id),
        )
    _audit(
        "password_reset_via_security_question",
        entitas="user",
        entitas_id=user_id,
        detail={"username": username},
        user_id=user_id,
        db=db,
    )


# ---------------------------------------------------------------------------
# Audit log helper — local import supaya tidak circular.
# ---------------------------------------------------------------------------
def _audit(
    aksi: str,
    *,
    entitas: str,
    entitas_id: int,
    detail: dict | None = None,
    user_id: int | None = None,
    db: Database | None = None,
) -> None:
    """Tulis ke audit_log; swallow error supaya tidak gagalkan operasi inti."""
    try:
        import json

        from perpustakaan.models import audit_log as audit_log_repo

        audit_log_repo.record(
            aksi=aksi,
            entitas=entitas,
            entitas_id=entitas_id,
            detail=json.dumps(detail or {}, ensure_ascii=False),
            user_id=user_id,
            db=db,
        )
    except Exception:  # noqa: BLE001
        import logging

        logging.getLogger("perpustakaan.auth").warning(
            "Gagal tulis audit log %s utk %s#%s", aksi, entitas, entitas_id,
            exc_info=True,
        )


def list_users(db: Database | None = None) -> list[dict]:
    db = db or get_db()
    return db.query_all(
        "SELECT u.id, u.username, u.full_name, u.role, u.aktif, "
        "       u.last_login_at, u.created_at, "
        "       (SELECT COUNT(*) FROM user_permissions up WHERE up.user_id = u.id) "
        "         AS permission_count "
        "FROM users u ORDER BY u.username"
    )
