import { expect, test } from '@playwright/test';

async function login(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.removeItem('po:auth');
  });
  await page.reload();
  await page.getByLabel(/Nama Pengguna|Username/).fill('admin');
  await page.getByLabel(/Kata Sandi|Password/).fill('admin123');
  await page.getByRole('button', { name: /Masuk|Sign in/ }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe('laporan', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await login(page);
    await page.goto('/laporan');
    await expect(page.getByTestId('laporan-layout')).toBeVisible();
  });

  test('redirects /laporan to /laporan/grafik with sidebar nav visible', async ({ page }) => {
    await expect(page).toHaveURL(/\/laporan\/grafik/);
    await expect(page.getByTestId('laporan-nav')).toBeVisible();
  });

  test('navigates to top-peminjam and shows table', async ({ page }) => {
    await page.getByRole('link', { name: /Top Peminjam|Top Borrowers/ }).click();
    await expect(page).toHaveURL(/\/laporan\/top-peminjam/);
    await expect(page.getByTestId('top-peminjam-table')).toBeVisible();
  });

  test('navigates to kas and shows summary cards', async ({ page }) => {
    await page.getByRole('link', { name: /Kas|Cash/ }).click();
    await expect(page).toHaveURL(/\/laporan\/kas/);
    await expect(page.getByText(/Total Masuk|Total In/)).toBeVisible();
    await expect(page.getByText(/Saldo Akhir|Closing Balance/)).toBeVisible();
  });

  test('navigates to backup and shows controls', async ({ page }) => {
    await page.getByRole('link', { name: /^Backup$/ }).click();
    await expect(page).toHaveURL(/\/laporan\/backup/);
    await expect(page.getByTestId('backup-create')).toBeVisible();
    await expect(page.getByTestId('schedule-cron')).toBeVisible();
  });
});
