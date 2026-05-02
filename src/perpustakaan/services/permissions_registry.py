"""Registry permission keys (RBAC v0.4.3).

Modul ini adalah **single source of truth** untuk semua permission key yang
dikenal aplikasi. Saat startup, ``seed_permissions`` membaca registry ini lalu
menulis isinya ke tabel ``permissions`` (idempotent — INSERT OR IGNORE +
UPDATE label/sort_order).

Konvensi key: ``<area>.<aksi>`` (lowercase, dot-separated). Area dibatasi ke
nilai yang sudah didaftarkan di ``AREAS`` agar dialog UI bisa
mengelompokkannya secara konsisten.

Default preset per role (admin / pustakawan / siswa) dipakai oleh seed untuk
auto-grant ke user yang **belum punya permission satupun** sehingga upgrade
dari versi lama (v0.4.0–v0.4.2) tidak menyebabkan user kehilangan akses.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Final

# ---------------------------------------------------------------------------
# Areas
# ---------------------------------------------------------------------------
AREA_ANGGOTA: Final = "anggota"
AREA_BUKU: Final = "buku"
AREA_KUNJUNGAN: Final = "kunjungan"
AREA_PEMINJAMAN: Final = "peminjaman"
AREA_PENGEMBALIAN: Final = "pengembalian"
AREA_LAPORAN: Final = "laporan"
AREA_SETTING: Final = "setting"
AREA_AUDIT_LOG: Final = "audit_log"

AREAS: Final[tuple[str, ...]] = (
    AREA_ANGGOTA,
    AREA_BUKU,
    AREA_KUNJUNGAN,
    AREA_PEMINJAMAN,
    AREA_PENGEMBALIAN,
    AREA_LAPORAN,
    AREA_SETTING,
    AREA_AUDIT_LOG,
)


@dataclass(frozen=True)
class PermissionDef:
    key: str
    area: str
    label: str
    description: str = ""
    sort_order: int = 0


# ---------------------------------------------------------------------------
# Catalog — order di sini = sort_order otomatis (urut tampil di dialog).
# ---------------------------------------------------------------------------
def _build() -> tuple[PermissionDef, ...]:
    rows: list[PermissionDef] = []

    def add(key: str, area: str, label: str, description: str = "") -> None:
        rows.append(
            PermissionDef(
                key=key, area=area, label=label,
                description=description, sort_order=len(rows),
            )
        )

    # ---------------- Anggota ----------------
    add("anggota.tambah", AREA_ANGGOTA, "Tambah anggota",
        "Membuat anggota baru via form atau import Excel.")
    add("anggota.edit", AREA_ANGGOTA, "Edit anggota",
        "Mengubah data anggota yang sudah ada.")
    add("anggota.hapus", AREA_ANGGOTA, "Hapus anggota",
        "Menghapus anggota dari database.")
    add("anggota.import", AREA_ANGGOTA, "Impor anggota dari Excel",
        "Bulk-import anggota dari file Excel.")
    add("anggota.cetak_kta", AREA_ANGGOTA, "Cetak Kartu Anggota (KTA)",
        "Mencetak Kartu Tanda Anggota (KTA) untuk satu / banyak anggota.")
    add("anggota.naik_kelas", AREA_ANGGOTA, "Proses Naik Kelas batch",
        "Memetakan kelas lama → kelas baru untuk semua anggota sekaligus.")
    add("anggota.bebas_pustaka", AREA_ANGGOTA, "Cetak Surat Bebas Pustaka",
        "Mencetak surat bebas pustaka (validasi peminjaman aktif otomatis).")

    # ---------------- Buku ----------------
    add("buku.tambah", AREA_BUKU, "Tambah buku", "Membuat data buku baru.")
    add("buku.edit", AREA_BUKU, "Edit buku", "Mengubah data buku.")
    add("buku.hapus", AREA_BUKU, "Hapus buku", "Menghapus buku.")
    add("buku.import", AREA_BUKU, "Impor buku dari Excel",
        "Bulk-import buku dari file Excel.")
    add("buku.cetak_label", AREA_BUKU, "Cetak label & barcode",
        "Mencetak label punggung + barcode per eksemplar.")

    # ---------------- Kunjungan ----------------
    add("kunjungan.tambah", AREA_KUNJUNGAN, "Catat kunjungan",
        "Mencatat kunjungan harian (manual / per kelas).")
    add("kunjungan.edit", AREA_KUNJUNGAN, "Edit kunjungan",
        "Mengubah catatan kunjungan.")
    add("kunjungan.hapus", AREA_KUNJUNGAN, "Hapus kunjungan",
        "Menghapus catatan kunjungan.")

    # ---------------- Peminjaman ----------------
    add("peminjaman.tambah", AREA_PEMINJAMAN, "Buat peminjaman",
        "Membuat transaksi peminjaman baru.")
    add("peminjaman.edit", AREA_PEMINJAMAN, "Edit peminjaman",
        "Mengubah peminjaman yang masih aktif.")
    add("peminjaman.hapus", AREA_PEMINJAMAN, "Hapus peminjaman",
        "Menghapus transaksi peminjaman (jarang dipakai).")
    add("peminjaman.cetak_nota", AREA_PEMINJAMAN, "Cetak nota peminjaman",
        "Mencetak nota PDF setelah simpan peminjaman.")

    # ---------------- Pengembalian ----------------
    add("pengembalian.proses", AREA_PENGEMBALIAN, "Proses pengembalian",
        "Memproses pengembalian buku + perhitungan denda.")
    add("pengembalian.cetak_nota", AREA_PENGEMBALIAN, "Cetak nota pengembalian",
        "Mencetak nota PDF setelah pengembalian.")

    # ---------------- Laporan ----------------
    add("laporan.lihat", AREA_LAPORAN, "Lihat laporan",
        "Membuka tab Laporan (grafik kunjungan, top peminjam, top buku, kas).")
    add("laporan.ekspor", AREA_LAPORAN, "Ekspor laporan",
        "Ekspor laporan ke Excel / PDF.")
    add("laporan.kas_tambah", AREA_LAPORAN, "Tambah/edit kas manual",
        "Menambah atau mengedit catatan kas manual.")
    add("laporan.kas_hapus", AREA_LAPORAN, "Hapus kas",
        "Menghapus catatan kas (otomatis maupun manual).")

    # ---------------- Setting ----------------
    add("setting.identitas", AREA_SETTING, "Edit identitas perpustakaan",
        "Mengubah nama, alamat, kepala, NPSN, tahun ajaran, logo.")
    add("setting.kta", AREA_SETTING, "Edit teks kartu anggota",
        "Mengubah teks peraturan di balik KTA.")
    add("setting.transaksi", AREA_SETTING, "Edit aturan transaksi",
        "Mengubah lama pinjam, maks buku, denda per hari, dll.")
    add("setting.akun", AREA_SETTING, "Manajemen akun & hak akses",
        "Membuat / hapus / edit hak akses akun lain.")
    add("setting.bahasa", AREA_SETTING, "Edit bahasa & tema",
        "Mengubah bahasa antarmuka, tema, warna aplikasi.")
    add("setting.sync", AREA_SETTING, "Sync / Export Google Sheets",
        "Konfigurasi & jalankan sync ke Google Sheets.")
    add("setting.backup", AREA_SETTING, "Backup terjadwal & manual",
        "Mengubah jadwal backup, jalankan backup, restore.")
    add("setting.tools", AREA_SETTING, "Tools (cek data ganda, dll)",
        "Akses utilitas Tools di Setting.")

    # ---------------- Audit log ----------------
    add("audit_log.lihat", AREA_AUDIT_LOG, "Lihat audit log",
        "Membuka tab Audit Log di Setting.")

    return tuple(rows)


PERMISSIONS: Final[tuple[PermissionDef, ...]] = _build()
PERMISSION_BY_KEY: Final[dict[str, PermissionDef]] = {p.key: p for p in PERMISSIONS}
PERMISSION_KEYS: Final[frozenset[str]] = frozenset(p.key for p in PERMISSIONS)


def permissions_by_area() -> dict[str, list[PermissionDef]]:
    """Return permissions grouped by area, urut sesuai ``AREAS`` lalu sort_order."""
    out: dict[str, list[PermissionDef]] = {a: [] for a in AREAS}
    for p in PERMISSIONS:
        out.setdefault(p.area, []).append(p)
    for area in out:
        out[area].sort(key=lambda x: x.sort_order)
    return out


# ---------------------------------------------------------------------------
# Default presets per role
# ---------------------------------------------------------------------------
ROLE_ADMIN: Final = "admin"
ROLE_PUSTAKAWAN: Final = "pustakawan"
ROLE_SISWA: Final = "siswa"

# Admin = wildcard (semua permission key yang ada di registry)
_PUSTAKAWAN_DEFAULTS: Final[frozenset[str]] = frozenset({
    # Anggota — operasional sehari-hari, tidak hapus
    "anggota.tambah", "anggota.edit", "anggota.import",
    "anggota.cetak_kta", "anggota.naik_kelas", "anggota.bebas_pustaka",
    # Buku — operasional sehari-hari, tidak hapus
    "buku.tambah", "buku.edit", "buku.import", "buku.cetak_label",
    # Kunjungan
    "kunjungan.tambah", "kunjungan.edit",
    # Peminjaman
    "peminjaman.tambah", "peminjaman.edit", "peminjaman.cetak_nota",
    # Pengembalian
    "pengembalian.proses", "pengembalian.cetak_nota",
    # Laporan
    "laporan.lihat", "laporan.ekspor",
    "laporan.kas_tambah",
    # Setting — hanya yang aman
    "setting.kta", "setting.bahasa", "setting.backup", "setting.tools",
    # Audit log
    "audit_log.lihat",
})

_SISWA_DEFAULTS: Final[frozenset[str]] = frozenset({
    # Read-only — hanya boleh lihat laporan
    "laporan.lihat",
})


def default_permissions_for_role(role: str) -> frozenset[str]:
    """Return default permission set untuk role tertentu.

    Admin selalu mendapat **semua** permission yang ada di registry — kalau
    nanti ada permission baru ditambah, admin existing otomatis ikut dapat.
    """
    role_lc = (role or "").strip().lower()
    if role_lc == ROLE_ADMIN:
        return PERMISSION_KEYS
    if role_lc == ROLE_PUSTAKAWAN:
        return _PUSTAKAWAN_DEFAULTS
    if role_lc == ROLE_SISWA:
        return _SISWA_DEFAULTS
    # Role tidak dikenal — kosong (paling aman; admin perlu grant manual).
    return frozenset()
