"""View Laporan: Backup/Reset, Grafik, Top Peminjam/Buku, Kas."""
from __future__ import annotations

import os
import sys
from datetime import datetime

import customtkinter as ctk
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg

from perpustakaan.gui import widgets
from perpustakaan.gui.widgets import StyledTreeview, fmt_rupiah
from perpustakaan.i18n import t
from perpustakaan.models import kas as kas_repo
from perpustakaan.models import peminjaman as peminjaman_repo
from perpustakaan.services import backup_service, excel_service, report_service


class LaporanView(ctk.CTkFrame):
    def __init__(self, parent, app) -> None:
        super().__init__(parent, fg_color="transparent")
        self.app = app

        widgets.HeadingBar(
            self, text=t("menu.laporan"),
            menu_key="laporan", main_window=app,
        ).pack(fill="x", padx=24, pady=(20, 8))

        self.tabs = ctk.CTkTabview(self)
        self.tabs.pack(fill="both", expand=True, padx=24, pady=8)
        self.tabs.add(t("menu.laporan.backup"))
        self.tabs.add(t("menu.laporan.grafik"))
        self.tabs.add(t("menu.laporan.top_peminjam"))
        self.tabs.add(t("menu.laporan.top_buku"))
        self.tabs.add(t("menu.laporan.kas"))

        self._build_backup(self.tabs.tab(t("menu.laporan.backup")))
        self._build_grafik(self.tabs.tab(t("menu.laporan.grafik")))
        self._build_top_peminjam(self.tabs.tab(t("menu.laporan.top_peminjam")))
        self._build_top_buku(self.tabs.tab(t("menu.laporan.top_buku")))
        self._build_kas(self.tabs.tab(t("menu.laporan.kas")))

    def on_show(self) -> None:
        self._reload_top_peminjam()
        self._reload_top_buku()
        self._reload_kas()

    # ----------------- Backup -----------------
    def _build_backup(self, parent) -> None:
        wrap = ctk.CTkFrame(parent, fg_color="transparent")
        wrap.pack(fill="x", padx=10, pady=10)

        ctk.CTkLabel(
            wrap,
            text=(
                "Backup file database SQLite ke folder backup, atau ekspor seluruh "
                "data ke file .xlsx (semua tabel, satu sheet per tabel). Reset "
                "transaksi akan menghapus data peminjaman / kunjungan / kas (data "
                "anggota & buku tetap aman)."
            ),
            wraplength=720, justify="left",
        ).pack(anchor="w", pady=(4, 12))

        widgets.permission_button(
            wrap, text="Backup Database (.db)",
            permission="setting.backup",
            command=self._do_backup_db, width=240,
        ).pack(anchor="w", pady=4)
        widgets.permission_button(
            wrap, text="Ekspor Semua Data (.xlsx)",
            permission="laporan.ekspor",
            command=self._do_export_xlsx, width=240,
        ).pack(anchor="w", pady=4)
        widgets.permission_button(
            wrap, text="Reset Data Transaksi (aman)",
            permission="setting.backup",
            command=self._do_reset_safe,
            fg_color="#f59e0b", hover_color="#d97706", width=240,
        ).pack(anchor="w", pady=4)
        widgets.permission_button(
            wrap, text="Reset Total (HATI-HATI)",
            permission="setting.backup",
            command=self._do_reset_full,
            fg_color="#dc2626", hover_color="#991b1b", width=240,
        ).pack(anchor="w", pady=(4, 8))

    def _do_backup_db(self) -> None:
        try:
            path = backup_service.backup_db()
            widgets.show_toast(self, f"Backup tersimpan: {path.name}", kind="success", duration_ms=4500)
            _open_folder(path)
        except Exception as e:
            widgets.report_exception(self, e, "Gagal backup database", use_modal=True)

    def _do_export_xlsx(self) -> None:
        try:
            path = excel_service.export_all_workbook()
            widgets.show_toast(self, f"Ekspor tersimpan: {path.name}", kind="success", duration_ms=4500)
            _open_folder(path)
        except Exception as e:
            widgets.report_exception(self, e, "Gagal ekspor workbook", use_modal=True)

    def _do_reset_safe(self) -> None:
        if not widgets.confirm(
            self,
            "Reset data transaksi (peminjaman dikembalikan + kunjungan + kas). "
            "Pinjaman aktif TIDAK akan dihapus. Lanjutkan?",
        ):
            return
        try:
            backup_service.reset_transaksi(keep_outstanding=True)
            widgets.show_toast(self, "Reset transaksi selesai.", kind="success")
        except Exception as e:
            widgets.report_exception(self, e, "Gagal reset transaksi", use_modal=True)

    def _do_reset_full(self) -> None:
        if not widgets.confirm(
            self,
            "RESET TOTAL — semua peminjaman + kunjungan + kas akan dihapus, "
            "termasuk pinjaman yang masih aktif. Yakin?",
        ):
            return
        try:
            backup_service.reset_transaksi(keep_outstanding=False)
            widgets.show_toast(self, "Reset total selesai.", kind="success")
        except Exception as e:
            widgets.report_exception(self, e, "Gagal reset total", use_modal=True)

    # ----------------- Grafik Kunjungan -----------------
    def _build_grafik(self, parent) -> None:
        toolbar = ctk.CTkFrame(parent, fg_color="transparent")
        toolbar.pack(fill="x", padx=10, pady=10)
        now = datetime.now()
        ctk.CTkLabel(toolbar, text="Tahun:").pack(side="left")
        self.graf_tahun = ctk.CTkEntry(toolbar, width=80)
        self.graf_tahun.insert(0, str(now.year))
        self.graf_tahun.pack(side="left", padx=4)

        ctk.CTkLabel(toolbar, text="Bulan (kosong = setahun):").pack(side="left", padx=(12, 0))
        self.graf_bulan = ctk.CTkEntry(toolbar, width=60)
        self.graf_bulan.pack(side="left", padx=4)

        widgets.icon_button(
            toolbar, text=t("common.refresh"), lucide="refresh-cw",
            command=self._render_grafik,
        ).pack(side="left", padx=8)

        self.graf_holder = ctk.CTkFrame(parent, fg_color=("#ffffff", "#1f2937"))
        self.graf_holder.pack(fill="both", expand=True, padx=10, pady=4)
        self._canvas = None

    def _render_grafik(self) -> None:
        try:
            tahun = int(self.graf_tahun.get())
        except ValueError:
            widgets.show_toast(self, "Tahun harus angka.", kind="warning")
            return
        bulan_str = self.graf_bulan.get().strip()
        if bulan_str:
            try:
                bulan = int(bulan_str)
                fig = report_service.figure_kunjungan_bulanan(tahun, bulan)
            except ValueError:
                widgets.show_toast(self, "Bulan harus 1-12.", kind="warning")
                return
        else:
            fig = report_service.figure_kunjungan_tahunan(tahun)

        # clear holder
        for w in self.graf_holder.winfo_children():
            w.destroy()
        canvas = FigureCanvasTkAgg(fig, master=self.graf_holder)
        canvas.draw()
        canvas.get_tk_widget().pack(fill="both", expand=True)

    # ----------------- Top Peminjam -----------------
    def _build_top_peminjam(self, parent) -> None:
        ctk.CTkLabel(
            parent, text="Top 10 Peminjam (sepanjang waktu)",
            font=ctk.CTkFont(size=13, weight="bold"),
        ).pack(anchor="w", padx=10, pady=8)
        self.top_peminjam = StyledTreeview(
            parent,
            columns=[
                ("kode_anggota", "Kode", 120),
                ("nama", "Nama", 280),
                ("kelas", "Kelas", 120),
                ("jumlah", "Jumlah Pinjam", 110),
            ],
        )
        self.top_peminjam.pack(fill="both", expand=True, padx=10, pady=4)

    def _reload_top_peminjam(self) -> None:
        self.top_peminjam.set_rows(peminjaman_repo.top_peminjam(limit=10))

    # ----------------- Top Buku -----------------
    def _build_top_buku(self, parent) -> None:
        ctk.CTkLabel(
            parent, text="Top 10 Buku Paling Dipinjam",
            font=ctk.CTkFont(size=13, weight="bold"),
        ).pack(anchor="w", padx=10, pady=8)
        self.top_buku = StyledTreeview(
            parent,
            columns=[
                ("kode_buku", "Kode", 100),
                ("judul", "Judul", 300),
                ("pengarang", "Pengarang", 200),
                ("jumlah", "Jumlah", 90),
            ],
        )
        self.top_buku.pack(fill="both", expand=True, padx=10, pady=4)

    def _reload_top_buku(self) -> None:
        self.top_buku.set_rows(peminjaman_repo.top_buku(limit=10))

    # ----------------- Kas -----------------
    def _build_kas(self, parent) -> None:
        toolbar = ctk.CTkFrame(parent, fg_color="transparent")
        toolbar.pack(fill="x", padx=10, pady=10)

        self.kas_summary = ctk.CTkLabel(
            toolbar, text="—", font=ctk.CTkFont(size=13, weight="bold")
        )
        self.kas_summary.pack(side="left")

        widgets.permission_button(
            toolbar, text="Pemasukan", lucide="plus",
            permission="laporan.kas_tambah",
            command=lambda: self._add_kas("masuk"),
        ).pack(side="right", padx=4)
        widgets.permission_button(
            toolbar, text="Pengeluaran", lucide="download",
            permission="laporan.kas_tambah",
            command=lambda: self._add_kas("keluar"),
            fg_color="#f59e0b", hover_color="#d97706",
        ).pack(side="right", padx=4)
        widgets.permission_button(
            toolbar, text=t("common.delete"), phosphor="trash",
            permission="laporan.kas_hapus", command=self._delete_kas,
            fg_color="#ef4444", hover_color="#dc2626",
        ).pack(side="right", padx=4)

        self.kas_table = StyledTreeview(
            parent,
            columns=[
                ("tanggal", "Tanggal", 100),
                ("keterangan", "Keterangan", 320),
                ("jenis", "Jenis", 80),
                ("nominal", "Nominal", 110),
                ("sumber", "Sumber", 100),
            ],
        )
        self.kas_table.pack(fill="both", expand=True, padx=10, pady=4)

    def _reload_kas(self) -> None:
        rows = kas_repo.list_all(limit=500)
        self.kas_table.set_rows(rows)
        rk = kas_repo.ringkasan()
        self.kas_summary.configure(
            text=(
                f"Saldo: {fmt_rupiah(rk['saldo'])}   |   "
                f"Masuk: {fmt_rupiah(rk['masuk'])}   |   "
                f"Keluar: {fmt_rupiah(rk['keluar'])}"
            )
        )

    def _add_kas(self, jenis: str) -> None:
        KasDialog(self, jenis=jenis).wait_window()
        self._reload_kas()

    def _delete_kas(self) -> None:
        sel = self.kas_table.selected()
        if sel is None:
            return
        if not widgets.confirm(self, t("toast.confirm_delete")):
            return
        try:
            kas_repo.delete(int(sel["id"]))
            self._reload_kas()
            widgets.show_toast(self, t("toast.deleted_one"), kind="success")
        except Exception as e:
            widgets.report_exception(self, e, "Gagal hapus baris kas")


class KasDialog(ctk.CTkToplevel):
    def __init__(self, parent: LaporanView, *, jenis: str) -> None:
        super().__init__(parent)
        self.parent_view = parent
        self.jenis = jenis
        self.title(("Pemasukan" if jenis == "masuk" else "Pengeluaran") + " Kas")
        self.geometry("380x280")
        self.transient(parent)
        self.grab_set()
        from perpustakaan.gui.animations import apply_dialog_appear
        apply_dialog_appear(self)

        ctk.CTkLabel(self, text="Keterangan:", anchor="w").pack(fill="x", padx=20, pady=(20, 0))
        self.keterangan = ctk.CTkEntry(self)
        self.keterangan.pack(fill="x", padx=20)

        ctk.CTkLabel(self, text="Nominal (Rp):", anchor="w").pack(fill="x", padx=20, pady=(8, 0))
        self.nominal = ctk.CTkEntry(self, placeholder_text="0")
        self.nominal.pack(fill="x", padx=20)

        ctk.CTkLabel(self, text="Tanggal (YYYY-MM-DD, kosong=hari ini):", anchor="w").pack(
            fill="x", padx=20, pady=(8, 0)
        )
        self.tanggal = ctk.CTkEntry(self)
        self.tanggal.pack(fill="x", padx=20)

        btnbar = ctk.CTkFrame(self, fg_color="transparent")
        btnbar.pack(fill="x", padx=20, pady=14)
        widgets.icon_button(
            btnbar, text=t("common.cancel"), lucide="x",
            command=self.destroy,
            fg_color="transparent", border_width=1,
        ).pack(side="right", padx=4)
        widgets.icon_button(
            btnbar, text=t("common.save"), phosphor="floppy-disk",
            command=self._submit,
        ).pack(side="right", padx=4)

    def _submit(self) -> None:
        try:
            from perpustakaan.services import auth as auth_service

            user = auth_service.current_user()
            kas_repo.add(
                keterangan=self.keterangan.get().strip() or "(tanpa keterangan)",
                jenis=self.jenis,
                nominal=int(self.nominal.get() or 0),
                sumber="manual",
                petugas_id=user.id if user else None,
                tanggal=self.tanggal.get().strip() or None,
            )
            self.destroy()
        except Exception as e:
            widgets.report_exception(self, e, "Gagal simpan baris kas")


def _open_folder(path) -> None:
    import logging as _logging
    try:
        if sys.platform.startswith("win"):
            os.startfile(str(path.parent))  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            os.system(f'open "{path.parent}"')
        else:
            os.system(f'xdg-open "{path.parent}"')
    except Exception as exc:  # noqa: BLE001
        _logging.getLogger("perpustakaan.gui").warning(
            "Gagal buka folder %s: %s", path, exc
        )
