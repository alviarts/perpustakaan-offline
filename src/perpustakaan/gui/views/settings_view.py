"""View Setting: identitas, KTA, transaksi, akun, bahasa/tema, sync, backup."""
from __future__ import annotations

import contextlib
import os
import sys
from pathlib import Path
from tkinter import filedialog

import customtkinter as ctk

from perpustakaan.gui import widgets
from perpustakaan.gui.password_dialogs import ChangePasswordDialog
from perpustakaan.gui.widgets import LabeledEntry, StyledTreeview, configure_theme
from perpustakaan.i18n import LOCALE_NAMES, set_locale, t
from perpustakaan.models import anggota as anggota_repo
from perpustakaan.models import audit_log as audit_log_repo
from perpustakaan.models import buku as buku_repo
from perpustakaan.models import settings as settings_repo
from perpustakaan.services import auth as auth_service
from perpustakaan.services import backup_service
from perpustakaan.services.backup_scheduler import (
    SCHEDULE_DAILY,
    SCHEDULE_OFF,
    SCHEDULE_WEEKLY,
    BackupConfig,
    compute_next_run,
    get_scheduler,
)


class SettingsView(ctk.CTkFrame):
    def __init__(self, parent, app) -> None:
        super().__init__(parent, fg_color="transparent")
        self.app = app

        widgets.HeadingBar(
            self, text=t("menu.setting"),
            menu_key="setting", main_window=app,
        ).pack(fill="x", padx=24, pady=(20, 8))

        self.tabs = ctk.CTkTabview(self)
        self.tabs.pack(fill="both", expand=True, padx=24, pady=8)
        self.tabs.add(t("menu.setting.identitas"))
        self.tabs.add(t("menu.setting.kta"))
        self.tabs.add("Transaksi")
        self.tabs.add(t("menu.setting.akun"))
        self.tabs.add(t("menu.setting.bahasa"))
        self.tabs.add(t("menu.setting.sync"))
        self.tabs.add(t("backup.tab.title"))
        self.tabs.add("Tools")
        self.tabs.add("Audit Log")

        self._build_identitas(self.tabs.tab(t("menu.setting.identitas")))
        self._build_kta(self.tabs.tab(t("menu.setting.kta")))
        self._build_transaksi(self.tabs.tab("Transaksi"))
        self._build_akun(self.tabs.tab(t("menu.setting.akun")))
        self._build_bahasa(self.tabs.tab(t("menu.setting.bahasa")))
        self._build_sync(self.tabs.tab(t("menu.setting.sync")))
        self._build_backup(self.tabs.tab(t("backup.tab.title")))
        self._build_tools(self.tabs.tab("Tools"))
        self._build_audit_log(self.tabs.tab("Audit Log"))

    def on_show(self) -> None:
        self._load_identitas()
        self._load_kta()
        self._load_transaksi()
        self._reload_akun()
        self._load_bahasa()
        self._load_sync()
        self._load_backup()
        self._reload_tools()
        self._reload_audit_log()

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
        widgets.permission_button(
            btnrow, text=t("common.save"),
            permission="setting.identitas", command=self._save_identitas,
        ).pack(side="right", padx=2)

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

        widgets.permission_button(
            wrap, text=t("common.save"),
            permission="setting.kta", command=self._save_kta,
        ).pack(anchor="e", pady=8)

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
        widgets.permission_button(
            wrap, text=t("common.save"),
            permission="setting.transaksi", command=self._save_transaksi,
        ).pack(anchor="e", padx=8, pady=10)

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
        widgets.permission_button(
            toolbar, text="+ Akun Baru", permission="setting.akun",
            command=self._add_user,
        ).pack(side="left", padx=2)
        widgets.permission_button(
            toolbar, text="Hapus Akun", permission="setting.akun",
            command=self._del_user,
            fg_color="#ef4444", hover_color="#dc2626",
        ).pack(side="left", padx=2)
        widgets.permission_button(
            toolbar, text=t("permissions.action.edit"),
            permission="setting.akun",
            command=self._edit_permissions,
        ).pack(side="left", padx=2)
        # "Ganti Password Saya" tidak protected — siapapun yang login boleh
        # ganti password sendiri.
        ctk.CTkButton(toolbar, text="Ganti Password Saya", command=self._change_pw).pack(
            side="left", padx=2
        )
        self.akun_table = StyledTreeview(
            parent,
            columns=[
                ("username", "Username", 140),
                ("full_name", "Nama Lengkap", 220),
                ("role", "Role", 120),
                ("permission_count", t("permissions.dialog.col.granted"), 80),
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

    def _edit_permissions(self) -> None:
        sel = self.akun_table.selected()
        if sel is None:
            widgets.show_toast(
                self, "Pilih akun yang mau di-edit hak aksesnya dulu.",
                kind="warning",
            )
            return
        dlg = PermissionsDialog(
            self,
            user_id=int(sel["id"]),
            username=str(sel.get("username", "")),
            role=str(sel.get("role", "")),
        )
        dlg.wait_window()
        self._reload_akun()

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

        # Tutorial restart
        ctk.CTkLabel(
            wrap, text=t("tour.restart.help"), wraplength=520, justify="left",
            text_color=("#6b7280", "#9ca3af"),
        ).grid(row=4, column=0, columnspan=2, padx=4, pady=(16, 2), sticky="w")
        ctk.CTkButton(
            wrap, text=t("tour.restart"), command=self._restart_tour,
        ).grid(row=5, column=0, columnspan=2, padx=4, pady=(2, 12), sticky="w")

    def _restart_tour(self) -> None:
        # Reset semua flag tutorial.<menu>.completed lalu mulai tour Dashboard.
        from perpustakaan.gui.tour import reset_all_tutorial_flags

        with contextlib.suppress(Exception):
            reset_all_tutorial_flags()
        with contextlib.suppress(Exception):
            self.app.start_tour("dashboard")
        with contextlib.suppress(Exception):
            widgets.show_toast(
                self, t("tour.restart.applied"), kind="success", duration_ms=3000
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

    # ------------------ Backup Terjadwal ------------------
    _FREQ_OPTIONS = (SCHEDULE_OFF, SCHEDULE_DAILY, SCHEDULE_WEEKLY)

    def _freq_label(self, key: str) -> str:
        return {
            SCHEDULE_OFF: t("backup.freq.off"),
            SCHEDULE_DAILY: t("backup.freq.daily"),
            SCHEDULE_WEEKLY: t("backup.freq.weekly"),
        }.get(key, key)

    def _freq_key(self, label: str) -> str:
        for k in self._FREQ_OPTIONS:
            if self._freq_label(k) == label:
                return k
        return SCHEDULE_OFF

    def _weekday_label(self, idx: int) -> str:
        return t(f"backup.weekday.{idx}")

    def _weekday_idx(self, label: str) -> int:
        for i in range(7):
            if self._weekday_label(i) == label:
                return i
        return 0

    @staticmethod
    def _fmt_size(size_bytes: int) -> str:
        size = float(size_bytes)
        for unit in ("B", "KB", "MB", "GB"):
            if size < 1024:
                return f"{size:,.1f} {unit}" if unit != "B" else f"{int(size)} {unit}"
            size /= 1024
        return f"{size:,.1f} TB"

    def _build_backup(self, parent) -> None:
        wrap = ctk.CTkScrollableFrame(parent)
        wrap.pack(fill="both", expand=True, padx=10, pady=10)

        ctk.CTkLabel(
            wrap, text=t("backup.help"), wraplength=720, justify="left",
            text_color=("#374151", "#d1d5db"),
        ).pack(anchor="w", pady=(4, 12))

        # Frekuensi
        row = ctk.CTkFrame(wrap, fg_color="transparent")
        row.pack(fill="x", padx=4, pady=4)
        ctk.CTkLabel(row, text=t("backup.frequency") + ":", width=180, anchor="w").pack(side="left")
        self.backup_freq_menu = ctk.CTkOptionMenu(
            row,
            values=[self._freq_label(k) for k in self._FREQ_OPTIONS],
            command=lambda _v: self._update_backup_visibility(),
            width=200,
        )
        self.backup_freq_menu.pack(side="left", padx=4)

        # Jam (HH:MM)
        row = ctk.CTkFrame(wrap, fg_color="transparent")
        row.pack(fill="x", padx=4, pady=4)
        ctk.CTkLabel(row, text=t("backup.time") + ":", width=180, anchor="w").pack(side="left")
        self.backup_time_entry = ctk.CTkEntry(row, width=120, placeholder_text="02:00")
        self.backup_time_entry.pack(side="left", padx=4)

        # Hari (weekly)
        self.backup_weekday_row = ctk.CTkFrame(wrap, fg_color="transparent")
        self.backup_weekday_row.pack(fill="x", padx=4, pady=4)
        ctk.CTkLabel(
            self.backup_weekday_row, text=t("backup.weekday") + ":", width=180, anchor="w",
        ).pack(side="left")
        self.backup_weekday_menu = ctk.CTkOptionMenu(
            self.backup_weekday_row,
            values=[self._weekday_label(i) for i in range(7)],
            width=200,
        )
        self.backup_weekday_menu.pack(side="left", padx=4)

        # Folder tujuan
        row = ctk.CTkFrame(wrap, fg_color="transparent")
        row.pack(fill="x", padx=4, pady=4)
        ctk.CTkLabel(row, text=t("backup.folder") + ":", width=180, anchor="w").pack(side="left")
        self.backup_folder_entry = ctk.CTkEntry(row, width=380)
        self.backup_folder_entry.pack(side="left", padx=4)
        ctk.CTkButton(
            row, text="…", width=32, command=self._pick_backup_folder,
        ).pack(side="left", padx=2)
        ctk.CTkLabel(
            wrap, text=t("backup.folder.default"),
            text_color=("#6b7280", "#9ca3af"), font=ctk.CTkFont(size=11),
        ).pack(anchor="w", padx=(184, 4), pady=(0, 4))

        # Retensi
        row = ctk.CTkFrame(wrap, fg_color="transparent")
        row.pack(fill="x", padx=4, pady=4)
        ctk.CTkLabel(row, text=t("backup.retention") + ":", width=180, anchor="w").pack(side="left")
        self.backup_retention_entry = ctk.CTkEntry(row, width=80, placeholder_text="7")
        self.backup_retention_entry.pack(side="left", padx=4)

        # Tombol Simpan + Backup Sekarang
        btnrow = ctk.CTkFrame(wrap, fg_color="transparent")
        btnrow.pack(fill="x", padx=4, pady=12)
        widgets.permission_button(
            btnrow, text=t("backup.button.save"),
            permission="setting.backup",
            command=self._save_backup, width=180,
        ).pack(side="left", padx=2)
        widgets.permission_button(
            btnrow, text=t("backup.button.now"),
            permission="setting.backup",
            command=self._do_backup_now, width=180,
            fg_color="#10b981", hover_color="#059669",
        ).pack(side="left", padx=2)
        ctk.CTkButton(
            btnrow, text=t("backup.button.open_folder"),
            command=self._open_backup_folder, width=140,
            fg_color="transparent", border_width=1,
        ).pack(side="left", padx=2)

        # Status terakhir + jadwal berikutnya
        self.backup_last_label = ctk.CTkLabel(
            wrap, text="", anchor="w", justify="left",
        )
        self.backup_last_label.pack(anchor="w", padx=4, pady=(2, 0))
        self.backup_next_label = ctk.CTkLabel(
            wrap, text="", anchor="w", justify="left",
            text_color=("#6b7280", "#9ca3af"),
        )
        self.backup_next_label.pack(anchor="w", padx=4, pady=(0, 8))

        # Daftar backup tersimpan
        ctk.CTkLabel(
            wrap, text=t("backup.list.title"),
            font=ctk.CTkFont(size=13, weight="bold"),
        ).pack(anchor="w", padx=4, pady=(8, 2))
        self.backup_table = StyledTreeview(
            wrap,
            columns=[
                ("name", t("backup.col.name"), 280),
                ("size", t("backup.col.size"), 100),
                ("mtime", t("backup.col.mtime"), 160),
            ],
            height=8,
        )
        self.backup_table.pack(fill="x", padx=4, pady=2)

    def _update_backup_visibility(self) -> None:
        freq_key = self._freq_key(self.backup_freq_menu.get())
        if freq_key == SCHEDULE_WEEKLY:
            if not self.backup_weekday_row.winfo_ismapped():
                self.backup_weekday_row.pack(fill="x", padx=4, pady=4, before=self.backup_folder_entry.master)
        else:
            with contextlib.suppress(Exception):
                self.backup_weekday_row.pack_forget()

    def _load_backup(self) -> None:
        cfg = BackupConfig.from_settings()
        self.backup_freq_menu.set(self._freq_label(cfg.schedule))
        self.backup_time_entry.delete(0, "end")
        self.backup_time_entry.insert(0, f"{cfg.hour:02d}:{cfg.minute:02d}")
        self.backup_weekday_menu.set(self._weekday_label(cfg.weekday))
        self.backup_folder_entry.delete(0, "end")
        self.backup_folder_entry.insert(0, cfg.folder)
        self.backup_retention_entry.delete(0, "end")
        self.backup_retention_entry.insert(0, str(cfg.retention))
        self._update_backup_visibility()
        self._refresh_backup_status(cfg)
        self._refresh_backup_list(cfg)

    def _refresh_backup_status(self, cfg: BackupConfig | None = None) -> None:
        cfg = cfg or BackupConfig.from_settings()
        last_at = settings_repo.get_value("backup.last_run_at") or ""
        last_status = settings_repo.get_value("backup.last_run_status") or ""
        if last_at:
            status_label = (
                t("backup.status.success") if last_status == "success"
                else t("backup.status.failed")
            )
            self.backup_last_label.configure(
                text=f"{t('backup.last_run')}: {last_at} — {status_label}",
            )
        else:
            self.backup_last_label.configure(
                text=f"{t('backup.last_run')}: {t('backup.never')}",
            )
        nxt = compute_next_run(cfg)
        if nxt is None:
            self.backup_next_label.configure(text=f"{t('backup.next_run')}: —")
        else:
            self.backup_next_label.configure(
                text=f"{t('backup.next_run')}: {nxt.strftime('%Y-%m-%d %H:%M')}",
            )

    def _refresh_backup_list(self, cfg: BackupConfig | None = None) -> None:
        cfg = cfg or BackupConfig.from_settings()
        try:
            rows = backup_service.list_backups(cfg.folder or None)
        except Exception:  # noqa: BLE001
            rows = []
        display = [
            {
                "name": r["name"],
                "size": self._fmt_size(r["size_bytes"]),
                "mtime": r["mtime_str"],
            }
            for r in rows
        ]
        self.backup_table.set_rows(display)

    def _pick_backup_folder(self) -> None:
        path = filedialog.askdirectory(title=t("backup.folder"))
        if path:
            self.backup_folder_entry.delete(0, "end")
            self.backup_folder_entry.insert(0, path)

    def _open_backup_folder(self) -> None:
        cfg = BackupConfig.from_settings()
        folder = backup_service.resolve_backup_folder(cfg.folder or None)
        with contextlib.suppress(OSError):
            folder.mkdir(parents=True, exist_ok=True)
        _open_path(folder)

    def _save_backup(self) -> None:
        time_str = self.backup_time_entry.get().strip()
        try:
            hh_str, mm_str = time_str.split(":", 1)
            hh = int(hh_str)
            mm = int(mm_str)
            if not (0 <= hh <= 23 and 0 <= mm <= 59):
                raise ValueError
        except ValueError:
            widgets.show_toast(self, t("backup.invalid_time"), kind="warning")
            return
        try:
            retention = max(0, int(self.backup_retention_entry.get().strip() or "0"))
        except ValueError:
            retention = 7

        freq_key = self._freq_key(self.backup_freq_menu.get())
        weekday = self._weekday_idx(self.backup_weekday_menu.get())
        folder = self.backup_folder_entry.get().strip()

        settings_repo.set_many(
            {
                "backup.schedule": freq_key,
                "backup.time": f"{hh:02d}:{mm:02d}",
                "backup.weekday": str(weekday),
                "backup.folder": folder,
                "backup.retention": str(retention),
            }
        )
        with contextlib.suppress(Exception):
            get_scheduler().reload()
        widgets.show_toast(self, t("toast.saved"), kind="success")
        self._refresh_backup_status()

    def _do_backup_now(self) -> None:
        try:
            user = auth_service.current_user()
            uid = user.id if user else None
            result = get_scheduler().trigger_now(user_id=uid)
        except Exception as exc:  # noqa: BLE001
            widgets.report_exception(self, exc, "Gagal backup", use_modal=True)
            return
        if result.get("status") == "success":
            name = Path(result.get("path", "")).name or ""
            msg = (
                t("backup.toast.success", name=name)
                if name
                else t("backup.toast.success_noname")
            )
            widgets.show_toast(self, msg, kind="success", duration_ms=4500)
        else:
            widgets.show_toast(
                self, t("backup.toast.failed", error=result.get("error", "")),
                kind="error", duration_ms=6000,
            )
        self._refresh_backup_status()
        self._refresh_backup_list()

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

    # ------------------ Audit Log ------------------
    def _build_audit_log(self, parent) -> None:
        wrap = ctk.CTkFrame(parent, fg_color="transparent")
        wrap.pack(fill="both", expand=True, padx=10, pady=10)

        toolbar = ctk.CTkFrame(wrap, fg_color="transparent")
        toolbar.pack(fill="x", pady=(0, 8))

        self.audit_search = ctk.CTkEntry(
            toolbar, placeholder_text="Cari aksi / entitas / user…", width=260
        )
        self.audit_search.pack(side="left")
        self.audit_search.bind("<Return>", lambda _e: self._reload_audit_log())
        ctk.CTkButton(
            toolbar, text=t("common.refresh"), width=90,
            command=self._reload_audit_log,
        ).pack(side="left", padx=4)

        self.audit_count_label = ctk.CTkLabel(
            toolbar, text="", text_color=("#6b7280", "#9ca3af"),
        )
        self.audit_count_label.pack(side="right", padx=4)

        self.audit_table = StyledTreeview(
            wrap,
            columns=[
                ("created_at", "Waktu", 160),
                ("username", "User", 120),
                ("aksi", "Aksi", 100),
                ("entitas", "Entitas", 120),
                ("entitas_id", "ID", 60),
                ("detail", "Detail", 350),
            ],
            height=14,
        )
        self.audit_table.pack(fill="both", expand=True)

    def _reload_audit_log(self) -> None:
        with contextlib.suppress(Exception):
            q = self.audit_search.get().strip()
            rows = audit_log_repo.list_all(search=q)
            self.audit_table.set_rows(rows)
            total = audit_log_repo.count()
            self.audit_count_label.configure(
                text=f"Menampilkan {len(rows)} dari {total} entri"
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
        self.role_menu = ctk.CTkOptionMenu(self, values=["admin", "pustakawan", "siswa"])
        self.role_menu.set("pustakawan")
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


class PermissionsDialog(ctk.CTkToplevel):
    """Dialog edit hak akses granular per user (RBAC v0.4.3).

    Layout: header info + tombol preset (Admin / Pustakawan / Siswa / Kosong)
    + scrollable frame berisi checkbox per permission, di-grup per area.
    """

    def __init__(
        self,
        parent: SettingsView,
        *,
        user_id: int,
        username: str,
        role: str,
    ) -> None:
        super().__init__(parent)
        self.parent_view = parent
        self.user_id = user_id
        self.username = username
        self.role = role
        self.title(t("permissions.dialog.title", username=username))
        self.geometry("680x640")
        self.transient(parent)
        self.grab_set()

        from perpustakaan.services import permissions as permissions_service
        from perpustakaan.services.permissions_registry import (
            permissions_by_area,
        )

        self._svc = permissions_service
        self._by_area = permissions_by_area()

        # Header
        header = ctk.CTkFrame(self, fg_color="transparent")
        header.pack(fill="x", padx=18, pady=(14, 4))
        ctk.CTkLabel(
            header,
            text=t("permissions.dialog.title", username=username),
            font=ctk.CTkFont(size=15, weight="bold"),
            anchor="w",
        ).pack(side="left", fill="x", expand=True)
        ctk.CTkLabel(
            header,
            text=f"{t('permissions.dialog.col.role')}: {role}",
            text_color=("#6b7280", "#9ca3af"),
        ).pack(side="right")

        ctk.CTkLabel(
            self, text=t("permissions.dialog.help"),
            wraplength=620, justify="left",
            text_color=("#6b7280", "#9ca3af"),
        ).pack(fill="x", padx=18, pady=(2, 8))

        # Preset buttons
        preset_bar = ctk.CTkFrame(self, fg_color="transparent")
        preset_bar.pack(fill="x", padx=18, pady=(0, 6))
        ctk.CTkButton(
            preset_bar, text=t("permissions.dialog.preset.admin"),
            command=lambda: self._apply_preset("admin"),
        ).pack(side="left", padx=2)
        ctk.CTkButton(
            preset_bar, text=t("permissions.dialog.preset.pustakawan"),
            command=lambda: self._apply_preset("pustakawan"),
        ).pack(side="left", padx=2)
        ctk.CTkButton(
            preset_bar, text=t("permissions.dialog.preset.siswa"),
            command=lambda: self._apply_preset("siswa"),
        ).pack(side="left", padx=2)
        ctk.CTkButton(
            preset_bar, text=t("permissions.dialog.preset.none"),
            command=lambda: self._apply_preset(None),
            fg_color="transparent", border_width=1,
        ).pack(side="left", padx=2)

        # Scrollable checkbox tree
        self._vars: dict[str, ctk.BooleanVar] = {}
        scroll = ctk.CTkScrollableFrame(self)
        scroll.pack(fill="both", expand=True, padx=18, pady=(4, 8))

        current = set(self._svc.user_permissions(user_id))
        for area, perms in self._by_area.items():
            if not perms:
                continue
            area_label = t(f"permissions.area.{area}")
            section = ctk.CTkFrame(scroll, fg_color=("#f3f4f6", "#1f2937"))
            section.pack(fill="x", padx=2, pady=4)
            ctk.CTkLabel(
                section, text=area_label,
                font=ctk.CTkFont(size=13, weight="bold"),
                anchor="w",
            ).pack(fill="x", padx=10, pady=(6, 2))
            for p in perms:
                var = ctk.BooleanVar(value=(p.key in current))
                self._vars[p.key] = var
                cb = ctk.CTkCheckBox(section, text=p.label, variable=var)
                cb.pack(fill="x", padx=18, pady=2, anchor="w")

        # Footer
        footer = ctk.CTkFrame(self, fg_color="transparent")
        footer.pack(fill="x", padx=18, pady=(2, 14))
        ctk.CTkButton(
            footer, text=t("common.cancel"), command=self.destroy,
            fg_color="transparent", border_width=1,
        ).pack(side="right", padx=4)
        ctk.CTkButton(
            footer, text=t("common.save"), command=self._submit,
        ).pack(side="right", padx=4)

    def _apply_preset(self, preset: str | None) -> None:
        from perpustakaan.services.permissions_registry import (
            default_permissions_for_role,
        )

        target = (
            default_permissions_for_role(preset) if preset else frozenset()
        )
        for key, var in self._vars.items():
            var.set(key in target)

    def _submit(self) -> None:
        desired = [k for k, v in self._vars.items() if v.get()]
        try:
            granter = (
                auth_service.current_user().id
                if auth_service.current_user() is not None
                else None
            )
            granted, revoked = self._svc.set_user_permissions(
                self.user_id, desired, granted_by=granter,
            )
            if granted == 0 and revoked == 0:
                widgets.show_toast(
                    self.parent_view,
                    t("permissions.toast.no_change"),
                    kind="info",
                )
            else:
                widgets.show_toast(
                    self.parent_view,
                    t(
                        "permissions.toast.saved",
                        granted=granted, revoked=revoked,
                    ),
                    kind="success",
                )
            self.destroy()
        except Exception as exc:  # noqa: BLE001
            widgets.report_exception(self, exc, "Gagal simpan hak akses")


def _open_path(path) -> None:
    """Buka folder di file manager native (cross-platform)."""
    import logging as _logging
    try:
        target = str(path)
        if sys.platform.startswith("win"):
            os.startfile(target)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            os.system(f"open \"{target}\"")
        else:
            os.system(f"xdg-open \"{target}\"")
    except Exception as exc:  # noqa: BLE001
        _logging.getLogger("perpustakaan.gui").warning(
            "Gagal buka folder %s: %s", path, exc
        )
