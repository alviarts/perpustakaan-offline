"""Main window: shell dengan sidebar navigasi + content area."""
from __future__ import annotations

import contextlib

import customtkinter as ctk

from perpustakaan.config import APP_DISPLAY_NAME, APP_VERSION
from perpustakaan.gui import widgets
from perpustakaan.gui.views.anggota_view import AnggotaView
from perpustakaan.gui.views.buku_view import BukuView
from perpustakaan.gui.views.dashboard_view import DashboardView
from perpustakaan.gui.views.kunjungan_view import KunjunganView
from perpustakaan.gui.views.laporan_view import LaporanView
from perpustakaan.gui.views.peminjaman_view import PeminjamanView
from perpustakaan.gui.views.pengembalian_view import PengembalianView
from perpustakaan.gui.views.settings_view import SettingsView
from perpustakaan.i18n import t
from perpustakaan.models import settings as settings_repo
from perpustakaan.services.auth import SessionUser
from perpustakaan.services.backup_scheduler import get_scheduler

_THEME_KEYS = ("system", "light", "dark")


class MainWindow(ctk.CTk):
    def __init__(self, user: SessionUser) -> None:
        super().__init__()
        widgets.configure_theme()
        # Font detection harus setelah Tk root (super().__init__) tersedia.
        with contextlib.suppress(Exception):
            from perpustakaan.gui.fonts import detect_default_family

            detect_default_family(force=True)
        self.user = user
        self.logout_requested = False

        self.title(APP_DISPLAY_NAME)
        self.geometry("1280x780")
        self.minsize(1100, 680)

        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        # Sidebar
        self.sidebar = ctk.CTkFrame(self, width=240, corner_radius=0)
        self.sidebar.grid(row=0, column=0, sticky="nsw")
        self.sidebar.grid_propagate(False)

        # Content area
        self.content = ctk.CTkFrame(self, fg_color=("#f3f4f6", "#111827"))
        self.content.grid(row=0, column=1, sticky="nsew")
        self.content.grid_columnconfigure(0, weight=1)
        self.content.grid_rowconfigure(0, weight=1)

        self.views: dict[str, ctk.CTkFrame] = {}
        self._buttons: dict[str, ctk.CTkButton] = {}
        self._sidebar_indicators: dict[str, ctk.CTkFrame] = {}
        self._current_view_key: str = "dashboard"
        self._build_sidebar()
        self._build_views()
        self._build_theme_toggle()
        self._build_help_button()
        self._build_change_password_button()
        self.show("dashboard")

        # Hubungkan callback scheduler -> toast (marshal ke main thread).
        with contextlib.suppress(Exception):
            get_scheduler().set_callback(self._on_scheduled_backup)

        # Auto-launch tutorial Dashboard di first-run.
        with contextlib.suppress(Exception):
            self.after(800, self._maybe_autostart_tour)

        # First-login wizard wajib utk user lama yang belum set pertanyaan
        # keamanan (PR-C v0.4.4). Ditampilkan setelah window selesai render
        # supaya modal punya parent yang sudah visible.
        with contextlib.suppress(Exception):
            self.after(400, self._maybe_force_security_setup)

    # ------------------------------------------------------------------
    # Theme toggle (selalu visible di pojok kanan-atas, terlepas dari menu)
    # ------------------------------------------------------------------
    def _build_theme_toggle(self) -> None:
        cur_theme = (settings_repo.get_value("ui.theme") or "system").lower()
        if cur_theme not in _THEME_KEYS:
            cur_theme = "system"
        labels = [t(f"theme.{k}") for k in _THEME_KEYS]
        self._theme_var = ctk.StringVar(value=t(f"theme.{cur_theme}"))
        self._theme_btn = ctk.CTkSegmentedButton(
            self.content,
            values=labels,
            variable=self._theme_var,
            command=self._on_theme_changed,
            font=ctk.CTkFont(size=12, weight="bold"),
        )
        # Anchor ke pojok kanan-atas content area.
        self._theme_btn.place(relx=1.0, rely=0.0, x=-16, y=12, anchor="ne")
        # Re-raise tiap kali user berpindah view supaya tetap di atas.
        self._theme_btn.lift()

    # ------------------------------------------------------------------
    # Tombol "?" untuk replay tour menu yang sedang dibuka.
    # ------------------------------------------------------------------
    def _build_help_button(self) -> None:
        self._help_btn = ctk.CTkButton(
            self.content,
            text="?",
            width=32, height=32,
            corner_radius=16,
            fg_color=("#e0e7ff", "#312e81"),
            text_color=("#3730a3", "#c7d2fe"),
            hover_color=("#c7d2fe", "#4338ca"),
            font=ctk.CTkFont(size=14, weight="bold"),
            command=self._on_help_clicked,
        )
        # Posisi: kiri dari theme toggle. Theme toggle ~190px wide @ x=-16.
        self._help_btn.place(relx=1.0, rely=0.0, x=-220, y=14, anchor="ne")
        self._help_btn.lift()
        # Tooltip sederhana via Tk hint.
        with contextlib.suppress(Exception):
            self._help_btn.configure(cursor="hand2")

    def _on_help_clicked(self) -> None:
        from perpustakaan.gui.tour import start_menu_tour

        with contextlib.suppress(Exception):
            start_menu_tour(self, self._current_view_key)

    # ------------------------------------------------------------------
    # Tombol "Ganti Password" di header (PR-C v0.4.4) — selalu visible,
    # tidak protected karena siapapun yang sudah login boleh ganti password
    # akun-nya sendiri.
    # ------------------------------------------------------------------
    def _build_change_password_button(self) -> None:
        self._change_pw_btn = ctk.CTkButton(
            self.content,
            text=t("password.change.button"),
            width=140, height=32,
            corner_radius=16,
            fg_color=("#e0e7ff", "#312e81"),
            text_color=("#3730a3", "#c7d2fe"),
            hover_color=("#c7d2fe", "#4338ca"),
            font=ctk.CTkFont(size=12, weight="bold"),
            command=self._on_change_password_clicked,
        )
        # Posisi: kiri dari tombol "?" (yang ada di x=-220).
        # Kasih jarak 40px supaya tidak menempel.
        self._change_pw_btn.place(relx=1.0, rely=0.0, x=-260, y=14, anchor="ne")
        self._change_pw_btn.lift()
        with contextlib.suppress(Exception):
            self._change_pw_btn.configure(cursor="hand2")

    def _on_change_password_clicked(self) -> None:
        from perpustakaan.gui.password_dialogs import ChangePasswordDialog

        with contextlib.suppress(Exception):
            ChangePasswordDialog(self).wait_window()

    # ------------------------------------------------------------------
    # First-login wizard: paksa user lama isi pertanyaan keamanan
    # (PR-C v0.4.4). Idempotent — kalau sudah set, no-op.
    # ------------------------------------------------------------------
    def _maybe_force_security_setup(self) -> None:
        from perpustakaan.gui.password_dialogs import (
            FirstLoginSecuritySetupDialog,
        )
        from perpustakaan.services import auth as auth_service

        if not auth_service.needs_security_setup(self.user.id):
            return
        with contextlib.suppress(Exception):
            FirstLoginSecuritySetupDialog(self, user_id=self.user.id).wait_window()

    def _label_to_theme_key(self, label: str) -> str:
        for k in _THEME_KEYS:
            if t(f"theme.{k}") == label:
                return k
        return "system"

    def _on_theme_changed(self, label: str) -> None:
        key = self._label_to_theme_key(label)
        color = settings_repo.get_value("ui.color_theme", "blue") or "blue"
        with contextlib.suppress(Exception):
            widgets.configure_theme(key, color)
        with contextlib.suppress(Exception):
            settings_repo.set_value("ui.theme", key)
        with contextlib.suppress(Exception):
            widgets.show_toast(self, t("theme.applied"), kind="success", duration_ms=2000)

    # ------------------------------------------------------------------
    # Tour kontekstual per-menu
    # ------------------------------------------------------------------
    def _maybe_autostart_tour(self) -> None:
        """Auto-launch tour Dashboard saat pertama kali aplikasi dibuka."""
        from perpustakaan.gui.tour import maybe_autostart_menu_tour

        with contextlib.suppress(Exception):
            maybe_autostart_menu_tour(self, "dashboard")

    def start_tour(self, menu_key: str | None = None) -> None:
        """Mulai tour secara manual untuk ``menu_key`` (default: menu aktif)."""
        from perpustakaan.gui.tour import start_menu_tour

        target = menu_key or self._current_view_key or "dashboard"
        with contextlib.suppress(Exception):
            start_menu_tour(self, target)

    def _on_scheduled_backup(self, result: dict) -> None:
        """Dipanggil dari worker thread saat backup terjadwal selesai."""
        def _show() -> None:
            with contextlib.suppress(Exception):
                if result.get("status") == "success":
                    name = ""
                    path = result.get("path", "")
                    if path:
                        from pathlib import Path

                        name = Path(path).name
                    msg = (
                        t("backup.toast.success", name=name)
                        if name
                        else t("backup.toast.success_noname")
                    )
                    widgets.show_toast(self, msg, kind="success", duration_ms=4500)
                else:
                    widgets.show_toast(
                        self,
                        t("backup.toast.failed", error=result.get("error", "")),
                        kind="error",
                        duration_ms=6000,
                    )
        with contextlib.suppress(Exception):
            self.after(0, _show)

    # ------------------------------------------------------------------
    # Sidebar
    # ------------------------------------------------------------------
    def _build_sidebar(self) -> None:
        ctk.CTkLabel(
            self.sidebar,
            text=APP_DISPLAY_NAME,
            font=ctk.CTkFont(size=16, weight="bold"),
        ).pack(pady=(20, 0), padx=20, anchor="w")
        ctk.CTkLabel(
            self.sidebar,
            text=f"v{APP_VERSION}",
            font=ctk.CTkFont(size=10),
            text_color=("#6b7280", "#9ca3af"),
        ).pack(pady=(0, 12), padx=20, anchor="w")

        ctk.CTkLabel(
            self.sidebar, text=f"👤  {self.user.full_name}",
            font=ctk.CTkFont(size=11, weight="bold"),
        ).pack(padx=20, anchor="w")
        ctk.CTkLabel(
            self.sidebar, text=f"{self.user.role}",
            font=ctk.CTkFont(size=10),
            text_color=("#6b7280", "#9ca3af"),
        ).pack(padx=20, anchor="w", pady=(0, 16))

        sections: list[tuple[str, list[tuple[str, str, str]]]] = [
            ("", [("dashboard", t("menu.dashboard"), "📊")]),
            (
                t("menu.master"),
                [
                    ("anggota", t("menu.master.anggota"), "👥"),
                    ("buku", t("menu.master.buku"), "📚"),
                ],
            ),
            (
                t("menu.transaksi"),
                [
                    ("kunjungan", t("menu.transaksi.kunjungan"), "🚪"),
                    ("peminjaman", t("menu.transaksi.peminjaman"), "📤"),
                    ("pengembalian", t("menu.transaksi.pengembalian"), "📥"),
                ],
            ),
            ("", [("laporan", t("menu.laporan"), "📈")]),
            ("", [("setting", t("menu.setting"), "⚙️")]),
        ]
        for section_label, items in sections:
            if section_label:
                ctk.CTkLabel(
                    self.sidebar,
                    text=section_label.upper(),
                    font=ctk.CTkFont(size=10, weight="bold"),
                    text_color=("#9ca3af", "#6b7280"),
                ).pack(padx=20, pady=(12, 4), anchor="w")
            for key, label, icon in items:
                # Container per item supaya bisa kasih indicator bar di kiri.
                row = ctk.CTkFrame(self.sidebar, fg_color="transparent")
                row.pack(fill="x", padx=10, pady=2)
                indicator = ctk.CTkFrame(
                    row, width=3, height=24,
                    corner_radius=2,
                    fg_color="transparent",
                )
                indicator.pack(side="left", padx=(0, 6))
                indicator.pack_propagate(False)
                btn = ctk.CTkButton(
                    row,
                    text=f"  {icon}   {label}",
                    anchor="w",
                    height=36,
                    corner_radius=8,
                    fg_color="transparent",
                    text_color=("#1f2937", "#e5e7eb"),
                    hover_color=("#e5e7eb", "#1f2937"),
                    command=lambda k=key: self.show(k),
                )
                btn.pack(side="left", fill="x", expand=True)
                self._buttons[key] = btn
                self._sidebar_indicators[key] = indicator

        # Logout di bawah
        ctk.CTkButton(
            self.sidebar,
            text=f"  ↩   {t('menu.logout')}",
            anchor="w",
            height=36,
            corner_radius=8,
            fg_color="transparent",
            text_color="#ef4444",
            hover_color=("#fee2e2", "#7f1d1d"),
            command=self._do_logout,
        ).pack(fill="x", padx=10, pady=(20, 16), side="bottom")

    # ------------------------------------------------------------------
    # Views
    # ------------------------------------------------------------------
    def _build_views(self) -> None:
        view_factories = {
            "dashboard": DashboardView,
            "anggota": AnggotaView,
            "buku": BukuView,
            "kunjungan": KunjunganView,
            "peminjaman": PeminjamanView,
            "pengembalian": PengembalianView,
            "laporan": LaporanView,
            "setting": SettingsView,
        }
        for key, cls in view_factories.items():
            view = cls(self.content, app=self)
            view.grid(row=0, column=0, sticky="nsew")
            self.views[key] = view

    def show(self, key: str) -> None:
        view = self.views.get(key)
        if view is None:
            return
        view.tkraise()
        if hasattr(view, "on_show"):
            with contextlib.suppress(Exception):
                view.on_show()
        for k, btn in self._buttons.items():
            if k == key:
                btn.configure(fg_color=("#eef2ff", "#312e81"))
            else:
                btn.configure(fg_color="transparent")
        for k, ind in self._sidebar_indicators.items():
            ind.configure(fg_color="#6366f1" if k == key else "transparent")
        # Pastikan kontrol global tetap di atas setelah view di-raise.
        with contextlib.suppress(Exception):
            self._theme_btn.lift()
        with contextlib.suppress(Exception):
            self._help_btn.lift()

        self._current_view_key = key
        # Auto-launch contextual tour kalau user belum pernah selesaikan menu ini.
        from perpustakaan.gui.tour import maybe_autostart_menu_tour

        with contextlib.suppress(Exception):
            maybe_autostart_menu_tour(self, key)

    # ------------------------------------------------------------------
    def _do_logout(self) -> None:
        if widgets.confirm(self, t("toast.confirm_logout")):
            self.logout_requested = True
            self.destroy()

    def destroy(self) -> None:
        # Lepas callback supaya scheduler tidak panggil widget yang sudah hancur.
        with contextlib.suppress(Exception):
            get_scheduler().set_callback(None)
        super().destroy()
