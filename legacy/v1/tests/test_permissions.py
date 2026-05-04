"""Test RBAC: registry permission, grant/revoke, default per role,
audit log, dan integrasi seed.
"""
from __future__ import annotations

import pytest


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------
def test_registry_has_known_keys():
    from perpustakaan.services import permissions_registry as reg

    # Sanity: key inti dari spec PR-B harus terdaftar.
    expected = {
        "anggota.tambah", "anggota.edit", "anggota.hapus",
        "anggota.cetak_kta", "anggota.naik_kelas", "anggota.bebas_pustaka",
        "buku.tambah", "buku.edit", "buku.hapus",
        "kunjungan.tambah", "peminjaman.tambah",
        "pengembalian.proses",
        "laporan.lihat", "laporan.ekspor",
        "setting.identitas", "setting.transaksi", "setting.akun",
        "setting.backup", "audit_log.lihat",
    }
    missing = expected - reg.PERMISSION_KEYS
    assert not missing, f"permission keys hilang dari registry: {missing}"


def test_registry_unique_keys():
    from perpustakaan.services import permissions_registry as reg

    keys = [p.key for p in reg.PERMISSIONS]
    assert len(keys) == len(set(keys)), "permission key duplikat di registry"


def test_registry_areas_known():
    from perpustakaan.services import permissions_registry as reg

    for p in reg.PERMISSIONS:
        assert p.area in reg.AREAS, f"area tak dikenal: {p.area} (key={p.key})"


def test_default_admin_gets_everything():
    from perpustakaan.services import permissions_registry as reg

    defaults = reg.default_permissions_for_role("admin")
    assert defaults == reg.PERMISSION_KEYS


def test_default_pustakawan_subset():
    from perpustakaan.services import permissions_registry as reg

    defaults = reg.default_permissions_for_role("pustakawan")
    # Pustakawan boleh tambah anggota tapi tidak hapus.
    assert "anggota.tambah" in defaults
    assert "anggota.hapus" not in defaults
    # Tidak boleh manage akun.
    assert "setting.akun" not in defaults


def test_default_siswa_readonly():
    from perpustakaan.services import permissions_registry as reg

    defaults = reg.default_permissions_for_role("siswa")
    # Siswa hanya boleh lihat laporan.
    assert "laporan.lihat" in defaults
    write_keys = {
        "anggota.tambah", "buku.tambah",
        "peminjaman.tambah", "pengembalian.proses",
        "setting.akun",
    }
    assert defaults & write_keys == set()


def test_default_unknown_role_empty():
    from perpustakaan.services import permissions_registry as reg

    assert reg.default_permissions_for_role("guest") == frozenset()


# ---------------------------------------------------------------------------
# Seed integration
# ---------------------------------------------------------------------------
def test_seed_permissions_populates_table(fresh_db):
    from perpustakaan.db.connection import get_db
    from perpustakaan.services import permissions_registry as reg

    db = get_db()
    rows = db.query_all("SELECT key FROM permissions")
    keys = {r["key"] for r in rows}
    # Setelah fresh_db (-> seed_all), seluruh registry harus ter-populate.
    assert keys == reg.PERMISSION_KEYS


def test_seed_default_grants_admin_all(fresh_db):
    from perpustakaan.services import permissions as perm_service
    from perpustakaan.services import permissions_registry as reg
    from perpustakaan.services.auth import login

    user = login("admin", "admin123")
    grants = set(perm_service.user_permissions(user.id))
    assert grants == reg.PERMISSION_KEYS


def test_seed_idempotent(fresh_db):
    """Re-run seed_all tidak membuat grant duplikat / permission duplikat."""
    from perpustakaan.db.connection import get_db
    from perpustakaan.db.seed import seed_all
    from perpustakaan.services import permissions_registry as reg

    db = get_db()
    seed_all()
    seed_all()  # 2nd call

    perm_count = int(db.scalar("SELECT COUNT(*) FROM permissions") or 0)
    assert perm_count == len(reg.PERMISSIONS)

    # Admin user (id=1) tetap dapat semua permission tanpa duplikasi.
    grants_count = int(
        db.scalar("SELECT COUNT(*) FROM user_permissions WHERE user_id = 1") or 0
    )
    assert grants_count == len(reg.PERMISSION_KEYS)


# ---------------------------------------------------------------------------
# Grant / revoke
# ---------------------------------------------------------------------------
def test_grant_and_has_permission(fresh_db):
    from perpustakaan.services import permissions as perm_service
    from perpustakaan.services.auth import register

    user_id = register(
        username="pus1", password="rahasia6",
        full_name="Pustakawan 1", role="pustakawan",
    )
    # Pustakawan tidak punya anggota.hapus secara default.
    assert not perm_service.has_permission(user_id, "anggota.hapus")
    # Grant manual.
    inserted = perm_service.grant(user_id, "anggota.hapus", granted_by=1)
    assert inserted is True
    assert perm_service.has_permission(user_id, "anggota.hapus")

    # Idempotent.
    assert perm_service.grant(user_id, "anggota.hapus", granted_by=1) is False


def test_revoke_permission(fresh_db):
    from perpustakaan.services import permissions as perm_service
    from perpustakaan.services.auth import register

    user_id = register(
        username="pus1", password="rahasia6",
        full_name="Pustakawan 1", role="pustakawan",
    )
    # Default: pustakawan punya anggota.tambah.
    assert perm_service.has_permission(user_id, "anggota.tambah")
    deleted = perm_service.revoke(user_id, "anggota.tambah", revoked_by=1)
    assert deleted is True
    assert not perm_service.has_permission(user_id, "anggota.tambah")
    # Revoke 2x → False.
    assert perm_service.revoke(user_id, "anggota.tambah", revoked_by=1) is False


def test_grant_unknown_key_raises(fresh_db):
    from perpustakaan.services import permissions as perm_service
    from perpustakaan.services.auth import register

    user_id = register(
        username="x", password="rahasia6", full_name="x", role="pustakawan"
    )
    with pytest.raises(perm_service.PermissionError):
        perm_service.grant(user_id, "tidak.ada", granted_by=1)


def test_set_user_permissions_diff(fresh_db):
    from perpustakaan.services import permissions as perm_service
    from perpustakaan.services.auth import register

    user_id = register(
        username="pus1", password="rahasia6",
        full_name="Pustakawan 1", role="pustakawan",
    )
    # Default pustakawan punya banyak permission.
    desired = {"anggota.tambah", "anggota.edit", "buku.tambah"}
    granted, revoked = perm_service.set_user_permissions(
        user_id, desired, granted_by=1,
    )
    # granted = 0 karena ketiganya sudah di-grant default.
    # revoked = jumlah default lain - desired = banyak.
    assert granted == 0
    assert revoked > 0

    actual = set(perm_service.user_permissions(user_id))
    assert actual == desired


def test_audit_log_on_grant_revoke(fresh_db):
    from perpustakaan.db.connection import get_db
    from perpustakaan.services import permissions as perm_service
    from perpustakaan.services.auth import register

    user_id = register(
        username="pus1", password="rahasia6",
        full_name="Pustakawan 1", role="pustakawan",
    )
    db = get_db()
    # Bersihkan audit log dari seed/register events
    db.execute("DELETE FROM audit_log")

    perm_service.grant(user_id, "anggota.hapus", granted_by=1)
    perm_service.revoke(user_id, "anggota.tambah", revoked_by=1)

    rows = db.query_all(
        "SELECT aksi, entitas, entitas_id FROM audit_log ORDER BY id"
    )
    assert any(r["aksi"] == "permission_granted" and r["entitas_id"] == user_id
               for r in rows)
    assert any(r["aksi"] == "permission_revoked" and r["entitas_id"] == user_id
               for r in rows)


# ---------------------------------------------------------------------------
# Session-based current_has / require
# ---------------------------------------------------------------------------
def test_current_has_with_session(fresh_db):
    from perpustakaan.services import permissions as perm_service
    from perpustakaan.services.auth import login, logout

    login("admin", "admin123")
    # Admin punya semua permission.
    assert perm_service.current_has("setting.akun")
    assert perm_service.current_has("audit_log.lihat")

    logout()
    # Tanpa session → False.
    assert not perm_service.current_has("setting.akun")


def test_require_raises_when_denied(fresh_db):
    from perpustakaan.services import permissions as perm_service
    from perpustakaan.services.auth import login, register

    register(username="pus1", password="rahasia6",
             full_name="P1", role="pustakawan")
    login("pus1", "rahasia6")
    # Pustakawan default tidak punya setting.akun → require harus raise.
    with pytest.raises(perm_service.PermissionError):
        perm_service.require("setting.akun")


# ---------------------------------------------------------------------------
# Migration: existing user (tanpa grant) auto-mendapat default per role
# ---------------------------------------------------------------------------
def test_existing_user_auto_grant_on_seed(fresh_db):
    """Skenario upgrade dari v0.4.0 -> v0.4.3: user lama tanpa grant otomatis
    dapat default sesuai role-nya saat seed_default_user_permissions dipanggil.
    """
    from perpustakaan.db.connection import get_db
    from perpustakaan.db.seed import seed_default_user_permissions
    from perpustakaan.services import permissions as perm_service

    db = get_db()
    # Bikin user lama "manual" lewat SQL (bypass register supaya tidak
    # auto-grant di register), simulasi user yg sudah ada sebelum upgrade.
    from perpustakaan.services.auth import hash_password

    db.execute(
        "INSERT INTO users (username, password_hash, full_name, role) "
        "VALUES (?, ?, ?, 'pustakawan')",
        ("legacy_pus", hash_password("rahasia6"), "Legacy Pustakawan"),
    )
    legacy_id = int(db.scalar(
        "SELECT id FROM users WHERE username = 'legacy_pus'") or 0)
    assert legacy_id > 0
    # Pastikan legacy user belum punya grant.
    assert perm_service.user_permissions(legacy_id) == []

    # Jalankan migrasi.
    inserted = seed_default_user_permissions()
    assert inserted > 0

    grants = set(perm_service.user_permissions(legacy_id))
    # Pustakawan default harus dapat anggota.tambah tapi bukan setting.akun.
    assert "anggota.tambah" in grants
    assert "setting.akun" not in grants

    # Re-run idempotent.
    assert seed_default_user_permissions() == 0
