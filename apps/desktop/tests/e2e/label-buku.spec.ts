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

test.describe('label buku template (browser dev mode)', () => {
  test('advanced popup exposes the full manual layout editor', async ({ page }) => {
    await login(page);
    await page.goto('/settings/label-buku');

    await expect(page.getByTestId('label-buku-open-advanced')).toBeVisible();
    // Editor tidak lagi menumpuk di halaman utama seperti KTA.
    await expect(page.getByTestId('label-buku-field-add')).toHaveCount(0);

    await page.getByTestId('label-buku-open-advanced').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId('label-buku-field-add')).toBeVisible();
    await expect(dialog.getByTestId('label-buku-field-editor')).toBeVisible();

    // Tambah field di dalam popup — editor benar-benar interaktif.
    const before = await dialog.locator('[data-testid^="label-buku-field-row-"]').count();
    await dialog.getByTestId('label-buku-field-add').click();
    await expect(dialog.locator('[data-testid^="label-buku-field-row-"]')).toHaveCount(before + 1);

    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('label-buku-save')).toBeVisible();
  });
});
