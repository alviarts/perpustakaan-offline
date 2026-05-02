"""View Master Data Buku."""
from __future__ import annotations

import os
import sys
from tkinter import filedialog

import customtkinter as ctk

from perpustakaan.gui import widgets
from perpustakaan.gui.widgets import LabeledEntry, StyledTreeview
from perpustakaan.i18n import t
from perpustakaan.models import buku as buku_repo
from perpustakaan.services import excel_service, pdf_service


class BukuView(ctk.CTkFrame):
    def __init__(self, parent, app) -> None:
        super().__init__(parent, fg_color="transparent")
        self.app = app
        self._editing_id: int | None = None

        widgets.HeadingBar(
            self, text=t("menu.master.buku"),
            menu_key="buku", main_window=app,
        ).pack(fill="x", padx=24, pady=(20, 8))

        toolbar = ctk.CTkFrame(self, fg_color="transparent")
        toolbar.pack(fill="x", padx=24, pady=4)
        self.search = ctk.CTkEntry(toolbar, placeholder_text=t("common.search"), width=260)
        self.search.pack(side="left")
        self.search.bind("<Return>", lambda _e: self._reload())
        ctk.CTkButton(toolbar, text=t("common.refresh"), width=90, command=self._reload).pack(
            side="left", padx=4
        )
        widgets.permission_button(
            toolbar, text=t("common.import"), width=90,
            permission="buku.import", command=self._do_import,
        ).pack(side="right", padx=2)
        ctk.CTkButton(
            toolbar, text="Template", width=90, command=self._download_template
        ).pack(side="right", padx=2)
        widgets.permission_button(
            toolbar, text=t("buku.cetak_label"), width=170,
            permission="buku.cetak_label", command=self._cetak_label,
        ).pack(side="right", padx=2)
        widgets.permission_button(
            toolbar, text=t("buku.transfer_penerbit"), width=140,
            permission="buku.edit", command=self._transfer_penerbit,
        ).pack(side="right", padx=2)

        body = ctk.CTkFrame(self, fg_color="transparent")
        body.pack(fill="both", expand=True, padx=24, pady=8)
        body.grid_columnconfigure(0, weight=0, minsize=340)
        body.grid_columnconfigure(1, weight=1)
        body.grid_rowconfigure(0, weight=1)

        form = ctk.CTkScrollableFrame(body, label_text="Data Buku", width=340)
        form.grid(row=0, column=0, sticky="nsew", padx=(0, 12))

        self.fields: dict[str, LabeledEntry] = {}
        for key, label in [
            ("kode_buku", t("buku.kode")),
            ("judul", t("buku.judul")),
            ("pengarang", t("buku.pengarang")),
            ("penerbit", t("buku.penerbit")),
            ("tahun_terbit", t("buku.tahun_terbit")),
            ("kode_ddc", t("buku.kode_ddc")),
            ("kategori", t("buku.kategori")),
            ("isbn", t("buku.isbn")),
            ("jumlah_eksemplar", t("buku.jumlah_eksemplar")),
            ("sumber", t("buku.sumber")),
            ("harga", "Harga (Rp)"),
            ("bahasa", "Bahasa"),
            ("rak", "Rak"),
            ("cover_path", t("buku.cover") + " (path)"),
        ]:
            f = LabeledEntry(form, label)
            f.pack(fill="x", padx=8, pady=2)
            self.fields[key] = f

        ctk.CTkLabel(form, text="Deskripsi", anchor="w").pack(fill="x", padx=8, pady=(8, 2))
        self.deskripsi = ctk.CTkTextbox(form, height=80)
        self.deskripsi.pack(fill="x", padx=8)

        ctk.CTkButton(form, text="Pilih Cover…", command=self._pick_cover).pack(
            padx=8, pady=(2, 6), anchor="e"
        )

        btn_row = ctk.CTkFrame(form, fg_color="transparent")
        btn_row.pack(fill="x", padx=8, pady=(8, 4))
        self.btn_save = ctk.CTkButton(btn_row, text=t("common.add"), command=self._save)
        self.btn_save.pack(side="left", padx=2)
        ctk.CTkButton(
            btn_row, text=t("common.new"), command=self._reset_form,
            fg_color="transparent", border_width=1,
        ).pack(side="left", padx=2)
        ctk.CTkButton(
            btn_row, text=t("common.delete"), command=self._delete,
            fg_color="#ef4444", hover_color="#dc2626",
        ).pack(side="right", padx=2)

        self.table = StyledTreeview(
            body,
            columns=[
                ("kode_buku", t("buku.kode"), 100),
                ("judul", t("buku.judul"), 280),
                ("pengarang", t("buku.pengarang"), 160),
                ("penerbit", t("buku.penerbit"), 140),
                ("tahun_terbit", "Thn", 60),
                ("kode_ddc", "DDC", 80),
                ("jumlah_eksemplar", "Eks", 50),
                ("jumlah_tersedia", "Tersedia", 70),
            ],
            on_double_click=self._on_select,
        )
        self.table.grid(row=0, column=1, sticky="nsew")

    # ----------------------------------------------------------------
    def on_show(self) -> None:
        self._reload()

    def _reload(self) -> None:
        rows = buku_repo.list_all(search=self.search.get().strip())
        self.table.set_rows(rows)

    def _reset_form(self) -> None:
        self._editing_id = None
        for f in self.fields.values():
            f.set("")
        self.deskripsi.delete("1.0", "end")
        self.btn_save.configure(text=t("common.add"))

    def _on_select(self, row: dict) -> None:
        self._editing_id = int(row["id"])
        for k, f in self.fields.items():
            f.set(row.get(k, ""))
        self.deskripsi.delete("1.0", "end")
        self.deskripsi.insert("1.0", row.get("deskripsi", "") or "")
        self.btn_save.configure(text=t("common.update"))

    def _pick_cover(self) -> None:
        path = filedialog.askopenfilename(
            title="Pilih cover",
            filetypes=[("Image", "*.jpg *.jpeg *.png *.gif *.bmp")],
        )
        if path:
            self.fields["cover_path"].set(path)

    def _save(self) -> None:
        data = {}
        for k, f in self.fields.items():
            v = f.get() or None
            if k in {"tahun_terbit", "jumlah_eksemplar", "harga"} and v:
                try:
                    v = int(v)
                except ValueError:
                    v = 0
            data[k] = v
        data["deskripsi"] = self.deskripsi.get("1.0", "end").strip() or None

        if not data.get("judul"):
            widgets.show_toast(self, t("toast.required", field="judul"), kind="warning")
            return
        needed = "buku.edit" if self._editing_id else "buku.tambah"
        if not widgets.require_permission_or_toast(self, needed):
            return
        try:
            if self._editing_id:
                buku_repo.update(self._editing_id, data)
                widgets.show_toast(self, t("toast.updated"), kind="success")
            else:
                buku_repo.create(data)
                widgets.show_toast(self, t("toast.saved"), kind="success")
            self._reset_form()
            self._reload()
        except Exception as e:
            widgets.report_exception(self, e, "Gagal simpan buku")

    def _delete(self) -> None:
        sel = self.table.selected()
        if sel is None:
            return
        if not widgets.require_permission_or_toast(self, "buku.hapus"):
            return
        if not widgets.confirm(self, t("toast.confirm_delete")):
            return
        try:
            buku_repo.delete(int(sel["id"]))
            self._reset_form()
            self._reload()
            widgets.show_toast(self, t("toast.deleted_one"), kind="success")
        except Exception as e:
            widgets.report_exception(self, e, "Gagal hapus buku")

    # ---------------- Cetak ----------------
    def _cetak_label(self) -> None:
        sel = self.table.selected()
        if sel is None:
            widgets.show_toast(self, "Pilih buku terlebih dahulu.", kind="warning")
            return
        try:
            path = pdf_service.cetak_label_buku(sel)
            _open_file(path)
            widgets.show_toast(self, f"Label tersimpan: {path.name}", kind="success")
        except Exception as e:
            widgets.report_exception(self, e, "Gagal cetak label buku")

    def _transfer_penerbit(self) -> None:
        try:
            n = buku_repo.transfer_penerbit()
            widgets.show_toast(self, f"{n} penerbit ditambahkan ke master.", kind="success")
        except Exception as e:
            widgets.report_exception(self, e, "Gagal transfer penerbit")

    # ---------------- Import / Template ----------------
    def _do_import(self) -> None:
        path = filedialog.askopenfilename(
            title="Pilih file Excel template buku",
            filetypes=[("Excel", "*.xlsx *.xls")],
        )
        if not path:
            return
        try:
            stats = excel_service.import_buku(path)
            widgets.info(
                self,
                f"Berhasil impor {stats['inserted']} dari {stats['total']} baris. "
                f"Skipped: {stats['skipped']}, Duplicates: {stats['duplicates']}",
            )
            self._reload()
        except Exception as e:
            widgets.report_exception(self, e, "Gagal impor Excel buku", use_modal=True)

    def _download_template(self) -> None:
        try:
            path = excel_service.template_buku()
            widgets.show_toast(self, f"Template disimpan: {path}", kind="success", duration_ms=4500)
            _open_file(path)
        except Exception as e:
            widgets.report_exception(self, e, "Gagal generate template Excel")


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
