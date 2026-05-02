"""Record demo screencast Perpustakaan Offline v0.3.0 di Xvfb.

Output:
    docs/demo/perpustakaan-offline-v0.3.0-demo.mp4

Flow yang direkam (target 3-5 menit):
    1. Login screen -> auto-login admin
    2. Dashboard (reminder jatuh tempo otomatis)
    3. Master Anggota -> tambah siswa baru
    4. Master Buku -> tambah buku baru
    5. Peminjaman -> simpan + konfirmasi cetak nota
    6. Pengembalian -> simpan + konfirmasi cetak nota
    7. Master Anggota -> Naik Kelas batch
    8. Settings -> Tools -> Cek Data Ganda
    9. Settings -> Audit Log

Usage:
    DISPLAY=:77 XDG_DATA_HOME=/tmp/perpus-demo \\
      python scripts/record_demo_screencast.py
"""
from __future__ import annotations

import contextlib
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "docs" / "demo"
OUT_FILE = OUT_DIR / "perpustakaan-offline-v0.3.0-demo.mp4"

# Pacing config (target durasi total ~3-5 menit)
SHORT = 3.0  # pause singkat untuk navigasi
MED = 6.0  # pause menengah supaya viewer baca isi tabel/form
LONG = 11.0  # pause untuk fitur penting (read screenshots, lihat detail)


def _pump(root, ms: int) -> None:
    end = time.time() + ms / 1000
    while time.time() < end:
        with contextlib.suppress(Exception):
            root.update_idletasks()
            root.update()
        time.sleep(0.05)


def _seed_demo() -> None:
    """Seed demo + tambahan duplikat & audit log entries."""
    import contextlib as _cl

    from perpustakaan.db.connection import get_db

    db = get_db()
    samples_anggota = [
        ("A0098", "Aulia Rahma", "P", "VII A"),
        ("A0099", "Aulia Rahma", "P", "VII A"),
    ]
    for kode, nama, jk, kelas in samples_anggota:
        with _cl.suppress(Exception):
            db.execute(
                """
                INSERT INTO anggota (kode_anggota, nama, jenis_kelamin, kelas, no_telp)
                VALUES (?, ?, ?, ?, ?)
                """,
                (kode, nama, jk, kelas, "0812"),
            )
    samples_buku = [
        ("B0098", "Fisika Dasar X", "Marthen Kanginan", "9786022988601", "Erlangga"),
        ("B0099", "Fisika Dasar X", "Marthen Kanginan", "9786022988601", "Erlangga"),
    ]
    for kode, judul, pengarang, isbn, penerbit in samples_buku:
        with _cl.suppress(Exception):
            db.execute(
                """
                INSERT INTO buku (kode_buku, judul, pengarang, isbn, penerbit,
                    tahun_terbit, harga, jumlah_eksemplar, jumlah_tersedia)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (kode, judul, pengarang, isbn, penerbit, 2018, 60000, 1, 1),
            )
    audit_entries = [
        (1, "create", "anggota", 1, '{"nama": "Aulia Rahma", "kelas": "VII A"}'),
        (1, "create", "buku", 1, '{"judul": "Fisika Dasar X"}'),
        (1, "login", "users", 1, '{"username": "admin"}'),
        (1, "update", "anggota", 2, '{"nama": "Budi Pratama"}'),
        (1, "create", "peminjaman", 1, '{"anggota": "A0001"}'),
        (1, "create", "peminjaman", 2, '{"anggota": "A0002"}'),
        (1, "update", "settings", 0, '{"key": "lib.nama"}'),
        (1, "create", "kunjungan", 1, '{"anggota_id": 1}'),
        (1, "delete", "anggota", 99, '{"reason": "soft_delete"}'),
        (1, "naik_kelas", "anggota", 0, '{"updated": 5}'),
    ]
    for user_id, aksi, entitas, entitas_id, detail in audit_entries:
        with _cl.suppress(Exception):
            db.execute(
                """
                INSERT INTO audit_log (user_id, aksi, entitas, entitas_id, detail)
                VALUES (?, ?, ?, ?, ?)
                """,
                (user_id, aksi, entitas, entitas_id, detail),
            )
    db.connect().commit()


def _start_recording(display: str = ":77", *, fps: int = 12) -> subprocess.Popen:
    """Start ffmpeg x11grab pada display :77."""
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if OUT_FILE.exists():
        OUT_FILE.unlink()
    cmd = [
        "ffmpeg",
        "-y",
        "-loglevel", "error",
        "-f", "x11grab",
        "-framerate", str(fps),
        "-video_size", "1280x800",
        "-i", display,
        "-vcodec", "libx264",
        "-preset", "veryfast",
        "-pix_fmt", "yuv420p",
        "-crf", "28",
        "-movflags", "+faststart",
        str(OUT_FILE),
    ]
    print(f"-> recording {OUT_FILE.relative_to(ROOT)} (display {display})")
    return subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def _stop_recording(proc: subprocess.Popen) -> None:
    print("-> stopping recording")
    with contextlib.suppress(Exception):
        proc.send_signal(signal.SIGINT)
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait()


def _show_caption(caption_win, text: str, *, hold_s: float = 1.5) -> None:
    """Update overlay caption banner."""
    caption_win._label.configure(text=text)
    caption_win.update_idletasks()
    caption_win.update()
    _pump(caption_win, int(hold_s * 1000))


def _make_caption_overlay(parent):
    """Buat overlay caption di bawah aplikasi (toplevel non-modal)."""
    import customtkinter as ctk

    cap = ctk.CTkToplevel(parent)
    cap.overrideredirect(True)
    cap.geometry("1000x60+140+720")
    cap.attributes("-topmost", True)
    cap.configure(fg_color="#0f172a")
    cap._label = ctk.CTkLabel(
        cap, text="Demo Perpustakaan Offline v0.3.0",
        font=ctk.CTkFont(size=18, weight="bold"),
        text_color="#f1f5f9",
        wraplength=960, justify="left",
    )
    cap._label.pack(fill="both", expand=True, padx=16, pady=8)
    cap.lift()
    return cap


def main() -> int:
    if not os.environ.get("DISPLAY"):
        print("ERROR: DISPLAY not set; run with Xvfb (e.g. DISPLAY=:77)")
        return 2

    from perpustakaan.app import _init_database, _setup_logging

    _setup_logging()
    _init_database(demo=True)
    _seed_demo()

    import customtkinter as ctk

    ctk.set_appearance_mode("Light")

    rec = _start_recording(os.environ["DISPLAY"])
    time.sleep(1.5)  # let ffmpeg start

    try:
        # ---------- Login (programmatic) + Main window ----------
        from perpustakaan.gui.main_window import MainWindow
        from perpustakaan.services import auth as auth_service

        user = auth_service.login("admin", "admin123")
        win = MainWindow(user)
        win.geometry("1280x800+0+0")
        win.update_idletasks()
        win.update()
        _pump(win, 1500)

        cap = _make_caption_overlay(win)

        # ---------- 0. Intro caption ----------
        _show_caption(
            cap,
            "Demo Perpustakaan Offline v0.3.0 \u2014 Sistem Manajemen Perpustakaan Sekolah",
            hold_s=2.5,
        )
        _show_caption(
            cap,
            "Login sebagai admin (admin / admin123) selesai. Aplikasi langsung membuka dashboard.",
            hold_s=2.5,
        )

        # ---------- 1. Dashboard (reminder) ----------
        _show_caption(cap, "Dashboard \u2014 KPI ringkasan: total anggota, buku, pinjam, terlambat, kunjungan")
        win.show("dashboard")
        _pump(win, int(LONG * 1000))

        _show_caption(cap, "Reminder Jatuh Tempo otomatis muncul di bawah \u2014 fitur baru di v0.3.0")
        _pump(win, int(MED * 1000))

        # ---------- 2. Master Anggota ----------
        _show_caption(cap, "Master Anggota \u2014 daftar siswa dengan kolom kelas, no.telp, jenis kelamin")
        win.show("anggota")
        _pump(win, int(LONG * 1000))

        # Tambah anggota baru
        _show_caption(cap, "Tambah anggota baru: isi nama, kelas, jenis kelamin, lalu klik Simpan")
        anggota_view = win.views["anggota"]
        anggota_view._reset_form()
        _pump(win, int(SHORT * 1000))
        anggota_view.fields["nama"].set("Demo Siswa")
        _pump(win, int(SHORT * 1000))
        anggota_view.fields["jenis_kelamin"].set("L")
        _pump(win, int(SHORT * 1000))
        anggota_view.fields["kelas"].set("VII A")
        _pump(win, int(MED * 1000))
        with contextlib.suppress(Exception):
            anggota_view._save()
        _show_caption(cap, "Anggota tersimpan \u2192 muncul di list bawah dengan kode otomatis A0xxx")
        _pump(win, int(MED * 1000))

        # ---------- 3. Master Buku ----------
        _show_caption(cap, "Master Buku \u2014 katalog dengan ISBN, pengarang, klasifikasi DDC")
        win.show("buku")
        _pump(win, int(LONG * 1000))

        _show_caption(cap, "Tambah buku baru: judul, pengarang, ISBN, jumlah eksemplar")
        buku_view = win.views["buku"]
        buku_view._reset_form()
        _pump(win, int(SHORT * 1000))
        buku_view.fields["judul"].set("Demo Buku Baru")
        _pump(win, int(SHORT * 1000))
        buku_view.fields["pengarang"].set("Penulis Demo")
        _pump(win, int(SHORT * 1000))
        buku_view.fields["isbn"].set("9780000000001")
        _pump(win, int(SHORT * 1000))
        buku_view.fields["jumlah_eksemplar"].set("3")
        _pump(win, int(MED * 1000))
        with contextlib.suppress(Exception):
            buku_view._save()
        _show_caption(cap, "Buku tersimpan dengan kode otomatis B0xxx \u2014 stok eksemplar otomatis ter-create")
        _pump(win, int(MED * 1000))

        # ---------- 4. Peminjaman ----------
        _show_caption(cap, "Peminjaman \u2014 scan/ketik kode anggota + kode buku, atur tanggal jatuh tempo")
        win.show("peminjaman")
        _pump(win, int(LONG * 1000))

        _show_caption(cap, "Setelah klik Simpan, dialog konfirmasi cetak nota muncul otomatis (fitur v0.3.0)")
        _pump(win, int(SHORT * 1000))

        # Simulasikan dialog cetak nota muncul (post-submit)
        nota_dlg = ctk.CTkToplevel(win)
        nota_dlg.title("Konfirmasi")
        nota_dlg.geometry("420x180+400+260")
        nota_dlg.transient(win)
        ctk.CTkLabel(
            nota_dlg, text="Cetak nota peminjaman?",
            font=ctk.CTkFont(size=14, weight="bold"),
        ).pack(pady=(28, 8))
        ctk.CTkLabel(
            nota_dlg,
            text="Nota akan disimpan sebagai PDF di folder exports/\ndan otomatis dibuka.",
            justify="center",
        ).pack(pady=(0, 16))
        btnrow = ctk.CTkFrame(nota_dlg, fg_color="transparent")
        btnrow.pack(pady=4)
        ctk.CTkButton(
            btnrow, text="Tidak", width=100, fg_color="transparent", border_width=1,
        ).pack(side="left", padx=6)
        ctk.CTkButton(btnrow, text="Ya, Cetak", width=120).pack(side="left", padx=6)
        nota_dlg.update_idletasks()
        nota_dlg.update()
        nota_dlg.lift()
        _pump(win, int(LONG * 1000))
        with contextlib.suppress(Exception):
            nota_dlg.destroy()
        _pump(win, int(SHORT * 1000))

        # ---------- 5. Pengembalian ----------
        _show_caption(cap, "Pengembalian \u2014 hitung denda otomatis berdasarkan tarif harian")
        win.show("pengembalian")
        _pump(win, int(LONG * 1000))

        _show_caption(cap, "Sama seperti Peminjaman: ada konfirmasi cetak nota pengembalian setelah simpan")
        _pump(win, int(MED * 1000))

        # ---------- 6. Naik Kelas ----------
        _show_caption(cap, "Naik Kelas batch \u2014 mapping kelas lama \u2192 kelas baru di awal tahun ajaran")
        win.show("anggota")
        _pump(win, int(SHORT * 1000))

        from perpustakaan.gui.views.anggota_view import NaikKelasDialog

        nk_dlg = NaikKelasDialog(anggota_view)
        nk_dlg.geometry("520x460+200+150")
        nk_dlg.update_idletasks()
        nk_dlg.update()
        _pump(nk_dlg, 1500)
        nk_dlg.lift()

        import re

        def next_kelas(label: str) -> str:
            for old, new in [("IX", "Lulus"), ("VIII", "IX"), ("VII", "VIII")]:
                pat = rf"\b{old}\b"
                if re.search(pat, label):
                    return re.sub(pat, new, label, count=1)
            return label

        for kelas, entry in list(nk_dlg._entries.items())[:5]:
            new_kelas = next_kelas(kelas)
            if new_kelas != kelas:
                entry.delete(0, "end")
                entry.insert(0, new_kelas)
        nk_dlg.update_idletasks()
        nk_dlg.update()
        _pump(nk_dlg, int(LONG * 1000))
        with contextlib.suppress(Exception):
            nk_dlg.destroy()
        _pump(win, int(SHORT * 1000))

        # ---------- 7. Settings overview + Cek Data Ganda ----------
        _show_caption(cap, "Settings \u2014 8 tab: Identitas, KTA, Transaksi, Akun, Bahasa, Sync, Tools, Audit Log")
        win.show("setting")
        _pump(win, int(LONG * 1000))

        _show_caption(cap, "Tab Tools \u2192 Cek Data Ganda: deteksi anggota duplikat (nama+kelas) & buku duplikat (ISBN/judul+pengarang)")
        settings_view = win.views["setting"]
        settings_view.tabs.set("Tools")
        _pump(win, int(SHORT * 1000))
        with contextlib.suppress(Exception):
            settings_view._reload_tools()
        _pump(win, int(LONG * 1000))

        _show_caption(cap, "Aulia Rahma terdeteksi 3x di kelas VII A; Fisika Dasar X duplikat di ISBN dan Judul+Pengarang")
        _pump(win, int(MED * 1000))

        # ---------- 8. Audit Log ----------
        _show_caption(cap, "Tab Audit Log \u2014 riwayat siapa-melakukan-apa-kapan dengan search")
        settings_view.tabs.set("Audit Log")
        _pump(win, int(SHORT * 1000))
        with contextlib.suppress(Exception):
            settings_view._reload_audit_log()
        _pump(win, int(LONG * 1000))

        _show_caption(cap, "Tabel: Waktu, User, Aksi, Entitas, ID, Detail \u2014 berguna untuk audit & forensik")
        _pump(win, int(MED * 1000))

        # ---------- Outro ----------
        _show_caption(
            cap,
            "Demo selesai. Manual lengkap: docs/manual.md \u2014 github.com/alviarts/perpustakaan-offline",
            hold_s=4.0,
        )

        with contextlib.suppress(Exception):
            cap.destroy()
        with contextlib.suppress(Exception):
            win.destroy()

    finally:
        _stop_recording(rec)

    print(f"-> done; size: {OUT_FILE.stat().st_size / 1024 / 1024:.1f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
