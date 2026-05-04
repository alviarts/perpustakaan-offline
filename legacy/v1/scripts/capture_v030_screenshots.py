"""Capture screenshot baru untuk fitur v0.3.0 (Jalur B).

Output:
    docs/screenshots/14-naik-kelas.png
    docs/screenshots/15-cetak-nota.png
    docs/screenshots/16-tools-duplikat.png
    docs/screenshots/17-audit-log.png

Usage:
    DISPLAY=:77 XDG_DATA_HOME=/tmp/perpus-docs python scripts/capture_v030_screenshots.py
"""
from __future__ import annotations

import contextlib
import os
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCREENSHOT_DIR = ROOT / "docs" / "screenshots"


def _pump(root, ms: int = 800) -> None:
    end = time.time() + ms / 1000
    while time.time() < end:
        with contextlib.suppress(Exception):
            root.update_idletasks()
            root.update()
        time.sleep(0.05)


def _capture(root, name: str, *, full_display: bool = False) -> Path:
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    dest = SCREENSHOT_DIR / f"{name}.png"
    target = "root" if full_display else hex(root.winfo_id())
    subprocess.run(
        ["import", "-window", target, str(dest)],
        timeout=15,
        check=True,
        capture_output=True,
    )
    print(f"  -> saved {dest.relative_to(ROOT)}")
    return dest


def _seed_extra_demo() -> None:
    """Tambah duplikat anggota/buku + audit log entries supaya screenshot
    menampilkan tabel yang ramai (bukan kosong)."""
    from perpustakaan.db.connection import get_db

    db = get_db()
    # Duplikat anggota: tambah dua anggota dengan nama+kelas yang sama
    samples_anggota = [
        ("A0098", "Aulia Rahma", "P", "VII A"),
        ("A0099", "Aulia Rahma", "P", "VII A"),
        ("A0100", "Budi Pratama", "L", "VII A"),
        ("A0101", "Budi Pratama", "L", "VII A"),
    ]
    for kode, nama, jk, kelas in samples_anggota:
        with contextlib.suppress(Exception):
            db.execute(
                """
                INSERT INTO anggota (kode_anggota, nama, jenis_kelamin, kelas, no_telp)
                VALUES (?, ?, ?, ?, ?)
                """,
                (kode, nama, jk, kelas, "0812"),
            )
    # Duplikat buku: tambah dua buku dengan ISBN/judul yang sama
    samples_buku = [
        ("B0098", "Fisika Dasar X", "Marthen Kanginan", "9786022988601", "Erlangga"),
        ("B0099", "Fisika Dasar X", "Marthen Kanginan", "9786022988601", "Erlangga"),
        ("B0100", "Matematika SMA 1", "Sukino", "", "Yudhistira"),
        ("B0101", "Matematika SMA 1", "Sukino", "", "Yudhistira"),
    ]
    for kode, judul, pengarang, isbn, penerbit in samples_buku:
        with contextlib.suppress(Exception):
            db.execute(
                """
                INSERT INTO buku (kode_buku, judul, pengarang, isbn, penerbit,
                    tahun_terbit, harga, jumlah_eksemplar, jumlah_tersedia)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (kode, judul, pengarang, isbn, penerbit, 2018, 60000, 1, 1),
            )

    # Audit log demo entries
    audit_entries = [
        (1, "create", "anggota", 1, '{"nama": "Aulia Rahma", "kelas": "VII A"}'),
        (1, "create", "buku", 1, '{"judul": "Fisika Dasar X"}'),
        (1, "login", "users", 1, '{"username": "admin"}'),
        (1, "update", "anggota", 2, '{"nama": "Budi Pratama", "kelas": "VII A"}'),
        (1, "create", "peminjaman", 1, '{"anggota": "A0001", "buku": "B0001"}'),
        (1, "create", "peminjaman", 2, '{"anggota": "A0002", "buku": "B0003"}'),
        (1, "update", "settings", 0, '{"key": "lib.nama"}'),
        (1, "create", "kunjungan", 1, '{"anggota_id": 1}'),
        (1, "delete", "anggota", 99, '{"reason": "soft_delete"}'),
        (1, "naik_kelas", "anggota", 0, '{"updated": 5}'),
    ]
    for user_id, aksi, entitas, entitas_id, detail in audit_entries:
        with contextlib.suppress(Exception):
            db.execute(
                """
                INSERT INTO audit_log (user_id, aksi, entitas, entitas_id, detail)
                VALUES (?, ?, ?, ?, ?)
                """,
                (user_id, aksi, entitas, entitas_id, detail),
            )
    db.connect().commit()


def main() -> int:
    if not os.environ.get("DISPLAY"):
        print("ERROR: DISPLAY not set; run with Xvfb (e.g. DISPLAY=:77)")
        return 2

    from perpustakaan.app import _init_database, _setup_logging

    _setup_logging()
    _init_database(demo=True)
    _seed_extra_demo()

    import customtkinter as ctk

    ctk.set_appearance_mode("Light")

    from perpustakaan.gui.main_window import MainWindow
    from perpustakaan.services.auth import login

    user = login("admin", "admin123")
    win = MainWindow(user)
    win.geometry("1280x800+0+0")
    _pump(win, 1500)

    # 1. Naik Kelas dialog -------------------------------------------------
    print("Capturing: 14-naik-kelas")
    win.show("anggota")
    _pump(win, 800)
    anggota_view = win.views["anggota"]
    from perpustakaan.gui.views.anggota_view import NaikKelasDialog

    dialog = NaikKelasDialog(anggota_view)
    dialog.geometry("520x460+200+150")
    dialog.update_idletasks()
    dialog.update()
    _pump(dialog, 1500)
    dialog.lift()
    dialog.update_idletasks()
    dialog.update()

    # Isi mapping contoh — gunakan regex word-boundary supaya VIII tidak
    # tertangkap oleh "VII".
    def _next_kelas(label: str) -> str:
        for old, new in [("IX", "Lulus"), ("VIII", "IX"), ("VII", "VIII")]:
            pattern = rf"\b{old}\b"
            if re.search(pattern, label):
                return re.sub(pattern, new, label, count=1)
        return label

    for kelas, entry in list(dialog._entries.items())[:5]:
        new_kelas = _next_kelas(kelas)
        if new_kelas != kelas:
            entry.delete(0, "end")
            entry.insert(0, new_kelas)
    dialog.update_idletasks()
    dialog.update()
    _pump(dialog, 1500)
    _capture(win, "14-naik-kelas", full_display=True)
    with contextlib.suppress(Exception):
        dialog.destroy()
    _pump(win, 600)

    # 2. Cetak Nota dialog (confirm popup) ---------------------------------
    print("Capturing: 15-cetak-nota")
    win.show("peminjaman")
    _pump(win, 800)

    # Tampilkan dialog konfirmasi cetak nota — bikin Toplevel manual yang
    # tampilannya sama dengan widgets.confirm() agar konsisten dengan flow user.
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
    _pump(win, 2000)
    _capture(win, "15-cetak-nota", full_display=True)
    with contextlib.suppress(Exception):
        nota_dlg.destroy()
    _pump(win, 600)

    # 3. Settings → Tools (Cek Data Ganda) ---------------------------------
    print("Capturing: 16-tools-duplikat")
    win.show("setting")
    _pump(win, 800)
    settings_view = win.views["setting"]
    settings_view.tabs.set("Tools")
    _pump(win, 800)
    settings_view._reload_tools()
    _pump(win, 800)
    win.update_idletasks()
    win.update()
    _capture(win, "16-tools-duplikat")
    _pump(win, 400)

    # 4. Settings → Audit Log ---------------------------------------------
    print("Capturing: 17-audit-log")
    settings_view.tabs.set("Audit Log")
    _pump(win, 800)
    settings_view._reload_audit_log()
    _pump(win, 800)
    win.update_idletasks()
    win.update()
    _capture(win, "17-audit-log")
    _pump(win, 400)

    print("Done. Screenshots in docs/screenshots/")
    with contextlib.suppress(Exception):
        win.destroy()
    return 0


if __name__ == "__main__":
    sys.exit(main())
