import { expect, test, type Page } from '@playwright/test';

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.removeItem('po:auth');
    localStorage.setItem('perpustakaan.permissions.done', '1');
  });
  await page.reload();
  await page.getByLabel(/Nama Pengguna|Username/).fill('admin');
  await page.getByLabel(/Kata Sandi|Password/).fill('admin123');
  await page.getByRole('button', { name: /Masuk|Sign in/ }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

test.describe('trial countdown & lock (browser dev mode)', () => {
  test('header shows a countdown badge during trial', async ({ page }) => {
    await login(page);
    await page.evaluate((start) => {
      localStorage.setItem('perpustakaan.trial.start', start);
      localStorage.setItem('perpustakaan.trial.used', '1');
    }, daysAgo(10));
    await page.goto('/dashboard');
    await expect(page.getByTestId('trial-badge')).toContainText('20 hari tersisa');
  });

  test('expired trial locks the app and cannot be restarted', async ({ page }) => {
    await login(page);
    await page.evaluate((start) => {
      localStorage.setItem('perpustakaan.trial.start', start);
      localStorage.setItem('perpustakaan.trial.used', '1');
    }, daysAgo(31));

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/aktivasi/);
    await expect(page.getByText(/tidak dapat diulang/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lanjut dengan trial' })).toHaveCount(0);

    // Menghapus penanda awal trial tidak boleh membuka trial baru.
    await page.evaluate(() => localStorage.removeItem('perpustakaan.trial.start'));
    await page.reload();
    await expect(page).toHaveURL(/\/aktivasi/);
  });
});
