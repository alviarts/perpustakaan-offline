"""Dialog Bantuan / FAQ / Video Tutorial / Tentang (PR-D v0.5.3).

Dipanggil dari tombol "Bantuan" di header :class:`MainWindow`. Modal
dengan tiga tab via :class:`ctk.CTkTabview`:

* **FAQ** — pertanyaan & jawaban umum (lihat :data:`help_content.FAQ_ENTRIES`).
  Tiap entry render sebagai pertanyaan bold + jawaban paragraf di scroll-frame.
* **Video Tutorial** — daftar video di ``docs/demo/`` (lihat
  :func:`help_content.discover_videos`). Tiap video punya tombol "Buka
  Video" yang membuka file pakai default media player OS.
* **Tentang** — versi aplikasi, tagline, kredit Kang Sur, link ke
  GitHub repo / releases / issues.

Konten data (FAQ, video metadata, link ekstern) di-isolasi di
:mod:`help_content` supaya bisa di-test tanpa Tk.
"""
from __future__ import annotations

import contextlib
import logging
import os
import subprocess
import sys
import webbrowser
from pathlib import Path

import customtkinter as ctk

from perpustakaan.config import APP_DISPLAY_NAME, APP_VERSION
from perpustakaan.gui import widgets
from perpustakaan.gui.help_content import (
    FAQ_ENTRIES,
    GITHUB_ISSUES_URL,
    GITHUB_RELEASES_URL,
    GITHUB_REPO_URL,
    VideoEntry,
    discover_videos,
    format_size,
)
from perpustakaan.i18n import t

_log = logging.getLogger("perpustakaan.gui.help_dialog")

# Wrapping width for paragraph text (FAQ answers, video descriptions).
# Window-width 640px - paddings + scrollbar leaves ~560 usable.
_WRAP_WIDTH = 540


# ---------------------------------------------------------------------------
# OS-aware "open file/url with default app" helper
# ---------------------------------------------------------------------------
def _open_path(path: Path) -> None:
    """Buka file pakai default media player / handler OS.

    Raises :class:`OSError` jika gagal supaya caller bisa show toast.
    """
    if not path.exists():
        raise OSError(f"File tidak ditemukan: {path}")
    if sys.platform.startswith("win"):
        os.startfile(str(path))  # type: ignore[attr-defined]
    elif sys.platform == "darwin":
        subprocess.run(["open", str(path)], check=True)
    else:
        subprocess.run(["xdg-open", str(path)], check=True)


def _open_url(url: str) -> None:
    """Buka URL di default browser. Pakai :mod:`webbrowser` (cross-platform)."""
    ok = webbrowser.open(url, new=2)
    if not ok:
        raise OSError(f"Gagal membuka browser untuk: {url}")


# ---------------------------------------------------------------------------
# HelpDialog
# ---------------------------------------------------------------------------
class HelpDialog(ctk.CTkToplevel):
    """Modal dialog Bantuan dengan 3 tab (FAQ, Video, Tentang)."""

    def __init__(self, parent: ctk.CTkBaseClass) -> None:
        super().__init__(parent)
        self.parent_widget = parent
        self.title(t("help.title"))
        self.geometry("680x560")
        self.minsize(600, 480)
        self.transient(parent)
        self.grab_set()

        from perpustakaan.gui.animations import apply_dialog_appear
        apply_dialog_appear(self)

        # Header banner
        ctk.CTkLabel(
            self,
            text=t("help.title"),
            font=ctk.CTkFont(size=18, weight="bold"),
        ).pack(pady=(16, 0))
        ctk.CTkLabel(
            self,
            text=t("help.subtitle"),
            text_color=("#6b7280", "#9ca3af"),
            font=ctk.CTkFont(size=11),
            wraplength=600,
        ).pack(pady=(0, 12))

        # Tabview
        self.tabs = ctk.CTkTabview(self)
        self.tabs.pack(fill="both", expand=True, padx=16, pady=(0, 12))
        self.tabs.add(t("help.tab.faq"))
        self.tabs.add(t("help.tab.video"))
        self.tabs.add(t("help.tab.about"))

        self._build_faq(self.tabs.tab(t("help.tab.faq")))
        self._build_video(self.tabs.tab(t("help.tab.video")))
        self._build_about(self.tabs.tab(t("help.tab.about")))

        # Footer close button (always visible)
        btnbar = ctk.CTkFrame(self, fg_color="transparent")
        btnbar.pack(fill="x", padx=16, pady=(0, 12))
        ctk.CTkButton(
            btnbar,
            text=t("common.close"),
            command=self.destroy,
            width=110,
        ).pack(side="right")

    # ------------------------------------------------------------------
    # FAQ tab
    # ------------------------------------------------------------------
    def _build_faq(self, parent: ctk.CTkBaseClass) -> None:
        scroll = ctk.CTkScrollableFrame(parent, fg_color="transparent")
        scroll.pack(fill="both", expand=True, padx=4, pady=4)

        for idx, entry in enumerate(FAQ_ENTRIES):
            container = ctk.CTkFrame(
                scroll,
                fg_color=("#f9fafb", "#1f2937"),
                corner_radius=8,
            )
            container.pack(fill="x", padx=4, pady=(0, 8))
            # Pertanyaan (bold)
            ctk.CTkLabel(
                container,
                text=f"{idx + 1}. {t(entry.question_key)}",
                anchor="w", justify="left",
                wraplength=_WRAP_WIDTH,
                font=ctk.CTkFont(size=13, weight="bold"),
                text_color=("#111827", "#f9fafb"),
            ).pack(fill="x", padx=12, pady=(10, 4))
            # Jawaban (paragraf)
            ctk.CTkLabel(
                container,
                text=t(entry.answer_key),
                anchor="w", justify="left",
                wraplength=_WRAP_WIDTH,
                font=ctk.CTkFont(size=12),
                text_color=("#374151", "#d1d5db"),
            ).pack(fill="x", padx=12, pady=(0, 10))

    # ------------------------------------------------------------------
    # Video tab
    # ------------------------------------------------------------------
    def _build_video(self, parent: ctk.CTkBaseClass) -> None:
        videos = discover_videos()
        scroll = ctk.CTkScrollableFrame(parent, fg_color="transparent")
        scroll.pack(fill="both", expand=True, padx=4, pady=4)

        if not videos:
            self._build_video_empty(scroll)
            return

        for video in videos:
            self._build_video_card(scroll, video)

    def _build_video_empty(self, parent: ctk.CTkBaseClass) -> None:
        container = ctk.CTkFrame(parent, fg_color="transparent")
        container.pack(fill="both", expand=True, pady=24)
        ctk.CTkLabel(
            container,
            text=t("help.video.empty.title"),
            font=ctk.CTkFont(size=14, weight="bold"),
        ).pack(pady=(0, 6))
        ctk.CTkLabel(
            container,
            text=t("help.video.empty.desc"),
            wraplength=_WRAP_WIDTH,
            justify="center",
            text_color=("#6b7280", "#9ca3af"),
        ).pack(pady=(0, 14))
        ctk.CTkButton(
            container,
            text=t("help.about.releases"),
            command=lambda: self._safe_open_url(GITHUB_RELEASES_URL),
            width=200,
        ).pack()

    def _build_video_card(
        self, parent: ctk.CTkBaseClass, video: VideoEntry,
    ) -> None:
        card = ctk.CTkFrame(
            parent,
            fg_color=("#f9fafb", "#1f2937"),
            corner_radius=8,
        )
        card.pack(fill="x", padx=4, pady=(0, 8))

        ctk.CTkLabel(
            card,
            text=t(video.title_key),
            anchor="w", justify="left",
            wraplength=_WRAP_WIDTH,
            font=ctk.CTkFont(size=13, weight="bold"),
        ).pack(fill="x", padx=12, pady=(10, 2))

        ctk.CTkLabel(
            card,
            text=t(video.description_key),
            anchor="w", justify="left",
            wraplength=_WRAP_WIDTH,
            font=ctk.CTkFont(size=11),
            text_color=("#374151", "#d1d5db"),
        ).pack(fill="x", padx=12, pady=(0, 6))

        meta_text = f"{t('help.video.size_label')}: {format_size(video.size_bytes)} · {video.path.name}"
        ctk.CTkLabel(
            card,
            text=meta_text,
            anchor="w",
            font=ctk.CTkFont(size=10),
            text_color=("#6b7280", "#9ca3af"),
        ).pack(fill="x", padx=12, pady=(0, 6))

        ctk.CTkButton(
            card,
            text=t("help.video.open_button"),
            command=lambda v=video: self._safe_open_video(v),
            width=140,
        ).pack(anchor="w", padx=12, pady=(0, 10))

    # ------------------------------------------------------------------
    # About tab
    # ------------------------------------------------------------------
    def _build_about(self, parent: ctk.CTkBaseClass) -> None:
        scroll = ctk.CTkScrollableFrame(parent, fg_color="transparent")
        scroll.pack(fill="both", expand=True, padx=4, pady=4)

        ctk.CTkLabel(
            scroll,
            text=t("help.about.app_name"),
            font=ctk.CTkFont(size=16, weight="bold"),
            wraplength=_WRAP_WIDTH,
            justify="left",
            anchor="w",
        ).pack(fill="x", padx=8, pady=(8, 2))

        ctk.CTkLabel(
            scroll,
            text=t("help.about.tagline"),
            text_color=("#6b7280", "#9ca3af"),
            wraplength=_WRAP_WIDTH,
            justify="left",
            anchor="w",
        ).pack(fill="x", padx=8, pady=(0, 14))

        # Info rows
        info_rows = (
            ("help.about.version", APP_VERSION),
            ("help.about.license", "MIT"),
            ("help.about.author", "alviarts"),
        )
        for key, value in info_rows:
            row = ctk.CTkFrame(scroll, fg_color="transparent")
            row.pack(fill="x", padx=8, pady=2)
            ctk.CTkLabel(
                row, text=f"{t(key)}:",
                width=110, anchor="w",
                font=ctk.CTkFont(size=12, weight="bold"),
            ).pack(side="left")
            ctk.CTkLabel(
                row, text=value, anchor="w",
                font=ctk.CTkFont(size=12),
            ).pack(side="left")

        ctk.CTkLabel(
            scroll,
            text=t("help.about.inspiration"),
            wraplength=_WRAP_WIDTH,
            justify="left",
            anchor="w",
            text_color=("#374151", "#d1d5db"),
            font=ctk.CTkFont(size=11),
        ).pack(fill="x", padx=8, pady=(14, 14))

        # Link buttons
        links = (
            ("help.about.github", GITHUB_REPO_URL),
            ("help.about.releases", GITHUB_RELEASES_URL),
            ("help.about.report_bug", GITHUB_ISSUES_URL),
        )
        for key, url in links:
            ctk.CTkButton(
                scroll,
                text=t(key),
                command=lambda u=url: self._safe_open_url(u),
                width=240,
            ).pack(anchor="w", padx=8, pady=4)

        ctk.CTkLabel(
            scroll,
            text=f"{APP_DISPLAY_NAME} · {APP_VERSION}",
            text_color=("#9ca3af", "#6b7280"),
            font=ctk.CTkFont(size=10),
        ).pack(anchor="w", padx=8, pady=(14, 8))

    # ------------------------------------------------------------------
    # Open helpers (with toast on failure)
    # ------------------------------------------------------------------
    def _safe_open_video(self, video: VideoEntry) -> None:
        try:
            _open_path(video.path)
        except (OSError, subprocess.CalledProcessError) as exc:
            _log.warning("Open video failed: %s", exc)
            with contextlib.suppress(Exception):
                widgets.show_toast(
                    self,
                    t("help.video.open_failed", error=str(exc)),
                    kind="error",
                    duration_ms=5000,
                )

    def _safe_open_url(self, url: str) -> None:
        try:
            _open_url(url)
        except OSError as exc:
            _log.warning("Open URL failed: %s", exc)
            with contextlib.suppress(Exception):
                widgets.show_toast(
                    self,
                    t("help.about.open_link_failed", error=str(exc)),
                    kind="error",
                    duration_ms=5000,
                )
