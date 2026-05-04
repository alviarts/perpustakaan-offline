"""Aggregasi dashboard."""
from __future__ import annotations

from perpustakaan.db.connection import Database, get_db
from perpustakaan.models import anggota as anggota_repo
from perpustakaan.models import buku as buku_repo
from perpustakaan.models import kas as kas_repo
from perpustakaan.models import kunjungan as kunjungan_repo
from perpustakaan.models import peminjaman as peminjaman_repo


def stats(db: Database | None = None) -> dict:
    db = db or get_db()
    return {
        "anggota_total": anggota_repo.count(db),
        "anggota_aktif": anggota_repo.count(db, aktif=True),
        "buku_total": buku_repo.count(db),
        "eksemplar_total": buku_repo.total_eksemplar(db),
        "dipinjam": peminjaman_repo.count_dipinjam(db),
        "dikembalikan": peminjaman_repo.count_dikembalikan(db),
        "terlambat": peminjaman_repo.count_terlambat(db),
        "hilang": peminjaman_repo.count_hilang(db),
        "kunjungan_hari": kunjungan_repo.count_today(db),
        "kas_saldo": kas_repo.saldo(db),
    }
