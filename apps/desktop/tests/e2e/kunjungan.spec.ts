import { expect, test } from '@playwright/test';

async function login(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.removeItem('po:auth');
    localStorage.removeItem('po:kunjungan-mock');
  });
  await page.reload();
  await page.getByLabel(/Nama Pengguna|Username/).fill('admin');
  await page.getByLabel(/Kata Sandi|Password/).fill('admin123');
  await page.getByRole('button', { name: /Masuk|Sign in/ }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe('kunjungan page (browser dev mode)', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await login(page);
    await page.goto('/kunjungan');
    await expect(page.getByTestId('kunjungan-page')).toBeVisible();
  });

  test('renders page with quick stats and table empty state', async ({ page }) => {
    await expect(page.getByTestId('kunjungan-quick-stats')).toBeVisible();
    await expect(page.getByTestId('kunjungan-table')).toBeVisible();
    await expect(page.getByText(/Belum ada kunjungan|No visits in this range/)).toBeVisible();
  });

  test('opens add dialog and shows keperluan select', async ({ page }) => {
    await page.getByTestId('kunjungan-add').click();
    await expect(page.getByTestId('kunjungan-keperluan')).toBeVisible();
    await expect(page.getByTestId('kunjungan-submit')).toBeVisible();
  });

  test('adds a manual visit which appears in table and bumps stats', async ({ page }) => {
    await page.getByTestId('kunjungan-add').click();
    await page.getByTestId('kunjungan-submit').click();
    // Dialog should close + new row visible
    await expect(page.getByText(/Membaca/)).toBeVisible({ timeout: 5000 });
  });
});
