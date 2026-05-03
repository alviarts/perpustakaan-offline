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

test.describe('peminjaman happy path (browser dev mode)', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await login(page);
  });

  test('renders peminjaman list with empty state and quick stats bar', async ({ page }) => {
    await page.goto('/peminjaman');
    await expect(page.getByTestId('peminjaman-list')).toBeVisible();
    await expect(page.getByTestId('peminjaman-quick-stats')).toBeVisible();
  });

  test('navigates to new loan form and renders required fields', async ({ page }) => {
    await page.goto('/peminjaman/new');
    await expect(page.getByTestId('peminjaman-form')).toBeVisible();
    await expect(page.getByTestId('peminjaman-anggota-autocomplete')).toBeVisible();
    await expect(page.getByTestId('peminjaman-buku-autocomplete')).toBeVisible();
    await expect(page.getByTestId('peminjaman-submit')).toBeVisible();
  });

  test('shows validation errors on empty submit', async ({ page }) => {
    await page.goto('/peminjaman/new');
    await page.getByTestId('peminjaman-submit').click();
    await expect(page.getByText(/Pilih anggota/i)).toBeVisible();
    await expect(page.getByText(/Pilih minimal 1 buku/i)).toBeVisible();
  });
});
