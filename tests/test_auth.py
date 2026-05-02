"""Test auth service."""
from __future__ import annotations

import pytest


def test_login_default_admin(fresh_db):
    from perpustakaan.services.auth import login

    user = login("admin", "admin123")
    assert user.username == "admin"
    assert user.role == "admin"


def test_login_wrong_password(fresh_db):
    from perpustakaan.services.auth import AuthError, login

    with pytest.raises(AuthError):
        login("admin", "salah")


def test_register_and_login(fresh_db):
    from perpustakaan.services.auth import login, register

    new_id = register(
        username="pustakawan1",
        password="rahasia6",
        full_name="Bu Siti",
        role="pustakawan",
    )
    assert new_id > 0
    user = login("pustakawan1", "rahasia6")
    assert user.role == "pustakawan"
    assert user.full_name == "Bu Siti"


def test_register_duplicate_username(fresh_db):
    from perpustakaan.services.auth import AuthError, register

    register(username="dupe", password="rahasia6", full_name="A")
    with pytest.raises(AuthError):
        register(username="dupe", password="rahasia6", full_name="B")


def test_register_password_too_short(fresh_db):
    from perpustakaan.services.auth import AuthError, register

    with pytest.raises(AuthError):
        register(username="x", password="123", full_name="X")


def test_change_password(fresh_db):
    from perpustakaan.services.auth import AuthError, change_password, login

    user = login("admin", "admin123")
    change_password(user.id, "admin123", "barubaru")
    login("admin", "barubaru")  # tidak melempar
    with pytest.raises(AuthError):
        change_password(user.id, "salah", "yyyy")
