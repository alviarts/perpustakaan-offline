"""Konfigurasi pytest: redirect data dir ke folder temp per test."""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import pytest


@pytest.fixture()
def fresh_db(monkeypatch):
    """Set env var XDG_DATA_HOME / APPDATA agar config menulis ke temp dir.

    Reset module ``perpustakaan.config``, ``perpustakaan.db.connection`` setiap test.
    """
    tmpdir = Path(tempfile.mkdtemp(prefix="perpus_test_"))
    monkeypatch.setenv("XDG_DATA_HOME", str(tmpdir))
    monkeypatch.setenv("APPDATA", str(tmpdir))

    for mod in [m for m in list(sys.modules) if m.startswith("perpustakaan")]:
        sys.modules.pop(mod, None)

    from perpustakaan.db.connection import init_db
    from perpustakaan.db.seed import seed_all

    init_db()
    seed_all()
    yield tmpdir
