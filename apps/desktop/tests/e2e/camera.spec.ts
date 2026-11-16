import { expect, test, type Page } from '@playwright/test';

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.removeItem('po:auth');
    localStorage.setItem('perpustakaan.permissions.done', '1');
    localStorage.setItem('isbn-tutorial-completed', 'true');
  });
  await page.reload();
  await page.getByLabel(/Nama Pengguna|Username/).fill('admin');
  await page.getByLabel(/Kata Sandi|Password/).fill('admin123');
  await page.getByRole('button', { name: /Masuk|Sign in/ }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test('ISBN scanner exposes a camera dropdown with detected devices', async ({ page }) => {
  // Browser dev mode has no real webcam — expose two fake devices so the
  // device picker can be exercised without hardware.
  await page.addInitScript(() => {
    const fakeDevices = [
      { deviceId: 'cam-front', kind: 'videoinput', label: 'Kamera Depan', groupId: 'g1', toJSON: () => ({}) },
      { deviceId: 'cam-back', kind: 'videoinput', label: 'Kamera Belakang', groupId: 'g2', toJSON: () => ({}) },
    ];
    if (navigator.mediaDevices) {
      Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', {
        configurable: true,
        value: async () => fakeDevices,
      });
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        configurable: true,
        value: async () => {
          throw new DOMException('No camera in test environment', 'NotFoundError');
        },
      });
    }
  });

  await login(page);
  await page.goto('/buku');
  await page.getByTestId('buku-import-isbn').click();

  const picker = page.getByTestId('isbn-camera-select');
  await expect(picker).toBeVisible();
  await expect(picker.locator('option')).toHaveCount(2);
  await expect(picker.locator('option').first()).toHaveText('Kamera Depan');
});
