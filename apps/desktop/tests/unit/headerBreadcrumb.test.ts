import { describe, expect, it } from 'vitest';
import { resolveBreadcrumbKeys } from '@/components/layout/Header';

/**
 * Regression tests for BUG-006 — header breadcrumb stayed on "Dashboard"
 * for any sub-route because the resolver only matched the full pathname
 * against ROUTE_LABELS.
 */
describe('resolveBreadcrumbKeys', () => {
  it('returns the dashboard crumb for /dashboard', () => {
    expect(resolveBreadcrumbKeys('/dashboard')).toEqual(['common:menu.dashboard']);
  });

  it('falls back to the dashboard crumb for an empty / root path', () => {
    expect(resolveBreadcrumbKeys('/')).toEqual(['common:menu.dashboard']);
    expect(resolveBreadcrumbKeys('')).toEqual(['common:menu.dashboard']);
  });

  it('returns the section crumb for top-level list routes', () => {
    expect(resolveBreadcrumbKeys('/anggota')).toEqual(['common:menu.anggota']);
    expect(resolveBreadcrumbKeys('/buku')).toEqual(['common:menu.buku']);
    expect(resolveBreadcrumbKeys('/peminjaman')).toEqual(['common:menu.peminjaman']);
    expect(resolveBreadcrumbKeys('/laporan')).toEqual(['common:menu.laporan']);
    expect(resolveBreadcrumbKeys('/settings')).toEqual(['common:menu.settings']);
  });

  it('appends a sub-route crumb for /anggota/new', () => {
    expect(resolveBreadcrumbKeys('/anggota/new')).toEqual([
      'common:menu.anggota',
      'anggota:breadcrumb.new',
    ]);
  });

  it('appends a sub-route crumb for /buku/new', () => {
    expect(resolveBreadcrumbKeys('/buku/new')).toEqual([
      'common:menu.buku',
      'buku:breadcrumb.new',
    ]);
  });

  it('appends a sub-route crumb for /peminjaman/new', () => {
    expect(resolveBreadcrumbKeys('/peminjaman/new')).toEqual([
      'common:menu.peminjaman',
      'peminjaman:breadcrumb.new',
    ]);
  });

  it('appends a sub-route crumb for /anggota/cetak-kta', () => {
    expect(resolveBreadcrumbKeys('/anggota/cetak-kta')).toEqual([
      'common:menu.anggota',
      'anggota:breadcrumb.cetakKta',
    ]);
  });

  it('appends laporan tab crumbs for /laporan/grafik etc.', () => {
    expect(resolveBreadcrumbKeys('/laporan/grafik')).toEqual([
      'common:menu.laporan',
      'laporan:nav.grafik',
    ]);
    expect(resolveBreadcrumbKeys('/laporan/top-peminjam')).toEqual([
      'common:menu.laporan',
      'laporan:nav.topPeminjam',
    ]);
    expect(resolveBreadcrumbKeys('/laporan/top-buku')).toEqual([
      'common:menu.laporan',
      'laporan:nav.topBuku',
    ]);
    expect(resolveBreadcrumbKeys('/laporan/kas')).toEqual([
      'common:menu.laporan',
      'laporan:nav.kas',
    ]);
    expect(resolveBreadcrumbKeys('/laporan/backup')).toEqual([
      'common:menu.laporan',
      'laporan:nav.backup',
    ]);
  });

  it('treats numeric anggota detail routes as edit', () => {
    expect(resolveBreadcrumbKeys('/anggota/42')).toEqual([
      'common:menu.anggota',
      'anggota:breadcrumb.edit',
    ]);
  });

  it('treats numeric buku detail routes as edit', () => {
    expect(resolveBreadcrumbKeys('/buku/123')).toEqual([
      'common:menu.buku',
      'buku:breadcrumb.edit',
    ]);
  });

  it('treats numeric peminjaman detail routes as detail', () => {
    expect(resolveBreadcrumbKeys('/peminjaman/9')).toEqual([
      'common:menu.peminjaman',
      'peminjaman:breadcrumb.detail',
    ]);
  });

  it('falls back to the raw segment for unknown sub-routes', () => {
    // Surfaces the segment instead of regressing back to "Dashboard" so the
    // breadcrumb is still informative.
    expect(resolveBreadcrumbKeys('/buku/unknown-action')).toEqual([
      'common:menu.buku',
      'unknown-action',
    ]);
  });

  it('falls back to dashboard for unknown top-level routes', () => {
    expect(resolveBreadcrumbKeys('/totally-unknown')).toEqual(['common:menu.dashboard']);
  });

  it('never returns a label key prefix that the previous implementation would have hit', () => {
    // Regression guard: every sub-route MUST produce more than one crumb when
    // it has a known section. Catches a future regression to the old "exact
    // match only" behaviour where /anggota/new collapsed to ['…dashboard'].
    const subRoutes = [
      '/anggota/new',
      '/anggota/cetak-kta',
      '/buku/new',
      '/peminjaman/new',
      '/laporan/grafik',
      '/laporan/top-peminjam',
      '/laporan/kas',
    ];
    for (const route of subRoutes) {
      const crumbs = resolveBreadcrumbKeys(route);
      expect(crumbs.length, `expected >1 crumb for ${route}`).toBeGreaterThan(1);
      expect(crumbs[0], `expected section crumb for ${route}`).not.toBe(
        'common:menu.dashboard',
      );
    }
  });
});
