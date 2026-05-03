import { expect, test } from '@playwright/test';

async function login(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.removeItem('po:auth');
    localStorage.removeItem('po:kta:templates');
  });
  await page.reload();
  await page.getByLabel(/Nama Pengguna|Username/).fill('admin');
  await page.getByLabel(/Kata Sandi|Password/).fill('admin123');
  await page.getByRole('button', { name: /Masuk|Sign in/ }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe('kta', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await login(page);
  });

  test('settings KTA page renders editor + template list', async ({ page }) => {
    await page.goto('/settings/kta');
    await expect(page.getByTestId('kta-settings-page')).toBeVisible();
    await expect(page.getByTestId('kta-preview')).toBeVisible();
    await expect(page.getByTestId('kta-name-input')).toBeVisible();
  });

  test('cetak KTA page renders selector + member table', async ({ page }) => {
    await page.goto('/anggota/cetak-kta');
    await expect(page.getByTestId('cetak-kta-page')).toBeVisible();
    await expect(page.getByTestId('kta-template-select')).toBeVisible();
    await expect(page.getByTestId('cetak-kta-print')).toBeDisabled();
  });
});
