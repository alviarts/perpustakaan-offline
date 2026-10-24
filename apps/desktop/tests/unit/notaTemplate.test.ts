import { describe, expect, it } from 'vitest';
import { DEFAULT_NOTA_TEMPLATE, buildNotaHtml, type NotaInput } from '@/lib/pdf/nota';

const input: NotaInput = {
  nomor: 'PJ-20261024-0001',
  anggotaNama: 'Budi <Santoso>',
  anggotaKode: 'A0001',
  tanggalPinjam: '2026-10-24',
  tanggalJatuhTempo: '2026-10-31',
  items: [
    { judul: 'Laskar Pelangi', kode: '813-HIR-L-01-0', eksemplarKode: '813-HIR-L-01-0-01' },
    { judul: 'Bumi Manusia', kode: '899-TOE-B-01-0' },
  ],
  totalDenda: 1500,
  totalPoin: 0,
  identitas: { nama: 'Perpustakaan Nusantara', alamat: 'Jl. Merdeka 1' },
};

describe('buildNotaHtml', () => {
  it('renders a single nota with escaped content', () => {
    const html = buildNotaHtml(input);
    expect(html).toContain('PJ-20261024-0001');
    expect(html).toContain('Laskar Pelangi');
    expect(html).toContain('Budi &lt;Santoso&gt;');
    expect(html).toContain('Perpustakaan Nusantara');
    expect(html).toContain('Rp 1.500');
    expect(html).toContain('@page { size: A4');
  });

  it('renders multiple nota for bulk printing', () => {
    const html = buildNotaHtml([input, { ...input, nomor: 'PJ-2' }]);
    const count = (html.match(/class="nota"/g) ?? []).length;
    expect(count).toBe(2);
    expect(html).toContain('PJ-2');
  });

  it('respects template options (paper, heading, footer, signature)', () => {
    const html = buildNotaHtml([input, input], {
      paper: 'a5',
      perPage: 4,
      heading: 'Bukti Pinjam',
      footer: '',
      showAlamat: false,
      showEksemplar: true,
      showDenda: false,
      showTandaTangan: false,
    });
    expect(html).toContain('size: A5');
    expect(html).toContain('grid-template-columns: repeat(2, 1fr)');
    expect(html).toContain('Bukti Pinjam');
    expect(html).not.toContain('Jl. Merdeka 1');
    expect(html).toContain('Eksemplar');
    expect(html).not.toContain('Rp 1.500');
    expect(html).not.toContain('Peminjam</span>');
  });

  it('thermal paper forces single-column', () => {
    const html = buildNotaHtml([input, input], { paper: 'thermal80' });
    expect(html).toContain('80mm');
    expect(html).toContain('grid-template-columns: repeat(1, 1fr)');
  });

  it('has sensible defaults', () => {
    expect(DEFAULT_NOTA_TEMPLATE.paper).toBe('a4');
    expect(DEFAULT_NOTA_TEMPLATE.perPage).toBe(1);
    expect(DEFAULT_NOTA_TEMPLATE.showDenda).toBe(true);
  });
});
