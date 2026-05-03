import { test, expect } from '@playwright/test';

const adminLogin = async (page: import('@playwright/test').Page) => {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.removeItem('po:auth');
    localStorage.removeItem('po:sidebar');
  });
  await page.reload();
  await page.getByLabel(/Nama Pengguna|Username/).fill('admin');
  await page.getByLabel(/Kata Sandi|Password/).fill('admin123');
  await page.getByRole('button', { name: /Masuk|Sign in/ }).click();
  await page.waitForURL(/\/dashboard/);
};

test.describe('app shell — sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await adminLogin(page);
  });

  test('sidebar is visible after login', async ({ page }) => {
    const sidebar = page.getByTestId('sidebar');
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toHaveAttribute('data-collapsed', 'false');
  });

  test('toggle button collapses + expands sidebar', async ({ page }) => {
    const sidebar = page.getByTestId('sidebar');
    await page.getByTestId('sidebar-toggle').click();
    await expect(sidebar).toHaveAttribute('data-collapsed', 'true');
    await page.getByTestId('sidebar-toggle').click();
    await expect(sidebar).toHaveAttribute('data-collapsed', 'false');
  });

  test('Ctrl+B toggles sidebar globally', async ({ page }) => {
    const sidebar = page.getByTestId('sidebar');
    await page.keyboard.press('Control+B');
    await expect(sidebar).toHaveAttribute('data-collapsed', 'true');
    await page.keyboard.press('Control+B');
    await expect(sidebar).toHaveAttribute('data-collapsed', 'false');
  });

  test('collapsed state persists after reload', async ({ page }) => {
    await page.getByTestId('sidebar-toggle').click();
    await expect(page.getByTestId('sidebar')).toHaveAttribute('data-collapsed', 'true');
    await page.reload();
    await expect(page.getByTestId('sidebar')).toHaveAttribute('data-collapsed', 'true');
  });

  test('viewport <1024px auto-collapses sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 700 });
    await expect(page.getByTestId('sidebar')).toHaveAttribute('data-collapsed', 'true');
  });

  test('logout from header user menu redirects to /login', async ({ page }) => {
    await page.getByTestId('user-menu').click();
    await page.getByTestId('logout').click();
    await expect(page).toHaveURL(/\/login/);
  });
});
