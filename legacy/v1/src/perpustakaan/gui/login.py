"""Login window + bootstrap ke main window."""
from __future__ import annotations

import contextlib

import customtkinter as ctk

from perpustakaan.config import APP_DISPLAY_NAME, APP_VERSION
from perpustakaan.gui import widgets
from perpustakaan.i18n import t
from perpustakaan.services import auth


class LoginWindow(ctk.CTk):
    def __init__(self) -> None:
        super().__init__()
        widgets.configure_theme()
        self.title(t("login.title"))
        self.geometry("420x520")
        self.resizable(False, False)
        self.user: auth.SessionUser | None = None

        # Soft radial gradient bg (PR-V4a v0.6.0). Center kanan-atas dengan
        # warna indigo subtle supaya kesan "spotlight" tanpa terlalu ramai.
        # Aman: kalau Pillow gagal, login tetap render dengan bg default.
        self._bg_label: ctk.CTkLabel | None = None
        with contextlib.suppress(Exception):
            from perpustakaan.gui.effects import make_radial_gradient

            bg_image = make_radial_gradient(
                width=420, height=520,
                color_center=("#eef2ff", "#1e1b4b"),
                color_outer=("#ffffff", "#0b1120"),
                center_x_pct=80, center_y_pct=15,
                radius_pct=110,
            )
            self._bg_label = ctk.CTkLabel(self, text="", image=bg_image)
            self._bg_label.place(x=0, y=0, relwidth=1, relheight=1)

        container = ctk.CTkFrame(self, fg_color="transparent")
        container.pack(fill="both", expand=True, padx=40, pady=30)

        ctk.CTkLabel(
            container, text=APP_DISPLAY_NAME,
            font=ctk.CTkFont(size=22, weight="bold"),
        ).pack(pady=(10, 0))
        ctk.CTkLabel(
            container, text=t("app.tagline"),
            font=ctk.CTkFont(size=11),
            text_color=("#6b7280", "#9ca3af"),
        ).pack(pady=(0, 6))
        ctk.CTkLabel(
            container, text=f"v{APP_VERSION}",
            font=ctk.CTkFont(size=10),
            text_color=("#9ca3af", "#6b7280"),
        ).pack(pady=(0, 18))

        ctk.CTkLabel(container, text=t("login.username"), anchor="w").pack(
            fill="x", pady=(8, 2)
        )
        self.username = ctk.CTkEntry(container, placeholder_text="admin")
        self.username.pack(fill="x")

        ctk.CTkLabel(container, text=t("login.password"), anchor="w").pack(
            fill="x", pady=(12, 2)
        )
        self.password = ctk.CTkEntry(container, placeholder_text="••••", show="*")
        self.password.pack(fill="x")
        self.password.bind("<Return>", lambda _e: self._do_login())

        self.message = ctk.CTkLabel(container, text="", text_color="#ef4444")
        self.message.pack(pady=(8, 0))

        login_btn = ctk.CTkButton(
            container, text=t("login.button"), command=self._do_login, height=40
        )
        login_btn.pack(fill="x", pady=(20, 8))
        with contextlib.suppress(Exception):
            from perpustakaan.gui.animations import attach_press_feedback
            attach_press_feedback(login_btn)

        # Link tombol kecil utk "Lupa Password?" (PR-C v0.4.4) dan "Daftar".
        link_row = ctk.CTkFrame(container, fg_color="transparent")
        link_row.pack(fill="x", pady=(0, 4))
        ctk.CTkButton(
            link_row,
            text=t("login.forgot"),
            command=self._open_forgot,
            fg_color="transparent",
            text_color=("#1d4ed8", "#60a5fa"),
            hover=False,
            width=120,
        ).pack(side="left")
        ctk.CTkButton(
            link_row,
            text=t("login.register"),
            command=self._open_register,
            fg_color="transparent",
            text_color=("#1d4ed8", "#60a5fa"),
            hover=False,
            width=160,
        ).pack(side="right")

        ctk.CTkLabel(
            container,
            text=t("login.first_time"),
            font=ctk.CTkFont(size=10),
            text_color=("#6b7280", "#9ca3af"),
        ).pack(pady=(8, 0))

        self.username.focus_set()

    def _do_login(self) -> None:
        username = self.username.get().strip()
        password = self.password.get()
        if not username or not password:
            self.message.configure(text=t("toast.required", field="username/password"))
            return
        try:
            self.user = auth.login(username, password)
            self.destroy()
        except auth.AuthError:
            self.message.configure(text=t("login.invalid"))

    def _open_register(self) -> None:
        RegisterDialog(self)

    def _open_forgot(self) -> None:
        # Lazy import supaya login screen tidak depend ke modul yang
        # mungkin belum siap saat startup awal.
        from perpustakaan.gui.password_dialogs import ResetPasswordDialog

        ResetPasswordDialog(self)


class RegisterDialog(ctk.CTkToplevel):
    def __init__(self, parent: ctk.CTk) -> None:
        super().__init__(parent)
        self.title(t("login.register"))
        self.geometry("400x360")
        self.transient(parent)
        self.grab_set()
        from perpustakaan.gui.animations import apply_dialog_appear
        apply_dialog_appear(self)

        ctk.CTkLabel(
            self, text=t("login.register"),
            font=ctk.CTkFont(size=16, weight="bold"),
        ).pack(pady=(16, 8))

        self.full_name = widgets.LabeledEntry(self, "Full Name")
        self.full_name.pack(fill="x", padx=20, pady=4)
        self.username = widgets.LabeledEntry(self, t("login.username"))
        self.username.pack(fill="x", padx=20, pady=4)
        self.password = widgets.LabeledEntry(self, t("login.password"), show="*")
        self.password.pack(fill="x", padx=20, pady=4)
        self.password2 = widgets.LabeledEntry(self, "Konfirmasi Password", show="*")
        self.password2.pack(fill="x", padx=20, pady=4)

        self.message = ctk.CTkLabel(self, text="", text_color="#ef4444")
        self.message.pack(pady=(8, 0))

        btnbar = ctk.CTkFrame(self, fg_color="transparent")
        btnbar.pack(fill="x", padx=20, pady=14)
        ctk.CTkButton(btnbar, text=t("common.cancel"), command=self.destroy,
                      fg_color="transparent", border_width=1).pack(side="right", padx=4)
        ctk.CTkButton(btnbar, text=t("common.save"), command=self._submit).pack(
            side="right", padx=4
        )

    def _submit(self) -> None:
        try:
            if self.password.get() != self.password2.get():
                self.message.configure(text="Password tidak cocok / mismatch.")
                return
            auth.register(
                username=self.username.get(),
                password=self.password.get(),
                full_name=self.full_name.get(),
            )
            self.message.configure(
                text="Akun berhasil dibuat. Silakan login.",
                text_color="#10b981",
            )
            self.after(900, self.destroy)
        except auth.AuthError as e:
            mapping = {
                "username_taken": "Username sudah terpakai.",
                "password_too_short": "Password minimal 6 karakter.",
                "required_fields": "Semua field wajib diisi.",
            }
            self.message.configure(text=mapping.get(str(e), str(e)))


def run_login_then_main() -> int:
    """Show login, lalu (jika sukses) main window. Loop sampai user benar-benar keluar."""
    while True:
        login_win = LoginWindow()
        login_win.mainloop()
        if login_win.user is None:
            return 0  # user batal / tutup -> keluar
        from perpustakaan.gui.main_window import MainWindow

        main = MainWindow(login_win.user)
        main.mainloop()
        if not getattr(main, "logout_requested", False):
            return 0
        # logout -> kembali ke login screen
        auth.logout()
