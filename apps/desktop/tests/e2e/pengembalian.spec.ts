import { expect, test } from '@playwright/test';

async function login(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.removeItem('po:auth');
    localStorage.removeItem('po:peminjaman-mock');
  });
  await page.reload();
  await page.getByLabel(/Nama Pengguna|Username/).fill('admin');
  await page.getByLabel(/Kata Sandi|Password/).fill('admin123');
  await page.getByRole('button', { name: /Masuk|Sign in/ }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe('pengembalian flow (browser dev mode)', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await login(page);
  });

  test('renders search panel and detail empty state', async ({ page }) => {
    await page.goto('/pengembalian');
    await expect(page.getByTestId('pengembalian-page')).toBeVisible();
    await expect(page.getByTestId('pengembalian-search')).toBeVisible();
    await expect(page.getByText(/Pilih peminjaman/i)).toBeVisible();
  });

  test('shows empty result message when no active loans match', async ({ page }) => {
    await page.goto('/pengembalian');
    await page.getByTestId('pengembalian-search').fill('NO_SUCH_LOAN_XYZ');
    await expect(page.getByText(/Tidak ada peminjaman aktif/i)).toBeVisible();
  });
});
