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
        ctk.CTkButton(
            toolbar, text=t("anggota.naik_kelas"), width=130, command=self._naik_kelas
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
            widgets.show_toast(self, t("toast.required", field="nama"), kind="warning")
            return
        try:
            if self._editing_id:
                anggota_repo.update(self._editing_id, data)
                widgets.show_toast(self, t("toast.updated"), kind="success")
            else:
                new_id = anggota_repo.create(data)
                self._editing_id = new_id
                widgets.show_toast(self, t("toast.saved"), kind="success")
            self._reset_form()
            self._reload()
        except Exception as e:
            widgets.report_exception(self, e, "Gagal simpan anggota")

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
            widgets.show_toast(self, t("toast.deleted_one"), kind="success")
        except Exception as e:
            widgets.report_exception(self, e, "Gagal hapus anggota")

    # ---------------- Naik Kelas ----------------
    def _naik_kelas(self) -> None:
        NaikKelasDialog(self).wait_window()
        self._reload()

    # ---------------- Cetak ----------------
    def _cetak_kta(self) -> None:
        sel = self.table.selected()
        if sel is None:
            widgets.show_toast(self, "Pilih anggota terlebih dahulu.", kind="warning")
            return
        try:
            path = pdf_service.cetak_kta(sel)
            _open_file(path)
            widgets.show_toast(self, f"KTA tersimpan: {path.name}", kind="success")
        except Exception as e:
            widgets.report_exception(self, e, "Gagal cetak KTA")

    def _cetak_bebas(self) -> None:
        sel = self.table.selected()
        if sel is None:
            widgets.show_toast(self, "Pilih anggota terlebih dahulu.", kind="warning")
            return
        try:
            path = pdf_service.cetak_bebas_pustaka(sel)
            _open_file(path)
            widgets.show_toast(self, f"Surat Bebas Pustaka: {path.name}", kind="success")
        except Exception as e:
            widgets.report_exception(self, e, "Gagal cetak surat bebas pustaka")

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
            widgets.report_exception(self, e, "Gagal impor Excel anggota", use_modal=True)

    def _download_template(self) -> None:
        try:
            path = excel_service.template_anggota()
            widgets.show_toast(self, f"Template disimpan: {path}", kind="success", duration_ms=4500)
            _open_file(path)
        except Exception as e:
            widgets.report_exception(self, e, "Gagal generate template Excel")


class NaikKelasDialog(ctk.CTkToplevel):
    """Dialog batch naik kelas: mapping kelas lama -> kelas baru."""

    def __init__(self, parent: AnggotaView) -> None:
        super().__init__(parent)
        self.parent_view = parent
        self.title(t("anggota.naik_kelas"))
        self.geometry("520x460")
        self.transient(parent)
        self.grab_set()

        ctk.CTkLabel(
            self, text=t("anggota.naik_kelas"),
            font=ctk.CTkFont(size=16, weight="bold"),
        ).pack(pady=(14, 4))

        ctk.CTkLabel(
            self, text="Isi kelas baru untuk setiap kelas. Kosongkan jika tidak naik.",
            text_color=("#6b7280", "#9ca3af"),
        ).pack(pady=(0, 8))

        kelas_list = anggota_repo.list_distinct_kelas()

        scroll = ctk.CTkScrollableFrame(self, label_text="Mapping Kelas")
        scroll.pack(fill="both", expand=True, padx=16, pady=4)

        self._entries: dict[str, ctk.CTkEntry] = {}
        for kelas in kelas_list:
            row = ctk.CTkFrame(scroll, fg_color="transparent")
            row.pack(fill="x", pady=2)
            ctk.CTkLabel(row, text=kelas, width=140, anchor="w").pack(side="left", padx=(4, 8))
            ctk.CTkLabel(row, text="→").pack(side="left", padx=4)
            entry = ctk.CTkEntry(row, placeholder_text="Kelas baru", width=180)
            entry.pack(side="left", padx=4)
            self._entries[kelas] = entry

        if not kelas_list:
            ctk.CTkLabel(scroll, text="Tidak ada data kelas.").pack(pady=20)

        btnbar = ctk.CTkFrame(self, fg_color="transparent")
        btnbar.pack(fill="x", padx=16, pady=12)
        ctk.CTkButton(
            btnbar, text=t("common.cancel"), command=self.destroy,
            fg_color="transparent", border_width=1,
        ).pack(side="right", padx=4)
        ctk.CTkButton(
            btnbar, text=t("common.save"), command=self._submit,
        ).pack(side="right", padx=4)

    def _submit(self) -> None:
        mapping = {}
        for lama, entry in self._entries.items():
            baru = entry.get().strip()
            if baru and baru != lama:
                mapping[lama] = baru
        if not mapping:
            widgets.show_toast(self, "Tidak ada perubahan kelas.", kind="warning")
            return
        summary = "\n".join(f"  {old} → {new}" for old, new in mapping.items())
        if not widgets.confirm(
            self, f"Naik kelas batch:\n{summary}\n\nLanjutkan?"
        ):
            return
        try:
            total = anggota_repo.naik_kelas(mapping)
            widgets.show_toast(
                self.parent_view,
                f"Berhasil update {total} anggota.",
                kind="success",
                duration_ms=4000,
            )
            self.destroy()
        except Exception as e:
            widgets.report_exception(self, e, "Gagal naik kelas batch")


def _open_file(path) -> None:
    import logging as _logging
    try:
        if sys.platform.startswith("win"):
            os.startfile(str(path))  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            os.system(f'open "{path}"')
        else:
            os.system(f'xdg-open "{path}"')
    except Exception as exc:  # noqa: BLE001 - tidak ada handler tersedia di sini
        _logging.getLogger("perpustakaan.gui").warning(
            "Gagal buka file %s: %s", path, exc
        )
