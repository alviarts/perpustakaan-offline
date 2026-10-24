import { BUKTI_WAJIB, getJenjang, type Instrumen } from '@perpustakaan/shared';
import type {
  AkreditasiBuktiRow,
  AkreditasiManual,
  AkreditasiProfil,
  ButirJawaban,
} from '@/lib/akreditasi';
import type { HasilSkor } from './skor';
import { butirKey, toJawabanMap } from './skor';
import type { LaporanIdentitas, LaporanTtd } from '@/features/laporan/utils';

export interface BukuBuktiContext {
  identitas: LaporanIdentitas;
  ttd: LaporanTtd;
  profil: AkreditasiProfil;
  manual: AkreditasiManual;
  bukti: AkreditasiBuktiRow[];
  butir: ButirJawaban[];
  instrumen: Instrumen;
  hasil: HasilSkor;
}

const esc = (v: string | number | null | undefined): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Full "Buku Bukti" document HTML: kop + profil + skor + butir + bukti + ttd. */
export function buildBukuBuktiHtml(ctx: BukuBuktiContext): string {
  const { identitas, ttd, profil, manual, bukti, butir, instrumen, hasil } = ctx;
  const jenjang = getJenjang(profil.jenjang);
  const jw = toJawabanMap(butir);
  const catatanMap = new Map(butir.map((b) => [butirKey(b.komponen, b.butir), b.catatan]));
  const buktiMap = new Map(bukti.map((b) => [b.kode, b]));

  const subLine = [
    identitas.npsn ? `NPSN: ${identitas.npsn}` : '',
    profil.npp ? `NPP: ${profil.npp}` : '',
    identitas.kontak ?? '',
  ].filter(Boolean);

  const komponenRows = hasil.komponen
    .map(
      (k) =>
        `<tr><td>${esc(`${k.no}. ${k.judul}`)}</td><td class="num">${k.skor}/${k.skorMaks}</td><td class="num">${k.bobot}</td><td class="num">${k.nilai.toFixed(2)}</td><td class="num">${k.answered}/${k.total}</td></tr>`,
    )
    .join('');

  const butirSections = instrumen.komponen
    .map((k) => {
      const rows = instrumen.butir
        .filter((b) => b.komponen === k.no)
        .map((b) => {
          const j = jw.get(butirKey(b.komponen, b.no)) ?? '';
          const skor = j ? b.opsi[j as 'a' | 'b' | 'c' | 'd']?.skor ?? 0 : 0;
          const cat = catatanMap.get(butirKey(b.komponen, b.no)) ?? '';
          return `<tr><td class="num">${b.no}</td><td>${esc(b.teks)}</td><td class="num">${esc(j.toUpperCase() || '-')}</td><td class="num">${skor}</td><td class="num">${esc(cat)}</td></tr>`;
        })
        .join('');
      return `<h3>${esc(`${k.no}. ${k.judul}`)}</h3>
        <table><thead><tr><th>#</th><th>Butir</th><th>Jwb</th><th>Skor</th><th>Catatan</th></tr></thead><tbody>${rows}</tbody></table>`;
    })
    .join('');

  const buktiRows = BUKTI_WAJIB.map((b) => {
    const row = buktiMap.get(b.kode);
    const status = row?.ada ? 'Ada' : 'Belum';
    const fileName = row?.filePath ? row.filePath.split('/').pop() : '';
    return `<tr><td>${esc(b.label)}${b.wajib ? ' *' : ''}</td><td>${esc(status)}</td><td>${esc(row?.catatan ?? '')}</td><td>${esc(fileName ?? '')}</td></tr>`;
  }).join('');

  const tenagaTotal = manual.tenagaPustakawan + manual.jumlahGuru + manual.jumlahTendik;

  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8"/>
<title>Buku Bukti Akreditasi</title>
<style>
  body { font-family: 'Inter', system-ui, sans-serif; padding: 24px; color: #111; font-size: 12px; }
  .kop { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 8px; }
  .kop-text { flex: 1; text-align: center; }
  .kop-nama { font-size: 18px; font-weight: 700; text-transform: uppercase; }
  .kop-sub { font-size: 11px; color: #555; }
  h2 { font-size: 15px; margin: 20px 0 8px; }
  h3 { font-size: 13px; margin: 16px 0 6px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #f0f0f0; }
  .num { text-align: right; white-space: nowrap; }
  .kv { display: flex; flex-wrap: wrap; gap: 8px 24px; margin: 6px 0; }
  .ttd { margin-top: 40px; margin-left: auto; width: 260px; text-align: left; }
  .ttd-space { height: 56px; }
  .ttd-nama { font-weight: 700; text-decoration: underline; }
  footer { margin-top: 24px; font-size: 10px; color: #777; text-align: right; }
  @media print { body { padding: 12mm; } }
</style></head><body>
  <div class="kop">
    <div class="kop-text">
      <div class="kop-nama">${esc(identitas.nama ?? 'Perpustakaan')}</div>
      <div>${esc(identitas.alamat ?? '')}</div>
      <div class="kop-sub">${esc(subLine.join('  |  '))}</div>
    </div>
  </div>
  <h2>Buku Bukti Akreditasi Perpustakaan</h2>
  <div class="kv">
    <span><strong>Jenjang:</strong> ${esc(jenjang?.label ?? profil.jenjang)}</span>
    <span><strong>Standar:</strong> ${esc(jenjang?.standarRef ?? '')}</span>
    <span><strong>Instrumen:</strong> ${esc(jenjang?.keputusanRef ?? '')}</span>
  </div>
  <div class="kv">
    <span><strong>Nilai Proyeksi:</strong> ${hasil.nilai.toFixed(2)} (${esc(hasil.predikat)})</span>
    <span><strong>Terjawab:</strong> ${hasil.answered}/${hasil.total}</span>
    <span><strong>SK Pendirian:</strong> ${esc(profil.skPendirian || '-')}</span>
  </div>

  <h2>A. Rekapitulasi Skor per Komponen</h2>
  <table><thead><tr><th>Komponen</th><th class="num">Skor</th><th class="num">Bobot</th><th class="num">Nilai</th><th class="num">Terjawab</th></tr></thead><tbody>${komponenRows}</tbody>
  <tfoot><tr><td colspan="3"><strong>Nilai akhir</strong></td><td class="num"><strong>${hasil.nilai.toFixed(2)}</strong></td><td></td></tr></tfoot></table>

  <h2>B. Data Pendukung</h2>
  <div class="kv">
    <span><strong>Total tenaga:</strong> ${tenagaTotal}</span>
    <span><strong>Komputer:</strong> ${manual.jumlahKomputer}</span>
    <span><strong>Luas ruang:</strong> ${manual.luasRuang || 0} m²</span>
  </div>

  <h2>C. Bukti Fisik</h2>
  <table><thead><tr><th>Dokumen</th><th>Status</th><th>Catatan</th><th>Berkas</th></tr></thead><tbody>${buktiRows}</tbody></table>

  <h2>D. Butir Penilaian</h2>
  ${butirSections}

  <div class="ttd">
    <div>${esc(ttd.tempatTanggal ?? '')}</div>
    <div><strong>${esc(ttd.jabatan ?? 'Kepala Sekolah')}</strong></div>
    <div class="ttd-space"></div>
    <div class="ttd-nama">${esc(ttd.nama ?? '....................')}</div>
    ${ttd.nip ? `<div>NIP. ${esc(ttd.nip)}</div>` : ''}
  </div>
  <footer>Dicetak pada ${new Date().toLocaleString('id-ID')}</footer>
</body></html>`;
}

/** JSON snapshot stored in `laporan_arsip.konten_json` for later re-printing. */
export function buildBukuBuktiSnapshot(ctx: BukuBuktiContext): string {
  return JSON.stringify({
    version: 1,
    jenis: 'buku-bukti',
    jenjang: ctx.profil.jenjang,
    nilai: ctx.hasil.nilai,
    predikat: ctx.hasil.predikat,
    answered: ctx.hasil.answered,
    total: ctx.hasil.total,
    html: buildBukuBuktiHtml(ctx),
  });
}
