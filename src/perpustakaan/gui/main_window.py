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
from perpustakaan.services.auth import SessionUser


class MainWindow(ctk.CTk):
    def __init__(self, user: SessionUser) -> None:
        super().__init__()
        widgets.configure_theme()
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
        self._build_sidebar()
        self._build_views()
        self.show("dashboard")

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
                btn = ctk.CTkButton(
                    self.sidebar,
                    text=f"  {icon}   {label}",
                    anchor="w",
                    height=36,
                    corner_radius=8,
                    fg_color="transparent",
                    text_color=("#1f2937", "#e5e7eb"),
                    hover_color=("#e5e7eb", "#1f2937"),
                    command=lambda k=key: self.show(k),
                )
                btn.pack(fill="x", padx=10, pady=2)
                self._buttons[key] = btn

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
                btn.configure(fg_color=("#dbeafe", "#1e3a8a"))
            else:
                btn.configure(fg_color="transparent")

    # ------------------------------------------------------------------
    def _do_logout(self) -> None:
        if widgets.confirm(self, t("toast.confirm_logout")):
            self.logout_requested = True
            self.destroy()
