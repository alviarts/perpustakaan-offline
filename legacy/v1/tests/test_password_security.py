"""Test PR-C v0.4.4: ganti password (audit), set/verify security question,
reset password via security question, dan flag ``needs_security_setup``.

Coverage utama:
* ``change_password`` validasi password lama + audit log
* ``set_security_question`` validasi + audit
* ``reset_password_via_security_question`` flow lengkap (success + invalid +
  no-question + password-too-short)
* ``needs_security_setup`` true untuk user lama (kolom NULL), false setelah
  set
* Schema migration: ``_ensure_columns`` idempotent untuk DB existing
"""
from __future__ import annotations

import pytest


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture()
def admin_user_id(fresh_db):
    """Return admin user id (admin user di-seed otomatis oleh seed_all)."""
    from perpustakaan.db.connection import get_db

    row = get_db().query_one("SELECT id FROM users WHERE username = 'admin'")
    assert row is not None
    return int(row["id"])


# ---------------------------------------------------------------------------
# change_password
# ---------------------------------------------------------------------------
def test_change_password_success(admin_user_id):
    from perpustakaan.services import auth

    # Seed default admin password = admin123.
    auth.change_password(admin_user_id, "admin123", "newpass123")
    user = auth.login("admin", "newpass123")
    assert user.id == admin_user_id


def test_change_password_wrong_old(admin_user_id):
    from perpustakaan.services import auth

    with pytest.raises(auth.AuthError) as exc:
        auth.change_password(admin_user_id, "salah", "newpass123")
    assert str(exc.value) == "invalid_credentials"


def test_change_password_too_short(admin_user_id):
    from perpustakaan.services import auth

    with pytest.raises(auth.AuthError) as exc:
        auth.change_password(admin_user_id, "admin123", "abc")
    assert str(exc.value) == "password_too_short"


def test_change_password_writes_audit(admin_user_id):
    from perpustakaan.db.connection import get_db
    from perpustakaan.services import auth

    auth.change_password(admin_user_id, "admin123", "newpass123")
    rows = get_db().query_all(
        "SELECT aksi, entitas, entitas_id FROM audit_log "
        "WHERE aksi = 'password_changed' AND entitas_id = ?",
        (admin_user_id,),
    )
    assert len(rows) == 1
    assert rows[0]["entitas"] == "user"


# ---------------------------------------------------------------------------
# Security question hash
# ---------------------------------------------------------------------------
def test_normalize_answer_case_and_whitespace():
    from perpustakaan.services import auth

    assert auth._normalize_answer("  Bandung  ") == "bandung"
    assert auth._normalize_answer("Tom  Jerry") == "tom jerry"
    assert auth._normalize_answer("MIXED Case") == "mixed case"


def test_hash_and_verify_answer_roundtrip():
    from perpustakaan.services import auth

    h = auth._hash_answer("Bandung")
    assert auth._verify_answer("bandung", h)
    assert auth._verify_answer("BANDUNG", h)
    assert auth._verify_answer("  bandung  ", h)
    assert not auth._verify_answer("jakarta", h)


# ---------------------------------------------------------------------------
# needs_security_setup
# ---------------------------------------------------------------------------
def test_needs_security_setup_true_initially(admin_user_id):
    from perpustakaan.services import auth

    # Admin yang baru di-seed belum punya security question (kolom NULL).
    assert auth.needs_security_setup(admin_user_id) is True


def test_needs_security_setup_false_after_set(admin_user_id):
    from perpustakaan.services import auth

    auth.set_security_question(admin_user_id, "Hewan?", "kucing")
    assert auth.needs_security_setup(admin_user_id) is False


def test_needs_security_setup_unknown_user(fresh_db):
    from perpustakaan.services import auth

    # User tidak ada → False (tidak crash).
    assert auth.needs_security_setup(99999) is False


# ---------------------------------------------------------------------------
# set_security_question
# ---------------------------------------------------------------------------
def test_set_security_question_validates_question_required(admin_user_id):
    from perpustakaan.services import auth

    with pytest.raises(auth.AuthError) as exc:
        auth.set_security_question(admin_user_id, "  ", "kucing")
    assert str(exc.value) == "question_required"


def test_set_security_question_validates_answer_too_short(admin_user_id):
    from perpustakaan.services import auth

    with pytest.raises(auth.AuthError) as exc:
        auth.set_security_question(admin_user_id, "Hewan?", "x")
    assert str(exc.value) == "answer_too_short"


def test_set_security_question_writes_audit(admin_user_id):
    from perpustakaan.db.connection import get_db
    from perpustakaan.services import auth

    auth.set_security_question(admin_user_id, "Hewan?", "kucing")
    rows = get_db().query_all(
        "SELECT aksi, entitas_id FROM audit_log "
        "WHERE aksi = 'security_question_set' AND entitas_id = ?",
        (admin_user_id,),
    )
    assert len(rows) == 1


def test_set_security_question_overwrites(admin_user_id):
    from perpustakaan.services import auth

    auth.set_security_question(admin_user_id, "Hewan?", "kucing")
    auth.set_security_question(admin_user_id, "Kota?", "bandung")
    # Question terakhir yang berlaku.
    q = auth.get_security_question("admin")
    assert q == "Kota?"


# ---------------------------------------------------------------------------
# get_security_question
# ---------------------------------------------------------------------------
def test_get_security_question_returns_none_for_unknown_user(fresh_db):
    from perpustakaan.services import auth

    assert auth.get_security_question("ghost-user-doesnt-exist") is None


def test_get_security_question_returns_none_for_user_without_question(admin_user_id):
    from perpustakaan.services import auth

    # Belum di-set apapun.
    assert auth.get_security_question("admin") is None


def test_get_security_question_returns_value_after_set(admin_user_id):
    from perpustakaan.services import auth

    auth.set_security_question(admin_user_id, "Sekolah dasar Anda?", "SD 1")
    assert auth.get_security_question("admin") == "Sekolah dasar Anda?"


# ---------------------------------------------------------------------------
# reset_password_via_security_question
# ---------------------------------------------------------------------------
def test_reset_password_success(admin_user_id):
    from perpustakaan.services import auth

    auth.set_security_question(admin_user_id, "Hewan?", "kucing")
    # Logout supaya kita pastikan reset bekerja tanpa session.
    auth.logout()
    auth.reset_password_via_security_question("admin", "KUCING", "freshpass1")
    user = auth.login("admin", "freshpass1")
    assert user.id == admin_user_id


def test_reset_password_wrong_answer_raises_invalid(admin_user_id):
    from perpustakaan.services import auth

    auth.set_security_question(admin_user_id, "Hewan?", "kucing")
    with pytest.raises(auth.AuthError) as exc:
        auth.reset_password_via_security_question("admin", "anjing", "freshpass1")
    assert str(exc.value) == "invalid_credentials"


def test_reset_password_unknown_user_raises_invalid(fresh_db):
    from perpustakaan.services import auth

    # User tidak ada — sengaja sama error code-nya untuk hindari user
    # enumeration.
    with pytest.raises(auth.AuthError) as exc:
        auth.reset_password_via_security_question("ghost", "x" * 5, "freshpass1")
    assert str(exc.value) == "invalid_credentials"


def test_reset_password_user_without_question_raises_invalid(admin_user_id):
    from perpustakaan.services import auth

    # Admin punya akun valid tapi belum set question → tetap invalid.
    with pytest.raises(auth.AuthError) as exc:
        auth.reset_password_via_security_question("admin", "kucing", "freshpass1")
    assert str(exc.value) == "invalid_credentials"


def test_reset_password_too_short(admin_user_id):
    from perpustakaan.services import auth

    auth.set_security_question(admin_user_id, "Hewan?", "kucing")
    with pytest.raises(auth.AuthError) as exc:
        auth.reset_password_via_security_question("admin", "kucing", "abc")
    assert str(exc.value) == "password_too_short"


def test_reset_password_writes_audit(admin_user_id):
    from perpustakaan.db.connection import get_db
    from perpustakaan.services import auth

    auth.set_security_question(admin_user_id, "Hewan?", "kucing")
    auth.reset_password_via_security_question("admin", "kucing", "freshpass1")
    rows = get_db().query_all(
        "SELECT aksi, entitas_id FROM audit_log "
        "WHERE aksi = 'password_reset_via_security_question' "
        "AND entitas_id = ?",
        (admin_user_id,),
    )
    assert len(rows) == 1


# ---------------------------------------------------------------------------
# Schema migration: kolom security_question + security_answer_hash
# ditambahkan ke users existing tanpa data hilang.
# ---------------------------------------------------------------------------
def test_users_has_security_columns(fresh_db):
    from perpustakaan.db.connection import get_db

    rows = get_db().query_all("PRAGMA table_info(users)")
    cols = {row["name"] for row in rows}
    assert "security_question" in cols
    assert "security_answer_hash" in cols


def test_ensure_columns_idempotent(fresh_db):
    """Memanggil ulang ``_ensure_columns`` tidak duplikasi / error."""
    from perpustakaan.db.connection import _ensure_columns, get_db

    db = get_db()
    _ensure_columns(
        db,
        "users",
        {"security_question": "TEXT", "security_answer_hash": "TEXT"},
    )
    # Tidak crash; kolom tetap ada sekali.
    rows = db.query_all("PRAGMA table_info(users)")
    cols = [row["name"] for row in rows]
    assert cols.count("security_question") == 1
    assert cols.count("security_answer_hash") == 1


def test_migration_existing_user_can_set_question(fresh_db):
    """User lama (existing di DB v0.4.3) bisa set question setelah upgrade."""
    from perpustakaan.services import auth

    user_id = auth.register(
        username="legacy_user",
        password="legacy123",
        full_name="Legacy User",
    )
    # User baru di-create tanpa security_question (kolom NULL).
    assert auth.needs_security_setup(user_id) is True
    auth.set_security_question(user_id, "Hewan?", "kucing")
    assert auth.needs_security_setup(user_id) is False
