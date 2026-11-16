import { expect, test, type Page } from '@playwright/test';
import { utils, write } from 'xlsx';

/** Build a small .xlsx buffer for the import wizard (header row + data). */
function makeAnggotaXlsx(): Buffer {
  const aoa = [
    ['Kode Anggota', 'Nama Lengkap', 'Jenis Kelamin', 'Kelas', 'Jurusan', 'Agama', 'No. Telepon', 'Email'],
    ['EXCEL001', 'Siti Excel', 'P', 'XII IPA 1', 'IPA', 'Islam', '081234567890', 'siti@example.com'],
    ['EXCEL002', 'Budi Excel', 'L', 'XII IPS 2', 'IPS', 'Islam', '081234567891', 'budi@example.com'],
  ];
  const sheet = utils.aoa_to_sheet(aoa);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, sheet, 'Anggota');
  return Buffer.from(write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
}

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.removeItem('po:auth');
    localStorage.removeItem('po:anggota-mock');
    localStorage.removeItem('po:buku-mock');
  });
  await page.reload();
  await page.getByLabel(/Nama Pengguna|Username/).fill('admin');
  await page.getByLabel(/Kata Sandi|Password/).fill('admin123');
  await page.getByRole('button', { name: /Masuk|Sign in/ }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe('Excel import/export (browser dev mode)', () => {
  test('anggota export triggers an .xlsx download', async ({ page }) => {
    await login(page);
    await page.goto('/anggota');
    const dl = page.waitForEvent('download', { timeout: 15000 });
    await page.getByTestId('anggota-export').click();
    const download = await dl;
    expect(download.suggestedFilename()).toMatch(/^anggota-.*\.xlsx$/);
  });

  test('buku export button exists and triggers an .xlsx download', async ({ page }) => {
    await login(page);
    await page.goto('/buku');
    await expect(page.getByTestId('buku-export')).toBeVisible();
    const dl = page.waitForEvent('download', { timeout: 15000 });
    await page.getByTestId('buku-export').click();
    const download = await dl;
    expect(download.suggestedFilename()).toMatch(/^buku-.*\.xlsx$/);
  });

  test('anggota import wizard: upload → map → preview → result', async ({ page }) => {
    await login(page);
    await page.goto('/anggota');
    await page.getByTestId('anggota-import').click();

    const buffer = makeAnggotaXlsx();
    await page.getByTestId('import-wizard-file').setInputFiles({
      name: 'data-anggota.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    });

    // Step 2: mapping (auto-mapped from header labels).
    await expect(page.getByTestId('import-wizard-next-preview')).toBeEnabled();
    await page.getByTestId('import-wizard-next-preview').click();

    // Step 3: preview shows both rows as valid.
    await expect(page.getByText('2 baris siap')).toBeVisible();
    await page.getByTestId('import-wizard-submit').click();

    // Step 4: result summary.
    await expect(page.getByText('Ditambahkan', { exact: true })).toBeVisible();
    await expect(page.getByText('2 ditambahkan, 0 dilewati', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Tutup' }).click();

    // Imported rows show up in the list.
    await page.getByTestId('anggota-search').fill('EXCEL001');
    await expect(page.getByTestId('anggota-table').getByText('Siti Excel')).toBeVisible();
  });

  test('operational lists expose Excel export buttons', async ({ page }) => {
    await login(page);
    const cases: Array<[string, string]> = [
      ['/peminjaman', 'peminjaman-export-excel'],
      ['/pengembalian', 'pengembalian-export-excel'],
      ['/kunjungan', 'kunjungan-export-excel'],
      ['/reservasi', 'reservasi-export-excel'],
      ['/wishlist', 'wishlist-export-excel'],
    ];
    for (const [path, testid] of cases) {
      await page.goto(path);
      await expect(page.getByTestId(testid)).toBeVisible();
    }
  });

  test('laporan subpages expose Excel export buttons', async ({ page }) => {
    await login(page);
    for (const path of [
      '/laporan/grafik',
      '/laporan/top-peminjam',
      '/laporan/top-buku',
      '/laporan/kas',
      '/laporan/pemanfaatan',
      '/laporan/kinerja',
    ]) {
      await page.goto(path);
      await expect(page.getByTestId('laporan-export-excel')).toBeVisible();
    }
    // Koleksi uses inline CSV/Excel/PDF buttons instead of RangeToolbar.
    await page.goto('/laporan/koleksi');
    await expect(page.getByRole('button', { name: 'Excel' })).toBeVisible();
    await page.goto('/laporan/eksekutif');
    await expect(page.getByTestId('laporan-eksekutif-excel')).toBeVisible();
  });
});
