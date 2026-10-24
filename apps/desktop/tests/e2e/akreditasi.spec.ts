import { expect, test, type Page } from '@playwright/test';

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.evaluate(() => localStorage.removeItem('po:auth'));
  await page.reload();
  await page.getByLabel(/Nama Pengguna|Username/).fill('admin');
  await page.getByLabel(/Kata Sandi|Password/).fill('admin123');
  await page.getByRole('button', { name: /Masuk|Sign in/ }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function openAkreditasi(page: Page): Promise<void> {
  await page.getByTestId('sidebar').getByRole('link', { name: /Akreditasi/ }).click();
  await expect(page).toHaveURL(/\/akreditasi/);
  await expect(page.getByTestId('akreditasi-layout')).toBeVisible();
}

test.describe('akreditasi (browser dev mode)', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await login(page);
    await openAkreditasi(page);
  });

  test('ringkasan renders profile + counters', async ({ page }) => {
    await expect(page).toHaveURL(/\/akreditasi\/ringkasan/);
    await expect(page.getByTestId('akreditasi-nav')).toBeVisible();
    await expect(page.getByTestId('akreditasi-ringkasan')).toBeVisible();
    await expect(page.getByText(/Profil Perpustakaan|Library Profile/)).toBeVisible();
  });

  test('butir: answering a butir persists across client navigation', async ({ page }) => {
    await page.getByTestId('akreditasi-nav').getByRole('link', { name: /Butir/ }).click();
    await expect(page.getByTestId('akreditasi-butir')).toBeVisible();

    const firstRadio = page.locator('[data-testid="akreditasi-butir"] input[type="radio"]').first();
    await firstRadio.check();
    await expect(firstRadio).toBeChecked();

    // Go to skor and back — client-side routing keeps mock state.
    await page.getByTestId('akreditasi-nav').getByRole('link', { name: /Skor/ }).click();
    await expect(page.getByTestId('akreditasi-skor')).toBeVisible();
    await page.getByTestId('akreditasi-nav').getByRole('link', { name: /Butir/ }).click();
    await expect(
      page.locator('[data-testid="akreditasi-butir"] input[type="radio"]').first(),
    ).toBeChecked();
  });

  test('skor shows projected score table and answered progress', async ({ page }) => {
    await page.getByTestId('akreditasi-nav').getByRole('link', { name: /Skor/ }).click();
    await expect(page.getByTestId('akreditasi-skor')).toBeVisible();
    await expect(page.getByTestId('akreditasi-skor-table')).toBeVisible();
    await expect(page.getByText(/Nilai akhir|Final score/).first()).toBeVisible();
  });

  test('bukti fisik: checklist toggle works', async ({ page }) => {
    await page.getByTestId('akreditasi-nav').getByRole('link', { name: /Bukti Fisik|Evidence/ }).click();
    await expect(page.getByTestId('akreditasi-bukti')).toBeVisible();
    const box = page.getByTestId('bukti-sk_pendirian');
    await box.click();
    await expect(box).toBeChecked();
  });

  test('buku bukti -> sahkan & arsipkan -> appears in arsip', async ({ page }) => {
    await page.getByTestId('akreditasi-nav').getByRole('link', { name: /Buku Bukti|Evidence Book/ }).click();
    await expect(page.getByTestId('akreditasi-buku-bukti')).toBeVisible();
    await page.getByRole('button', { name: /Sahkan & Arsipkan|Sign & Archive/ }).click();

    await page.getByTestId('akreditasi-nav').getByRole('link', { name: /Arsip|Archive/ }).click();
    await expect(page.getByTestId('akreditasi-arsip')).toBeVisible();
    await expect(page.getByTestId('akreditasi-arsip-table')).toBeVisible();
    await expect(page.getByTestId('akreditasi-arsip-table').getByRole('row')).not.toHaveCount(1);
  });

  test('laporan per jenjang pages render', async ({ page }) => {
    await page.getByTestId('sidebar').getByRole('link', { name: /Laporan|Reports/ }).click();
    await expect(page).toHaveURL(/\/laporan/);

    await page.getByTestId('laporan-nav').getByRole('link', { name: /Koleksi|Collection/ }).click();
    await expect(page.getByTestId('laporan-koleksi')).toBeVisible();
    await expect(page.getByTestId('koleksi-ddc-table')).toBeVisible();

    await page.getByTestId('laporan-nav').getByRole('link', { name: /Pemanfaatan|Usage/ }).click();
    await expect(page.getByTestId('laporan-pemanfaatan')).toBeVisible();

    await page.getByTestId('laporan-nav').getByRole('link', { name: /Kinerja|Performance/ }).click();
    await expect(page.getByTestId('laporan-kinerja')).toBeVisible();
  });

  test('settings: perpustakaan & akreditasi section renders jenjang info', async ({ page }) => {
    await page.goto('/settings/akreditasi');
    await expect(page.getByTestId('settings-section-akreditasi')).toBeVisible();
    await expect(page.getByTestId('akreditasi-jenjang')).toBeVisible();
    await expect(page.getByTestId('akreditasi-jenjang-info')).toBeVisible();
  });
});
