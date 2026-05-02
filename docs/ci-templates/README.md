# CI Templates

Workflow definitions yang **belum** otomatis aktif karena PAT yang dipakai
Devin tidak memiliki scope `workflow` untuk mendaftarkan file di
`.github/workflows/`.

## Cara Mengaktifkan GitHub Actions CI

Cukup salin file `github-actions-ci.yml` ke `.github/workflows/ci.yml` lalu
push:

```bash
mkdir -p .github/workflows
cp docs/ci-templates/github-actions-ci.yml .github/workflows/ci.yml
git add .github/workflows/ci.yml
git commit -m "ci: enable GitHub Actions"
git push
```

Workflow ini menjalankan:

1. **Lint** dengan `ruff check` di Python 3.11 dan 3.12.
2. **Pytest** untuk semua test di `tests/`.
3. **Build PyInstaller `.exe` Windows** (hanya pada push ke `main`) dan
   meng-upload artifact `PerpustakaanOffline.exe`.
