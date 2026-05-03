"""Widget reusable + helper untuk view CustomTkinter.

Termasuk wrapper :class:`StyledTreeview` (ttk.Treeview yang nyaman dipakai untuk
list data dengan scrollbar) — CustomTkinter belum punya tabel data nativ.
"""
from __future__ import annotations

import contextlib
import logging
import tkinter as tk
from collections.abc import Callable, Iterable
from tkinter import ttk
from typing import Any

import customtkinter as ctk

from perpustakaan.i18n import t

_log = logging.getLogger("perpustakaan.gui")


# ---------------------------------------------------------------------------
# Theme defaults
# ---------------------------------------------------------------------------
def configure_theme(theme: str = "system", color: str = "blue") -> None:
    if theme not in {"system", "light", "dark"}:
        theme = "system"
    if color not in {"blue", "green", "dark-blue"}:
        color = "blue"
    ctk.set_appearance_mode(theme)
    ctk.set_default_color_theme(color)


# ---------------------------------------------------------------------------
# Styled Treeview
# ---------------------------------------------------------------------------
class StyledTreeview(ctk.CTkFrame):
    """Treeview dengan scrollbar vertikal & horizontal."""

    def __init__(
        self,
        parent: Any,
        columns: list[tuple[str, str, int]],
        *,
        on_double_click: Callable[[dict], None] | None = None,
        height: int = 18,
    ) -> None:
        super().__init__(parent, fg_color="transparent")

        self._columns = columns
        self._key_field = columns[0][0] if columns else "id"
        self._on_double = on_double_click

        # Style untuk dukung dark mode
        style = ttk.Style()
        with contextlib.suppress(Exception):
            style.theme_use("clam")
        bg = "#212121" if ctk.get_appearance_mode().lower() == "dark" else "#ffffff"
        fg = "#e5e5e5" if ctk.get_appearance_mode().lower() == "dark" else "#1f2937"
        sel = "#1d4ed8"
        style.configure(
            "Perpus.Treeview",
            background=bg,
            foreground=fg,
            fieldbackground=bg,
            rowheight=26,
            bordercolor=bg,
            borderwidth=0,
        )
        style.map("Perpus.Treeview", background=[("selected", sel)])
        style.configure(
            "Perpus.Treeview.Heading",
            background="#1f2937",
            foreground="#f9fafb",
            font=("Segoe UI", 10, "bold"),
            relief="flat",
        )

        col_ids = [c[0] for c in columns]
        self.tree = ttk.Treeview(
            self,
            columns=col_ids,
            show="headings",
            style="Perpus.Treeview",
            height=height,
        )
        for col_id, label, width in columns:
            self.tree.heading(col_id, text=label)
            anchor = "e" if col_id in {"jumlah", "denda", "harga", "nominal"} else "w"
            self.tree.column(col_id, width=width, anchor=anchor)

        vsb = ttk.Scrollbar(self, orient="vertical", command=self.tree.yview)
        hsb = ttk.Scrollbar(self, orient="horizontal", command=self.tree.xview)
        self.tree.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)

        self.tree.grid(row=0, column=0, sticky="nsew")
        vsb.grid(row=0, column=1, sticky="ns")
        hsb.grid(row=1, column=0, sticky="ew")
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=1)

        self._items_by_iid: dict[str, dict] = {}
        self.tree.bind("<Double-1>", self._handle_double)

    def set_rows(self, rows: Iterable[dict]) -> None:
        self.tree.delete(*self.tree.get_children())
        self._items_by_iid.clear()
        for r in rows:
            iid = str(r.get(self._key_field, r.get("id", id(r))))
            if iid in self._items_by_iid:
                fallback = r.get("id")
                iid = str(fallback) if fallback is not None else f"{iid}_{id(r)}"
            values = [r.get(col_id, "") for col_id, _, _ in self._columns]
            self.tree.insert("", "end", iid=iid, values=values)
            self._items_by_iid[iid] = r

    def selected(self) -> dict | None:
        sel = self.tree.selection()
        if not sel:
            return None
        return self._items_by_iid.get(sel[0])

    def selected_many(self) -> list[dict]:
        return [self._items_by_iid[i] for i in self.tree.selection() if i in self._items_by_iid]

    def _handle_double(self, _event) -> None:
        if self._on_double is None:
            return
        row = self.selected()
        if row is not None:
            self._on_double(row)


# ---------------------------------------------------------------------------
# Form helpers
# ---------------------------------------------------------------------------
class LabeledEntry(ctk.CTkFrame):
    def __init__(
        self,
        parent: Any,
        label: str,
        *,
        placeholder: str = "",
        show: str | None = None,
        width: int = 220,
    ) -> None:
        super().__init__(parent, fg_color="transparent")
        self._label = ctk.CTkLabel(self, text=label, anchor="w", width=140)
        self._label.grid(row=0, column=0, sticky="w", padx=(0, 8), pady=2)
        self.entry = ctk.CTkEntry(self, width=width, placeholder_text=placeholder, show=show)
        self.entry.grid(row=0, column=1, sticky="we", pady=2)
        self.grid_columnconfigure(1, weight=1)

    def set(self, value: object) -> None:
        self.entry.delete(0, "end")
        if value is not None:
            self.entry.insert(0, str(value))

    def get(self) -> str:
        return self.entry.get().strip()


class StatCard(ctk.CTkFrame):
    """Kartu statistik utk dashboard, dengan ikon bulat berwarna + hover lift."""

    _NORMAL_FG: tuple[str, str] = ("white", "#1f2937")
    _HOVER_FG: tuple[str, str] = ("#f9fafb", "#283344")
    _NORMAL_BORDER: tuple[str, str] = ("#e5e7eb", "#374151")
    _HOVER_BORDER: tuple[str, str] = ("#c7d2fe", "#4338ca")

    def __init__(
        self,
        parent: Any,
        title: str,
        value: str = "0",
        *,
        color: str = "#3b82f6",
        icon: str = "•",
        lucide: str | None = None,
    ) -> None:
        """Stat card.

        Args:
            title: label di atas angka.
            value: angka / teks utama.
            color: warna brand utk icon bubble + value text.
            icon: emoji / glyph fallback (dipakai kalau ``lucide`` ``None``
                atau gagal load).
            lucide: nama Lucide icon (mis. ``"users"``) — kalau di-set, icon
                bubble pakai gambar Lucide putih di atas warna ``color``.
        """
        super().__init__(
            parent,
            corner_radius=14,
            fg_color=self._NORMAL_FG,
            border_width=1,
            border_color=self._NORMAL_BORDER,
        )
        self._color = color

        # Header row: icon bubble + title
        header = ctk.CTkFrame(self, fg_color="transparent")
        header.pack(fill="x", padx=14, pady=(14, 0))
        try:
            from perpustakaan.gui.fonts import (
                get_font as _get_font,
            )
            from perpustakaan.gui.fonts import (
                small_font as _small_font,
            )
            from perpustakaan.gui.fonts import (
                stat_value_font as _stat_value_font,
            )
            _icon_font = _get_font(14, weight="bold")
            _title_font = _small_font()
            _value_font = _stat_value_font()
        except Exception:  # noqa: BLE001
            _icon_font = ctk.CTkFont(size=14, weight="bold")
            _title_font = ctk.CTkFont(size=11, weight="bold")
            _value_font = ctk.CTkFont(size=26, weight="bold")

        # Icon bubble: try Lucide first, fallback ke emoji.
        bubble_image = None
        if lucide:
            try:
                from perpustakaan.gui.icons import lucide_icon as _lucide

                bubble_image = _lucide(lucide, size=18, color="#ffffff")
            except Exception:  # noqa: BLE001
                bubble_image = None
        self._icon_bubble = ctk.CTkLabel(
            header,
            text="" if bubble_image is not None else icon,
            image=bubble_image,
            width=32, height=32,
            corner_radius=16,
            fg_color=color,
            text_color="white",
            font=_icon_font,
        )
        self._icon_bubble.pack(side="left", padx=(0, 10))
        self._title_lbl = ctk.CTkLabel(
            header,
            text=title,
            font=_title_font,
            text_color=("#4b5563", "#d1d5db"),
            anchor="w",
        )
        self._title_lbl.pack(side="left", fill="x", expand=True)

        self._value_lbl = ctk.CTkLabel(
            self,
            text=value,
            font=_value_font,
            text_color=color,
            anchor="w",
        )
        self._value_lbl.pack(fill="x", padx=14, pady=(6, 14))

        # Hover lift: subtle bg/border change ketika kursor masuk.
        self.bind("<Enter>", self._on_enter, add=True)
        self.bind("<Leave>", self._on_leave, add=True)
        for child in (header, self._title_lbl, self._value_lbl, self._icon_bubble):
            child.bind("<Enter>", self._on_enter, add=True)
            child.bind("<Leave>", self._on_leave, add=True)

    def set_value(self, value: str) -> None:
        self._value_lbl.configure(text=value)

    def _on_enter(self, _event: Any = None) -> None:
        # Smooth color cross-fade saat hover (PR-V4a v0.6.0). Lebih halus
        # dibanding instant configure karena interpolasi RGB lewat
        # animations.animate_color.
        try:
            from perpustakaan.gui.animations import animate_color

            animate_color(
                self, attr="fg_color",
                color_from=self._NORMAL_FG, color_to=self._HOVER_FG,
                duration_ms=140,
            )
            animate_color(
                self, attr="border_color",
                color_from=self._NORMAL_BORDER, color_to=self._HOVER_BORDER,
                duration_ms=140,
            )
        except Exception:  # noqa: BLE001 — fallback tanpa animasi
            with contextlib.suppress(Exception):
                self.configure(
                    fg_color=self._HOVER_FG, border_color=self._HOVER_BORDER,
                )

    def _on_leave(self, _event: Any = None) -> None:
        try:
            from perpustakaan.gui.animations import animate_color

            animate_color(
                self, attr="fg_color",
                color_from=self._HOVER_FG, color_to=self._NORMAL_FG,
                duration_ms=140,
            )
            animate_color(
                self, attr="border_color",
                color_from=self._HOVER_BORDER, color_to=self._NORMAL_BORDER,
                duration_ms=140,
            )
        except Exception:  # noqa: BLE001 — fallback tanpa animasi
            with contextlib.suppress(Exception):
                self.configure(
                    fg_color=self._NORMAL_FG, border_color=self._NORMAL_BORDER,
                )


# ---------------------------------------------------------------------------
# Toast (non-blocking, auto-dismiss)
# ---------------------------------------------------------------------------
_TOAST_COLORS = {
    "info":    {"bg": ("#dbeafe", "#1e3a8a"), "fg": ("#1e3a8a", "#dbeafe"), "border": "#2563eb"},
    "success": {"bg": ("#dcfce7", "#14532d"), "fg": ("#14532d", "#dcfce7"), "border": "#16a34a"},
    "warning": {"bg": ("#fef3c7", "#78350f"), "fg": ("#78350f", "#fef3c7"), "border": "#d97706"},
    "error":   {"bg": ("#fee2e2", "#7f1d1d"), "fg": ("#7f1d1d", "#fee2e2"), "border": "#dc2626"},
}


def show_toast(
    parent: Any,
    message: str,
    *,
    kind: str = "info",
    duration_ms: int = 3000,
) -> None:
    """Tampilkan toast notification non-blocking di pojok kanan-bawah window.

    Args:
        parent: widget atau window induk.
        message: teks pesan (max ~200 karakter).
        kind: ``"info"`` / ``"success"`` / ``"warning"`` / ``"error"``.
        duration_ms: durasi tampil dalam milidetik sebelum auto-dismiss.
    """
    palette = _TOAST_COLORS.get(kind, _TOAST_COLORS["info"])
    try:
        # Cari toplevel-nya parent (kasus parent berupa frame nested)
        top = parent.winfo_toplevel()
    except Exception:  # noqa: BLE001 - widget belum di-realize
        _log.warning("show_toast: parent tidak punya toplevel, fallback log: %s", message)
        return

    toast = ctk.CTkFrame(
        top,
        fg_color=palette["bg"],
        border_color=palette["border"],
        border_width=2,
        corner_radius=8,
    )

    # Optional: prepend animated icon untuk kind=success (PR-V4b v0.6.1)
    inner = ctk.CTkFrame(toast, fg_color="transparent")
    inner.pack(padx=14, pady=10)
    if kind == "success":
        with contextlib.suppress(Exception):
            from perpustakaan.gui.animation_player import AnimationPlayer

            anim = AnimationPlayer(
                inner, name="success_check", size=(28, 28),
                fps=24, loop=False,
            )
            anim.pack(side="left", padx=(0, 10))
            anim.start()

    label = ctk.CTkLabel(
        inner,
        text=message,
        text_color=palette["fg"],
        font=ctk.CTkFont(size=13, weight="bold"),
        anchor="w",
        justify="left",
        wraplength=320,
    )
    label.pack(side="left")

    # Animasi slide-in dari kanan + dismiss halus dengan import lokal supaya
    # tidak ada cycle import (animations butuh widgets-free saja).
    from perpustakaan.gui.animations import slide_in_x

    def _place_and_animate() -> None:
        try:
            top.update_idletasks()
            tw = max(toast.winfo_reqwidth(), 200)
            th = max(toast.winfo_reqheight(), 40)
            tw_total = max(top.winfo_width(), 1)
            th_total = max(top.winfo_height(), 1)
            target_x = max(tw_total - tw - 16, 16)
            start_x = tw_total + 8  # mulai sedikit di luar layar kanan
            target_y = max(th_total - th - 16, 16)
            toast.place(x=start_x, y=target_y)
            slide_in_x(
                toast,
                from_x=start_x,
                to_x=target_x,
                y=target_y,
                duration_ms=220,
                steps=12,
            )
        except Exception:  # noqa: BLE001
            toast.place(relx=1.0, rely=1.0, x=-16, y=-16, anchor="se")

    def _safe_destroy() -> None:
        with contextlib.suppress(Exception):
            toast.destroy()

    def _dismiss() -> None:
        # Slide keluar lalu destroy.
        try:
            cur_x = toast.winfo_x()
            cur_y = toast.winfo_y()
            tw_total = max(top.winfo_width(), cur_x + 100)
            slide_in_x(
                toast,
                from_x=cur_x,
                to_x=tw_total + 8,
                y=cur_y,
                duration_ms=180,
                steps=8,
                on_done=_safe_destroy,
            )
        except Exception:  # noqa: BLE001
            _safe_destroy()

    _place_and_animate()
    top.after(max(duration_ms, 500), _dismiss)


# ---------------------------------------------------------------------------
# Modal dialog (info / warn / error / confirm)
# ---------------------------------------------------------------------------
def info(parent: Any, message: str, title: str | None = None) -> None:
    from tkinter import messagebox

    messagebox.showinfo(title or t("common.info"), message, parent=parent)


def warn(parent: Any, message: str, title: str | None = None) -> None:
    from tkinter import messagebox

    messagebox.showwarning(title or t("common.warning"), message, parent=parent)


def error(parent: Any, message: str, title: str | None = None) -> None:
    from tkinter import messagebox

    messagebox.showerror(title or t("common.error"), message, parent=parent)


def confirm(parent: Any, message: str, title: str | None = None) -> bool:
    from tkinter import messagebox

    return bool(
        messagebox.askyesno(title or t("common.confirm"), message, parent=parent)
    )


# ---------------------------------------------------------------------------
# Exception reporter — log + show user-friendly toast / modal
# ---------------------------------------------------------------------------
# Exception types yang biasanya berarti "user input error" — pesan singkat
# saja sudah cukup, tidak perlu modal merah dan tidak perlu link ke log.
_USER_INPUT_EXC = (ValueError, TypeError, KeyError)


def report_exception(
    parent: Any,
    exc: BaseException,
    context: str = "",
    *,
    use_modal: bool = False,
) -> None:
    """Log full exception ke ``app.log`` lalu tampilkan toast/modal user-friendly.

    Args:
        parent: widget induk untuk toast/modal.
        exc: exception yang ditangkap.
        context: deskripsi singkat operasi (mis "simpan anggota") — akan
            ditampilkan ke user sebagai prefix supaya jelas operasi mana.
        use_modal: kalau True, pakai messagebox modal (untuk error kritis
            yang user wajib acknowledge). Default False = toast.
    """
    _log.exception("[%s] %s", context or "operation failed", exc)

    if isinstance(exc, _USER_INPUT_EXC):
        msg = str(exc) or t("common.error")
        kind = "warning"
    else:
        # Exception tidak terduga — kasih hint ke log
        msg = (
            f"{context or 'Terjadi kesalahan'}: {exc}\n"
            f"Detail tersimpan di app.log."
        )
        kind = "error"

    if use_modal:
        if kind == "error":
            error(parent, msg)
        else:
            warn(parent, msg)
    else:
        show_toast(parent, msg, kind=kind, duration_ms=4500)


# ---------------------------------------------------------------------------
# HeadingBar
# ---------------------------------------------------------------------------
class HeadingBar(ctk.CTkFrame):
    """Heading konsisten utk tiap view: judul besar + tombol "?" inline.

    Layout::

        ┌────────────────────────────────────────────┐
        │  Data Anggota   [?]              (extras…) │
        └────────────────────────────────────────────┘

    - Klik tombol "?" memanggil ``on_help`` (mis. replay tour menu ini).
    - ``extras`` adalah CTkFrame transparan di kanan untuk widget tambahan
      view-specific (mis. tombol Refresh di Dashboard).
    """

    def __init__(
        self,
        parent: Any,
        *,
        text: str,
        menu_key: str | None = None,
        main_window: Any = None,
        on_help: Callable[[], None] | None = None,
    ) -> None:
        """Heading konsisten dengan tombol "?" inline.

        Salah satu mode harus dipilih:
            - ``menu_key`` + ``main_window``: HeadingBar otomatis memanggil
              ``start_menu_tour(main_window, menu_key)`` saat tombol "?" diklik.
            - ``on_help``: callable kustom dipanggil saat klik "?".
            - keduanya kosong: tombol "?" tidak ditampilkan.
        """
        super().__init__(parent, fg_color="transparent")
        try:
            from perpustakaan.gui.fonts import heading_font
            font = heading_font()
        except Exception:  # noqa: BLE001
            font = ctk.CTkFont(size=22, weight="bold")
        self._title = ctk.CTkLabel(self, text=text, font=font, anchor="w")
        self._title.pack(side="left")

        # Resolve callback
        if on_help is None and menu_key and main_window is not None:
            def _replay() -> None:
                try:
                    from perpustakaan.gui.tour import start_menu_tour

                    start_menu_tour(main_window, menu_key)
                except Exception:  # noqa: BLE001
                    pass
            on_help = _replay

        if on_help is not None:
            self._help_btn = ctk.CTkButton(
                self,
                text="?",
                width=26, height=26,
                corner_radius=13,
                fg_color=("#e0e7ff", "#312e81"),
                text_color=("#3730a3", "#c7d2fe"),
                hover_color=("#c7d2fe", "#4338ca"),
                font=ctk.CTkFont(size=12, weight="bold"),
                command=on_help,
            )
            self._help_btn.pack(side="left", padx=(10, 0), pady=(2, 0))
            with contextlib.suppress(Exception):
                self._help_btn.configure(cursor="hand2")
        # Frame slot di kanan utk extras (refresh button, dst.).
        self.extras = ctk.CTkFrame(self, fg_color="transparent")
        self.extras.pack(side="right")

    def set_text(self, text: str) -> None:
        with contextlib.suppress(Exception):
            self._title.configure(text=text)


def icon_button(
    parent: Any,
    *,
    text: str = "",
    lucide: str | None = None,
    icon_size: int = 16,
    icon_color: str | tuple[str, str] | None = None,
    command: Callable[[], None] | None = None,
    width: int = 0,
    height: int = 32,
    corner_radius: int = 8,
    compound: str = "left",
    **kwargs: Any,
) -> ctk.CTkButton:
    """CTkButton helper dengan Lucide icon di kiri text.

    Implementasi: load icon via :func:`perpustakaan.gui.icons.lucide_icon`,
    pass sebagai ``image=`` ke ``CTkButton``. Kalau icon gagal load, tetap
    bikin button dengan text saja (graceful degradation).

    Args:
        parent: parent widget.
        text: label text. Empty string = icon-only button.
        lucide: nama icon Lucide (mis. ``"plus"``, ``"trash-2"``).
        icon_size: ukuran icon dalam pixel — pakai ``ICON_SIZE.sm`` (16) utk
            button standard atau ``ICON_SIZE.md`` (20) utk button besar.
        icon_color: warna icon. ``None`` → ikut text_color CTk default
            (bisa di-tune via theme JSON), atau spec eksplisit.
        command: callback klik.
        width / height / corner_radius: sesuai CTkButton.
        compound: posisi icon vs text — ``"left"`` (default), ``"top"``,
            ``"right"``, ``"bottom"``.
        **kwargs: passthrough ke ``CTkButton.__init__`` (mis. ``fg_color``,
            ``hover_color``, ``font``).
    """
    img = None
    if lucide:
        try:
            from perpustakaan.gui.icons import lucide_icon
            img = lucide_icon(lucide, size=icon_size, color=icon_color)
        except Exception:  # noqa: BLE001
            img = None

    btn_kwargs: dict[str, Any] = {
        "text": text,
        "command": command,
        "height": height,
        "corner_radius": corner_radius,
    }
    if width:
        btn_kwargs["width"] = width
    if img is not None:
        btn_kwargs["image"] = img
        btn_kwargs["compound"] = compound
    btn_kwargs.update(kwargs)
    return ctk.CTkButton(parent, **btn_kwargs)


def fmt_rupiah(value: int | float) -> str:
    try:
        return f"Rp {int(value):,}".replace(",", ".")
    except (TypeError, ValueError):
        return "Rp 0"


# ---------------------------------------------------------------------------
# Permission helpers (RBAC v0.4.3)
# ---------------------------------------------------------------------------
def permission_button(
    parent: Any,
    *,
    text: str,
    permission: str,
    lucide: str | None = None,
    icon_size: int = 16,
    icon_color: str | tuple[str, str] | None = None,
    command: Callable[[], None] | None = None,
    **kwargs: Any,
) -> ctk.CTkButton:
    """Build a CTkButton yang otomatis di-disable kalau user aktif tidak punya
    ``permission``. Klik saat tidak punya hak tetap menampilkan toast
    "Akses ditolak" (defense in depth — secara visual juga sudah greyed).

    Pakai sebagai pengganti ``ctk.CTkButton`` untuk aksi yang protected::

        permission_button(toolbar, text="+ Tambah", permission="anggota.tambah",
                          lucide="plus", command=self._add)

    Kalau ``lucide`` diberikan, ikon Lucide ditampilkan di kiri text (memakai
    helper ``icon_button`` di belakang layar — tetap dgn permission gating).
    """
    try:
        from perpustakaan.services import permissions as permissions_service

        allowed = permissions_service.current_has(permission)
    except Exception:  # noqa: BLE001
        # Kalau service tidak available (mis. tabel permissions belum ada),
        # default = allow agar app tidak kunci semua tombol di skenario error.
        allowed = True

    def _wrapped() -> None:
        if not allowed:
            with contextlib.suppress(Exception):
                show_toast(
                    parent,
                    t("permissions.toast.denied", permission=permission),
                    kind="warning",
                )
            return
        if command is not None:
            command()

    if lucide:
        # Reuse icon_button untuk dapat lucide rendering + recolor theme-aware
        btn = icon_button(
            parent,
            text=text,
            lucide=lucide,
            icon_size=icon_size,
            icon_color=icon_color,
            command=_wrapped,
            **kwargs,
        )
    else:
        btn = ctk.CTkButton(parent, text=text, command=_wrapped, **kwargs)
    if not allowed:
        with contextlib.suppress(Exception):
            btn.configure(state="disabled")
    return btn


def require_permission_or_toast(parent: Any, permission: str) -> bool:
    """Helper imperative: ``True`` kalau user punya hak, ``False`` + toast
    "Akses ditolak" kalau tidak. Cocok untuk aksi yang dipanggil dari
    keyboard shortcut / context menu (tidak dari permission_button).
    """
    try:
        from perpustakaan.services import permissions as permissions_service

        if permissions_service.current_has(permission):
            return True
    except Exception:  # noqa: BLE001
        return True
    with contextlib.suppress(Exception):
        show_toast(
            parent,
            t("permissions.toast.denied", permission=permission),
            kind="warning",
        )
    return False


# ---------------------------------------------------------------------------
# Empty state — hero pictogram + title + description + optional action
# ---------------------------------------------------------------------------
class EmptyState(ctk.CTkFrame):
    """Placeholder visual saat list/dashboard kosong.

    Layout::

        ┌────────────────────────────────┐
        │           [icon 48px]          │
        │                                │
        │       Belum ada data           │
        │   Penjelasan singkat di sini   │
        │                                │
        │      [ + Tambah data ]         │
        └────────────────────────────────┘

    Default ikon dipilih dari Lucide ("inbox") tapi bisa di-override.
    """

    def __init__(
        self,
        parent: Any,
        *,
        title: str,
        description: str = "",
        icon: str = "inbox",
        icon_size: int = 48,
        illustration: str | None = None,
        illustration_size: tuple[int, int] = (320, 200),
        animation: str | None = None,
        animation_size: tuple[int, int] = (96, 96),
        animation_fps: int = 24,
        action_label: str | None = None,
        action_command: Callable[[], None] | None = None,
    ) -> None:
        """Empty state placeholder.

        Visual layer order (first match wins):

        1. ``animation`` \u2014 name dari ``assets/animations/<name>/`` (PR-V4b).
           Kalau folder ada \u2192 looping AnimationPlayer di-render sebagai hero.
        2. ``illustration`` \u2014 name dari ``assets/illustrations/<name>.png``.
           Kalau file ada, dipakai sebagai hero visual (sebelum Lucide icon).
        3. ``icon`` \u2014 Lucide icon name. Default ``"inbox"``. Dipakai sebagai
           fallback kalau illustration tidak tersedia.

        Param ``illustration_size`` adalah max bound ``(w, h)``; aspect ratio
        original akan dipertahankan via ``Image.thumbnail``.
        """
        super().__init__(parent, fg_color="transparent")

        # Animation memiliki priority paling tinggi (lebih hidup daripada
        # static illustration). Lazy import supaya widget tetap bisa render
        # di env minimal tanpa Pillow / asset.
        self._animation: Any = None
        anim_loaded = False
        if animation:
            try:
                from perpustakaan.gui.animation_player import (
                    AnimationPlayer,
                    load_animation_frames,
                )

                # Cek dulu ada frame-nya \u2014 supaya kita bisa fallback ke
                # illustration kalau folder kosong.
                frames = load_animation_frames(animation, animation_size)
                if frames:
                    anim_loaded = True
                    # AnimationPlayer di-pack di bawah (perlu super().__init__ done).
                    # Disini cukup tandai supaya skip illustration/icon path.
                    self._animation = AnimationPlayer(
                        self, name=animation, size=animation_size,
                        fps=animation_fps, loop=True,
                    )
            except Exception:  # noqa: BLE001
                anim_loaded = False
                self._animation = None

        # Lazy import supaya widgets.py tidak hard-depend ke icons.py kalau
        # asset belum ada (mis. di test environment minimal).
        img = None
        if not anim_loaded and illustration:
            try:
                from perpustakaan.gui.illustrations import load_illustration

                img = load_illustration(illustration, size=illustration_size)
            except Exception:  # noqa: BLE001
                img = None
        if not anim_loaded and img is None:
            try:
                from perpustakaan.gui.icons import lucide_icon

                img = lucide_icon(icon, size=icon_size)
            except Exception:  # noqa: BLE001
                img = None

        try:
            from perpustakaan.gui.fonts import body_font, section_font
            _title_font = section_font()
            _body_font = body_font()
        except Exception:  # noqa: BLE001
            _title_font = ctk.CTkFont(size=15, weight="bold")
            _body_font = ctk.CTkFont(size=12)

        # Animation (priority) / icon / illustration
        if self._animation is not None:
            self._animation.pack(pady=(8, 12))
            with contextlib.suppress(Exception):
                self._animation.start()
        elif img is not None:
            self._icon_lbl = ctk.CTkLabel(self, text="", image=img)
            self._icon_lbl.pack(pady=(8, 12))

        self._title_lbl = ctk.CTkLabel(
            self,
            text=title,
            font=_title_font,
            text_color=("#0f172a", "#f1f5f9"),
        )
        self._title_lbl.pack(pady=(0, 4))

        if description:
            self._desc_lbl = ctk.CTkLabel(
                self,
                text=description,
                font=_body_font,
                text_color=("#64748b", "#94a3b8"),
                wraplength=420,
                justify="center",
            )
            self._desc_lbl.pack(pady=(0, 16))

        if action_label and action_command:
            self._action_btn = ctk.CTkButton(
                self,
                text=action_label,
                command=action_command,
                width=180, height=36,
                corner_radius=8,
                font=ctk.CTkFont(size=13, weight="bold"),
            )
            self._action_btn.pack(pady=(0, 8))


# ---------------------------------------------------------------------------
# Tooltip — hover label borderless toplevel
# ---------------------------------------------------------------------------
class Tooltip:
    """Tooltip ringan ala native macOS — tampil saat hover ≥500ms.

    Pemakaian::

        btn = ctk.CTkButton(parent, text="", image=img)
        Tooltip(btn, text="Tambah anggota")

    Tidak butuh subclass; cukup ``Tooltip(widget, text=...)`` setelah pack/grid.
    Tooltip auto-destroy saat widget destroy (event bind ``<Destroy>``).
    """

    _DELAY_MS = 500
    _OFFSET_X = 12
    _OFFSET_Y = 22

    def __init__(self, widget: Any, *, text: str) -> None:
        self._widget = widget
        self._text = text
        self._after_id: str | None = None
        self._tip: tk.Toplevel | None = None
        widget.bind("<Enter>", self._schedule, add=True)
        widget.bind("<Leave>", self._hide, add=True)
        widget.bind("<ButtonPress>", self._hide, add=True)
        widget.bind("<Destroy>", self._cleanup, add=True)

    def _schedule(self, _event: Any = None) -> None:
        self._cancel()
        try:
            self._after_id = self._widget.after(self._DELAY_MS, self._show)
        except Exception:  # noqa: BLE001
            self._after_id = None

    def _cancel(self) -> None:
        if self._after_id is not None:
            with contextlib.suppress(Exception):
                self._widget.after_cancel(self._after_id)
            self._after_id = None

    def _show(self) -> None:
        if self._tip is not None or not self._text:
            return
        try:
            x = self._widget.winfo_rootx() + self._OFFSET_X
            y = self._widget.winfo_rooty() + self._widget.winfo_height() + 4
            tip = tk.Toplevel(self._widget)
            tip.wm_overrideredirect(True)
            tip.wm_geometry(f"+{x}+{y}")
            tip.attributes("-topmost", True)
            # Match light/dark dengan deteksi mode aktif (best-effort).
            try:
                mode = ctk.get_appearance_mode().lower()
                bg = "#1f2937" if mode == "light" else "#e5e7eb"
                fg = "#f9fafb" if mode == "light" else "#0f172a"
            except Exception:  # noqa: BLE001
                bg, fg = "#1f2937", "#f9fafb"
            lbl = tk.Label(
                tip,
                text=self._text,
                background=bg,
                foreground=fg,
                padx=10,
                pady=5,
                font=("TkDefaultFont", 10),
                relief="flat",
                borderwidth=0,
            )
            lbl.pack()
            self._tip = tip
        except Exception:  # noqa: BLE001
            self._tip = None

    def _hide(self, _event: Any = None) -> None:
        self._cancel()
        if self._tip is not None:
            with contextlib.suppress(Exception):
                self._tip.destroy()
            self._tip = None

    def _cleanup(self, _event: Any = None) -> None:
        self._hide()

