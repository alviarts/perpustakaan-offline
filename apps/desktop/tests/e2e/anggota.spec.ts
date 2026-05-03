import { test, expect } from '@playwright/test';

const adminLogin = async (page: import('@playwright/test').Page) => {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.removeItem('po:auth');
    localStorage.removeItem('po:sidebar');
    localStorage.removeItem('po:mock:anggota');
  });
  await page.reload();
  await page.getByLabel(/Nama Pengguna|Username/).fill('admin');
  await page.getByLabel(/Kata Sandi|Password/).fill('admin123');
  await page.getByRole('button', { name: /Masuk|Sign in/ }).click();
  await page.waitForURL(/\/dashboard/);
};

test.describe('anggota CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await adminLogin(page);
    await page.goto('/anggota');
    await expect(page.getByTestId('anggota-table')).toBeVisible();
  });

  test('list shows seed members and total count', async ({ page }) => {
    const rows = page.getByTestId('anggota-row');
    await expect(rows.first()).toBeVisible();
    await expect(page.getByTestId('anggota-total')).toContainText(/\d+/);
  });

  test('create new anggota appears in list', async ({ page }) => {
    await page.getByTestId('add-anggota').click();
    await expect(page.getByTestId('anggota-form')).toBeVisible();
    const uniqueCode = `T${Date.now().toString().slice(-6)}`;
    await page.getByTestId('field-kode-anggota').fill(uniqueCode);
    await page.getByTestId('field-nama').fill('Anggota E2E');
    await page.getByTestId('field-kelas').fill('XII RPL');
    await page.getByTestId('field-jurusan').fill('RPL');
    await page.getByTestId('submit-anggota').click();

    await expect(page.getByTestId('anggota-form')).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Anggota E2E')).toBeVisible();
  });

  test('edit existing anggota updates name', async ({ page }) => {
    await page.getByTestId('edit-anggota').first().click();
    await expect(page.getByTestId('anggota-form')).toBeVisible();
    const namaField = page.getByTestId('field-nama');
    await namaField.fill('Renamed Member');
    await page.getByTestId('submit-anggota').click();

    await expect(page.getByTestId('anggota-form')).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Renamed Member')).toBeVisible();
  });

  test('delete anggota with confirmation removes row', async ({ page }) => {
    const initialRows = await page.getByTestId('anggota-row').count();
    expect(initialRows).toBeGreaterThan(0);

    await page.getByTestId('delete-anggota').first().click();
    await page.getByTestId('confirm-delete').click();

    await expect
      .poll(async () => page.getByTestId('anggota-row').count(), { timeout: 5_000 })
      .toBe(initialRows - 1);
  });

  test('search filters table within debounce window', async ({ page }) => {
    await page.getByTestId('anggota-search').fill('Citra');
    await page.waitForTimeout(300); // > 200ms debounce
    const rows = page.getByTestId('anggota-row');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      await expect(rows.nth(i)).toContainText(/Citra/i);
    }
  });

  test('reject duplicate kode_anggota with conflict error', async ({ page }) => {
    await page.getByTestId('add-anggota').click();
    await page.getByTestId('field-kode-anggota').fill('A001'); // already in seed
    await page.getByTestId('field-nama').fill('Duplicate');
    await page.getByTestId('submit-anggota').click();

    await expect(page.getByTestId('anggota-error')).toBeVisible();
  });
});
