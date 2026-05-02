"""View Master Data Anggota."""
from __future__ import annotations

import os
import sys
from tkinter import filedialog

import customtkinter as ctk

from perpustakaan.gui import widgets
from perpustakaan.gui.widgets import LabeledEntry, StyledTreeview
from perpustakaan.i18n import t
from perpustakaan.models import anggota as anggota_repo
from perpustakaan.services import excel_service, pdf_service


class AnggotaView(ctk.CTkFrame):
    def __init__(self, parent, app) -> None:
        super().__init__(parent, fg_color="transparent")
        self.app = app
        self._editing_id: int | None = None

        # Header
        header = ctk.CTkFrame(self, fg_color="transparent")
        header.pack(fill="x", padx=24, pady=(20, 8))
        ctk.CTkLabel(
            header, text=t("menu.master.anggota"),
            font=ctk.CTkFont(size=22, weight="bold"),
        ).pack(side="left")

        # Toolbar
        toolbar = ctk.CTkFrame(self, fg_color="transparent")
        toolbar.pack(fill="x", padx=24, pady=4)
        self.search = ctk.CTkEntry(toolbar, placeholder_text=t("common.search"), width=260)
        self.search.pack(side="left")
        self.search.bind("<Return>", lambda _e: self._reload())
        ctk.CTkButton(toolbar, text=t("common.refresh"), width=90, command=self._reload).pack(
            side="left", padx=4
        )
        ctk.CTkButton(
            toolbar, text=t("common.import"), width=90, command=self._do_import
        ).pack(side="right", padx=2)
        ctk.CTkButton(
            toolbar, text="Template", width=90, command=self._download_template
        ).pack(side="right", padx=2)
        ctk.CTkButton(
            toolbar, text=t("anggota.cetak_kta"), width=130, command=self._cetak_kta
        ).pack(side="right", padx=2)
        ctk.CTkButton(
            toolbar, text=t("anggota.bebas_pustaka"), width=160, command=self._cetak_bebas
        ).pack(side="right", padx=2)

        # Body: split form (kiri) + table (kanan)
        body = ctk.CTkFrame(self, fg_color="transparent")
        body.pack(fill="both", expand=True, padx=24, pady=8)
        body.grid_columnconfigure(0, weight=0, minsize=320)
        body.grid_columnconfigure(1, weight=1)
        body.grid_rowconfigure(0, weight=1)

        # Form panel
        form = ctk.CTkScrollableFrame(body, label_text="Data Anggota", width=320)
        form.grid(row=0, column=0, sticky="nsew", padx=(0, 12))

        self.fields: dict[str, LabeledEntry] = {}
        for key, label in [
            ("kode_anggota", t("anggota.kode")),
            ("nama", t("anggota.nama")),
            ("jenis_kelamin", t("anggota.jenis_kelamin") + " (L/P)"),
            ("kelas", t("anggota.kelas")),
            ("jurusan", t("anggota.jurusan")),
            ("tempat_lahir", "Tempat Lahir"),
            ("tanggal_lahir", "Tanggal Lahir (YYYY-MM-DD)"),
            ("no_telp", t("anggota.no_telp")),
            ("email", "Email"),
            ("alamat", t("anggota.alamat")),
            ("foto_path", t("anggota.foto") + " (path)"),
        ]:
            f = LabeledEntry(form, label)
            f.pack(fill="x", padx=8, pady=2)
            self.fields[key] = f

        # Foto picker
        ctk.CTkButton(form, text="Pilih Foto…", command=self._pick_foto).pack(
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

        # Table
        self.table = StyledTreeview(
            body,
            columns=[
                ("kode_anggota", t("anggota.kode"), 110),
                ("nama", t("anggota.nama"), 220),
                ("jenis_kelamin", "JK", 50),
                ("kelas", t("anggota.kelas"), 100),
                ("jurusan", t("anggota.jurusan"), 110),
                ("no_telp", t("anggota.no_telp"), 130),
                ("tanggal_daftar", t("anggota.tgl_daftar"), 110),
            ],
            on_double_click=self._on_select,
        )
        self.table.grid(row=0, column=1, sticky="nsew")

    # ----------------------------------------------------------------
    def on_show(self) -> None:
        self._reload()

    def _reload(self) -> None:
        rows = anggota_repo.list_all(search=self.search.get().strip())
        self.table.set_rows(rows)

    def _reset_form(self) -> None:
        self._editing_id = None
        for f in self.fields.values():
            f.set("")
        self.btn_save.configure(text=t("common.add"))

    def _on_select(self, row: dict) -> None:
        self._editing_id = int(row["id"])
        for k, f in self.fields.items():
            f.set(row.get(k, ""))
        self.btn_save.configure(text=t("common.update"))

    def _pick_foto(self) -> None:
        path = filedialog.askopenfilename(
            title="Pilih foto",
            filetypes=[("Image", "*.jpg *.jpeg *.png *.gif *.bmp")],
        )
        if path:
            self.fields["foto_path"].set(path)

    def _save(self) -> None:
        data = {k: f.get() or None for k, f in self.fields.items()}
        if not data.get("nama"):
            widgets.warn(self, t("toast.required", field="nama"))
            return
        try:
            if self._editing_id:
                anggota_repo.update(self._editing_id, data)
                widgets.info(self, t("toast.updated"))
            else:
                new_id = anggota_repo.create(data)
                self._editing_id = new_id
                widgets.info(self, t("toast.saved"))
            self._reset_form()
            self._reload()
        except Exception as e:
            widgets.error(self, str(e))

    def _delete(self) -> None:
        sel = self.table.selected()
        if sel is None:
            return
        if not widgets.confirm(self, t("toast.confirm_delete")):
            return
        try:
            anggota_repo.delete(int(sel["id"]))
            self._reset_form()
            self._reload()
            widgets.info(self, t("toast.deleted_one"))
        except Exception as e:
            widgets.error(self, str(e))

    # ---------------- Cetak ----------------
    def _cetak_kta(self) -> None:
        sel = self.table.selected()
        if sel is None:
            widgets.warn(self, "Pilih anggota terlebih dahulu.")
            return
        try:
            path = pdf_service.cetak_kta(sel)
            _open_file(path)
        except Exception as e:
            widgets.error(self, str(e))

    def _cetak_bebas(self) -> None:
        sel = self.table.selected()
        if sel is None:
            widgets.warn(self, "Pilih anggota terlebih dahulu.")
            return
        try:
            path = pdf_service.cetak_bebas_pustaka(sel)
            _open_file(path)
        except Exception as e:
            widgets.error(self, str(e))

    # ---------------- Import / Template ----------------
    def _do_import(self) -> None:
        path = filedialog.askopenfilename(
            title="Pilih file Excel template anggota",
            filetypes=[("Excel", "*.xlsx *.xls")],
        )
        if not path:
            return
        try:
            stats = excel_service.import_anggota(path)
            widgets.info(
                self,
                f"Berhasil impor {stats['inserted']} dari {stats['total']} baris. "
                f"Skipped: {stats['skipped']}, Duplicates: {stats['duplicates']}",
            )
            self._reload()
        except Exception as e:
            widgets.error(self, str(e))

    def _download_template(self) -> None:
        try:
            path = excel_service.template_anggota()
            widgets.info(self, f"Template disimpan di:\n{path}")
            _open_file(path)
        except Exception as e:
            widgets.error(self, str(e))


def _open_file(path) -> None:
    try:
        if sys.platform.startswith("win"):
            os.startfile(str(path))  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            os.system(f'open "{path}"')
        else:
            os.system(f'xdg-open "{path}"')
    except Exception:
        pass
