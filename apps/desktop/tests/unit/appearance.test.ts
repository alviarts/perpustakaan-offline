import { beforeEach, describe, expect, it } from 'vitest';
import { ACCENTS, LAYOUTS, applyAppearance, isAccentColor, isAppLayout } from '@/lib/appearance';
import { DEFAULT_DISPLAY_PREFS } from '@/lib/settings';

describe('appearance metadata', () => {
  it('exposes exactly 3 layouts and 5 accent colors', () => {
    expect(LAYOUTS).toHaveLength(3);
    expect(ACCENTS).toHaveLength(5);
    expect(new Set(LAYOUTS.map((l) => l.id)).size).toBe(3);
    expect(new Set(ACCENTS.map((a) => a.id)).size).toBe(5);
  });

  it('guards layout/accent values', () => {
    expect(isAppLayout('klasik')).toBe(true);
    expect(isAppLayout('ringkas')).toBe(true);
    expect(isAppLayout('modern')).toBe(true);
    expect(isAppLayout('lainnya')).toBe(false);
    expect(isAccentColor('biru')).toBe(true);
    expect(isAccentColor('mawar')).toBe(true);
    expect(isAccentColor('hitam')).toBe(false);
  });

  it('defaults include layout klasik + accent biru', () => {
    expect(DEFAULT_DISPLAY_PREFS.layout).toBe('klasik');
    expect(DEFAULT_DISPLAY_PREFS.accent).toBe('biru');
  });
});

describe('applyAppearance', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-layout');
    document.documentElement.removeAttribute('data-accent');
    document.documentElement.removeAttribute('data-density');
    document.documentElement.style.fontSize = '';
  });

  it('applies layout/accent/density/fontScale to the root element', () => {
    applyAppearance({
      fontScale: 1.1,
      density: 'compact',
      layout: 'modern',
      accent: 'ungu',
    });
    const root = document.documentElement;
    expect(root.dataset.layout).toBe('modern');
    expect(root.dataset.accent).toBe('ungu');
    expect(root.dataset.density).toBe('compact');
    expect(parseFloat(root.style.fontSize)).toBeCloseTo(110, 5);
    expect(root.style.getPropertyValue('--app-font-scale')).toBe('1.1');
  });
});
