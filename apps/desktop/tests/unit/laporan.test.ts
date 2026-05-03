import { describe, expect, it } from 'vitest';
import { csvCell, describeCron, laporanApi, toCsv } from '@/lib/laporan';

describe('csvCell', () => {
  it('returns plain string for safe values', () => {
    expect(csvCell('Adelia')).toBe('Adelia');
    expect(csvCell(42)).toBe('42');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('quotes and escapes when value has comma, quote, or newline', () => {
    expect(csvCell('Hello, world')).toBe('"Hello, world"');
    expect(csvCell('She said "hi"')).toBe('"She said ""hi"""');
    expect(csvCell('multi\nline')).toBe('"multi\nline"');
  });
});

describe('toCsv', () => {
  it('builds header + rows joined by newline', () => {
    const csv = toCsv(
      ['kode', 'judul', 'jumlah'],
      [
        ['B001', 'Bumi Manusia', 21],
        ['B002', 'Laskar, Pelangi', 17],
      ],
    );
    expect(csv).toBe('kode,judul,jumlah\nB001,Bumi Manusia,21\nB002,"Laskar, Pelangi",17');
  });
});

describe('describeCron', () => {
  it('describes daily schedule with HH:MM', () => {
    expect(describeCron('0 2 * * *')).toBe('Setiap hari pukul 02:00');
    expect(describeCron('30 14 * * *')).toBe('Setiap hari pukul 14:30');
  });

  it('describes weekly schedule with day name', () => {
    expect(describeCron('0 9 * * 1')).toBe('Setiap Senin pukul 09:00');
    expect(describeCron('15 7 * * 5')).toBe('Setiap Jumat pukul 07:15');
  });

  it('returns generic format for unsupported expressions', () => {
    expect(describeCron('*/15 * * * *')).toMatch(/Cron:/);
    expect(describeCron('not-a-cron')).toMatch(/tidak valid/);
  });
});

describe('laporanApi (browser mock)', () => {
  it('grafik returns inclusive day range', async () => {
    const days = await laporanApi.grafik('2025-01-01', '2025-01-07', 'day');
    expect(days.length).toBe(7);
    expect(days[0]!.bucket).toBe('2025-01-01');
    expect(days[days.length - 1]!.bucket).toBe('2025-01-07');
  });

  it('grafik returns monthly buckets when granularity=month', async () => {
    const months = await laporanApi.grafik('2025-01-01', '2025-03-15', 'month');
    expect(months.length).toBe(3);
    expect(months[0]!.bucket).toBe('2025-01');
    expect(months[2]!.bucket).toBe('2025-03');
  });

  it('topPeminjam respects limit and is sorted DESC', async () => {
    const rows = await laporanApi.topPeminjam('2025-01-01', '2025-12-31', 5);
    expect(rows.length).toBe(5);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1]!.jumlahPinjam).toBeGreaterThanOrEqual(rows[i]!.jumlahPinjam);
    }
  });

  it('kas summary saldoAkhir = totalMasuk - totalKeluar', async () => {
    const k = await laporanApi.kas('2025-01-01', '2025-12-31');
    expect(k.saldoAkhir).toBe(k.totalMasuk - k.totalKeluar);
    expect(k.fromManual + k.fromDenda + k.fromHilang + k.fromModal).toBe(k.totalMasuk);
  });

  it('kas cumulative ends at saldoAkhir', async () => {
    const k = await laporanApi.kas('2025-01-01', '2025-12-31');
    expect(k.cumulative.length).toBeGreaterThan(0);
    expect(k.cumulative[k.cumulative.length - 1]!.saldo).toBe(k.saldoAkhir);
  });

  it('backupScheduleSet preserves cron and enabled', async () => {
    const s = await laporanApi.backupScheduleSet(true, '0 3 * * *');
    expect(s.enabled).toBe(true);
    expect(s.cron).toBe('0 3 * * *');
  });
});
