# Smoke Test Report — Perpustakaan Offline

**Tanggal:** 2026-05-02
**Environment:** Ubuntu 22.04, Python 3.11.11, Xvfb :77 (1280x800x24)
**Versi:** main (post-PR #5 merge, commit `816c09b`)
**Demo data:** `--demo` flag (5 anggota + 10 buku + 2 peminjaman aktif)

---

## Ringkasan

| Kategori | Hasil |
|----------|-------|
| Navigasi semua menu (8 menu utama) | PASS |
| Setting sub-tabs (6 tab) | PASS |
| Simpan anggota baru | PASS |
| Simpan buku baru | PASS |
| Peminjaman (scan anggota + tambah buku + simpan) | PASS |
| Pengembalian (cari anggota + kembalikan buku) | PASS |
| Cetak KTA (PDF) | PASS |
| Cetak Label Buku (PDF) | PASS |
| Toast notification muncul | PASS |
| Toast auto-dismiss | PASS |
| **Total test:** 17 | **17 passed, 0 failed** |

---

## Bug Ditemukan & Diperbaiki

### BUG-001: `StyledTreeview.set_rows()` crash pada duplicate iid (FIXED)

**Severity:** High — crash saat membuka Pengembalian
**Reproduksi:**
1. Jalankan app dengan `--demo`
2. Buka menu Pengembalian
3. Cari anggota yang memiliki >1 buku dalam satu nomor peminjaman
4. **Crash:** `_tkinter.TclError: Item PJ-20260502-0001 already exists`

**Root cause:** `StyledTreeview` menggunakan kolom pertama (`nomor_pinjam`) sebagai
iid Treeview. Ketika ada 2+ buku dalam satu peminjaman, semua item berbagi
`nomor_pinjam` yang sama, sehingga Tcl menolak insert duplikat.

**Fix:** Tambah fallback di `set_rows()` — jika iid sudah ada, gunakan field `id`
dari row dict. Perubahan di `src/perpustakaan/gui/widgets.py` line 108-111.

```python
# Before (crash on duplicate)
iid = str(r.get(self._key_field, r.get("id", id(r))))

# After (graceful fallback)
iid = str(r.get(self._key_field, r.get("id", id(r))))
if iid in self._items_by_iid:
    fallback = r.get("id")
    iid = str(fallback) if fallback is not None else f"{iid}_{id(r)}"
```

---

## Screenshot Navigasi

Semua screenshot tersimpan di `docs/smoke-test/`:

| Menu | File |
|------|------|
| Dashboard | `01_dashboard.png` |
| Anggota | `02_anggota.png` |
| Buku | `03_buku.png` |
| Kunjungan | `04_kunjungan.png` |
| Peminjaman | `05_peminjaman.png` |
| Pengembalian | `06_pengembalian.png` |
| Laporan | `07_laporan.png` |
| Setting | `08_setting.png` |
| Setting > Identitas | `09_setting_tab_0_identitas_perpustakaan.png` |
| Setting > KTA | `09_setting_tab_1_kartu_anggota.png` |
| Setting > Transaksi | `09_setting_tab_2_transaksi.png` |
| Setting > Akun | `09_setting_tab_3_manajemen_akun.png` |
| Setting > Bahasa | `09_setting_tab_4_bahasa_&_tema.png` |

## Screenshot CRUD

| Operasi | File |
|---------|------|
| Anggota baru tersimpan | `10_anggota_saved.png` |
| Buku baru tersimpan | `11_buku_saved.png` |
| Peminjaman (sebelum simpan) | `12_peminjaman_before_save.png` |
| Peminjaman (setelah simpan) | `12_peminjaman_after_save.png` |
| Pengembalian (daftar pinjaman aktif) | `13_pengembalian_list.png` |
| Toast visible | `16_toast_visible.png` |

---

## Catatan

- Screenshots diambil via ImageMagick `import -window <wid>` di Xvfb
- Test menggunakan `XDG_DATA_HOME` temp dir sehingga DB fresh setiap run
- Cetak KTA dan Label Buku menghasilkan PDF yang valid
- Toast notification non-blocking berfungsi dengan benar (muncul & auto-dismiss)
- Sync tab di Settings tidak menghasilkan screenshot karena nama tab mengandung
  karakter `/` — bukan bug fungsional
