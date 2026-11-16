import type { AccentColor, AppLayout, DisplayPrefs } from '@/lib/settings';

/**
 * Metadata tampilan (layout & warna aksen) untuk onboarding awal dan
 * Settings → Tampilan. Nilai diterapkan lewat data-attribute di `<html>`
 * (`data-layout`, `data-accent`) dan dipetakan ke CSS di globals.css —
 * tidak menyentuh logika JS lain.
 */

export interface LayoutOption {
  id: AppLayout;
  label: string;
  description: string;
}

export const LAYOUTS: LayoutOption[] = [
  {
    id: 'klasik',
    label: 'Klasik',
    description: 'Sidebar lebar dengan label, seperti tampilan bawaan.',
  },
  {
    id: 'ringkas',
    label: 'Ringkas',
    description: 'Sidebar mengecil otomatis (ikon saja), menghemat ruang.',
  },
  {
    id: 'modern',
    label: 'Modern',
    description: 'Sidebar dengan gaya pill aktif & ikon lebih menonjol.',
  },
];

export interface AccentOption {
  id: AccentColor;
  label: string;
  /** Kelas tailwind untuk swatch (warna solid, tanpa dependensi CSS var). */
  swatch: string;
}

export const ACCENTS: AccentOption[] = [
  { id: 'biru', label: 'Biru', swatch: 'bg-blue-600' },
  { id: 'hijau', label: 'Hijau', swatch: 'bg-emerald-600' },
  { id: 'ungu', label: 'Ungu', swatch: 'bg-violet-600' },
  { id: 'oranye', label: 'Oranye', swatch: 'bg-orange-500' },
  { id: 'mawar', label: 'Mawar', swatch: 'bg-rose-500' },
];

export function isAppLayout(value: unknown): value is AppLayout {
  return LAYOUTS.some((l) => l.id === value);
}

export function isAccentColor(value: unknown): value is AccentColor {
  return ACCENTS.some((a) => a.id === value);
}

/** Terapkan semua preferensi tampilan ke `<html>` (root elements). */
export function applyAppearance(prefs: DisplayPrefs, emitEvent = true): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--app-font-scale', String(prefs.fontScale));
  root.style.fontSize = `${prefs.fontScale * 100}%`;
  root.dataset.density = prefs.density;
  root.dataset.layout = prefs.layout;
  root.dataset.accent = prefs.accent;

  // Beri tahu shell (AppShell) bahwa preferensi berubah. Tanpa ini, state
  // `layout` di AppShell tidak ikut berubah saat pengguna mengganti layout
  // dari Settings → Tampilan, sehingga sidebar tidak menyesuaikan.
  const win = document.defaultView;
  if (win && emitEvent) {
    win.dispatchEvent(new CustomEvent('appearance-changed', { detail: prefs }));
  }
}

export const APPEARANCE_CHANGED_EVENT = 'appearance-changed';
