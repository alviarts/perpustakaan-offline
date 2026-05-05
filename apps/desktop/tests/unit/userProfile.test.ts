import { describe, expect, it, vi, beforeEach } from 'vitest';

// Force browser-mode by mocking isTauri before importing the module under
// test. The browser fallback writes to an in-memory map so we can verify
// the round-trip without any Rust host.
vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  return {
    ...actual,
    isTauri: () => false,
  };
});

import { userProfileApi } from '@/lib/userProfile';

describe('userProfileApi (browser fallback)', () => {
  beforeEach(async () => {
    // Reset the in-memory store between tests by overwriting with defaults.
    await userProfileApi.update(1, {
      fullName: 'Administrator',
      fotoPath: null,
      tanggalLahir: null,
      tempatLahir: null,
      telepon: null,
      email: null,
      alamat: null,
      jenisKelamin: null,
      agama: null,
    });
  });

  it('returns a default profile for an unknown user id', async () => {
    const p = await userProfileApi.get(42);
    expect(p.userId).toBe(42);
    expect(p.fullName).toBe('Administrator');
    expect(p.fotoPath).toBeNull();
  });

  it('persists updates and returns them on next get', async () => {
    const updated = await userProfileApi.update(1, {
      fullName: 'Alvi Awal',
      fotoPath: 'uploads/user/foo.jpg',
      tanggalLahir: '1995-08-17',
      tempatLahir: 'Jakarta',
      telepon: '0812',
      email: 'a@b.id',
      alamat: 'Jl. Merdeka',
      jenisKelamin: 'L',
      agama: 'Islam',
    });
    expect(updated.fullName).toBe('Alvi Awal');
    expect(updated.fotoPath).toBe('uploads/user/foo.jpg');

    const fetched = await userProfileApi.get(1);
    expect(fetched.fullName).toBe('Alvi Awal');
    expect(fetched.tanggalLahir).toBe('1995-08-17');
    expect(fetched.tempatLahir).toBe('Jakarta');
    expect(fetched.telepon).toBe('0812');
    expect(fetched.email).toBe('a@b.id');
    expect(fetched.alamat).toBe('Jl. Merdeka');
    expect(fetched.jenisKelamin).toBe('L');
    expect(fetched.agama).toBe('Islam');
  });

  it('clears optional fields when updates pass null', async () => {
    await userProfileApi.update(1, {
      fullName: 'X',
      fotoPath: 'uploads/user/v1.jpg',
      tanggalLahir: '2000-01-01',
      tempatLahir: 'Bandung',
      telepon: '0',
      email: 'x@y.z',
      alamat: 'Foo',
      jenisKelamin: 'P',
      agama: 'Hindu',
    });
    const cleared = await userProfileApi.update(1, {
      fullName: 'X',
      fotoPath: null,
      tanggalLahir: null,
      tempatLahir: null,
      telepon: null,
      email: null,
      alamat: null,
      jenisKelamin: null,
      agama: null,
    });
    expect(cleared.fotoPath).toBeNull();
    expect(cleared.tanggalLahir).toBeNull();
    expect(cleared.alamat).toBeNull();
  });
});
