"""Dialog terkait password: ganti, reset via security question, setup
pertanyaan keamanan (PR-C v0.4.4).

Modul ini dipakai dari tiga tempat:

* ``main_window`` — tombol "Ganti Password" di header → :class:`ChangePasswordDialog`,
  serta first-login wizard otomatis muncul kalau user lama belum mengisi
  pertanyaan keamanan (:class:`FirstLoginSecuritySetupDialog`).
* ``login`` — link "Lupa Password?" di layar login → :class:`ResetPasswordDialog`.
* ``settings_view`` — tombol "Ganti Password Saya" di Manajemen Akun (delegates
  ke :class:`ChangePasswordDialog`).

Semua dialog modal (``grab_set``) dan menggunakan widget bersama (toast,
LabeledEntry) dari :mod:`perpustakaan.gui.widgets`.
"""
from __future__ import annotations

import customtkinter as ctk

from perpustakaan.gui import widgets
from perpustakaan.gui.widgets import LabeledEntry
from perpustakaan.i18n import t
from perpustakaan.services import auth as auth_service


# ---------------------------------------------------------------------------
# Reusable security-question form (dropdown + custom + answer)
# ---------------------------------------------------------------------------
class SecurityQuestionForm(ctk.CTkFrame):
    """Sub-form: dropdown 5 pertanyaan default + opsi kustom + entry jawaban.

    Dipakai oleh first-login wizard, AccountDialog (nanti), dan
    ResetPasswordDialog step 2 (read-only mode untuk menampilkan pertanyaan).

    Mode:
    * ``editable=True`` (default) — user pilih pertanyaan + isi jawaban.
    * ``editable=False`` — pertanyaan diset via :meth:`set_question` dan
      tidak bisa diubah; user hanya isi jawaban (untuk reset flow).
    """

    _CUSTOM_KEY = "__custom__"

    def __init__(
        self,
        parent: ctk.CTkBaseClass,
        *,
        editable: bool = True,
        show_hint: bool = True,
    ) -> None:
        super().__init__(parent, fg_color="transparent")
        self._editable = editable
        self._questions = list(auth_service.DEFAULT_SECURITY_QUESTIONS)

        ctk.CTkLabel(
            self, text=t("security.question.label"), anchor="w",
        ).pack(fill="x", pady=(0, 2))

        if editable:
            values = [*self._questions, t("security.question.custom")]
            self._question_menu = ctk.CTkOptionMenu(
                self, values=values, command=self._on_question_changed,
            )
            self._question_menu.set(values[0])
            self._question_menu.pack(fill="x")

            self._custom_entry = ctk.CTkEntry(
                self,
                placeholder_text=t("security.question.custom_placeholder"),
            )
            # Disembunyikan dulu sampai user pilih opsi kustom.
        else:
            self._readonly_label = ctk.CTkLabel(
                self, text="—",
                anchor="w", justify="left",
                font=ctk.CTkFont(size=13, weight="bold"),
                wraplength=420,
            )
            self._readonly_label.pack(fill="x", pady=(0, 4))

        ctk.CTkLabel(
            self, text=t("security.answer.label"), anchor="w",
        ).pack(fill="x", pady=(10, 2))
        self._answer_entry = ctk.CTkEntry(self, show="•")
        self._answer_entry.pack(fill="x")

        if show_hint:
            ctk.CTkLabel(
                self, text=t("security.answer.hint"),
                anchor="w", justify="left",
                font=ctk.CTkFont(size=10),
                text_color=("#6b7280", "#9ca3af"),
                wraplength=420,
            ).pack(fill="x", pady=(4, 0))

    # ------------------------------------------------------------------
    # Editable-mode helpers
    # ------------------------------------------------------------------
    def _on_question_changed(self, value: str) -> None:
        if value == t("security.question.custom"):
            self._custom_entry.pack(fill="x", pady=(4, 0))
        else:
            self._custom_entry.pack_forget()
            self._custom_entry.delete(0, "end")

    def get_question(self) -> str:
        if not self._editable:
            return getattr(self, "_readonly_question", "")
        selected = self._question_menu.get()
        if selected == t("security.question.custom"):
            return self._custom_entry.get().strip()
        return selected.strip()

    def get_answer(self) -> str:
        return self._answer_entry.get()

    def set_question(self, question: str) -> None:
        """Set pertanyaan yang ditampilkan (read-only mode)."""
        if self._editable:
            return
        self._readonly_question = question
        self._readonly_label.configure(text=question)

    def focus_answer(self) -> None:
        self._answer_entry.focus_set()


# ---------------------------------------------------------------------------
# Ganti password (dipanggil dari header window + Setting > Akun)
# ---------------------------------------------------------------------------
class ChangePasswordDialog(ctk.CTkToplevel):
    """Modal: password lama → password baru → konfirmasi."""

    def __init__(self, parent: ctk.CTkBaseClass) -> None:
        super().__init__(parent)
        self.title(t("password.change.title"))
        self.geometry("420x340")
        self.transient(parent)
        self.grab_set()
        self.parent_widget = parent

        ctk.CTkLabel(
            self, text=t("password.change.title"),
            font=ctk.CTkFont(size=16, weight="bold"),
        ).pack(pady=(16, 8))

        self.old = LabeledEntry(self, t("password.change.old"), show="*")
        self.old.pack(fill="x", padx=24, pady=4)
        self.new1 = LabeledEntry(self, t("password.change.new"), show="*")
        self.new1.pack(fill="x", padx=24, pady=4)
        self.new2 = LabeledEntry(self, t("password.change.confirm"), show="*")
        self.new2.pack(fill="x", padx=24, pady=4)

        self.message = ctk.CTkLabel(self, text="", text_color="#ef4444")
        self.message.pack(pady=(8, 0))

        btnbar = ctk.CTkFrame(self, fg_color="transparent")
        btnbar.pack(fill="x", padx=24, pady=14)
        ctk.CTkButton(
            btnbar, text=t("common.cancel"), command=self.destroy,
            fg_color="transparent", border_width=1,
        ).pack(side="right", padx=4)
        ctk.CTkButton(
            btnbar, text=t("common.save"), command=self._submit,
        ).pack(side="right", padx=4)

        self.old.entry.bind("<Return>", lambda _e: self.new1.entry.focus_set())
        self.new1.entry.bind("<Return>", lambda _e: self.new2.entry.focus_set())
        self.new2.entry.bind("<Return>", lambda _e: self._submit())
        self.old.entry.focus_set()

    def _submit(self) -> None:
        if self.new1.get() != self.new2.get():
            self.message.configure(text=t("password.change.mismatch"))
            return
        user = auth_service.current_user()
        if user is None:
            self.message.configure(text=t("login.invalid"))
            return
        try:
            auth_service.change_password(user.id, self.old.get(), self.new1.get())
        except auth_service.AuthError as exc:
            mapping = {
                "invalid_credentials": t("password.change.invalid_old"),
                "password_too_short": t("password.change.too_short"),
            }
            self.message.configure(text=mapping.get(str(exc), str(exc)))
            return

        widgets.show_toast(
            self.parent_widget, t("password.change.success"),
            kind="success", duration_ms=3500,
        )
        self.destroy()


# ---------------------------------------------------------------------------
# First-login wizard: paksa user lama isi pertanyaan keamanan
# ---------------------------------------------------------------------------
class FirstLoginSecuritySetupDialog(ctk.CTkToplevel):
    """Modal yang dipaksakan setelah login pertama (untuk user lama).

    Tidak bisa di-close lewat tombol X — user harus isi pertanyaan +
    jawaban valid sebelum modal dismiss. Dipanggil dari ``MainWindow``
    saat :func:`perpustakaan.services.auth.needs_security_setup` true.
    """

    def __init__(self, parent: ctk.CTkBaseClass, *, user_id: int) -> None:
        super().__init__(parent)
        self.user_id = user_id
        self.title(t("security.firstlogin.title"))
        self.geometry("520x440")
        self.transient(parent)
        self.grab_set()
        # Disable close button (user tidak bisa skip).
        self.protocol("WM_DELETE_WINDOW", lambda: None)
        self.resizable(False, False)

        ctk.CTkLabel(
            self, text=t("security.firstlogin.title"),
            font=ctk.CTkFont(size=16, weight="bold"),
        ).pack(pady=(18, 4))
        ctk.CTkLabel(
            self, text=t("security.firstlogin.help"),
            wraplength=460, justify="left",
            text_color=("#374151", "#d1d5db"),
        ).pack(padx=24, pady=(0, 14))

        self.form = SecurityQuestionForm(self, editable=True, show_hint=True)
        self.form.pack(fill="x", padx=24, pady=4)

        self.message = ctk.CTkLabel(self, text="", text_color="#ef4444")
        self.message.pack(pady=(6, 0))

        ctk.CTkButton(
            self, text=t("common.save"), height=38,
            command=self._submit,
        ).pack(fill="x", padx=24, pady=(14, 18))

    def _submit(self) -> None:
        question = self.form.get_question()
        answer = self.form.get_answer()
        try:
            auth_service.set_security_question(self.user_id, question, answer)
        except auth_service.AuthError as exc:
            mapping = {
                "question_required": t("security.error.question_required"),
                "answer_too_short": t("security.error.answer_too_short"),
            }
            self.message.configure(text=mapping.get(str(exc), str(exc)))
            return
        widgets.show_toast(
            self.master, t("security.toast.saved"),
            kind="success", duration_ms=3000,
        )
        self.destroy()


# ---------------------------------------------------------------------------
# Reset password via security question (dipanggil dari login screen)
# ---------------------------------------------------------------------------
class ResetPasswordDialog(ctk.CTkToplevel):
    """Two-step modal:

    1. Username → tampilkan pertanyaan keamanan
    2. Jawaban + password baru + konfirmasi → submit
    """

    def __init__(self, parent: ctk.CTkBaseClass) -> None:
        super().__init__(parent)
        self.parent_widget = parent
        self.title(t("password.reset.title"))
        self.geometry("460x460")
        self.transient(parent)
        self.grab_set()
        self.resizable(False, False)

        ctk.CTkLabel(
            self, text=t("password.reset.title"),
            font=ctk.CTkFont(size=16, weight="bold"),
        ).pack(pady=(16, 4))

        self._container = ctk.CTkFrame(self, fg_color="transparent")
        self._container.pack(fill="both", expand=True, padx=24, pady=8)

        self._username: str | None = None
        self._question: str | None = None
        self._build_step1()

    # ------------------------------------------------------------------
    def _clear_step(self) -> None:
        for child in self._container.winfo_children():
            child.destroy()

    def _build_step1(self) -> None:
        self._clear_step()
        ctk.CTkLabel(
            self._container, text=t("password.reset.step1.help"),
            wraplength=400, justify="left",
            text_color=("#374151", "#d1d5db"),
        ).pack(anchor="w", pady=(0, 10))

        self.username_entry = LabeledEntry(self._container, t("login.username"))
        self.username_entry.pack(fill="x", pady=4)
        self.username_entry.entry.bind("<Return>", lambda _e: self._step1_submit())

        self.message1 = ctk.CTkLabel(self._container, text="", text_color="#ef4444")
        self.message1.pack(pady=(8, 0))

        btnbar = ctk.CTkFrame(self._container, fg_color="transparent")
        btnbar.pack(fill="x", pady=(14, 0))
        ctk.CTkButton(
            btnbar, text=t("common.cancel"), command=self.destroy,
            fg_color="transparent", border_width=1,
        ).pack(side="right", padx=4)
        ctk.CTkButton(
            btnbar, text=t("password.reset.continue"),
            command=self._step1_submit,
        ).pack(side="right", padx=4)

        self.username_entry.entry.focus_set()

    def _step1_submit(self) -> None:
        username = self.username_entry.get().strip()
        if not username:
            self.message1.configure(text=t("toast.required", field="username"))
            return
        question = auth_service.get_security_question(username)
        if not question:
            # Sengaja kasih pesan yang bedakan "tidak ada question" supaya user
            # tahu harus hubungi admin (vs. password salah). Pesan ini tidak
            # leak existence user karena selalu balas hal yang sama untuk
            # user-tidak-ada DAN user-tanpa-question.
            self.message1.configure(text=t("password.reset.no_question"))
            return
        self._username = username
        self._question = question
        self._build_step2()

    # ------------------------------------------------------------------
    def _build_step2(self) -> None:
        self._clear_step()
        ctk.CTkLabel(
            self._container, text=t("password.reset.step2.help"),
            wraplength=400, justify="left",
            text_color=("#374151", "#d1d5db"),
        ).pack(anchor="w", pady=(0, 10))

        self.form = SecurityQuestionForm(self._container, editable=False, show_hint=True)
        self.form.set_question(self._question or "")
        self.form.pack(fill="x", pady=4)

        ctk.CTkLabel(
            self._container, text=t("password.change.new"), anchor="w",
        ).pack(fill="x", pady=(12, 2))
        self.new1 = ctk.CTkEntry(self._container, show="*")
        self.new1.pack(fill="x")

        ctk.CTkLabel(
            self._container, text=t("password.change.confirm"), anchor="w",
        ).pack(fill="x", pady=(8, 2))
        self.new2 = ctk.CTkEntry(self._container, show="*")
        self.new2.pack(fill="x")
        self.new2.bind("<Return>", lambda _e: self._step2_submit())

        self.message2 = ctk.CTkLabel(self._container, text="", text_color="#ef4444")
        self.message2.pack(pady=(8, 0))

        btnbar = ctk.CTkFrame(self._container, fg_color="transparent")
        btnbar.pack(fill="x", pady=(14, 0))
        ctk.CTkButton(
            btnbar, text=t("password.reset.back"),
            command=self._build_step1,
            fg_color="transparent", border_width=1,
        ).pack(side="left", padx=4)
        ctk.CTkButton(
            btnbar, text=t("password.reset.submit"),
            command=self._step2_submit,
        ).pack(side="right", padx=4)

        self.form.focus_answer()

    def _step2_submit(self) -> None:
        if self.new1.get() != self.new2.get():
            self.message2.configure(text=t("password.change.mismatch"))
            return
        try:
            auth_service.reset_password_via_security_question(
                self._username or "",
                self.form.get_answer(),
                self.new1.get(),
            )
        except auth_service.AuthError as exc:
            mapping = {
                "invalid_credentials": t("password.reset.invalid"),
                "password_too_short": t("password.change.too_short"),
            }
            self.message2.configure(text=mapping.get(str(exc), str(exc)))
            return
        widgets.show_toast(
            self.parent_widget, t("password.reset.success"),
            kind="success", duration_ms=4000,
        )
        self.destroy()
