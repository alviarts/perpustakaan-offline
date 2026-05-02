"""Manual export ke Google Sheets (Opsi C, one-way).

Flow:
    1. User klik "Ekspor ke Google Sheets" di Settings.
    2. Aplikasi minta path ke ``credentials.json`` (OAuth desktop).
    3. Auth lokal via browser → token disimpan di ``CREDENTIALS_DIR/token.json``.
    4. Aplikasi cari spreadsheet pribadi user (judul ``Perpustakaan-{username}``);
       jika belum ada → buat baru.
    5. Push semua tabel utama (Anggota, Buku, Peminjaman, ...) ke sheet bernama
       sama. Spreadsheet di-overwrite (one-way push).

Dependency: ``gspread``, ``google-auth``, ``google-auth-oauthlib``.

Catatan: untuk sync 2-arah (Opsi A) lihat roadmap v0.5.
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from perpustakaan.config import CREDENTIALS_DIR
from perpustakaan.db.connection import Database, get_db
from perpustakaan.models import settings as settings_repo

SCOPES: tuple[str, ...] = (
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
)
TOKEN_PATH = CREDENTIALS_DIR / "token.json"


class SheetsAuthError(Exception):
    """Auth gagal (credentials.json tidak ada / OAuth dibatalkan)."""


def _load_credentials(client_secret_path: Path):
    """Load OAuth credentials, refresh / reauth jika perlu."""
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow

    creds = None
    if TOKEN_PATH.exists():
        try:
            creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), list(SCOPES))
        except Exception:
            creds = None

    if creds and creds.valid:
        return creds

    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            TOKEN_PATH.write_text(creds.to_json())
            return creds
        except Exception:
            creds = None

    if not client_secret_path.exists():
        raise SheetsAuthError(
            "credentials.json tidak ditemukan. Download dari Google Cloud Console "
            "(OAuth 2.0 Client ID — Desktop App) lalu pilih file-nya."
        )

    flow = InstalledAppFlow.from_client_secrets_file(str(client_secret_path), list(SCOPES))
    creds = flow.run_local_server(port=0)
    TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
    TOKEN_PATH.write_text(creds.to_json())
    return creds


def _get_or_create_spreadsheet(client, judul: str, *, spreadsheet_id: str = ""):
    if spreadsheet_id:
        try:
            return client.open_by_key(spreadsheet_id)
        except Exception:
            pass
    try:
        return client.open(judul)
    except Exception:
        return client.create(judul)


def export_all(
    client_secret_path: Path | str,
    *,
    username: str = "user",
    db: Database | None = None,
) -> dict[str, Any]:
    """Ekspor seluruh data ke spreadsheet pribadi user.

    :returns: dict ``{"spreadsheet_id", "url", "sheets_written"}``.
    """
    import gspread

    db = db or get_db()
    creds = _load_credentials(Path(client_secret_path))
    client = gspread.authorize(creds)

    judul = f"Perpustakaan-{username}"
    saved_id = settings_repo.get_value("sync.spreadsheet_id") or ""
    sh = _get_or_create_spreadsheet(client, judul, spreadsheet_id=saved_id)

    settings_repo.set_value("sync.spreadsheet_id", sh.id, db=db)

    sources: list[tuple[str, str]] = [
        ("Anggota", "SELECT * FROM anggota ORDER BY kode_anggota"),
        ("Buku", "SELECT * FROM buku ORDER BY kode_buku"),
        ("Peminjaman", "SELECT * FROM peminjaman ORDER BY tanggal_pinjam DESC"),
        ("Peminjaman_Item", "SELECT * FROM peminjaman_item ORDER BY peminjaman_id DESC"),
        ("Kunjungan", "SELECT * FROM kunjungan ORDER BY tanggal DESC"),
        ("Kas", "SELECT * FROM kas ORDER BY tanggal DESC"),
        ("Settings", "SELECT key, value, updated_at FROM settings ORDER BY key"),
    ]

    written: list[str] = []
    for sheet_name, sql in sources:
        rows = db.query_all(sql)
        try:
            ws = sh.worksheet(sheet_name)
            ws.clear()
        except gspread.WorksheetNotFound:
            ws = sh.add_worksheet(title=sheet_name, rows=max(len(rows) + 10, 100), cols=26)
        if rows:
            headers = list(rows[0].keys())
            data = [headers] + [[_cell(r.get(h)) for h in headers] for r in rows]
        else:
            data = [["(empty)"]]
        ws.update("A1", data, value_input_option="RAW")
        written.append(sheet_name)

    settings_repo.set_value(
        "sync.last_export_at", datetime.now().isoformat(timespec="seconds"), db=db
    )
    return {
        "spreadsheet_id": sh.id,
        "url": sh.url,
        "sheets_written": written,
    }


def _cell(value: Any) -> Any:
    if value is None:
        return ""
    if isinstance(value, (int, float, str, bool)):
        return value
    return json.dumps(value, ensure_ascii=False)
