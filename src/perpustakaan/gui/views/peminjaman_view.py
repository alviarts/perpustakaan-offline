"""View transaksi peminjaman."""
from __future__ import annotations

import os
import sys

import customtkinter as ctk

from perpustakaan.gui import widgets
from perpustakaan.gui.widgets import StyledTreeview
from perpustakaan.i18n import t
from perpustakaan.models import anggota as anggota_repo
from perpustakaan.models import buku as buku_repo
from perpustakaan.models import peminjaman as peminjaman_repo
from perpustakaan.services import pdf_service


class PeminjamanView(ctk.CTkFrame):
    def __init__(self, parent, app) -> None:
        super().__init__(parent, fg_color="transparent")
        self.app = app
        self._anggota: dict | None = None
        self._items: list[dict] = []  # buku_id -> dict

        widgets.HeadingBar(
            self, text=t("menu.transaksi.peminjaman"),
            menu_key="peminjaman", main_window=app,
        ).pack(fill="x", padx=24, pady=(20, 8))

        body = ctk.CTkFrame(self, fg_color="transparent")
        body.pack(fill="both", expand=True, padx=24, pady=8)
        body.grid_columnconfigure(0, weight=1)
        body.grid_columnconfigure(1, weight=1)

        # ---------------- Kolom kiri: scan/search anggota dan buku ----------------
        left = ctk.CTkFrame(body)
        left.grid(row=0, column=0, sticky="nsew", padx=(0, 8))

        # Anggota
        ctk.CTkLabel(left, text=t("menu.master.anggota"),
                     font=ctk.CTkFont(size=13, weight="bold")).pack(
            anchor="w", padx=12, pady=(12, 4)
        )
        ang_row = ctk.CTkFrame(left, fg_color="transparent")
        ang_row.pack(fill="x", padx=12)
        self.anggota_search = ctk.CTkEntry(
            ang_row, placeholder_text=f"{t('trx.scan_barcode')} / kode / nama"
        )
        self.anggota_search.pack(side="left", fill="x", expand=True)
        self.anggota_search.bind("<Return>", lambda _e: self._find_anggota())
        widgets.icon_button(
            ang_row, text=t("common.search"), lucide="search",
            width=100, command=self._find_anggota,
        ).pack(side="left", padx=4)

        self.anggota_label = ctk.CTkLabel(
            left, text="—", anchor="w",
            text_color=("#374151", "#d1d5db"),
        )
        self.anggota_label.pack(fill="x", padx=12, pady=(8, 6))

        # Buku
        ctk.CTkLabel(left, text=t("menu.master.buku"),
                     font=ctk.CTkFont(size=13, weight="bold")).pack(
            anchor="w", padx=12, pady=(12, 4)
        )
        buku_row = ctk.CTkFrame(left, fg_color="transparent")
        buku_row.pack(fill="x", padx=12)
        self.buku_search = ctk.CTkEntry(
            buku_row, placeholder_text=f"{t('trx.scan_barcode')} / kode / judul"
        )
        self.buku_search.pack(side="left", fill="x", expand=True)
        self.buku_search.bind("<Return>", lambda _e: self._add_buku())
        widgets.icon_button(
            buku_row, text=t("trx.tambah_item"), lucide="plus",
            width=140, command=self._add_buku,
        ).pack(side="left", padx=4)

        # ---------------- Kolom kanan: daftar item ----------------
        right = ctk.CTkFrame(body)
        right.grid(row=0, column=1, sticky="nsew", padx=(8, 0))
        right.grid_rowconfigure(1, weight=1)
        right.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(right, text="Item Peminjaman",
                     font=ctk.CTkFont(size=13, weight="bold")).grid(
            row=0, column=0, sticky="w", padx=12, pady=(12, 4)
        )
        self.items_table = StyledTreeview(
            right,
            columns=[
                ("kode_buku", t("buku.kode"), 110),
                ("judul", t("buku.judul"), 280),
                ("jumlah_tersedia", "Tersedia", 80),
            ],
            height=12,
        )
        self.items_table.grid(row=1, column=0, sticky="nsew", padx=12)

        action = ctk.CTkFrame(right, fg_color="transparent")
        action.grid(row=2, column=0, sticky="ew", padx=12, pady=12)
        widgets.icon_button(
            action, text=t("trx.hapus_item"), lucide="trash-2",
            command=self._remove_buku,
            fg_color="#ef4444", hover_color="#dc2626",
        ).pack(side="left", padx=2)
        widgets.icon_button(
            action, text=t("common.new"), lucide="file-text",
            command=self._reset,
            fg_color="transparent", border_width=1,
        ).pack(side="left", padx=2)
        self.add_kunjungan = ctk.CTkCheckBox(action, text=t("trx.tambah_kunjungan"))
        self.add_kunjungan.select()
        self.add_kunjungan.pack(side="left", padx=10)
        widgets.icon_button(
            action, text=t("common.save"), lucide="save",
            width=140, command=self._submit,
        ).pack(side="right", padx=2)

    # ----------------------------------------------------------------
    def on_show(self) -> None:
        self._reset()

    def _reset(self) -> None:
        self._anggota = None
        self._items = []
        self.anggota_search.delete(0, "end")
        self.buku_search.delete(0, "end")
        self.anggota_label.configure(text="—")
        self.items_table.set_rows([])

    # ---------------- Anggota ----------------
    def _find_anggota(self) -> None:
        q = self.anggota_search.get().strip()
        if not q:
            return
        # Coba kode dulu
        ang = anggota_repo.get_by_kode(q)
        if ang is None:
            results = anggota_repo.list_all(search=q, limit=1)
            if results:
                ang = results[0]
        if ang is None:
            widgets.warn(self, "Anggota tidak ditemukan.")
            return
        if not int(ang.get("aktif", 1)):
            widgets.warn(self, "Anggota tidak aktif.")
            return
        self._anggota = ang
        self.anggota_label.configure(
            text=f"✓  {ang['kode_anggota']}  •  {ang['nama']}  •  {ang.get('kelas') or '-'}"
        )

    # ---------------- Buku ----------------
    def _add_buku(self) -> None:
        if self._anggota is None:
            widgets.warn(self, "Cari/scan anggota terlebih dahulu.")
            return
        q = self.buku_search.get().strip()
        if not q:
            return
        buku = buku_repo.get_by_kode(q)
        # cek scan eksemplar (B0001-01) -> potong belakang
        if buku is None and "-" in q:
            kb = q.split("-", 1)[0]
            buku = buku_repo.get_by_kode(kb)
        if buku is None:
            results = buku_repo.list_all(search=q, limit=1)
            if results:
                buku = results[0]
        if buku is None:
            widgets.warn(self, "Buku tidak ditemukan.")
            return
        if int(buku.get("jumlah_tersedia", 0)) <= 0:
            widgets.warn(self, "Tidak ada eksemplar tersedia.")
            return
        if any(it["id"] == buku["id"] for it in self._items):
            widgets.warn(self, "Buku sudah ada di daftar.")
            return
        self._items.append(buku)
        self.items_table.set_rows(self._items)
        self.buku_search.delete(0, "end")

    def _remove_buku(self) -> None:
        sel = self.items_table.selected()
        if sel is None:
            return
        self._items = [it for it in self._items if it["id"] != sel["id"]]
        self.items_table.set_rows(self._items)

    # ---------------- Submit ----------------
    def _submit(self) -> None:
        if self._anggota is None:
            widgets.show_toast(self, "Cari anggota dulu.", kind="warning")
            return
        if not self._items:
            widgets.show_toast(self, "Tambah minimal 1 buku.", kind="warning")
            return
        try:
            from perpustakaan.services import auth as auth_service

            user = auth_service.current_user()
            pid = peminjaman_repo.pinjam(
                anggota_id=int(self._anggota["id"]),
                buku_ids=[int(it["id"]) for it in self._items],
                petugas_id=user.id if user else None,
                tambah_kunjungan=bool(self.add_kunjungan.get()),
            )
            widgets.show_toast(
                self,
                f"Peminjaman #{pid} tersimpan: {len(self._items)} buku oleh {self._anggota['nama']}.",
                kind="success",
                duration_ms=4500,
            )
            self._cetak_nota_peminjaman(pid)
            self._reset()
        except Exception as e:
            widgets.report_exception(self, e, "Gagal simpan peminjaman")

    def _cetak_nota_peminjaman(self, peminjaman_id: int) -> None:
        if not widgets.confirm(self, "Cetak nota peminjaman?"):
            return
        try:
            header = peminjaman_repo.get_header(peminjaman_id)
            if header is None:
                return
            items = peminjaman_repo.list_items(peminjaman_id)
            path = pdf_service.cetak_nota(
                judul_nota="Nota Peminjaman",
                nomor=header["nomor_pinjam"],
                tanggal=header["tanggal_pinjam"],
                anggota=self._anggota or {},
                items=items,
            )
            _open_file(path)
            widgets.show_toast(self, f"Nota tersimpan: {path.name}", kind="success")
        except Exception as e:
            widgets.report_exception(self, e, "Gagal cetak nota peminjaman")


def _open_file(path) -> None:
    import logging as _logging
    try:
        if sys.platform.startswith("win"):
            os.startfile(str(path))  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            os.system(f'open "{path}"')
        else:
            os.system(f'xdg-open "{path}"')
    except Exception as exc:  # noqa: BLE001
        _logging.getLogger("perpustakaan.gui").warning(
            "Gagal buka file %s: %s", path, exc
        )
