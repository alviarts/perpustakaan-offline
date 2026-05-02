"""View Kunjungan."""
from __future__ import annotations

import customtkinter as ctk

from perpustakaan.gui import widgets
from perpustakaan.gui.widgets import StyledTreeview
from perpustakaan.i18n import t
from perpustakaan.models import anggota as anggota_repo
from perpustakaan.models import kunjungan as kunjungan_repo


class KunjunganView(ctk.CTkFrame):
    def __init__(self, parent, app) -> None:
        super().__init__(parent, fg_color="transparent")
        self.app = app

        widgets.HeadingBar(
            self, text=t("menu.transaksi.kunjungan"),
            menu_key="kunjungan", main_window=app,
        ).pack(fill="x", padx=24, pady=(20, 8))

        body = ctk.CTkFrame(self, fg_color="transparent")
        body.pack(fill="both", expand=True, padx=24, pady=8)
        body.grid_columnconfigure(0, weight=0, minsize=320)
        body.grid_columnconfigure(1, weight=1)
        body.grid_rowconfigure(0, weight=1)

        # Form pencatatan
        form = ctk.CTkFrame(body)
        form.grid(row=0, column=0, sticky="nsew", padx=(0, 12))

        ctk.CTkLabel(form, text="Catat Kunjungan",
                     font=ctk.CTkFont(size=14, weight="bold")).pack(
            anchor="w", padx=12, pady=(12, 4)
        )
        ctk.CTkLabel(form, text="Anggota (kode/scan):", anchor="w").pack(fill="x", padx=12)
        self.anggota_search = ctk.CTkEntry(form, placeholder_text="Kosongkan untuk umum/kelas")
        self.anggota_search.pack(fill="x", padx=12)

        ctk.CTkLabel(form, text="Keperluan:", anchor="w").pack(fill="x", padx=12, pady=(8, 0))
        self.keperluan = ctk.CTkOptionMenu(
            form,
            values=["Membaca", "Pinjam Buku", "Kembalikan Buku", "Penelitian", "Kunjungan Kelas", "Lainnya"],
        )
        self.keperluan.pack(fill="x", padx=12)

        ctk.CTkLabel(form, text="Sumber:", anchor="w").pack(fill="x", padx=12, pady=(8, 0))
        self.sumber = ctk.CTkOptionMenu(form, values=["manual", "kelas"])
        self.sumber.pack(fill="x", padx=12)

        ctk.CTkLabel(form, text="Kelas (opsional):", anchor="w").pack(
            fill="x", padx=12, pady=(8, 0)
        )
        self.kelas = ctk.CTkEntry(form, placeholder_text="VII A / X IPA 1 / dll")
        self.kelas.pack(fill="x", padx=12)

        ctk.CTkLabel(form, text="Jumlah orang:", anchor="w").pack(
            fill="x", padx=12, pady=(8, 0)
        )
        self.jumlah = ctk.CTkEntry(form, placeholder_text="1")
        self.jumlah.pack(fill="x", padx=12)

        widgets.permission_button(
            form, text=t("common.save"),
            permission="kunjungan.tambah", command=self._save,
        ).pack(fill="x", padx=12, pady=14)

        # Tabel
        self.table = StyledTreeview(
            body,
            columns=[
                ("tanggal", "Tanggal", 100),
                ("jam", "Jam", 80),
                ("kode_anggota", "Kode", 90),
                ("nama_anggota", "Nama", 220),
                ("kelas", t("anggota.kelas"), 100),
                ("keperluan", "Keperluan", 160),
                ("jumlah_orang", "Jumlah", 70),
                ("sumber", "Sumber", 100),
            ],
        )
        self.table.grid(row=0, column=1, sticky="nsew")

    def on_show(self) -> None:
        self._reload()

    def _reload(self) -> None:
        self.table.set_rows(kunjungan_repo.list_recent(limit=200))

    def _save(self) -> None:
        try:
            from perpustakaan.services import auth as auth_service

            anggota_id: int | None = None
            kode = self.anggota_search.get().strip()
            if kode:
                ang = anggota_repo.get_by_kode(kode)
                if ang is None:
                    res = anggota_repo.list_all(search=kode, limit=1)
                    if res:
                        ang = res[0]
                if ang is None:
                    widgets.warn(self, "Anggota tidak ditemukan.")
                    return
                anggota_id = int(ang["id"])

            jumlah = int(self.jumlah.get() or 1)
            user = auth_service.current_user()
            kunjungan_repo.catat(
                anggota_id=anggota_id,
                keperluan=self.keperluan.get(),
                sumber=self.sumber.get(),
                jumlah_orang=jumlah,
                kelas=self.kelas.get().strip() or None,
                petugas_id=user.id if user else None,
            )
            self.anggota_search.delete(0, "end")
            self.kelas.delete(0, "end")
            self.jumlah.delete(0, "end")
            self._reload()
            widgets.show_toast(self, t("toast.saved"), kind="success")
        except Exception as e:
            widgets.report_exception(self, e, "Gagal simpan kunjungan")
