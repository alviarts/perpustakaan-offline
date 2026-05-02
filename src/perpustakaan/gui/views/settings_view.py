"""View Setting: identitas, KTA, transaksi, akun, bahasa/tema, sync."""
from __future__ import annotations

import contextlib
from tkinter import filedialog

import customtkinter as ctk

from perpustakaan.gui import widgets
from perpustakaan.gui.widgets import LabeledEntry, StyledTreeview, configure_theme
from perpustakaan.i18n import LOCALE_NAMES, set_locale, t
from perpustakaan.models import anggota as anggota_repo
from perpustakaan.models import buku as buku_repo
from perpustakaan.models import settings as settings_repo
from perpustakaan.services import auth as auth_service


class SettingsView(ctk.CTkFrame):
    def __init__(self, parent, app) -> None:
        super().__init__(parent, fg_color="transparent")
        self.app = app

        ctk.CTkLabel(
            self, text=t("menu.setting"),
            font=ctk.CTkFont(size=22, weight="bold"),
        ).pack(anchor="w", padx=24, pady=(20, 8))

        self.tabs = ctk.CTkTabview(self)
        self.tabs.pack(fill="both", expand=True, padx=24, pady=8)
        self.tabs.add(t("menu.setting.identitas"))
        self.tabs.add(t("menu.setting.kta"))
        self.tabs.add("Transaksi")
        self.tabs.add(t("menu.setting.akun"))
        self.tabs.add(t("menu.setting.bahasa"))
        self.tabs.add(t("menu.setting.sync"))
        self.tabs.add("Tools")

        self._build_identitas(self.tabs.tab(t("menu.setting.identitas")))
        self._build_kta(self.tabs.tab(t("menu.setting.kta")))
        self._build_transaksi(self.tabs.tab("Transaksi"))
        self._build_akun(self.tabs.tab(t("menu.setting.akun")))
        self._build_bahasa(self.tabs.tab(t("menu.setting.bahasa")))
        self._build_sync(self.tabs.tab(t("menu.setting.sync")))
        self._build_tools(self.tabs.tab("Tools"))

    def on_show(self) -> None:
        self._load_identitas()
        self._load_kta()
        self._load_transaksi()
        self._reload_akun()
        self._load_bahasa()
        self._load_sync()
        self._reload_tools()

    # ------------------ Identitas ------------------
    def _build_identitas(self, parent) -> None:
        wrap = ctk.CTkScrollableFrame(parent)
        wrap.pack(fill="both", expand=True, padx=10, pady=10)

        self.id_fields: dict[str, LabeledEntry] = {}
        for key, label in [
            ("lib.nama", t("set.lib.nama")),
            ("lib.alamat", t("set.lib.alamat")),
            ("lib.kepala", t("set.lib.kepala")),
            ("lib.npsn", t("set.lib.npsn")),
            ("lib.tahun_ajaran", t("set.lib.tahun_ajaran")),
            ("lib.kontak", t("set.lib.kontak")),
            ("lib.logo_path", t("set.lib.logo") + " (path)"),
        ]:
            f = LabeledEntry(wrap, label, width=400)
            f.pack(fill="x", padx=8, pady=2)
            self.id_fields[key] = f

        btnrow = ctk.CTkFrame(wrap, fg_color="transparent")
        btnrow.pack(fill="x", padx=8, pady=10)
        ctk.CTkButton(btnrow, text="Pilih Logo…", command=self._pick_logo).pack(side="left", padx=2)
        ctk.CTkButton(btnrow, text=t("common.save"), command=self._save_identitas).pack(
            side="right", padx=2
        )

    def _load_identitas(self) -> None:
        for key, field in self.id_fields.items():
            field.set(settings_repo.get_value(key) or "")

    def _save_identitas(self) -> None:
        try:
            settings_repo.set_many({k: f.get() for k, f in self.id_fields.items()})
            widgets.show_toast(self, t("toast.saved"), kind="success")
        except Exception as e:
            widgets.report_exception(self, e, "Gagal simpan identitas")

    def _pick_logo(self) -> None:
        path = filedialog.askopenfilename(
            title="Pilih logo", filetypes=[("Image", "*.png *.jpg *.jpeg *.gif *.bmp")]
        )
        if path:
            self.id_fields["lib.logo_path"].set(path)

    # ------------------ KTA ------------------
    def _build_kta(self, parent) -> None:
        wrap = ctk.CTkFrame(parent, fg_color="transparent")
        wrap.pack(fill="both", expand=True, padx=10, pady=10)

        ctk.CTkLabel(wrap, text="Teks peraturan di balik kartu anggota:", anchor="w").pack(
            fill="x", pady=(4, 4)
        )
        self.kta_text = ctk.CTkTextbox(wrap, height=240)
        self.kta_text.pack(fill="both", expand=True)

        ctk.CTkButton(wrap, text=t("common.save"), command=self._save_kta).pack(
            anchor="e", pady=8
        )

    def _load_kta(self) -> None:
        self.kta_text.delete("1.0", "end")
        self.kta_text.insert("1.0", settings_repo.get_value("kta.peraturan") or "")

    def _save_kta(self) -> None:
        try:
            settings_repo.set_value("kta.peraturan", self.kta_text.get("1.0", "end").strip())
            widgets.show_toast(self, t("toast.saved"), kind="success")
        except Exception as e:
            widgets.report_exception(self, e, "Gagal simpan teks KTA")

    # ------------------ Transaksi ------------------
    def _build_transaksi(self, parent) -> None:
        wrap = ctk.CTkFrame(parent, fg_color="transparent")
        wrap.pack(fill="x", padx=10, pady=10)

        self.trx_fields: dict[str, LabeledEntry] = {}
        for key, label in [
            ("transaksi.lama_pinjam_hari", t("set.trx.lama_pinjam")),
            ("transaksi.maks_buku_pinjam", t("set.trx.maks_pinjam")),
            ("transaksi.denda_per_hari", t("set.trx.denda_hari")),
            ("transaksi.denda_buku_hilang_persen", t("set.trx.denda_hilang")),
        ]:
            f = LabeledEntry(wrap, label)
            f.pack(fill="x", padx=8, pady=4)
            self.trx_fields[key] = f
        ctk.CTkButton(wrap, text=t("common.save"), command=self._save_transaksi).pack(
            anchor="e", padx=8, pady=10
        )

    def _load_transaksi(self) -> None:
        for k, f in self.trx_fields.items():
            f.set(settings_repo.get_value(k) or "")

    def _save_transaksi(self) -> None:
        try:
            data = {}
            for k, f in self.trx_fields.items():
                v = f.get().strip()
                int(v or 0)  # validasi
                data[k] = v or "0"
            settings_repo.set_many(data)
            widgets.show_toast(self, t("toast.saved"), kind="success")
        except ValueError:
            widgets.show_toast(self, "Semua field harus berupa angka.", kind="warning")

    # ------------------ Akun ------------------
    def _build_akun(self, parent) -> None:
        toolbar = ctk.CTkFrame(parent, fg_color="transparent")
        toolbar.pack(fill="x", padx=10, pady=8)
        ctk.CTkButton(toolbar, text="+ Akun Baru", command=self._add_user).pack(side="left", padx=2)
        ctk.CTkButton(toolbar, text="Hapus Akun", command=self._del_user,
                      fg_color="#ef4444", hover_color="#dc2626").pack(side="left", padx=2)
        ctk.CTkButton(toolbar, text="Ganti Password Saya", command=self._change_pw).pack(
            side="left", padx=2
        )
        self.akun_table = StyledTreeview(
            parent,
            columns=[
                ("username", "Username", 140),
                ("full_name", "Nama Lengkap", 220),
                ("role", "Role", 120),
                ("aktif", "Aktif", 60),
                ("last_login_at", "Login Terakhir", 160),
                ("created_at", "Dibuat", 160),
            ],
        )
        self.akun_table.pack(fill="both", expand=True, padx=10, pady=4)

    def _reload_akun(self) -> None:
        self.akun_table.set_rows(auth_service.list_users())

    def _add_user(self) -> None:
        dlg = AccountDialog(self, mode="new")
        dlg.wait_window()
        self._reload_akun()

    def _del_user(self) -> None:
        sel = self.akun_table.selected()
        if sel is None:
            return
        cur = auth_service.current_user()
        if cur and int(sel["id"]) == cur.id:
            widgets.show_toast(self, "Tidak bisa menghapus akun yang sedang login.", kind="warning")
            return
        if not widgets.confirm(self, t("toast.confirm_delete")):
            return
        try:
            auth_service.delete_user(int(sel["id"]))
            self._reload_akun()
            widgets.show_toast(self, t("toast.deleted_one"), kind="success")
        except Exception as e:
            widgets.report_exception(self, e, "Gagal hapus akun")

    def _change_pw(self) -> None:
        ChangePasswordDialog(self).wait_window()

    # ------------------ Bahasa & Tema ------------------
    def _build_bahasa(self, parent) -> None:
        wrap = ctk.CTkFrame(parent, fg_color="transparent")
        wrap.pack(fill="x", padx=10, pady=10)

        ctk.CTkLabel(wrap, text=t("set.bahasa") + ":").grid(row=0, column=0, padx=4, pady=4, sticky="w")
        self.bahasa_var = ctk.StringVar(value="id")
        self.bahasa_menu = ctk.CTkOptionMenu(
            wrap, variable=self.bahasa_var,
            values=[f"{c} — {LOCALE_NAMES[c]}" for c in LOCALE_NAMES],
        )
        self.bahasa_menu.grid(row=0, column=1, padx=4, pady=4)

        ctk.CTkLabel(wrap, text=t("set.tema") + ":").grid(row=1, column=0, padx=4, pady=4, sticky="w")
        self.tema_menu = ctk.CTkOptionMenu(wrap, values=["system", "light", "dark"])
        self.tema_menu.grid(row=1, column=1, padx=4, pady=4)

        ctk.CTkLabel(wrap, text="Warna:").grid(row=2, column=0, padx=4, pady=4, sticky="w")
        self.color_menu = ctk.CTkOptionMenu(wrap, values=["blue", "green", "dark-blue"])
        self.color_menu.grid(row=2, column=1, padx=4, pady=4)

        ctk.CTkButton(wrap, text=t("common.save"), command=self._save_bahasa).grid(
            row=3, column=1, padx=4, pady=12, sticky="e"
        )

    def _load_bahasa(self) -> None:
        cur_locale = settings_repo.get_value("ui.locale", "id") or "id"
        self.bahasa_menu.set(f"{cur_locale} — {LOCALE_NAMES.get(cur_locale, cur_locale)}")
        self.tema_menu.set(settings_repo.get_value("ui.theme", "system") or "system")
        self.color_menu.set(settings_repo.get_value("ui.color_theme", "blue") or "blue")

    def _save_bahasa(self) -> None:
        locale = self.bahasa_menu.get().split(" ", 1)[0]
        theme = self.tema_menu.get()
        color = self.color_menu.get()
        settings_repo.set_many(
            {"ui.locale": locale, "ui.theme": theme, "ui.color_theme": color}
        )
        with contextlib.suppress(ValueError):
            set_locale(locale)
        configure_theme(theme, color)
        widgets.info(
            self,
            "Pengaturan disimpan. Beberapa label baru akan terlihat setelah aplikasi "
            "dibuka ulang.",
        )

    # ------------------ Sync ------------------
    def _build_sync(self, parent) -> None:
        wrap = ctk.CTkFrame(parent, fg_color="transparent")
        wrap.pack(fill="both", expand=True, padx=10, pady=10)

        ctk.CTkLabel(
            wrap, text=t("sync.help"), wraplength=720, justify="left",
            text_color=("#374151", "#d1d5db"),
        ).pack(anchor="w", pady=(4, 12))

        self.sync_credentials_path = LabeledEntry(
            wrap, "credentials.json (Google OAuth Desktop)", width=500
        )
        self.sync_credentials_path.pack(fill="x", padx=4, pady=4)

        ctk.CTkButton(wrap, text="Pilih credentials.json…", command=self._pick_credentials).pack(
            anchor="w", padx=4, pady=4
        )

        info_row = ctk.CTkFrame(wrap, fg_color="transparent")
        info_row.pack(fill="x", padx=4, pady=8)
        self.sync_last_label = ctk.CTkLabel(info_row, text=t("sync.label.last_export") + ": —")
        self.sync_last_label.pack(side="left")

        ctk.CTkButton(
            wrap, text=t("sync.button.export"), command=self._do_export,
            height=40, width=260,
        ).pack(anchor="w", padx=4, pady=14)

        self.sync_result = ctk.CTkLabel(
            wrap, text="", justify="left", text_color=("#6b7280", "#9ca3af")
        )
        self.sync_result.pack(anchor="w", padx=4, pady=4)

    def _load_sync(self) -> None:
        last = settings_repo.get_value("sync.last_export_at") or "—"
        self.sync_last_label.configure(text=f"{t('sync.label.last_export')}: {last}")

    def _pick_credentials(self) -> None:
        path = filedialog.askopenfilename(
            title="Pilih credentials.json",
            filetypes=[("JSON", "*.json")],
        )
        if path:
            self.sync_credentials_path.set(path)

    def _do_export(self) -> None:
        path = self.sync_credentials_path.get().strip()
        if not path:
            widgets.show_toast(self, "Pilih credentials.json terlebih dahulu.", kind="warning")
            return
        try:
            from perpustakaan.services import sheets_service

            user = auth_service.current_user()
            res = sheets_service.export_all(
                path, username=(user.username if user else "user")
            )
            self.sync_result.configure(
                text=(
                    f"Berhasil ekspor ke spreadsheet.\n"
                    f"URL : {res['url']}\n"
                    f"ID  : {res['spreadsheet_id']}\n"
                    f"Sheets: {', '.join(res['sheets_written'])}"
                ),
                text_color="#10b981",
            )
            self._load_sync()
        except Exception as e:
            self.sync_result.configure(text=f"Error: {e}", text_color="#ef4444")

    # ------------------ Tools (Cek Data Ganda) ------------------
    def _build_tools(self, parent) -> None:
        wrap = ctk.CTkFrame(parent, fg_color="transparent")
        wrap.pack(fill="both", expand=True, padx=10, pady=10)

        ctk.CTkLabel(
            wrap, text="Cek Data Ganda",
            font=ctk.CTkFont(size=14, weight="bold"),
        ).pack(anchor="w", pady=(0, 4))

        ctk.CTkLabel(
            wrap,
            text="Deteksi entri duplikat anggota (nama+kelas) dan buku (ISBN / judul+pengarang).",
            text_color=("#6b7280", "#9ca3af"),
        ).pack(anchor="w", pady=(0, 8))

        ctk.CTkButton(
            wrap, text="Scan Duplikat", width=140, command=self._reload_tools
        ).pack(anchor="w", pady=(0, 8))

        ctk.CTkLabel(
            wrap, text="Duplikat Anggota (Nama + Kelas):",
            font=ctk.CTkFont(size=12, weight="bold"),
        ).pack(anchor="w", pady=(8, 2))
        self.dup_anggota_table = StyledTreeview(
            wrap,
            columns=[
                ("nama", "Nama", 220),
                ("kelas", "Kelas", 100),
                ("jumlah", "Jumlah", 70),
                ("kode_list", "Kode Anggota", 300),
            ],
            height=6,
        )
        self.dup_anggota_table.pack(fill="x", pady=2)

        ctk.CTkLabel(
            wrap, text="Duplikat Buku (ISBN / Judul+Pengarang):",
            font=ctk.CTkFont(size=12, weight="bold"),
        ).pack(anchor="w", pady=(12, 2))
        self.dup_buku_table = StyledTreeview(
            wrap,
            columns=[
                ("match_type", "Tipe", 120),
                ("judul", "Judul", 260),
                ("isbn", "ISBN", 140),
                ("jumlah", "Jumlah", 70),
                ("kode_list", "Kode Buku", 300),
            ],
            height=6,
        )
        self.dup_buku_table.pack(fill="x", pady=2)

        self.dup_summary = ctk.CTkLabel(wrap, text="", anchor="w")
        self.dup_summary.pack(anchor="w", pady=(8, 0))

    def _reload_tools(self) -> None:
        with contextlib.suppress(Exception):
            dup_a = anggota_repo.find_duplicates()
            self.dup_anggota_table.set_rows(dup_a)
            dup_b = buku_repo.find_duplicates()
            self.dup_buku_table.set_rows(dup_b)
            total = len(dup_a) + len(dup_b)
            if total == 0:
                self.dup_summary.configure(
                    text="Tidak ada data ganda ditemukan.",
                    text_color="#10b981",
                )
            else:
                self.dup_summary.configure(
                    text=f"Ditemukan {len(dup_a)} grup anggota + {len(dup_b)} grup buku duplikat.",
                    text_color="#f59e0b",
                )


# ---------------------------------------------------------------------------
# Dialog akun & password
# ---------------------------------------------------------------------------
class AccountDialog(ctk.CTkToplevel):
    def __init__(self, parent: SettingsView, *, mode: str) -> None:
        super().__init__(parent)
        self.parent_view = parent
        self.title("Akun Baru")
        self.geometry("400x340")
        self.transient(parent)
        self.grab_set()

        ctk.CTkLabel(self, text="Akun Baru", font=ctk.CTkFont(size=15, weight="bold")).pack(
            pady=(14, 6)
        )

        self.full_name = LabeledEntry(self, "Nama Lengkap")
        self.full_name.pack(fill="x", padx=20, pady=4)
        self.username = LabeledEntry(self, "Username")
        self.username.pack(fill="x", padx=20, pady=4)
        self.password = LabeledEntry(self, "Password", show="*")
        self.password.pack(fill="x", padx=20, pady=4)
        self.role_menu = ctk.CTkOptionMenu(self, values=["admin", "pustakawan"])
        self.role_menu.pack(fill="x", padx=20, pady=4)

        self.message = ctk.CTkLabel(self, text="", text_color="#ef4444")
        self.message.pack(pady=4)

        btnbar = ctk.CTkFrame(self, fg_color="transparent")
        btnbar.pack(fill="x", padx=20, pady=12)
        ctk.CTkButton(btnbar, text=t("common.cancel"), command=self.destroy,
                      fg_color="transparent", border_width=1).pack(side="right", padx=4)
        ctk.CTkButton(btnbar, text=t("common.save"), command=self._submit).pack(side="right", padx=4)

    def _submit(self) -> None:
        try:
            auth_service.register(
                username=self.username.get(),
                password=self.password.get(),
                full_name=self.full_name.get(),
                role=self.role_menu.get(),
            )
            self.destroy()
        except auth_service.AuthError as e:
            self.message.configure(text=str(e))


class ChangePasswordDialog(ctk.CTkToplevel):
    def __init__(self, parent: SettingsView) -> None:
        super().__init__(parent)
        self.title("Ganti Password")
        self.geometry("380x280")
        self.transient(parent)
        self.grab_set()
        self.parent_view = parent

        ctk.CTkLabel(self, text="Ganti Password", font=ctk.CTkFont(size=15, weight="bold")).pack(
            pady=(14, 6)
        )

        self.old = LabeledEntry(self, "Password Lama", show="*")
        self.old.pack(fill="x", padx=20, pady=4)
        self.new1 = LabeledEntry(self, "Password Baru", show="*")
        self.new1.pack(fill="x", padx=20, pady=4)
        self.new2 = LabeledEntry(self, "Konfirmasi Baru", show="*")
        self.new2.pack(fill="x", padx=20, pady=4)

        self.message = ctk.CTkLabel(self, text="", text_color="#ef4444")
        self.message.pack(pady=4)

        btnbar = ctk.CTkFrame(self, fg_color="transparent")
        btnbar.pack(fill="x", padx=20, pady=12)
        ctk.CTkButton(btnbar, text=t("common.cancel"), command=self.destroy,
                      fg_color="transparent", border_width=1).pack(side="right", padx=4)
        ctk.CTkButton(btnbar, text=t("common.save"), command=self._submit).pack(side="right", padx=4)

    def _submit(self) -> None:
        if self.new1.get() != self.new2.get():
            self.message.configure(text="Password baru tidak cocok.")
            return
        try:
            user = auth_service.current_user()
            if user is None:
                self.message.configure(text="Tidak ada sesi aktif.")
                return
            auth_service.change_password(user.id, self.old.get(), self.new1.get())
            self.destroy()
        except auth_service.AuthError as e:
            mapping = {
                "invalid_credentials": "Password lama salah.",
                "password_too_short": "Password baru minimal 6 karakter.",
            }
            self.message.configure(text=mapping.get(str(e), str(e)))
