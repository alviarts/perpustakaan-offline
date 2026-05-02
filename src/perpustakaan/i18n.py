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
    "login.forgot": {"id": "Lupa Password?", "en": "Forgot Password?"},
    # ----------------------------- ganti password (header / settings) ------
    "password.change.title": {"id": "Ganti Password", "en": "Change Password"},
    "password.change.button": {"id": "Ganti Password", "en": "Change Password"},
    "password.change.old": {"id": "Password Lama", "en": "Current Password"},
    "password.change.new": {"id": "Password Baru", "en": "New Password"},
    "password.change.confirm": {"id": "Konfirmasi Password Baru", "en": "Confirm New Password"},
    "password.change.success": {"id": "Password berhasil diganti.", "en": "Password updated."},
    "password.change.mismatch": {
        "id": "Konfirmasi password tidak cocok.",
        "en": "Password confirmation does not match.",
    },
    "password.change.too_short": {
        "id": "Password baru minimal 6 karakter.",
        "en": "New password must be at least 6 characters.",
    },
    "password.change.invalid_old": {
        "id": "Password lama salah.",
        "en": "Current password is incorrect.",
    },
    # ----------------------------- security question -----------------------
    "security.title": {
        "id": "Pertanyaan Keamanan",
        "en": "Security Question",
    },
    "security.subtitle": {
        "id": "Dipakai untuk reset password jika lupa.",
        "en": "Used to reset your password if forgotten.",
    },
    "security.question.label": {
        "id": "Pertanyaan",
        "en": "Question",
    },
    "security.question.custom": {
        "id": "(Tulis pertanyaan sendiri)",
        "en": "(Write your own question)",
    },
    "security.question.custom_placeholder": {
        "id": "Misalnya: Hobi favorit Anda?",
        "en": "e.g. Your favorite hobby?",
    },
    "security.answer.label": {
        "id": "Jawaban",
        "en": "Answer",
    },
    "security.answer.hint": {
        "id": "Catatan: jawaban tidak case-sensitive (BANDUNG = bandung).",
        "en": "Note: answer is not case-sensitive (BANDUNG = bandung).",
    },
    "security.error.question_required": {
        "id": "Pertanyaan wajib diisi.",
        "en": "Question is required.",
    },
    "security.error.answer_too_short": {
        "id": "Jawaban minimal 2 karakter.",
        "en": "Answer must be at least 2 characters.",
    },
    "security.toast.saved": {
        "id": "Pertanyaan keamanan tersimpan.",
        "en": "Security question saved.",
    },
    # ----------------------------- first-login wizard ----------------------
    "security.firstlogin.title": {
        "id": "Lengkapi Pertanyaan Keamanan",
        "en": "Complete Security Question",
    },
    "security.firstlogin.help": {
        "id": (
            "Demi keamanan akun Anda, mohon pilih satu pertanyaan keamanan "
            "dan isi jawabannya. Jawaban ini akan dipakai jika Anda lupa "
            "password dan butuh reset. Tidak bisa di-skip."
        ),
        "en": (
            "For your account safety, please choose a security question "
            "and provide an answer. This is used to reset your password "
            "if you forget it. Cannot be skipped."
        ),
    },
    # ----------------------------- forgot password / reset -----------------
    "password.reset.title": {
        "id": "Reset Password",
        "en": "Reset Password",
    },
    "password.reset.step1.help": {
        "id": "Masukkan username Anda untuk menampilkan pertanyaan keamanan.",
        "en": "Enter your username to show your security question.",
    },
    "password.reset.step2.help": {
        "id": "Jawab pertanyaan keamanan, lalu pilih password baru.",
        "en": "Answer the security question, then choose a new password.",
    },
    "password.reset.continue": {"id": "Lanjut", "en": "Continue"},
    "password.reset.back": {"id": "Kembali", "en": "Back"},
    "password.reset.submit": {
        "id": "Reset Password",
        "en": "Reset Password",
    },
    "password.reset.success": {
        "id": "Password berhasil direset. Silakan login dengan password baru.",
        "en": "Password reset successful. Please sign in with your new password.",
    },
    "password.reset.invalid": {
        "id": "Username atau jawaban salah.",
        "en": "Invalid username or answer.",
    },
    "password.reset.no_question": {
        "id": (
            "Akun ini belum mengatur pertanyaan keamanan. Hubungi admin "
            "untuk reset manual."
        ),
        "en": (
            "This account has no security question set. Please contact "
            "an admin for a manual reset."
        ),
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
    "anggota.empty.title": {
        "id": "Belum ada anggota",
        "en": "No members yet",
    },
    "anggota.empty.desc": {
        "id": "Tambahkan anggota baru dengan mengisi form di sebelah kiri, atau impor dari Excel.",
        "en": "Add a new member using the form on the left, or import from Excel.",
    },
    "anggota.empty.search.title": {
        "id": "Tidak ada hasil",
        "en": "No results",
    },
    "anggota.empty.search.desc": {
        "id": "Coba kata kunci yang berbeda atau hapus filter pencarian.",
        "en": "Try a different keyword or clear the search filter.",
    },
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
    "buku.empty.title": {"id": "Belum ada buku", "en": "No books yet"},
    "buku.empty.desc": {
        "id": "Tambahkan koleksi buku dengan mengisi form di sebelah kiri, atau impor dari Excel.",
        "en": "Add books using the form on the left, or import from Excel.",
    },
    "buku.empty.search.title": {"id": "Tidak ada hasil", "en": "No results"},
    "buku.empty.search.desc": {
        "id": "Coba kata kunci atau kategori yang berbeda.",
        "en": "Try a different keyword or category.",
    },
    "trx.empty.peminjaman.title": {
        "id": "Belum ada peminjaman aktif",
        "en": "No active loans yet",
    },
    "trx.empty.peminjaman.desc": {
        "id": "Catat peminjaman buku baru dengan memilih anggota dan buku di form kiri.",
        "en": "Record a new book loan by selecting a member and book in the left form.",
    },
    "trx.empty.pengembalian.title": {
        "id": "Tidak ada peminjaman untuk dikembalikan",
        "en": "Nothing to return",
    },
    "trx.empty.pengembalian.desc": {
        "id": "Cari nomor peminjaman atau scan barcode untuk mulai proses pengembalian.",
        "en": "Search for a loan number or scan a barcode to begin returning.",
    },
    "trx.empty.kunjungan.title": {
        "id": "Belum ada kunjungan",
        "en": "No visits logged",
    },
    "trx.empty.kunjungan.desc": {
        "id": "Catat kunjungan anggota dengan memilih anggota di form di atas.",
        "en": "Log a member visit using the form above.",
    },
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
    "tour.button.skip": {"id": "Lewati", "en": "Skip"},
    "tour.button.prev": {"id": "Sebelumnya", "en": "Previous"},
    "tour.button.next": {"id": "Berikutnya", "en": "Next"},
    "tour.button.finish": {"id": "Selesai", "en": "Finish"},
    "tour.progress": {"id": "Langkah {current} dari {total}", "en": "Step {current} of {total}"},
    "tour.restart": {"id": "Mulai Ulang Semua Tutorial", "en": "Restart All Tutorials"},
    "tour.restart.help": {
        "id": (
            "Reset status tutorial supaya panduan otomatis muncul lagi saat "
            "kamu membuka tiap menu. Kamu juga bisa kapan saja menekan tombol "
            "“?” di pojok kanan-atas untuk memutar ulang tutorial menu yang "
            "sedang dibuka."
        ),
        "en": (
            "Reset the tutorial flags so the contextual onboarding appears "
            "again when you visit each menu. You can also press the “?” "
            "button at the top-right anytime to replay the tutorial for the "
            "currently open menu."
        ),
    },
    "tour.restart.applied": {
        "id": "Status tutorial direset. Buka menu untuk melihat panduan lagi.",
        "en": "Tutorial flags reset. Open menus to see the guides again.",
    },
    # Welcome (first-run, dashboard)
    "tour.welcome.title": {
        "id": "Selamat datang di Perpustakaan Offline!",
        "en": "Welcome to Library Offline!",
    },
    "tour.welcome.body": {
        "id": (
            "Tutorial singkat ini cuma menjelaskan dasar-dasar Dashboard. "
            "Setiap kali kamu membuka menu baru (Anggota, Buku, Peminjaman, "
            "dst.), panduan kontekstual akan muncul otomatis. Klik "
            "'Berikutnya' untuk lanjut, atau 'Lewati' untuk menutup."
        ),
        "en": (
            "This short tour just covers the Dashboard basics. Whenever you "
            "open a new menu (Members, Books, Loans, ...) a contextual guide "
            "will appear automatically. Click 'Next' to continue or 'Skip' "
            "to dismiss."
        ),
    },
    # Help button
    "tour.help.title": {
        "id": "Tombol “?” — putar ulang tutorial",
        "en": "“?” button — replay tutorials",
    },
    "tour.help.body": {
        "id": (
            "Lihat tombol “?” bulat di sebelah kiri toggle tema? Klik kapan "
            "saja untuk memutar ulang tutorial menu yang sedang kamu buka. "
            "Tombol ini selalu muncul di setiap menu."
        ),
        "en": (
            "See the round “?” button to the left of the theme toggle? Click "
            "it anytime to replay the tutorial for the menu you are currently "
            "viewing. The button is visible on every menu."
        ),
    },
    # Dashboard
    "tour.dashboard.cards.title": {"id": "Kartu Statistik", "en": "Stat Cards"},
    "tour.dashboard.cards.body": {
        "id": (
            "Kartu di sini menunjukkan ringkasan harian: total anggota, buku, "
            "eksemplar, peminjaman aktif, terlambat, dan kunjungan hari ini. "
            "Arahkan kursor ke kartu untuk melihat efek hover."
        ),
        "en": (
            "These cards show the daily summary: total members, books, "
            "copies, active loans, overdue, and today's visits. Hover a card "
            "to see the lift effect."
        ),
    },
    # Anggota
    "tour.anggota.intro.title": {"id": "Menu Data Anggota", "en": "Members menu"},
    "tour.anggota.intro.body": {
        "id": (
            "Di menu ini kamu mengelola data anggota perpustakaan (siswa/guru). "
            "Tutorial ini akan menyorot tombol-tombol penting di toolbar."
        ),
        "en": (
            "In this menu you manage library member data (students/teachers). "
            "This tutorial will highlight key toolbar buttons."
        ),
    },
    "tour.anggota.add.title": {"id": "Tambah / Simpan Anggota", "en": "Add / save member"},
    "tour.anggota.add.body": {
        "id": (
            "Isi form di kiri lalu klik tombol Simpan/Tambah untuk menambah "
            "anggota baru. Untuk edit, klik baris di tabel sebelah kanan."
        ),
        "en": (
            "Fill the form on the left then click Save/Add to insert a new "
            "member. To edit, click a row in the table on the right."
        ),
    },
    "tour.anggota.naik_kelas.title": {"id": "Naik Kelas (batch)", "en": "Promote Class (batch)"},
    "tour.anggota.naik_kelas.body": {
        "id": (
            "Tombol ini memindahkan banyak siswa sekaligus ke kelas baru di "
            "akhir tahun ajaran (mis. VII → VIII). Kamu bisa pilih kelas asal "
            "dan kelas tujuan, lalu konfirmasi."
        ),
        "en": (
            "This button bulk-moves students to a new class at the end of the "
            "school year (e.g. VII → VIII). Pick the source and target class, "
            "then confirm."
        ),
    },
    "tour.anggota.cetak_kta.title": {"id": "Cetak Kartu Anggota (KTA)", "en": "Print Member Card"},
    "tour.anggota.cetak_kta.body": {
        "id": (
            "Cetak Kartu Tanda Anggota (KTA) untuk anggota terpilih dalam "
            "format PDF siap cetak. Layout & logo bisa diatur di Setting → "
            "Kartu Anggota."
        ),
        "en": (
            "Print Member ID Cards (KTA) for selected members as a print-"
            "ready PDF. Layout & logo can be configured in Settings → Member "
            "Card."
        ),
    },
    "tour.anggota.bebas_pustaka.title": {"id": "Surat Bebas Pustaka", "en": "Library Clearance"},
    "tour.anggota.bebas_pustaka.body": {
        "id": (
            "Cetak surat keterangan bebas pustaka untuk anggota yang sudah "
            "tidak punya pinjaman aktif. Cocok untuk syarat kelulusan."
        ),
        "en": (
            "Print a library clearance letter for members with no active "
            "loans. Useful for graduation prerequisites."
        ),
    },
    "tour.anggota.import.title": {"id": "Import dari Excel", "en": "Import from Excel"},
    "tour.anggota.import.body": {
        "id": (
            "Import banyak anggota sekaligus dari file Excel/.xlsx. Klik "
            "tombol 'Template' di sebelah untuk mengunduh template kolom "
            "yang valid."
        ),
        "en": (
            "Import many members at once from an Excel/.xlsx file. Click the "
            "'Template' button next to it to download the valid column template."
        ),
    },
    # Buku
    "tour.buku.intro.title": {"id": "Menu Data Buku", "en": "Books menu"},
    "tour.buku.intro.body": {
        "id": (
            "Kelola koleksi buku: judul, ISBN, klasifikasi DDC, jumlah "
            "eksemplar, harga, rak, kategori. Tutorial ini menyorot tombol "
            "kunci."
        ),
        "en": (
            "Manage your collection: title, ISBN, DDC classification, copy "
            "count, price, shelf, category. This tour highlights key buttons."
        ),
    },
    "tour.buku.add.title": {"id": "Tambah / Simpan Buku", "en": "Add / save book"},
    "tour.buku.add.body": {
        "id": (
            "Isi form di kiri lalu klik Simpan/Tambah. Untuk edit, klik baris "
            "di tabel kanan."
        ),
        "en": (
            "Fill the form on the left then click Save/Add. To edit, click a "
            "row in the right table."
        ),
    },
    "tour.buku.cetak_label.title": {"id": "Cetak Label & Barcode", "en": "Print Labels & Barcode"},
    "tour.buku.cetak_label.body": {
        "id": (
            "Buat lembar label/barcode siap potong untuk eksemplar buku. "
            "Tiap eksemplar dapat barcode unik yang bisa di-scan saat "
            "peminjaman."
        ),
        "en": (
            "Generate ready-to-cut label/barcode sheets for book copies. "
            "Each copy gets a unique barcode usable at the loan counter."
        ),
    },
    "tour.buku.transfer_penerbit.title": {
        "id": "Transfer Penerbit (dedupe)",
        "en": "Transfer Publishers (dedupe)",
    },
    "tour.buku.transfer_penerbit.body": {
        "id": (
            "Sering ada penerbit yang ditulis beda-beda (mis. 'Erlangga' vs "
            "'PT Erlangga'). Tombol ini membantu memindahkan semua buku dari "
            "satu nama penerbit ke nama lain agar data terkonsolidasi."
        ),
        "en": (
            "Publishers are often spelled inconsistently (e.g. 'Erlangga' vs "
            "'PT Erlangga'). This button moves all books from one publisher "
            "name to another so the data is consolidated."
        ),
    },
    "tour.buku.import.title": {"id": "Import dari Excel", "en": "Import from Excel"},
    "tour.buku.import.body": {
        "id": (
            "Import banyak buku dari file Excel. Gunakan template yang "
            "tersedia agar kolomnya cocok."
        ),
        "en": (
            "Import many books from Excel. Use the provided template so the "
            "columns match."
        ),
    },
    # Kunjungan
    "tour.kunjungan.intro.title": {"id": "Catatan Kunjungan", "en": "Visits log"},
    "tour.kunjungan.intro.body": {
        "id": (
            "Catat kunjungan harian ke perpustakaan, baik perorangan (scan "
            "kartu anggota) maupun kunjungan kelas batch."
        ),
        "en": (
            "Log daily library visits, either per-person (scan member card) "
            "or as a batch class visit."
        ),
    },
    "tour.kunjungan.search.title": {"id": "Pilih Anggota", "en": "Pick member"},
    "tour.kunjungan.search.body": {
        "id": (
            "Scan barcode kartu anggota atau ketik kode/nama. Kosongkan "
            "kalau ingin mencatat kunjungan kelas batch (tanpa nama "
            "individu)."
        ),
        "en": (
            "Scan the member card barcode or type a code/name. Leave it "
            "empty for batch class visits (no individual name)."
        ),
    },
    "tour.kunjungan.kelas.title": {"id": "Kunjungan Kelas Batch", "en": "Batch class visit"},
    "tour.kunjungan.kelas.body": {
        "id": (
            "Untuk pelajaran masuk perpus, pilih sumber 'kelas' dan isi "
            "kelas + jumlah orang. Cocok untuk laporan kunjungan rombongan."
        ),
        "en": (
            "For class-led library sessions, pick source 'kelas' and fill "
            "class + headcount. Useful for group visit reports."
        ),
    },
    "tour.kunjungan.save.title": {"id": "Simpan Kunjungan", "en": "Save visit"},
    "tour.kunjungan.save.body": {
        "id": "Klik Simpan untuk mencatat. Kunjungan langsung tampil di tabel di kanan.",
        "en": "Click Save to record. The visit appears immediately in the right table.",
    },
    # Peminjaman
    "tour.peminjaman.intro.title": {"id": "Alur Peminjaman", "en": "Loan flow"},
    "tour.peminjaman.intro.body": {
        "id": (
            "Catat peminjaman buku dalam 4 langkah: pilih anggota → cari buku "
            "→ tambah ke item → simpan. Tutorial ini akan memandu setiap "
            "langkah."
        ),
        "en": (
            "Record a loan in 4 steps: pick member → find book → add to "
            "items → save. This tutorial walks you through each step."
        ),
    },
    "tour.peminjaman.anggota.title": {"id": "1. Pilih Anggota", "en": "1. Pick member"},
    "tour.peminjaman.anggota.body": {
        "id": (
            "Scan barcode kartu anggota atau ketik kode/nama lalu klik Cari. "
            "Nama anggota akan muncul di bawah kalau cocok."
        ),
        "en": (
            "Scan the member card barcode or type a code/name then click "
            "Search. The member's name appears below when matched."
        ),
    },
    "tour.peminjaman.buku.title": {"id": "2. Cari Buku", "en": "2. Find book"},
    "tour.peminjaman.buku.body": {
        "id": (
            "Scan barcode buku atau ketik kode/judul. Tekan Enter / klik "
            "Tambah Item untuk menambahkannya ke daftar pinjam."
        ),
        "en": (
            "Scan the book barcode or type a code/title. Press Enter / click "
            "Add Item to put it in the loan list."
        ),
    },
    "tour.peminjaman.add_item.title": {"id": "3. Tambah Item", "en": "3. Add item"},
    "tour.peminjaman.add_item.body": {
        "id": (
            "Buku yang sudah ditambah akan tampil di tabel kanan. Aplikasi "
            "akan menolak otomatis kalau eksemplar tidak tersedia atau "
            "anggota sudah melewati batas pinjaman."
        ),
        "en": (
            "Added books appear in the right table. The app auto-rejects "
            "when stock is unavailable or the member has hit the loan limit."
        ),
    },
    "tour.peminjaman.kunjungan.title": {
        "id": "Catat Kunjungan Sekalian",
        "en": "Auto-log visit",
    },
    "tour.peminjaman.kunjungan.body": {
        "id": (
            "Centang ini untuk otomatis mencatat kunjungan saat peminjaman "
            "disimpan. Berguna kalau perpus belum punya alur scan masuk "
            "terpisah."
        ),
        "en": (
            "Tick this to automatically log a visit when the loan is saved. "
            "Useful when the library has no separate entry-scan flow."
        ),
    },
    "tour.peminjaman.simpan.title": {"id": "4. Simpan & Cetak Nota", "en": "4. Save & print receipt"},
    "tour.peminjaman.simpan.body": {
        "id": (
            "Klik Simpan untuk menyelesaikan peminjaman. Kamu akan ditawari "
            "cetak nota peminjaman PDF langsung setelah simpan berhasil."
        ),
        "en": (
            "Click Save to finalize the loan. You will be offered to print "
            "the loan receipt PDF right after a successful save."
        ),
    },
    # Pengembalian
    "tour.pengembalian.intro.title": {"id": "Alur Pengembalian", "en": "Return flow"},
    "tour.pengembalian.intro.body": {
        "id": (
            "Proses kembalikan buku + tandai buku hilang. Denda terlambat "
            "dihitung otomatis berdasarkan parameter di Setting → Transaksi."
        ),
        "en": (
            "Process returns + mark lost books. Overdue fines are calculated "
            "automatically using parameters in Settings → Transactions."
        ),
    },
    "tour.pengembalian.search.title": {"id": "Cari Anggota", "en": "Find member"},
    "tour.pengembalian.search.body": {
        "id": (
            "Mulai dengan scan / cari anggota. Daftar buku yang sedang "
            "dipinjam anggota akan langsung muncul."
        ),
        "en": (
            "Start by scanning / searching the member. The list of books "
            "currently borrowed by them appears immediately."
        ),
    },
    "tour.pengembalian.list.title": {"id": "Daftar Pinjaman Aktif", "en": "Active loan list"},
    "tour.pengembalian.list.body": {
        "id": (
            "Pilih satu baris pinjaman aktif, lalu pakai tombol di bawah "
            "untuk melanjutkan: Kembalikan (normal) atau Buku Hilang."
        ),
        "en": (
            "Select an active loan row, then use the buttons below to "
            "continue: Return (normal) or Lost Book."
        ),
    },
    "tour.pengembalian.kembali.title": {
        "id": "Pengembalian Normal",
        "en": "Normal return",
    },
    "tour.pengembalian.kembali.body": {
        "id": (
            "Tombol ini membuka dialog pengembalian: cek kondisi buku, "
            "kalkulasi denda otomatis kalau lewat jatuh tempo, dan input "
            "bayar denda. Setelah simpan, nota PDF tersedia."
        ),
        "en": (
            "Opens the return dialog: check book condition, auto-calculate "
            "fines if overdue, and input fine payment. After saving, a PDF "
            "receipt is ready."
        ),
    },
    "tour.pengembalian.hilang.title": {"id": "Buku Hilang", "en": "Lost book"},
    "tour.pengembalian.hilang.body": {
        "id": (
            "Pakai tombol ini kalau buku tidak bisa dikembalikan (hilang/"
            "rusak berat). Sistem akan mencatat dan menetapkan denda "
            "penggantian sesuai kebijakan."
        ),
        "en": (
            "Use this when the book cannot be returned (lost/severely "
            "damaged). The system records it and assigns a replacement fine "
            "per policy."
        ),
    },
    # Laporan
    "tour.laporan.intro.title": {"id": "Pusat Laporan", "en": "Report center"},
    "tour.laporan.intro.body": {
        "id": (
            "Backup manual, ekspor Excel, grafik kunjungan, top peminjam, "
            "top buku, dan kas perpustakaan — semua dalam tab di sini."
        ),
        "en": (
            "Manual backup, Excel export, visit charts, top borrowers, top "
            "books, and library cash — all under tabs here."
        ),
    },
    "tour.laporan.tabs.title": {"id": "Tab Laporan", "en": "Report tabs"},
    "tour.laporan.tabs.body": {
        "id": (
            "Pilih tab di atas untuk berpindah jenis laporan. Setiap tab "
            "punya filter periode sendiri."
        ),
        "en": (
            "Pick a tab above to switch report type. Each tab has its own "
            "period filter."
        ),
    },
    "tour.laporan.export.title": {"id": "Ekspor Excel", "en": "Excel export"},
    "tour.laporan.export.body": {
        "id": (
            "Tombol ini mengekspor SEMUA tabel database ke satu file Excel "
            "(.xlsx) — satu sheet per tabel. Cocok buat arsip / analisis "
            "manual lebih lanjut."
        ),
        "en": (
            "This button exports ALL database tables to a single Excel "
            "(.xlsx) file — one sheet per table. Useful for archives / "
            "further manual analysis."
        ),
    },
    # Setting
    "tour.setting.intro.title": {"id": "Pengaturan Aplikasi", "en": "Application settings"},
    "tour.setting.intro.body": {
        "id": (
            "Semua konfigurasi aplikasi ada di tab-tab berikut. Tutorial "
            "akan berpindah tab otomatis untuk memperkenalkan tiap area."
        ),
        "en": (
            "All app configuration lives under these tabs. The tutorial "
            "will auto-switch tabs to introduce each area."
        ),
    },
    "tour.setting.identitas.title": {"id": "Tab Identitas", "en": "Identity tab"},
    "tour.setting.identitas.body": {
        "id": (
            "Atur nama sekolah/perpus, alamat, logo, dan kepala perpustakaan. "
            "Data ini muncul di kop nota & laporan PDF."
        ),
        "en": (
            "Configure school/library name, address, logo, and head "
            "librarian. This appears in PDF receipt & report letterheads."
        ),
    },
    "tour.setting.transaksi.title": {"id": "Tab Transaksi", "en": "Transactions tab"},
    "tour.setting.transaksi.body": {
        "id": (
            "Atur lama pinjam (hari), maks. eksemplar per anggota, denda per "
            "hari, denda buku hilang, dan toleransi keterlambatan."
        ),
        "en": (
            "Configure loan duration (days), max copies per member, daily "
            "fine, lost-book fine, and grace days."
        ),
    },
    "tour.setting.akun.title": {"id": "Tab Manajemen Akun", "en": "Account management"},
    "tour.setting.akun.body": {
        "id": (
            "Tambah / nonaktifkan akun pustakawan/admin. Setiap akun punya "
            "role (admin / pustakawan / siswa) yang membatasi akses fitur."
        ),
        "en": (
            "Add / deactivate librarian/admin accounts. Each account has a "
            "role (admin / librarian / student) limiting feature access."
        ),
    },
    "tour.setting.bahasa.title": {"id": "Tab Bahasa & Tema", "en": "Language & theme"},
    "tour.setting.bahasa.body": {
        "id": (
            "Pilih bahasa antarmuka (ID/EN), tema (Sistem/Terang/Gelap), warna "
            "aksen, dan tombol 'Mulai Ulang Semua Tutorial' kalau kamu mau "
            "mengulang panduan dari awal."
        ),
        "en": (
            "Pick the UI language (ID/EN), theme (System/Light/Dark), accent "
            "color, and the 'Restart All Tutorials' button if you want to "
            "replay the onboarding."
        ),
    },
    "tour.setting.backup.title": {"id": "Tab Backup Terjadwal", "en": "Scheduled Backup tab"},
    "tour.setting.backup.body": {
        "id": (
            "Atur backup otomatis harian/mingguan dengan retensi otomatis. "
            "Lihat status backup terakhir, jadwal berikutnya, dan list file "
            "backup."
        ),
        "en": (
            "Configure automatic daily/weekly backups with automatic "
            "retention. See last backup status, next schedule, and the list "
            "of backup files."
        ),
    },
    "tour.setting.audit.title": {"id": "Tab Audit Log", "en": "Audit Log tab"},
    "tour.setting.audit.body": {
        "id": (
            "Lihat catatan aktivitas penting: login, perubahan data, "
            "backup. Filter per tanggal / user / aksi untuk audit trail."
        ),
        "en": (
            "View key activity records: logins, data changes, backups. "
            "Filter by date / user / action for an audit trail."
        ),
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
    # ----------------------------- permissions / RBAC ----------------------
    "permissions.dialog.title": {
        "id": "Edit Hak Akses — {username}",
        "en": "Edit Permissions — {username}",
    },
    "permissions.dialog.help": {
        "id": (
            "Centang permission yang diberikan ke user ini. Tombol terkait "
            "permission yang tidak dicentang akan ter-disable saat user login."
        ),
        "en": (
            "Tick permissions granted to this user. Buttons tied to "
            "unchecked permissions will be disabled when the user logs in."
        ),
    },
    "permissions.dialog.preset.admin": {
        "id": "Pakai Default Admin",
        "en": "Use Admin Defaults",
    },
    "permissions.dialog.preset.pustakawan": {
        "id": "Pakai Default Pustakawan",
        "en": "Use Librarian Defaults",
    },
    "permissions.dialog.preset.siswa": {
        "id": "Pakai Default Siswa",
        "en": "Use Student Defaults",
    },
    "permissions.dialog.preset.none": {
        "id": "Kosongkan Semua",
        "en": "Clear All",
    },
    "permissions.dialog.col.role": {"id": "Role", "en": "Role"},
    "permissions.dialog.col.granted": {
        "id": "Hak Aktif",
        "en": "Active Grants",
    },
    "permissions.action.edit": {
        "id": "Edit Hak Akses…",
        "en": "Edit Permissions…",
    },
    "permissions.toast.saved": {
        "id": "Hak akses tersimpan ({granted} ditambah, {revoked} dicabut).",
        "en": "Permissions saved ({granted} added, {revoked} revoked).",
    },
    "permissions.toast.no_change": {
        "id": "Tidak ada perubahan hak akses.",
        "en": "No permission changes.",
    },
    "permissions.toast.denied": {
        "id": "Akses ditolak: {permission}",
        "en": "Access denied: {permission}",
    },
    "permissions.toast.denied_short": {
        "id": "Anda tidak punya hak akses untuk aksi ini.",
        "en": "You don't have permission for this action.",
    },
    # Area headings
    "permissions.area.anggota": {"id": "Data Anggota", "en": "Members"},
    "permissions.area.buku": {"id": "Data Buku", "en": "Books"},
    "permissions.area.kunjungan": {"id": "Kunjungan", "en": "Visits"},
    "permissions.area.peminjaman": {"id": "Peminjaman", "en": "Borrow"},
    "permissions.area.pengembalian": {"id": "Pengembalian", "en": "Return"},
    "permissions.area.laporan": {"id": "Laporan", "en": "Reports"},
    "permissions.area.setting": {"id": "Setting", "en": "Settings"},
    "permissions.area.audit_log": {"id": "Audit Log", "en": "Audit Log"},
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
