import { expect, test } from '@playwright/test';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.removeItem('po:auth');
    localStorage.removeItem('po:anggota-mock');
  });
  await page.reload();
  await page.getByLabel(/Nama Pengguna|Username/).fill('admin');
  await page.getByLabel(/Kata Sandi|Password/).fill('admin123');
  await page.getByRole('button', { name: /Masuk|Sign in/ }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe('anggota CRUD (browser dev mode)', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await login(page);
    await page.goto('/anggota');
    await expect(page.getByTestId('anggota-table')).toBeVisible();
  });

  test('renders the seed list with default rows', async ({ page }) => {
    const table = page.getByTestId('anggota-table');
    await expect(table.getByText('Andini Putri')).toBeVisible();
    await expect(table.getByText('Bagas Pratama')).toBeVisible();
  });

  test('debounced search filters rows live', async ({ page }) => {
    await page.getByTestId('anggota-search').fill('andini');
    const table = page.getByTestId('anggota-table');
    await expect(table.getByText('Andini Putri')).toBeVisible();
    await expect(table.getByText('Bagas Pratama')).toHaveCount(0);
  });

  test('header global search jumps to /anggota?q=…', async ({ page }) => {
    await page.goto('/dashboard');
    const headerSearch = page.getByTestId('header-search');
    await headerSearch.fill('bagas');
    await headerSearch.press('Enter');
    await expect(page).toHaveURL(/\/anggota\?q=bagas/);
    await expect(page.getByTestId('anggota-table').getByText('Bagas Pratama')).toBeVisible();
  });

  test('creates a new member end-to-end', async ({ page }) => {
    await page.getByTestId('anggota-add').click();
    await expect(page).toHaveURL(/\/anggota\/new/);
    await page.getByTestId('field-kodeAnggota').fill('E2E001');
    await page.getByTestId('field-nama').fill('Playwright E2E Member');
    await page.getByTestId('form-submit').click();
    await expect(page).toHaveURL(/\/anggota$|\/anggota\?/);
    await page.getByTestId('anggota-search').fill('E2E001');
    await expect(page.getByTestId('anggota-table').getByText('Playwright E2E Member')).toBeVisible();
  });

  test('blocks submission when required fields are missing', async ({ page }) => {
    await page.getByTestId('anggota-add').click();
    await page.getByTestId('form-submit').click();
    // Stays on the new page because validation fails.
    await expect(page).toHaveURL(/\/anggota\/new/);
  });

  test('edits and deletes an existing member', async ({ page }) => {
    // Open Andini's record.
    await page.getByTestId('anggota-table').getByText('Andini Putri').click();
    await expect(page).toHaveURL(/\/anggota\/\d+/);
    await page.getByTestId('field-nama').fill('Andini Putri (edited)');
    await page.getByTestId('form-submit').click();
    await expect(page).toHaveURL(/\/anggota$|\/anggota\?/);
    await expect(page.getByTestId('anggota-table').getByText('Andini Putri (edited)')).toBeVisible();

    // Delete via confirm dialog.
    await page.getByTestId('anggota-table').getByText('Andini Putri (edited)').click();
    await page.getByTestId('form-delete').click();
    await page.getByTestId('confirm-dialog-confirm').click();
    await expect(page).toHaveURL(/\/anggota$|\/anggota\?/);
    await expect(page.getByText('Andini Putri (edited)')).toHaveCount(0);
  });
});
