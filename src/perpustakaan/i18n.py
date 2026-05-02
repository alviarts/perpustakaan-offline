"""Bilingual i18n (Indonesia / English).

Pemakaian::

    from perpustakaan.i18n import t, set_locale

    set_locale("id")
    label = t("menu.dashboard")  # -> "Dashboard"

Untuk parameter substitusi::

    t("toast.deleted", n=3)  # -> "3 data berhasil dihapus."
"""
from __future__ import annotations

from typing import Final

_LOCALE: str = "id"

LOCALES: Final[tuple[str, ...]] = ("id", "en")
LOCALE_NAMES: Final[dict[str, str]] = {"id": "Indonesia", "en": "English"}


_STRINGS: Final[dict[str, dict[str, str]]] = {
    # ----------------------------- generic ---------------------------------
    "app.title": {
        "id": "Perpustakaan Offline — SIM-Perpus",
        "en": "Library Offline — SIM-Perpus",
    },
    "app.tagline": {
        "id": "Sistem Informasi Manajemen Perpustakaan Sekolah",
        "en": "School Library Management Information System",
    },
    "common.ok": {"id": "OK", "en": "OK"},
    "common.cancel": {"id": "Batal", "en": "Cancel"},
    "common.save": {"id": "Simpan", "en": "Save"},
    "common.add": {"id": "Tambahkan", "en": "Add"},
    "common.update": {"id": "Update", "en": "Update"},
    "common.delete": {"id": "Hapus", "en": "Delete"},
    "common.refresh": {"id": "Muat Ulang", "en": "Refresh"},
    "common.search": {"id": "Cari", "en": "Search"},
    "common.print": {"id": "Cetak", "en": "Print"},
    "common.export": {"id": "Ekspor", "en": "Export"},
    "common.import": {"id": "Impor", "en": "Import"},
    "common.close": {"id": "Tutup", "en": "Close"},
    "common.new": {"id": "Baru", "en": "New"},
    "common.edit": {"id": "Edit", "en": "Edit"},
    "common.yes": {"id": "Ya", "en": "Yes"},
    "common.no": {"id": "Tidak", "en": "No"},
    "common.confirm": {"id": "Konfirmasi", "en": "Confirm"},
    "common.error": {"id": "Galat", "en": "Error"},
    "common.success": {"id": "Berhasil", "en": "Success"},
    "common.warning": {"id": "Peringatan", "en": "Warning"},
    "common.info": {"id": "Informasi", "en": "Information"},
    "common.loading": {"id": "Memuat...", "en": "Loading..."},
    "common.total": {"id": "Total", "en": "Total"},
    "common.no_data": {"id": "Belum ada data.", "en": "No data yet."},
    # ----------------------------- login -----------------------------------
    "login.title": {"id": "Masuk", "en": "Sign In"},
    "login.username": {"id": "Username", "en": "Username"},
    "login.password": {"id": "Password", "en": "Password"},
    "login.button": {"id": "Masuk", "en": "Sign In"},
    "login.register": {"id": "Daftar Akun Baru", "en": "Register New Account"},
    "login.invalid": {"id": "Username atau password salah.", "en": "Invalid username or password."},
    "login.first_time": {
        "id": "Login pertama: gunakan admin / admin123",
        "en": "First login: use admin / admin123",
    },
    # ----------------------------- main shell ------------------------------
    "menu.dashboard": {"id": "Dashboard", "en": "Dashboard"},
    "menu.master": {"id": "Master Data", "en": "Master Data"},
    "menu.master.anggota": {"id": "Data Anggota", "en": "Members"},
    "menu.master.buku": {"id": "Data Buku", "en": "Books"},
    "menu.transaksi": {"id": "Transaksi", "en": "Transactions"},
    "menu.transaksi.kunjungan": {"id": "Kunjungan", "en": "Visits"},
    "menu.transaksi.peminjaman": {"id": "Peminjaman", "en": "Borrow"},
    "menu.transaksi.pengembalian": {"id": "Pengembalian", "en": "Return"},
    "menu.transaksi.buku_hilang": {"id": "Buku Hilang", "en": "Lost Books"},
    "menu.laporan": {"id": "Laporan", "en": "Reports"},
    "menu.laporan.backup": {"id": "Backup / Reset", "en": "Backup / Reset"},
    "menu.laporan.grafik": {"id": "Grafik Kunjungan", "en": "Visit Charts"},
    "menu.laporan.top_peminjam": {"id": "Top Peminjam", "en": "Top Borrowers"},
    "menu.laporan.top_buku": {"id": "Top Buku", "en": "Top Books"},
    "menu.laporan.kas": {"id": "Kas", "en": "Cash Book"},
    "menu.setting": {"id": "Setting", "en": "Settings"},
    "menu.setting.identitas": {"id": "Identitas Perpustakaan", "en": "Library Identity"},
    "menu.setting.kta": {"id": "Kartu Anggota", "en": "Member Card"},
    "menu.setting.utilities": {"id": "Utilities", "en": "Utilities"},
    "menu.setting.akun": {"id": "Manajemen Akun", "en": "Account Management"},
    "menu.setting.bahasa": {"id": "Bahasa & Tema", "en": "Language & Theme"},
    "menu.setting.sync": {"id": "Sync / Export", "en": "Sync / Export"},
    "menu.logout": {"id": "Keluar", "en": "Logout"},
    # ----------------------------- dashboard -------------------------------
    "dash.total_anggota": {"id": "Total Anggota", "en": "Total Members"},
    "dash.total_buku": {"id": "Total Buku", "en": "Total Books"},
    "dash.eksemplar": {"id": "Total Eksemplar", "en": "Total Copies"},
    "dash.dipinjam": {"id": "Sedang Dipinjam", "en": "Currently Borrowed"},
    "dash.dikembalikan": {"id": "Telah Dikembalikan", "en": "Returned"},
    "dash.belum_kembali": {"id": "Belum Dikembalikan", "en": "Not Returned"},
    "dash.terlambat": {"id": "Terlambat", "en": "Overdue"},
    "dash.hilang": {"id": "Buku Hilang", "en": "Lost Books"},
    "dash.kunjungan_hari": {"id": "Kunjungan Hari Ini", "en": "Visits Today"},
    "dash.kas_saldo": {"id": "Saldo Kas", "en": "Cash Balance"},
    # ----------------------------- anggota ---------------------------------
    "anggota.kode": {"id": "Kode Anggota", "en": "Member Code"},
    "anggota.nama": {"id": "Nama Lengkap", "en": "Full Name"},
    "anggota.jenis_kelamin": {"id": "Jenis Kelamin", "en": "Gender"},
    "anggota.kelas": {"id": "Kelas", "en": "Class"},
    "anggota.jurusan": {"id": "Jurusan", "en": "Major"},
    "anggota.no_telp": {"id": "No. Telepon", "en": "Phone"},
    "anggota.alamat": {"id": "Alamat", "en": "Address"},
    "anggota.foto": {"id": "Foto", "en": "Photo"},
    "anggota.tgl_daftar": {"id": "Tanggal Daftar", "en": "Registered On"},
    "anggota.cetak_kta": {"id": "Cetak KTA", "en": "Print Member Card"},
    "anggota.bebas_pustaka": {"id": "Surat Bebas Pustaka", "en": "Library Clearance Letter"},
    "anggota.naik_kelas": {"id": "Naik Kelas", "en": "Promote Class"},
    "anggota.rekap": {"id": "Rekap Anggota", "en": "Member Recap"},
    # ----------------------------- buku ------------------------------------
    "buku.kode": {"id": "Kode Buku", "en": "Book Code"},
    "buku.judul": {"id": "Judul", "en": "Title"},
    "buku.pengarang": {"id": "Pengarang", "en": "Author"},
    "buku.penerbit": {"id": "Penerbit", "en": "Publisher"},
    "buku.tahun_terbit": {"id": "Tahun Terbit", "en": "Year"},
    "buku.kode_ddc": {"id": "Kode DDC", "en": "DDC Code"},
    "buku.kategori": {"id": "Kategori", "en": "Category"},
    "buku.isbn": {"id": "ISBN", "en": "ISBN"},
    "buku.jumlah_eksemplar": {"id": "Jumlah Eksemplar", "en": "Copies"},
    "buku.sumber": {"id": "Sumber", "en": "Source"},
    "buku.cover": {"id": "Cover", "en": "Cover"},
    "buku.cetak_label": {"id": "Cetak Label & Barcode", "en": "Print Label & Barcode"},
    "buku.transfer_penerbit": {"id": "Transfer Penerbit", "en": "Transfer Publishers"},
    # ----------------------------- transaksi -------------------------------
    "trx.no_pinjam": {"id": "No. Peminjaman", "en": "Borrow No."},
    "trx.tgl_pinjam": {"id": "Tanggal Pinjam", "en": "Borrow Date"},
    "trx.tgl_jatuh_tempo": {"id": "Jatuh Tempo", "en": "Due Date"},
    "trx.tgl_kembali": {"id": "Tanggal Kembali", "en": "Return Date"},
    "trx.status": {"id": "Status", "en": "Status"},
    "trx.denda": {"id": "Denda", "en": "Fine"},
    "trx.bayar": {"id": "Bayar", "en": "Paid"},
    "trx.scan_barcode": {"id": "Scan Barcode", "en": "Scan Barcode"},
    "trx.tambah_item": {"id": "Tambah Item", "en": "Add Item"},
    "trx.hapus_item": {"id": "Hapus Item", "en": "Remove Item"},
    "trx.tambah_kunjungan": {"id": "Tambah ke Kunjungan?", "en": "Add to visit log?"},
    "trx.cetak_nota": {"id": "Cetak Nota", "en": "Print Receipt"},
    "trx.status.dipinjam": {"id": "Dipinjam", "en": "Borrowed"},
    "trx.status.dikembalikan": {"id": "Dikembalikan", "en": "Returned"},
    "trx.status.terlambat": {"id": "Terlambat", "en": "Overdue"},
    "trx.status.hilang": {"id": "Hilang", "en": "Lost"},
    # ----------------------------- settings --------------------------------
    "set.lib.nama": {"id": "Nama Perpustakaan", "en": "Library Name"},
    "set.lib.alamat": {"id": "Alamat", "en": "Address"},
    "set.lib.kepala": {"id": "Kepala Sekolah", "en": "Principal"},
    "set.lib.npsn": {"id": "NPSN", "en": "School ID (NPSN)"},
    "set.lib.tahun_ajaran": {"id": "Tahun Ajaran", "en": "Academic Year"},
    "set.lib.logo": {"id": "Logo Sekolah", "en": "School Logo"},
    "set.lib.kontak": {"id": "Kontak", "en": "Contact"},
    "set.trx.lama_pinjam": {"id": "Lama Pinjam (hari)", "en": "Loan Duration (days)"},
    "set.trx.maks_pinjam": {"id": "Maks. Buku Dipinjam", "en": "Max Books per Member"},
    "set.trx.denda_hari": {"id": "Denda per Hari (Rp)", "en": "Fine per Day (Rp)"},
    "set.trx.denda_hilang": {"id": "Denda Buku Hilang (% harga)", "en": "Lost Book Fine (% of price)"},
    "set.bahasa": {"id": "Bahasa", "en": "Language"},
    "set.tema": {"id": "Tema", "en": "Theme"},
    # ----------------------------- sync ------------------------------------
    "sync.button.export": {"id": "Ekspor ke Google Sheets", "en": "Export to Google Sheets"},
    "sync.label.last_export": {"id": "Ekspor Terakhir", "en": "Last Export"},
    "sync.label.spreadsheet": {"id": "Spreadsheet ID", "en": "Spreadsheet ID"},
    "sync.help": {
        "id": (
            "Tombol ini meng-ekspor seluruh data perpustakaan ke spreadsheet "
            "pribadi kamu di Google Drive (one-way). Butuh login Google sekali "
            "untuk authorisasi."
        ),
        "en": (
            "This button exports all library data to your personal spreadsheet "
            "on Google Drive (one-way). Requires a one-time Google sign-in for "
            "authorization."
        ),
    },
    # ----------------------------- toasts ----------------------------------
    "toast.saved": {"id": "Data tersimpan.", "en": "Data saved."},
    "toast.updated": {"id": "Data diperbarui.", "en": "Data updated."},
    "toast.deleted_one": {"id": "Data dihapus.", "en": "Data deleted."},
    "toast.deleted": {"id": "{n} data berhasil dihapus.", "en": "{n} records deleted."},
    "toast.required": {"id": "Field wajib: {field}", "en": "Required field: {field}"},
    "toast.duplicate": {"id": "Data ganda: {field}", "en": "Duplicate: {field}"},
    "toast.confirm_delete": {
        "id": "Yakin ingin menghapus data ini?",
        "en": "Are you sure you want to delete this record?",
    },
    "toast.confirm_logout": {"id": "Keluar dari aplikasi?", "en": "Logout from application?"},
}


def set_locale(locale: str) -> None:
    """Set locale aktif (``id`` atau ``en``)."""
    global _LOCALE
    if locale not in LOCALES:
        raise ValueError(f"Unsupported locale: {locale!r}; use one of {LOCALES}")
    _LOCALE = locale


def get_locale() -> str:
    return _LOCALE


def t(key: str, **kwargs: object) -> str:
    """Translate ``key`` ke locale aktif. Kembalikan key jika tidak ditemukan."""
    bundle = _STRINGS.get(key)
    if bundle is None:
        return key
    txt = bundle.get(_LOCALE) or bundle.get("id") or key
    if kwargs:
        try:
            return txt.format(**kwargs)
        except (KeyError, IndexError):
            return txt
    return txt
