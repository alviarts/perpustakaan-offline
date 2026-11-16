import { test, expect } from '@playwright/test';

async function adminLogin(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.clear();
    // Re-seed the one-time "Layar izin awal" gate flag that storageState
    // provided at context creation (settings.spec intentionally clears all
    // localStorage for a deterministic mock reset; wiping this flag would
    // redirect every reload to /izin and break the login flow).
    localStorage.setItem('perpustakaan.permissions.done', '1');
  });
  await page.reload();
  await page.getByLabel(/Nama Pengguna|Username/).fill('admin');
  await page.getByLabel(/Kata Sandi|Password/).fill('admin123');
  await page.getByRole('button', { name: /Masuk|Sign in/ }).click();
  await page.waitForURL(/\/dashboard/);
}

test.describe('settings — search & navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await adminLogin(page);
    await page.goto('/settings');
    await page.waitForURL(/\/settings\/identitas/);
  });

  test('default redirect lands on Identitas', async ({ page }) => {
    await expect(page).toHaveURL(/\/settings\/identitas/);
    await expect(page.getByTestId('settings-section-identitas')).toBeVisible();
  });

  test('sidebar lists all settings sections', async ({ page }) => {
    const nav = page.getByTestId('settings-nav');
    await expect(nav).toBeVisible();
    const links = nav.locator('a');
    // The app now ships 18 settings sections (v1.3.6 adds akreditasi, kta,
    // label-buku, sinkronisasi, template-nota, akses-mode, sandbox, …).
    await expect(links).toHaveCount(18);
  });

  test('search "denda" filters down to Aturan Peminjaman', async ({ page }) => {
    const search = page.getByTestId('settings-search');
    await search.fill('denda');
    const nav = page.getByTestId('settings-nav');
    const links = nav.locator('a');
    await expect(links).toHaveCount(1);
    await expect(links.first()).toContainText(/Aturan Peminjaman|Loan Rules/);
  });

  test('search empty state shows message', async ({ page }) => {
    await page.getByTestId('settings-search').fill('qqqqzzzzz');
    await expect(page.getByTestId('settings-nav')).toContainText(/Tidak ada|No matching/);
  });

  test('navigates to Tampilan and Reset shows confirm', async ({ page }) => {
    await page.getByTestId('settings-nav-tampilan').click();
    await expect(page).toHaveURL(/\/settings\/tampilan/);
    await page.getByTestId('settings-reset-tampilan').click();
    // SettingsSection uses the shared ConfirmDialog (Radix Dialog → role=dialog).
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('navigates to Tentang and shows credit + repo link', async ({ page }) => {
    await page.getByTestId('settings-nav-tentang').click();
    await expect(page).toHaveURL(/\/settings\/tentang/);
    await expect(page.getByText(/alvi arts/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Repositori GitHub/i })).toBeVisible();
  });
});
