"""View transaksi Pengembalian + Buku Hilang.

Mengikuti SIM-Perpus: cari anggota -> daftar buku dipinjam muncul -> double click /
scan eksemplar -> input bayar -> simpan.
"""
from __future__ import annotations

import os
import sys

import customtkinter as ctk

from perpustakaan.gui import widgets
from perpustakaan.gui.widgets import StyledTreeview, fmt_rupiah
from perpustakaan.i18n import t
from perpustakaan.models import anggota as anggota_repo
from perpustakaan.models import peminjaman as peminjaman_repo
from perpustakaan.services import pdf_service


class PengembalianView(ctk.CTkFrame):
    def __init__(self, parent, app) -> None:
        super().__init__(parent, fg_color="transparent")
        self.app = app
        self._anggota: dict | None = None

        widgets.HeadingBar(
            self, text=f"{t('menu.transaksi.pengembalian')} & {t('menu.transaksi.buku_hilang')}",
            menu_key="pengembalian", main_window=app,
        ).pack(fill="x", padx=24, pady=(20, 8))

        # Search anggota
        toolbar = ctk.CTkFrame(self, fg_color="transparent")
        toolbar.pack(fill="x", padx=24, pady=4)
        ctk.CTkLabel(toolbar, text="Anggota:").pack(side="left", padx=(0, 6))
        self.anggota_search = ctk.CTkEntry(
            toolbar, placeholder_text=f"{t('trx.scan_barcode')} / kode / nama", width=300
        )
        self.anggota_search.pack(side="left")
        self.anggota_search.bind("<Return>", lambda _e: self._find_anggota())
        widgets.icon_button(
            toolbar, text=t("common.search"), lucide="search",
            width=110, command=self._find_anggota,
        ).pack(side="left", padx=4)

        self.anggota_label = ctk.CTkLabel(self, text="—", anchor="w")
        self.anggota_label.pack(fill="x", padx=24, pady=(4, 0))

        # Daftar pinjaman aktif
        ctk.CTkLabel(self, text="Buku yang sedang dipinjam:",
                     font=ctk.CTkFont(size=12, weight="bold")).pack(
            anchor="w", padx=24, pady=(10, 4)
        )
        self.table = StyledTreeview(
            self,
            columns=[
                ("nomor_pinjam", "No. Pinjam", 130),
                ("kode_buku", t("buku.kode"), 110),
                ("judul", t("buku.judul"), 320),
                ("tanggal_pinjam", t("trx.tgl_pinjam"), 110),
                ("tanggal_jatuh_tempo", t("trx.tgl_jatuh_tempo"), 110),
                ("status", t("trx.status"), 100),
            ],
            on_double_click=self._open_proses,
        )
        self.table.pack(fill="both", expand=True, padx=24, pady=4)

        action = ctk.CTkFrame(self, fg_color="transparent")
        action.pack(fill="x", padx=24, pady=(8, 16))
        widgets.icon_button(
            action, text=t("menu.transaksi.pengembalian"), lucide="rotate-ccw",
            command=lambda: self._open_proses(self.table.selected(), mode="kembali"),
        ).pack(side="left", padx=2)
        widgets.icon_button(
            action, text=t("menu.transaksi.buku_hilang"), lucide="triangle-alert",
            command=lambda: self._open_proses(self.table.selected(), mode="hilang"),
            fg_color="#ef4444", hover_color="#dc2626",
        ).pack(side="left", padx=2)
        widgets.icon_button(
            action, text=t("common.refresh"), lucide="refresh-cw",
            command=self._reload,
            fg_color="transparent", border_width=1,
        ).pack(side="right", padx=2)

    # ----------------------------------------------------------------
    def on_show(self) -> None:
        self._reset()

    def _reset(self) -> None:
        self._anggota = None
        self.anggota_search.delete(0, "end")
        self.anggota_label.configure(text="—")
        self.table.set_rows([])

    def _find_anggota(self) -> None:
        q = self.anggota_search.get().strip()
        if not q:
            return
        ang = anggota_repo.get_by_kode(q)
        if ang is None:
            results = anggota_repo.list_all(search=q, limit=1)
            if results:
                ang = results[0]
        if ang is None:
            widgets.warn(self, "Anggota tidak ditemukan.")
            return
        self._anggota = ang
        self.anggota_label.configure(
            text=f"✓  {ang['kode_anggota']}  •  {ang['nama']}  •  {ang.get('kelas') or '-'}"
        )
        self._reload()

    def _reload(self) -> None:
        if self._anggota is None:
            return
        rows = peminjaman_repo.list_aktif_anggota(int(self._anggota["id"]))
        # rename item_id -> id biar Treeview key konsisten
        for r in rows:
            r["id"] = r.get("item_id")
        self.table.set_rows(rows)

    def _open_proses(self, row: dict | None, mode: str = "kembali") -> None:
        if row is None:
            widgets.warn(self, "Pilih buku terlebih dahulu.")
            return
        ProsesDialog(self, row, mode=mode).wait_window()
        self._reload()


class ProsesDialog(ctk.CTkToplevel):
    def __init__(self, parent: PengembalianView, item_row: dict, *, mode: str) -> None:
        super().__init__(parent)
        self.parent_view = parent
        self.item = item_row
        self.mode = mode  # kembali | hilang
        title = (
            t("menu.transaksi.pengembalian")
            if mode == "kembali"
            else t("menu.transaksi.buku_hilang")
        )
        self.title(title)
        self.geometry("420x340")
        self.transient(parent)
        self.grab_set()

        ctk.CTkLabel(self, text=title, font=ctk.CTkFont(size=15, weight="bold")).pack(pady=(14, 6))

        info = (
            f"No. Pinjam: {item_row.get('nomor_pinjam')}\n"
            f"Buku: {item_row.get('kode_buku')} — {item_row.get('judul')}\n"
            f"Jatuh Tempo: {item_row.get('tanggal_jatuh_tempo')}\n"
        )
        ctk.CTkLabel(self, text=info, justify="left", anchor="w").pack(fill="x", padx=20)

        ctk.CTkLabel(self, text=f"{t('trx.bayar')} (Rp):").pack(anchor="w", padx=20, pady=(8, 0))
        self.bayar_entry = ctk.CTkEntry(self, placeholder_text="0")
        self.bayar_entry.pack(fill="x", padx=20)

        self.message = ctk.CTkLabel(self, text="", text_color="#10b981", justify="left")
        self.message.pack(pady=10)

        btnbar = ctk.CTkFrame(self, fg_color="transparent")
        btnbar.pack(fill="x", padx=20, pady=12)
        widgets.icon_button(
            btnbar, text=t("common.cancel"), lucide="x",
            command=self.destroy,
            fg_color="transparent", border_width=1,
        ).pack(side="right", padx=4)
        widgets.icon_button(
            btnbar, text=t("common.save"), lucide="save",
            command=self._submit,
        ).pack(side="right", padx=4)

    def _submit(self) -> None:
        try:
            bayar = int(self.bayar_entry.get() or 0)
        except ValueError:
            bayar = 0
        try:
            from perpustakaan.services import auth as auth_service

            user = auth_service.current_user()
            item_id = int(self.item["item_id"])
            if self.mode == "kembali":
                res = peminjaman_repo.kembalikan(
                    item_id, bayar=bayar, petugas_id=user.id if user else None
                )
                self.message.configure(
                    text=(
                        f"Berhasil. Hari terlambat: {res['hari_terlambat']}, "
                        f"Denda: {fmt_rupiah(res['denda'])}"
                    ),
                    text_color="#10b981",
                )
            else:
                res = peminjaman_repo.tandai_hilang(
                    item_id, bayar=bayar, petugas_id=user.id if user else None
                )
                self.message.configure(
                    text=f"Buku ditandai hilang. Denda: {fmt_rupiah(res['denda'])}",
                    text_color="#f59e0b",
                )
            self._offer_nota(res)
            self.after(1500, self.destroy)
        except Exception as e:
            self.message.configure(text=str(e), text_color="#ef4444")

    def _offer_nota(self, res: dict) -> None:
        if not widgets.confirm(self, "Cetak nota pengembalian?"):
            return
        try:
            peminjaman_id = int(self.item.get("peminjaman_id") or self.item.get("id", 0))
            header = peminjaman_repo.get_header(peminjaman_id)
            if header is None:
                return
            items = peminjaman_repo.list_items(peminjaman_id)
            anggota = {}
            if self.parent_view._anggota:
                anggota = self.parent_view._anggota
            path = pdf_service.cetak_nota(
                judul_nota="Nota Pengembalian",
                nomor=header["nomor_pinjam"],
                tanggal=header.get("tanggal_kembali") or header["tanggal_pinjam"],
                anggota=anggota,
                items=items,
                total_denda=int(res.get("denda", 0)),
            )
            _open_file(path)
        except Exception as e:
            widgets.report_exception(self, e, "Gagal cetak nota")


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
