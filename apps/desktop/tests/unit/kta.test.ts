import { afterEach, describe, expect, it } from 'vitest';
import {
  buildQrPayload,
  defaultLayout,
  ktaApi,
  parseLayout,
  parseQrPayload,
} from '@/lib/kta';

afterEach(() => {
  localStorage.removeItem('po:kta:templates');
});

describe('parseQrPayload', () => {
  it('parses member:<id> payload', () => {
    expect(parseQrPayload('member:42')).toBe(42);
    expect(parseQrPayload('MEMBER:7')).toBe(7);
  });
  it('falls back to plain numeric id', () => {
    expect(parseQrPayload('123')).toBe(123);
  });
  it('returns null for unsupported payload', () => {
    expect(parseQrPayload('hello')).toBeNull();
    expect(parseQrPayload('https://example.com/m/1')).toBeNull();
  });
});

describe('buildQrPayload', () => {
  it('formats member:<id>', () => {
    expect(buildQrPayload(99)).toBe('member:99');
  });
  it('roundtrips with parseQrPayload', () => {
    expect(parseQrPayload(buildQrPayload(11))).toBe(11);
  });
});

describe('defaultLayout', () => {
  it('returns ID-1 size with required field kinds', () => {
    const l = defaultLayout();
    expect(l.widthMm).toBeCloseTo(85.6);
    expect(l.heightMm).toBeCloseTo(53.98);
    const kinds = l.fields.map((f) => f.kind);
    expect(kinds).toContain('foto');
    expect(kinds).toContain('qr');
    expect(kinds).toContain('nama');
    expect(kinds).toContain('kodeAnggota');
  });
});

describe('parseLayout', () => {
  it('returns default when JSON is invalid', () => {
    expect(parseLayout('not-json').widthMm).toBeCloseTo(85.6);
  });
  it('returns default when fields missing', () => {
    expect(parseLayout('{}').widthMm).toBeCloseTo(85.6);
  });
  it('preserves valid layout', () => {
    const layout = defaultLayout();
    layout.widthMm = 90;
    const back = parseLayout(JSON.stringify(layout));
    expect(back.widthMm).toBe(90);
    expect(back.fields.length).toBe(layout.fields.length);
  });
});

describe('ktaApi (browser mock)', () => {
  it('seeds a default template on first list', async () => {
    const list = await ktaApi.list();
    expect(list.length).toBe(1);
    expect(list[0]!.isDefault).toBe(true);
  });

  it('create + list reflects new entry', async () => {
    await ktaApi.list();
    const created = await ktaApi.create({
      nama: 'Custom',
      layoutJson: JSON.stringify(defaultLayout()),
    });
    expect(created.nama).toBe('Custom');
    const list = await ktaApi.list();
    expect(list.find((t) => t.id === created.id)).toBeTruthy();
  });

  it('setDefault swaps default flag', async () => {
    await ktaApi.list();
    const created = await ktaApi.create({
      nama: 'Other',
      layoutJson: JSON.stringify(defaultLayout()),
    });
    expect(created.isDefault).toBe(false);
    await ktaApi.setDefault(created.id);
    const list = await ktaApi.list();
    const defaults = list.filter((t) => t.isDefault);
    expect(defaults.length).toBe(1);
    expect(defaults[0]!.id).toBe(created.id);
  });

  it('delete removes entry', async () => {
    await ktaApi.list();
    const created = await ktaApi.create({
      nama: 'ToDelete',
      layoutJson: JSON.stringify(defaultLayout()),
    });
    await ktaApi.delete(created.id);
    const list = await ktaApi.list();
    expect(list.find((t) => t.id === created.id)).toBeUndefined();
  });
});
