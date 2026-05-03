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
        widgets.HeadingBar(
            self, text=t("menu.master.anggota"),
            menu_key="anggota", main_window=app,
        ).pack(fill="x", padx=24, pady=(20, 8))

        # Toolbar
        toolbar = ctk.CTkFrame(self, fg_color="transparent")
        toolbar.pack(fill="x", padx=24, pady=4)
        self.search = ctk.CTkEntry(toolbar, placeholder_text=t("common.search"), width=260)
        self.search.pack(side="left")
        self.search.bind("<Return>", lambda _e: self._reload())
        widgets.icon_button(
            toolbar, text=t("common.refresh"), lucide="refresh-cw",
            width=110, command=self._reload,
        ).pack(side="left", padx=4)
        widgets.permission_button(
            toolbar, text=t("common.import"), lucide="upload", width=110,
            permission="anggota.import", command=self._do_import,
        ).pack(side="right", padx=2)
        widgets.icon_button(
            toolbar, text="Template", lucide="file-text",
            width=110, command=self._download_template,
        ).pack(side="right", padx=2)
        widgets.permission_button(
            toolbar, text=t("anggota.cetak_kta"), lucide="printer", width=140,
            permission="anggota.cetak_kta", command=self._cetak_kta,
        ).pack(side="right", padx=2)
        widgets.permission_button(
            toolbar, text=t("anggota.bebas_pustaka"), lucide="clipboard-list", width=170,
            permission="anggota.bebas_pustaka", command=self._cetak_bebas,
        ).pack(side="right", padx=2)
        widgets.permission_button(
            toolbar, text=t("anggota.naik_kelas"), lucide="arrow-right", width=140,
            permission="anggota.naik_kelas", command=self._naik_kelas,
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
        self.btn_save = widgets.icon_button(
            btn_row, text=t("common.add"), lucide="plus",
            command=self._save,
        )
        self.btn_save.pack(side="left", padx=2)
        widgets.icon_button(
            btn_row, text=t("common.new"), lucide="file-text",
            command=self._reset_form,
            fg_color="transparent", border_width=1,
        ).pack(side="left", padx=2)
        widgets.icon_button(
            btn_row, text=t("common.delete"), lucide="trash-2",
            command=self._delete,
            fg_color="#ef4444", hover_color="#dc2626",
        ).pack(side="right", padx=2)

        # Wrapper utk table + empty state — grid overlay supaya empty state
        # bisa di-show/hide tanpa mengganggu layout table.
        table_wrapper = ctk.CTkFrame(body, fg_color="transparent")
        table_wrapper.grid(row=0, column=1, sticky="nsew")
        table_wrapper.grid_columnconfigure(0, weight=1)
        table_wrapper.grid_rowconfigure(0, weight=1)

        # Table
        self.table = StyledTreeview(
            table_wrapper,
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
        self.table.grid(row=0, column=0, sticky="nsew")
        self._table_wrapper = table_wrapper
        self._empty_state: widgets.EmptyState | None = None

    # ----------------------------------------------------------------
    def on_show(self) -> None:
        self._reload()

    def _reload(self) -> None:
        rows = anggota_repo.list_all(search=self.search.get().strip())
        self.table.set_rows(rows)
        self._toggle_empty_state(empty=not rows)

    def _toggle_empty_state(self, *, empty: bool) -> None:
        """Tampilkan EmptyState saat tidak ada baris, sembunyikan saat ada.

        EmptyState di-grid di kolom yang sama dengan table — kita lift()
        salah satu sesuai state.
        """
        if empty:
            if self._empty_state is None:
                is_search = bool(self.search.get().strip())
                self._empty_state = widgets.EmptyState(
                    self._table_wrapper,
                    title=(
                        t("anggota.empty.search.title")
                        if is_search
                        else t("anggota.empty.title")
                    ),
                    description=(
                        t("anggota.empty.search.desc")
                        if is_search
                        else t("anggota.empty.desc")
                    ),
                    icon="frown" if is_search else "users",
                    icon_size=64,
                    illustration=(
                        "empty-anggota-search" if is_search else "empty-anggota"
                    ),
                    illustration_size=(360, 220),
                )
                self._empty_state.grid(row=0, column=0, sticky="nsew")
            self._empty_state.lift()
        else:
            if self._empty_state is not None:
                self._empty_state.destroy()
                self._empty_state = None

    def _reset_form(self) -> None:
        self._editing_id = None
        for f in self.fields.values():
            f.set("")
        # Reset save button: ganti label + icon kembali ke "Tambah".
        try:
            from perpustakaan.gui.icons import lucide_icon
            plus_img = lucide_icon("plus", size=16)
        except Exception:  # noqa: BLE001
            plus_img = None
        self.btn_save.configure(text=t("common.add"), image=plus_img)

    def _on_select(self, row: dict) -> None:
        self._editing_id = int(row["id"])
        for k, f in self.fields.items():
            f.set(row.get(k, ""))
        try:
            from perpustakaan.gui.icons import lucide_icon
            save_img = lucide_icon("save", size=16)
        except Exception:  # noqa: BLE001
            save_img = None
        self.btn_save.configure(text=t("common.update"), image=save_img)

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
        # Permission check: tambah vs edit dipilih berdasarkan _editing_id.
        needed = "anggota.edit" if self._editing_id else "anggota.tambah"
        if not widgets.require_permission_or_toast(self, needed):
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
        if not widgets.require_permission_or_toast(self, "anggota.hapus"):
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
        from perpustakaan.models import peminjaman as peminjaman_repo

        sel = self.table.selected()
        if sel is None:
            widgets.show_toast(self, "Pilih anggota terlebih dahulu.", kind="warning")
            return
        aktif = peminjaman_repo.list_aktif_anggota(int(sel["id"]))
        if aktif:
            judul_list = ", ".join(r.get("judul", "?") for r in aktif[:5])
            widgets.warn(
                self,
                f"Anggota masih memiliki {len(aktif)} peminjaman aktif:\n"
                f"{judul_list}\n\n"
                "Selesaikan semua peminjaman terlebih dahulu.",
            )
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
        from perpustakaan.gui.animations import apply_dialog_appear
        apply_dialog_appear(self)

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
