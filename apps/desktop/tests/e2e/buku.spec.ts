import { expect, test } from '@playwright/test';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.removeItem('po:auth');
    localStorage.removeItem('po:buku-mock');
    localStorage.removeItem('po:master-mock');
  });
  await page.reload();
  await page.getByLabel(/Nama Pengguna|Username/).fill('admin');
  await page.getByLabel(/Kata Sandi|Password/).fill('admin123');
  await page.getByRole('button', { name: /Masuk|Sign in/ }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe('buku CRUD (browser dev mode)', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await login(page);
    await page.goto('/buku');
    await expect(page.getByTestId('buku-table')).toBeVisible();
  });

  test('renders the seed list with default rows', async ({ page }) => {
    const table = page.getByTestId('buku-table');
    await expect(table.getByText('Bumi Manusia')).toBeVisible();
    await expect(table.getByText('Sapiens')).toBeVisible();
  });

  test('debounced search filters books live', async ({ page }) => {
    await page.getByTestId('buku-search').fill('sapiens');
    const table = page.getByTestId('buku-table');
    await expect(table.getByText('Sapiens')).toBeVisible();
    await expect(table.getByText('Bumi Manusia')).toHaveCount(0);
  });

  test('selecting a row populates the detail panel', async ({ page }) => {
    await page.getByTestId('buku-table').getByText('Bumi Manusia').click();
    const detail = page.getByTestId('buku-detail');
    await expect(detail).toBeVisible();
    await expect(detail.getByText('Bumi Manusia')).toBeVisible();
    await expect(page.getByTestId('buku-eksemplar-list')).toBeVisible();
  });

  test('creates a new book end-to-end', async ({ page }) => {
    await page.getByTestId('buku-add').click();
    await expect(page).toHaveURL(/\/buku\/new/);
    await page.getByTestId('field-kodeBuku').fill('E2EBK1');
    await page.getByTestId('field-judul').fill('Playwright Buku E2E');
    await page.getByTestId('field-pengarang').fill('Devin AI');
    await page.getByTestId('field-jumlahEksemplar').fill('2');
    await page.getByTestId('form-submit').click();
    await expect(page).toHaveURL(/\/buku$|\/buku\?/);
    await page.getByTestId('buku-search').fill('E2EBK1');
    await expect(
      page.getByTestId('buku-table').getByText('Playwright Buku E2E'),
    ).toBeVisible();
  });

  test('blocks submission when required fields are missing', async ({ page }) => {
    await page.getByTestId('buku-add').click();
    await page.getByTestId('form-submit').click();
    await expect(page).toHaveURL(/\/buku\/new/);
  });

  test('edits and deletes an existing book', async ({ page }) => {
    await page.getByTestId('buku-table').getByText('Bumi Manusia').click();
    await page.getByTestId('buku-detail-edit').click();
    await expect(page).toHaveURL(/\/buku\/\d+/);
    await page.getByTestId('field-judul').fill('Bumi Manusia (edited)');
    await page.getByTestId('form-submit').click();
    await expect(page).toHaveURL(/\/buku$|\/buku\?/);
    await expect(
      page.getByTestId('buku-table').getByText('Bumi Manusia (edited)'),
    ).toBeVisible();

    await page.getByTestId('buku-table').getByText('Bumi Manusia (edited)').click();
    await page.getByTestId('buku-detail-edit').click();
    await page.getByTestId('form-delete').click();
    await page.getByTestId('confirm-dialog-confirm').click();
    await expect(page).toHaveURL(/\/buku$|\/buku\?/);
    await expect(page.getByText('Bumi Manusia (edited)')).toHaveCount(0);
  });
});
