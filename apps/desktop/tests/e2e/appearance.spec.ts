import { expect, test, type Page } from '@playwright/test';

/**
 * Fitur tampilan (layout + warna aksen) — pilihan onboarding awal &
 * Settings → Tampilan. Verifikasi: persistensi, penerapan ke <html>,
 * dan perilaku ringkas (sidebar mulai mengecil).
 */

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.removeItem('po:auth');
    localStorage.removeItem('po:settings:display');
  });
  await page.reload();
  await page.getByLabel(/Nama Pengguna|Username/).fill('admin');
  await page.getByLabel(/Kata Sandi|Password/).fill('admin123');
  await page.getByRole('button', { name: /Masuk|Sign in/ }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe('tampilan (layout + aksen)', () => {
  test('settings picker persists layout + accent and applies to root', async ({ page }) => {
    await login(page);
    await page.goto('/settings/tampilan');

    await page.getByTestId('appearance-layout-modern').click();
    await page.getByTestId('appearance-accent-ungu').click();

    await expect(page.getByTestId('appearance-layout-modern')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('appearance-accent-ungu')).toHaveAttribute('aria-pressed', 'true');

    // Apply + persist
    await page.goto('/dashboard');
    const root = page.evaluate(() => ({
      layout: document.documentElement.dataset.layout,
      accent: document.documentElement.dataset.accent,
      primary: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(),
    }));
    await expect.poll(() => root).toMatchObject({ layout: 'modern', accent: 'ungu' });

    // Persisted across reload
    await page.reload();
    const afterReload = await page.evaluate(() => ({
      layout: document.documentElement.dataset.layout,
      accent: document.documentElement.dataset.accent,
    }));
    expect(afterReload).toMatchObject({ layout: 'modern', accent: 'ungu' });
  });

  test('ringkas layout starts with collapsed sidebar but can be expanded', async ({ page }) => {
    await login(page);
    await page.goto('/settings/tampilan');
    await page.getByTestId('appearance-layout-ringkas').click();

    await page.goto('/dashboard');
    const sidebar = page.getByTestId('sidebar');
    await expect(sidebar).toHaveAttribute('data-collapsed', 'true');

    await page.getByTestId('sidebar-toggle').click();
    await expect(sidebar).toHaveAttribute('data-collapsed', 'false');
  });

  test('switching ringkas → modern expands the sidebar and shows labels', async ({ page }) => {
    await login(page);
    await page.goto('/settings/tampilan');
    await page.getByTestId('appearance-layout-ringkas').click();
    await expect(page.getByTestId('sidebar')).toHaveAttribute('data-collapsed', 'true');

    // Ganti ke Modern dari halaman Settings yang sama.
    await page.getByTestId('appearance-layout-modern').click();
    await page.goto('/dashboard');
    const sidebar = page.getByTestId('sidebar');
    await expect(sidebar).toHaveAttribute('data-collapsed', 'false');
    // Modern memakai label (bukan ikon saja seperti Ringkas).
    await expect(sidebar.getByText('Dashboard', { exact: true })).toBeVisible();
  });

  test('reset restores defaults', async ({ page }) => {
    await login(page);
    await page.goto('/settings/tampilan');
    await page.getByTestId('appearance-layout-modern').click();
    await page.getByTestId('appearance-accent-mawar').click();

    await page.getByTestId('settings-reset-tampilan').click();
    await page.getByRole('dialog').getByRole('button', { name: /Reset/i }).click();

    await expect(page.getByTestId('appearance-layout-klasik')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('appearance-accent-biru')).toHaveAttribute('aria-pressed', 'true');
  });
});
