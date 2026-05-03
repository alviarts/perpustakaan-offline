import { test, expect } from '@playwright/test';

test.describe('login (browser dev mode)', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.removeItem('po:auth');
    });
    await page.reload();
  });

  test('shows login form', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
    await expect(page.getByLabel(/Nama Pengguna|Username/)).toBeVisible();
    await expect(page.getByLabel(/Kata Sandi|Password/)).toBeVisible();
  });

  test('admin / admin123 logs in (mock fallback)', async ({ page }) => {
    await page.getByLabel(/Nama Pengguna|Username/).fill('admin');
    await page.getByLabel(/Kata Sandi|Password/).fill('admin123');
    await page.getByRole('button', { name: /Masuk|Sign in/ }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('wrong password shows error', async ({ page }) => {
    await page.getByLabel(/Nama Pengguna|Username/).fill('admin');
    await page.getByLabel(/Kata Sandi|Password/).fill('nope');
    await page.getByRole('button', { name: /Masuk|Sign in/ }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });
});
