import { expect, test } from '@playwright/test';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.removeItem('po:auth');
    localStorage.removeItem('po:master-mock');
  });
  await page.reload();
  await page.getByLabel(/Nama Pengguna|Username/).fill('admin');
  await page.getByLabel(/Kata Sandi|Password/).fill('admin123');
  await page.getByRole('button', { name: /Masuk|Sign in/ }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe('master-data CRUD (browser dev mode)', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await login(page);
    await page.goto('/settings/master-data');
    await expect(page.getByTestId('master-tabs')).toBeVisible();
  });

  test('renders DDC tab seed entries by default', async ({ page }) => {
    const table = page.getByTestId('master-table');
    await expect(table.getByText('000', { exact: true }).first()).toBeVisible();
  });

  test('switches between tabs', async ({ page }) => {
    await page.getByTestId('master-tab-bahasa').click();
    const table = page.getByTestId('master-table');
    await expect(table.getByText('Indonesia').first()).toBeVisible();
    await expect(table.getByText('Inggris').first()).toBeVisible();

    await page.getByTestId('master-tab-jurusan').click();
    await expect(table.getByText('IPA').first()).toBeVisible();
  });

  test('creates a new kategori entry via dialog', async ({ page }) => {
    await page.getByTestId('master-tab-kategori').click();
    await page.getByTestId('master-add').click();
    await page.getByTestId('master-form-nama').fill('E2E Test Kategori');
    await page.getByTestId('master-form-submit').click();
    await page.getByTestId('master-search').fill('E2E Test');
    await expect(page.getByTestId('master-table').getByText('E2E Test Kategori')).toBeVisible();
  });

  test('search filters within active tab', async ({ page }) => {
    await page.getByTestId('master-tab-kategori').click();
    await page.getByTestId('master-search').fill('fiksi');
    const table = page.getByTestId('master-table');
    await expect(table.getByText(/Fiksi|Non-fiksi/).first()).toBeVisible();
  });
});
