# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for Perpustakaan Offline.

Hasil build: single-file `dist/Perpustakaan.exe` (Windows).
"""
from pathlib import Path

block_cipher = None

PROJECT_ROOT = Path(SPECPATH).resolve()
SRC = PROJECT_ROOT / "src"
ASSETS = PROJECT_ROOT / "assets"


datas = [
    (str(ASSETS), "assets"),
    (str(SRC / "perpustakaan" / "db" / "schema.sql"), "perpustakaan/db"),
]


a = Analysis(
    [str(SRC / "perpustakaan" / "__main__.py")],
    pathex=[str(SRC)],
    binaries=[],
    datas=datas,
    hiddenimports=[
        "customtkinter",
        "PIL._tkinter_finder",
        "barcode",
        "barcode.writer",
        "openpyxl",
        "reportlab",
        "reportlab.pdfgen",
        "reportlab.lib",
        "matplotlib",
        "matplotlib.backends.backend_tkagg",
        "tkcalendar",
        "bcrypt",
        "gspread",
        "google.auth",
        "google.auth.transport.requests",
        "google_auth_oauthlib.flow",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "pytest",
        "ruff",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="PerpustakaanOffline",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # GUI app -> sembunyikan console
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(ASSETS / "icon.ico") if (ASSETS / "icon.ico").exists() else None,
)
