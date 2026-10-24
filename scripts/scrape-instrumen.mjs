#!/usr/bin/env node
/**
 * Scrape the FPPTI Jateng accreditation *simulator* pages into a structured
 * butir catalog for the Akreditasi module.
 *
 * Source (community tooling, content mirrors the Perpusnas instruments):
 *   https://akreditasi.fppti-jateng.or.id/simulator/<slug>.php
 *
 * Output: packages/shared/src/akreditasi/instrumen.json
 *   { "<jenjangId>": { komponen: [...], butir: [...] } }
 *
 * Run: node scripts/scrape-instrumen.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const BASE = 'https://akreditasi.fppti-jateng.or.id/simulator';

// jenjangId -> simulator slug
const TARGETS = {
  PAUD: 'sekolah-paud',
  SD: 'sekolah-sd',
  SMP: 'sekolah-smp',
  SMA: 'sekolah-sma',
  SLB: 'sekolah-slb',
  PT_UNIV: 'pt-universitas',
  PT_IST: 'pt-institut-st-politeknik',
  PT_AKA: 'pt-akademi',
  UMUM_PROV: 'umum-provinsi',
  UMUM_KAB: 'umum-kabkota',
  UMUM_KEC: 'umum-kecamatan',
  UMUM_DESA: 'umum-desa',
  KHUSUS_PEM: 'khusus-pemerintah',
  KHUSUS_NON: 'khusus-nonpemerintah',
  KHUSUS_IBADAH: 'khusus-rumah-ibadah',
};

const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
  '&apos;': "'", '&nbsp;': ' ', '&ndash;': '–', '&mdash;': '—',
  '&laquo;': '«', '&raquo;': '»', '&deg;': '°', '&times;': '×',
};

function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
}

function clean(html) {
  return decode(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parsePage(html) {
  // Two known templates:
  //   A) "<h3>Komponen N: Title</h3>" + "Indikator N:" + "<div class=bab-info>"
  //   B) "<h3>BAB N: TITLE</h3>"      + "Soal N:"      + "<div class=bab-info>"
  // Komponen titles appear in document order; the komponen *number* is taken
  // from the soal id ("soal-<komponen>-<butir>") so the pairing is robust.

  const titles = [];
  const h3Re = /<h3[^>]*>([\s\S]*?)<\/h3>/g;
  let hm;
  while ((hm = h3Re.exec(html))) {
    const text = clean(hm[1]);
    if (/(?:BAB|Komponen)\s*\d+/i.test(text)) {
      const title = text.includes(':') ? text.slice(text.indexOf(':') + 1).trim() : text;
      titles.push(title);
    }
  }

  const infos = [];
  const infoRe = /<div class="bab-info">([\s\S]*?)<\/div>/g;
  let im;
  while ((im = infoRe.exec(html))) {
    const info = clean(im[1]);
    const butirMatch = info.match(/(\d+)\s*(?:Indikator|Soal)/i);
    const skorMatch = info.match(/Skor Maks(?:imum)?:\s*(\d+)/i);
    const bobotMatch = info.match(/Bobot:\s*(\d+)/i);
    infos.push({
      butir: butirMatch ? Number(butirMatch[1]) : 0,
      skorMaks: skorMatch ? Number(skorMatch[1]) : 0,
      bobot: bobotMatch ? Number(bobotMatch[1]) : 0,
    });
  }

  const butir = [];
  const chunks = html.split('<div class="soal"').slice(1);
  for (const chunk of chunks) {
    const idMatch = chunk.match(/^[^>]*id="soal-(\d+)-(\d+)"/);
    if (!idMatch) continue;
    const komponenNo = Number(idMatch[1]);
    const no = Number(idMatch[2]);

    const sm = chunk.match(/<div class="soal-text">([\s\S]*?)<\/div>/);
    // Strip the leading label ("Indikator 1:", "Soal 1:", "IK 1:", "1.1:", …).
    const text = sm
      ? clean(sm[1]).replace(
          /^\s*(?:Indikator|Soal|IK|Butir)?\s*\d+(?:\.\d+)?\s*:\s*/i,
          '',
        )
      : '';

    // Bukti fisik: the second inner div inside `.tooltip-bukti` (the first is
    // the title). Works across the two templates (class- vs style-based).
    const buktiMatch = chunk.match(
      /<div class="tooltip-bukti"[^>]*>[\s\S]*?<\/div>\s*<div[^>]*>([\s\S]*?)<\/div>/,
    );
    const bukti = buktiMatch ? clean(buktiMatch[1]) : '';

    const opsi = {};
    const oRe = /<strong>([A-D])\s*\(Skor\s*(\d)\):\s*([^<]*)<\/strong><br>\s*<small>([\s\S]*?)<\/small>/g;
    let om;
    while ((om = oRe.exec(chunk))) {
      opsi[om[1].toLowerCase()] = {
        skor: Number(om[2]),
        label: clean(om[3]),
        kriteria: clean(om[4]),
      };
    }

    butir.push({ komponen: komponenNo, no, teks: text, bukti, opsi });
  }

  const numbers = [...new Set(butir.map((b) => b.komponen))].sort((a, b) => a - b);
  const komponen = numbers.map((no, i) => ({
    no,
    judul: titles[i] ?? '',
    butir: infos[i]?.butir ?? butir.filter((b) => b.komponen === no).length,
    skorMaks: infos[i]?.skorMaks ?? 0,
    bobot: infos[i]?.bobot ?? 0,
  }));

  return { komponen, butir };
}

async function main() {
  const out = {};
  for (const [id, slug] of Object.entries(TARGETS)) {
    const url = `${BASE}/${slug}.php`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`[skip] ${id} ${slug}: HTTP ${res.status}`);
        continue;
      }
      const html = await res.text();
      const parsed = parsePage(html);
      if (parsed.butir.length === 0) {
        console.warn(`[skip] ${id}: parsed 0 butir`);
        continue;
      }
      out[id] = parsed;
      console.log(`[ok] ${id.padEnd(12)} komponen=${parsed.komponen.length} butir=${parsed.butir.length}`);
    } catch (err) {
      console.warn(`[err] ${id} ${slug}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  const destDir = resolve(root, 'packages/shared/src/akreditasi');
  mkdirSync(destDir, { recursive: true });
  const dest = resolve(destDir, 'instrumen.json');
  writeFileSync(dest, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`\nWrote ${dest}`);
}

main();
