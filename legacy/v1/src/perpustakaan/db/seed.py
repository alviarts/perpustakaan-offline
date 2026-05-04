"""Seed default data: admin user, default settings, DDC reference, kelas dasar."""
from __future__ import annotations

import re
from pathlib import Path

from perpustakaan.config import (
    ASSETS_DIR,
    DEFAULT_ADMIN_FULLNAME,
    DEFAULT_ADMIN_PASSWORD,
    DEFAULT_ADMIN_USERNAME,
    DEFAULT_SETTINGS,
)
from perpustakaan.db.connection import Database, get_db, transaction

# Regex untuk parsing baris DDC: kode (digits, opsional .digit), tab/spasi, deskripsi.
_DDC_LINE = re.compile(r"^(\d{3}(?:\.\d+)?)[\t ]+(.+?)\s*$")


def parse_ddc(text: str) -> list[tuple[str, str, str | None, int]]:
    """Parse file ``DDC-KODE BUKU.txt`` -> list (kode, deskripsi, parent, depth)."""
    out: list[tuple[str, str, str | None, int]] = []
    seen: set[str] = set()
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        m = _DDC_LINE.match(line)
        if not m:
            continue
        kode = m.group(1)
        deskripsi = m.group(2).strip()
        if kode in seen:
            continue
        seen.add(kode)
        # Hitung depth: 000=0, 010=1, 011=2, 011.1=3, 011.12=4
        if "." in kode:
            base, frac = kode.split(".", 1)
            depth = 2 + len(frac)
            parent = base if depth == 3 else f"{base}.{frac[:-1]}"
        else:
            if kode.endswith("00"):
                depth = 0
                parent = None
            elif kode.endswith("0"):
                depth = 1
                parent = kode[:-1] + "00"
            else:
                depth = 2
                parent = kode[:-1] + "0"
        out.append((kode, deskripsi, parent, depth))
    return out


def seed_settings(db: Database | None = None) -> None:
    db = db or get_db()
    with transaction(db):
        for k, v in DEFAULT_SETTINGS.items():
            db.execute(
                "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
                (k, v),
            )


def seed_admin(db: Database | None = None) -> None:
    """Buat admin default jika belum ada user satupun."""
    db = db or get_db()
    from perpustakaan.services.auth import hash_password

    count = int(db.scalar("SELECT COUNT(*) FROM users") or 0)
    if count > 0:
        return
    pw_hash = hash_password(DEFAULT_ADMIN_PASSWORD)
    with transaction(db):
        db.execute(
            "INSERT INTO users (username, password_hash, full_name, role) "
            "VALUES (?, ?, ?, 'admin')",
            (DEFAULT_ADMIN_USERNAME, pw_hash, DEFAULT_ADMIN_FULLNAME),
        )


def seed_ddc(
    db: Database | None = None, source: Path | str | None = None
) -> int:
    """Isi tabel ``ddc`` dari file teks. Skip kalau sudah terisi."""
    db = db or get_db()
    count = int(db.scalar("SELECT COUNT(*) FROM ddc") or 0)
    if count > 0:
        return count

    src = Path(source) if source else (ASSETS_DIR / "ddc-source.txt")
    if not src.exists():
        return 0
    rows = parse_ddc(src.read_text(encoding="utf-8", errors="replace"))
    if not rows:
        return 0
    with transaction(db):
        db.executemany(
            "INSERT OR IGNORE INTO ddc (kode, deskripsi, parent, depth) VALUES (?, ?, ?, ?)",
            rows,
        )
    return len(rows)


def seed_kelas(db: Database | None = None) -> None:
    """Seed kelas SMP/MTs/SMA/MA/SMK default. Idempotent."""
    db = db or get_db()
    presets: list[tuple[str, int, int]] = [
        # SMP/MTs
        ("VII A", 7, 71), ("VII B", 7, 72), ("VII C", 7, 73),
        ("VIII A", 8, 81), ("VIII B", 8, 82), ("VIII C", 8, 83),
        ("IX A", 9, 91), ("IX B", 9, 92), ("IX C", 9, 93),
        # SMA/MA
        ("X IPA 1", 10, 101), ("X IPS 1", 10, 102),
        ("XI IPA 1", 11, 111), ("XI IPS 1", 11, 112),
        ("XII IPA 1", 12, 121), ("XII IPS 1", 12, 122),
    ]
    with transaction(db):
        for nama, tingkat, urutan in presets:
            db.execute(
                "INSERT OR IGNORE INTO kelas (nama, tingkat, urutan) VALUES (?, ?, ?)",
                (nama, tingkat, urutan),
            )


def seed_permissions(db: Database | None = None) -> int:
    """Sync registry permission Python ke tabel ``permissions``.

    Idempotent — di-call setiap startup. Permission baru otomatis
    ditambahkan, label / sort_order yang berubah otomatis di-update.

    Return jumlah row di registry (untuk referensi caller, mis. log).
    """
    from perpustakaan.models import permissions as permissions_repo
    from perpustakaan.services.permissions_registry import PERMISSIONS

    db = db or get_db()
    for p in PERMISSIONS:
        permissions_repo.upsert_permission(
            key=p.key,
            label=p.label,
            description=p.description,
            area=p.area,
            sort_order=p.sort_order,
            db=db,
        )
    return len(PERMISSIONS)


def seed_default_user_permissions(db: Database | None = None) -> int:
    """Auto-grant default permission ke user yang belum punya satupun grant.

    Dipanggil di startup setelah :func:`seed_permissions`. Skenario yang
    di-cover:

    - Fresh install: admin default seed-an dapat **semua** permission.
    - Upgrade dari v0.4.0–v0.4.2: existing user (admin / pustakawan / siswa)
      dapat default sesuai role-nya — supaya tidak ada user yang tiba-tiba
      kehilangan akses setelah upgrade.

    User yang sudah pernah punya grant (walau cuma satu) tidak diapa-apakan,
    karena admin mungkin sudah meng-customize hak aksesnya.

    Return jumlah baris grant baru yang dimasukkan.
    """
    from perpustakaan.models import permissions as permissions_repo
    from perpustakaan.services.permissions import grant_many

    db = db or get_db()
    rows = permissions_repo.users_without_grants(db=db)
    if not rows:
        return 0

    from perpustakaan.services.permissions_registry import (
        default_permissions_for_role,
    )

    inserted_total = 0
    for row in rows:
        role = row.get("role") or ""
        defaults = default_permissions_for_role(role)
        if not defaults:
            continue
        inserted_total += grant_many(
            int(row["id"]),
            defaults,
            granted_by=None,  # sistem / seed
            db=db,
        )
    return inserted_total


def seed_all(db: Database | None = None) -> None:
    seed_settings(db)
    seed_admin(db)
    seed_ddc(db)
    seed_kelas(db)
    seed_permissions(db)
    seed_default_user_permissions(db)


_DEMO_ANGGOTA: list[dict[str, str]] = [
    {"nama": "Aulia Rahma", "kelas": "VII A", "jenis_kelamin": "P",
     "tempat_lahir": "Jakarta", "tanggal_lahir": "2011-03-12", "no_telp": "081234567001"},
    {"nama": "Budi Pratama", "kelas": "VII A", "jenis_kelamin": "L",
     "tempat_lahir": "Bandung", "tanggal_lahir": "2011-07-08", "no_telp": "081234567002"},
    {"nama": "Citra Dewi", "kelas": "VIII B", "jenis_kelamin": "P",
     "tempat_lahir": "Surabaya", "tanggal_lahir": "2010-11-23", "no_telp": "081234567003"},
    {"nama": "Dimas Saputra", "kelas": "VIII B", "jenis_kelamin": "L",
     "tempat_lahir": "Yogyakarta", "tanggal_lahir": "2010-05-19", "no_telp": "081234567004"},
    {"nama": "Eka Putri", "kelas": "IX A", "jenis_kelamin": "P",
     "tempat_lahir": "Medan", "tanggal_lahir": "2009-09-01", "no_telp": "081234567005"},
]

_DEMO_BUKU: list[dict[str, object]] = [
    {"judul": "Bahasa Indonesia Kelas VII", "pengarang": "Tim Kemdikbud",
     "isbn": "978-602-100-001-1", "kode_ddc": "410", "jumlah_eksemplar": 3, "harga": 50000},
    {"judul": "Matematika Kelas VIII", "pengarang": "Tim Kemdikbud",
     "isbn": "978-602-100-002-2", "kode_ddc": "510", "jumlah_eksemplar": 3, "harga": 55000},
    {"judul": "IPA Terpadu Kelas IX", "pengarang": "Tim Kemdikbud",
     "isbn": "978-602-100-003-3", "kode_ddc": "500", "jumlah_eksemplar": 3, "harga": 60000},
    {"judul": "Sejarah Indonesia", "pengarang": "Marwati",
     "isbn": "978-979-100-004-4", "kode_ddc": "959", "jumlah_eksemplar": 2, "harga": 65000},
    {"judul": "Atlas Geografi Dunia", "pengarang": "Bambang H",
     "isbn": "978-602-100-005-5", "kode_ddc": "912", "jumlah_eksemplar": 2, "harga": 75000},
    {"judul": "Bumi Manusia", "pengarang": "Pramoedya Ananta Toer",
     "isbn": "978-979-100-006-6", "kode_ddc": "813", "jumlah_eksemplar": 2, "harga": 85000},
    {"judul": "Laskar Pelangi", "pengarang": "Andrea Hirata",
     "isbn": "978-979-100-007-7", "kode_ddc": "813", "jumlah_eksemplar": 3, "harga": 70000},
    {"judul": "Hujan", "pengarang": "Tere Liye",
     "isbn": "978-602-100-008-8", "kode_ddc": "813", "jumlah_eksemplar": 2, "harga": 78000},
    {"judul": "Bahasa Inggris untuk SMP", "pengarang": "Tim Erlangga",
     "isbn": "978-602-100-009-9", "kode_ddc": "420", "jumlah_eksemplar": 3, "harga": 52000},
    {"judul": "Pendidikan Pancasila", "pengarang": "Tim Kemdikbud",
     "isbn": "978-602-100-010-0", "kode_ddc": "320", "jumlah_eksemplar": 2, "harga": 48000},
]


def seed_demo(db: Database | None = None) -> dict[str, int]:
    """Insert demo data (5 anggota + 10 buku + 2 peminjaman aktif).

    Idempotent: skip jika sudah ada anggota atau buku.
    Return ringkasan jumlah baris yang berhasil di-insert.
    """
    db = db or get_db()
    summary = {"anggota": 0, "buku": 0, "peminjaman": 0}

    existing_anggota = int(db.scalar("SELECT COUNT(*) FROM anggota") or 0)
    existing_buku = int(db.scalar("SELECT COUNT(*) FROM buku") or 0)
    if existing_anggota > 0 or existing_buku > 0:
        return summary

    from perpustakaan.models import anggota as anggota_model
    from perpustakaan.models import buku as buku_model
    from perpustakaan.models import peminjaman as peminjaman_model

    anggota_ids: list[int] = []
    for data in _DEMO_ANGGOTA:
        try:
            new_id = anggota_model.create(dict(data), db=db)
        except Exception:  # noqa: BLE001 - demo seed best-effort
            continue
        anggota_ids.append(new_id)
        summary["anggota"] += 1

    buku_ids: list[int] = []
    for data in _DEMO_BUKU:
        try:
            new_id = buku_model.create(dict(data), db=db)
        except Exception:  # noqa: BLE001 - demo seed best-effort
            continue
        buku_ids.append(new_id)
        summary["buku"] += 1

    if len(anggota_ids) >= 2 and len(buku_ids) >= 3:
        try:
            peminjaman_model.pinjam(anggota_ids[0], buku_ids[:2], db=db)
            summary["peminjaman"] += 1
        except Exception:  # noqa: BLE001
            pass
        try:
            peminjaman_model.pinjam(anggota_ids[2], [buku_ids[2]], db=db)
            summary["peminjaman"] += 1
        except Exception:  # noqa: BLE001
            pass

    return summary
