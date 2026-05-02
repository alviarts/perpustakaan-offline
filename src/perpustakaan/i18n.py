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
    # ----------------------------- theme toggle ----------------------------
    "theme.system": {"id": "Sistem", "en": "System"},
    "theme.light": {"id": "Terang", "en": "Light"},
    "theme.dark": {"id": "Gelap", "en": "Dark"},
    "theme.applied": {"id": "Tema diterapkan.", "en": "Theme applied."},
    # ----------------------------- tutorial / guided tour ------------------
    "tour.welcome.title": {
        "id": "Selamat datang di Perpustakaan Offline!",
        "en": "Welcome to Library Offline!",
    },
    "tour.welcome.body": {
        "id": (
            "Tutorial singkat ini akan menjelaskan menu utama dan tombol "
            "penting. Klik 'Berikutnya' untuk lanjut, atau 'Lewati' untuk "
            "menutup tutorial. Kamu bisa mengulang tutorial ini kapan saja "
            "dari Setting → Bahasa & Tema."
        ),
        "en": (
            "This short tour will walk you through the main menus and key "
            "buttons. Click 'Next' to continue or 'Skip' to dismiss. You can "
            "replay this tour anytime from Settings → Language & Theme."
        ),
    },
    "tour.dashboard.title": {"id": "Menu Dashboard", "en": "Dashboard"},
    "tour.dashboard.body": {
        "id": "Ringkasan harian: total anggota, buku, peminjaman aktif, terlambat, dan kunjungan hari ini.",
        "en": "Daily summary: total members, books, active loans, overdue, and visits today.",
    },
    "tour.anggota.title": {"id": "Data Anggota", "en": "Members"},
    "tour.anggota.body": {
        "id": (
            "Kelola data anggota: tambah, edit, hapus, import Excel, cetak "
            "kartu (KTA). Tombol 'Naik Kelas' di toolbar memindahkan kelas "
            "siswa secara batch. 'Surat Bebas Pustaka' mencetak surat keterangan "
            "untuk anggota yang sudah lunas."
        ),
        "en": (
            "Manage member data: add, edit, delete, import Excel, print member "
            "cards (KTA). The 'Promote Class' toolbar button moves students to "
            "a new class in batch. 'Library Clearance Letter' prints clearance "
            "letters for cleared members."
        ),
    },
    "tour.buku.title": {"id": "Data Buku", "en": "Books"},
    "tour.buku.body": {
        "id": (
            "Kelola koleksi buku: input judul, ISBN, klasifikasi DDC, jumlah "
            "eksemplar. Cetak label & barcode tiap eksemplar. Tombol 'Transfer "
            "Penerbit' membantu menyatukan data ganda akibat penulisan penerbit "
            "yang beda-beda."
        ),
        "en": (
            "Manage your book collection: title, ISBN, DDC classification, "
            "number of copies. Print labels and barcodes per copy. The "
            "'Transfer Publishers' button helps unify duplicate publisher "
            "spellings."
        ),
    },
    "tour.peminjaman.title": {"id": "Peminjaman", "en": "Borrow"},
    "tour.peminjaman.body": {
        "id": (
            "Catat peminjaman buku: scan barcode atau pilih manual, atur "
            "jatuh tempo, dan langsung cetak nota peminjaman PDF."
        ),
        "en": (
            "Record book loans: scan barcode or pick manually, set the due "
            "date, and instantly print a borrow receipt PDF."
        ),
    },
    "tour.pengembalian.title": {"id": "Pengembalian", "en": "Return"},
    "tour.pengembalian.body": {
        "id": (
            "Proses pengembalian dengan denda otomatis kalau terlambat. "
            "Setelah simpan, nota pengembalian PDF langsung tersedia."
        ),
        "en": (
            "Process returns with automatic late fines. After saving, the "
            "return receipt PDF is ready for printing."
        ),
    },
    "tour.laporan.title": {"id": "Laporan", "en": "Reports"},
    "tour.laporan.body": {
        "id": (
            "Backup database manual, ekspor semua data ke Excel, lihat grafik "
            "kunjungan tahunan/bulanan, top peminjam, top buku, dan laporan "
            "kas."
        ),
        "en": (
            "Manual database backup, export everything to Excel, view yearly/"
            "monthly visit charts, top borrowers, top books, and cash reports."
        ),
    },
    "tour.setting.title": {"id": "Setting", "en": "Settings"},
    "tour.setting.body": {
        "id": (
            "Identitas perpustakaan, kartu anggota, parameter transaksi (lama "
            "pinjam, denda), manajemen akun, bahasa & tema, sync Google Sheets, "
            "Backup Terjadwal, Cek Data Ganda, dan Audit Log."
        ),
        "en": (
            "Library identity, member card, transaction parameters (loan "
            "duration, fines), account management, language & theme, Google "
            "Sheets sync, Scheduled Backup, Duplicate Check, and Audit Log."
        ),
    },
    "tour.theme.title": {"id": "Tema Terang / Gelap", "en": "Light / Dark Theme"},
    "tour.theme.body": {
        "id": (
            "Tombol ini selalu ada di pojok kanan atas, di menu manapun. "
            "Pilih 'Sistem' (ikut OS), 'Terang', atau 'Gelap' sesuai "
            "kenyamanan mata kamu."
        ),
        "en": (
            "This control is always pinned to the top-right corner, on every "
            "menu. Choose 'System' (follow OS), 'Light', or 'Dark' depending "
            "on what's most comfortable."
        ),
    },
    "tour.done.title": {"id": "Tutorial Selesai!", "en": "Tour Complete!"},
    "tour.done.body": {
        "id": (
            "Selamat menggunakan Perpustakaan Offline. Kamu bisa mengulang "
            "tutorial ini kapan saja dari Setting → Bahasa & Tema → 'Mulai "
            "Ulang Tutorial'."
        ),
        "en": (
            "Enjoy using Library Offline. You can replay this tour anytime "
            "from Settings → Language & Theme → 'Restart Tutorial'."
        ),
    },
    "tour.button.skip": {"id": "Lewati", "en": "Skip"},
    "tour.button.prev": {"id": "Sebelumnya", "en": "Previous"},
    "tour.button.next": {"id": "Berikutnya", "en": "Next"},
    "tour.button.finish": {"id": "Selesai", "en": "Finish"},
    "tour.progress": {"id": "Langkah {current} dari {total}", "en": "Step {current} of {total}"},
    "tour.restart": {"id": "Mulai Ulang Tutorial", "en": "Restart Tutorial"},
    "tour.restart.help": {
        "id": "Buka kembali tour singkat untuk mengenal menu dan fitur penting.",
        "en": "Replay the short tour explaining menus and key features.",
    },
    # ----------------------------- backup ----------------------------------
    "backup.tab.title": {"id": "Backup Terjadwal", "en": "Scheduled Backup"},
    "backup.help": {
        "id": (
            "Aplikasi bisa otomatis membuat backup database SQLite secara harian "
            "atau mingguan ke folder lokal. File lama akan dihapus otomatis sesuai "
            "jumlah retensi yang dipilih."
        ),
        "en": (
            "The app can automatically back up the SQLite database daily or "
            "weekly to a local folder. Older files are pruned automatically "
            "based on the retention setting."
        ),
    },
    "backup.frequency": {"id": "Frekuensi", "en": "Frequency"},
    "backup.freq.off": {"id": "Mati", "en": "Off"},
    "backup.freq.daily": {"id": "Harian", "en": "Daily"},
    "backup.freq.weekly": {"id": "Mingguan", "en": "Weekly"},
    "backup.time": {"id": "Jam (HH:MM, 24-jam)", "en": "Time (HH:MM, 24-hour)"},
    "backup.weekday": {"id": "Hari", "en": "Day"},
    "backup.folder": {"id": "Folder Tujuan", "en": "Target Folder"},
    "backup.folder.default": {
        "id": "Kosongkan untuk pakai folder backup default.",
        "en": "Leave blank to use the default backup folder.",
    },
    "backup.retention": {"id": "Retensi (jumlah file disimpan)", "en": "Retention (files to keep)"},
    "backup.button.save": {"id": "Simpan Pengaturan", "en": "Save Settings"},
    "backup.button.now": {"id": "Backup Sekarang", "en": "Backup Now"},
    "backup.button.open_folder": {"id": "Buka Folder", "en": "Open Folder"},
    "backup.list.title": {"id": "Backup Tersimpan", "en": "Stored Backups"},
    "backup.col.name": {"id": "Nama File", "en": "File Name"},
    "backup.col.size": {"id": "Ukuran", "en": "Size"},
    "backup.col.mtime": {"id": "Tanggal", "en": "Date"},
    "backup.last_run": {"id": "Backup terakhir", "en": "Last backup"},
    "backup.next_run": {"id": "Backup berikutnya", "en": "Next backup"},
    "backup.never": {"id": "Belum pernah", "en": "Never"},
    "backup.status.success": {"id": "Sukses", "en": "Success"},
    "backup.status.failed": {"id": "Gagal", "en": "Failed"},
    "backup.invalid_time": {
        "id": "Format jam tidak valid. Gunakan HH:MM (mis. 02:00).",
        "en": "Invalid time format. Use HH:MM (e.g. 02:00).",
    },
    "backup.toast.success": {
        "id": "Backup terjadwal sukses: {name}",
        "en": "Scheduled backup succeeded: {name}",
    },
    "backup.toast.success_noname": {
        "id": "Backup terjadwal sukses.",
        "en": "Scheduled backup succeeded.",
    },
    "backup.toast.failed": {
        "id": "Backup terjadwal gagal: {error}",
        "en": "Scheduled backup failed: {error}",
    },
    "backup.weekday.0": {"id": "Senin", "en": "Monday"},
    "backup.weekday.1": {"id": "Selasa", "en": "Tuesday"},
    "backup.weekday.2": {"id": "Rabu", "en": "Wednesday"},
    "backup.weekday.3": {"id": "Kamis", "en": "Thursday"},
    "backup.weekday.4": {"id": "Jumat", "en": "Friday"},
    "backup.weekday.5": {"id": "Sabtu", "en": "Saturday"},
    "backup.weekday.6": {"id": "Minggu", "en": "Sunday"},
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
