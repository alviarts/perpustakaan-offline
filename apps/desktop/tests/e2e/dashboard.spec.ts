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

test.describe('dashboard page', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await login(page);
    await expect(page.getByTestId('dashboard-page')).toBeVisible();
  });

  test('renders 3 KPI cards in hero row', async ({ page }) => {
    const cards = page.getByTestId('kpi-card');
    await expect(cards).toHaveCount(3);
  });

  test('renders donut and bar charts', async ({ page }) => {
    await expect(page.getByTestId('chart-pie')).toBeVisible();
    await expect(page.getByTestId('chart-bar')).toBeVisible();
  });

  test('renders top peminjam and top buku featured rows', async ({ page }) => {
    await expect(page.getByText(/Top Peminjam|Top Borrowers/)).toBeVisible();
    await expect(page.getByText(/Top Buku|Top Books/)).toBeVisible();
  });
});
