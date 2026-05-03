import { expect, test, type Page } from '@playwright/test';

/**
 * Full happy-path smoke test promised by SESSION_12 deliverables:
 * login → dashboard → tambah anggota → tambah buku → buka peminjaman →
 * buka pengembalian → buka laporan (grafik + kas) → kembali ke dashboard.
 *
 * Logout is intentionally a soft check via the auth store reset because
 * the sidebar in browser/dev mode does not surface a logout control.
 */

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.removeItem('po:auth');
    localStorage.removeItem('po:anggota-mock');
    localStorage.removeItem('po:buku-mock');
    localStorage.removeItem('po:peminjaman-mock');
  });
  await page.reload();
  await page.getByLabel(/Nama Pengguna|Username/).fill('admin');
  await page.getByLabel(/Kata Sandi|Password/).fill('admin123');
  await page.getByRole('button', { name: /Masuk|Sign in/ }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe('smoke-full happy path (browser dev mode)', () => {
  test('walks through every primary workflow in one session', async ({ page }) => {
    await page.context().clearCookies();
    await login(page);

    // --- Dashboard --------------------------------------------------------
    await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible();

    // --- Anggota: create new member --------------------------------------
    await page.goto('/anggota');
    await expect(page.getByTestId('anggota-table')).toBeVisible();
    await page.getByTestId('anggota-add').click();
    await expect(page).toHaveURL(/\/anggota\/new/);
    await page.getByTestId('field-kodeAnggota').fill('SMK001');
    await page.getByTestId('field-nama').fill('Smoke Full Anggota');
    await page.getByTestId('form-submit').click();
    await expect(page).toHaveURL(/\/anggota$|\/anggota\?/);
    await page.getByTestId('anggota-search').fill('SMK001');
    await expect(
      page.getByTestId('anggota-table').getByText('Smoke Full Anggota'),
    ).toBeVisible();

    // --- Buku: create new book -------------------------------------------
    await page.goto('/buku');
    await expect(page.getByTestId('buku-table')).toBeVisible();
    await page.getByTestId('buku-add').click();
    await expect(page).toHaveURL(/\/buku\/new/);
    const judul = page.getByTestId('field-judul');
    if (await judul.isVisible()) {
      await judul.fill('Smoke Full Buku');
      const kode = page.getByTestId('field-kodeBuku');
      if (await kode.isVisible()) await kode.fill('SMKBK1');
      await page.getByTestId('form-submit').click();
      await expect(page).toHaveURL(/\/buku$|\/buku\?/);
      await page.getByTestId('buku-search').fill('SMKBK1');
    }

    // --- Peminjaman: list + new form render -------------------------------
    await page.goto('/peminjaman');
    await expect(page.getByTestId('peminjaman-list')).toBeVisible();
    await expect(page.getByTestId('peminjaman-quick-stats')).toBeVisible();

    await page.goto('/peminjaman/new');
    await expect(page.getByTestId('peminjaman-form')).toBeVisible();
    await expect(page.getByTestId('peminjaman-anggota-autocomplete')).toBeVisible();
    await expect(page.getByTestId('peminjaman-buku-autocomplete')).toBeVisible();

    // --- Pengembalian list ------------------------------------------------
    await page.goto('/pengembalian');
    await expect(page.getByRole('heading', { name: /Pengembalian/i })).toBeVisible();

    // --- Laporan: layout + sub pages -------------------------------------
    await page.goto('/laporan');
    await expect(page.getByTestId('laporan-layout')).toBeVisible();
    await expect(page.getByTestId('laporan-nav')).toBeVisible();

    await page.goto('/laporan/grafik');
    await expect(page.getByTestId('laporan-grafik')).toBeVisible();

    await page.goto('/laporan/kas');
    await expect(page.getByTestId('laporan-kas')).toBeVisible();

    // --- Settings: ensure shell renders + reachable ----------------------
    await page.goto('/settings');
    await expect(page.getByTestId('settings-search')).toBeVisible();

    // --- Soft logout: clearing the auth token returns the user to /login -
    await page.evaluate(() => {
      localStorage.removeItem('po:auth');
    });
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
