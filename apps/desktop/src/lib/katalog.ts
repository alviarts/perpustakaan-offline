import { hurufJudul, kodePengarang } from './labelBuku';

/**
 * Catalog-code generator (kode buku / call number, DDC, rak).
 *
 * Everything is derived from the book's own metadata plus what the library
 * already has in its database:
 *  - **DDC** is mapped onto an *existing* master DDC code (the `buku.kode_ddc`
 *    column has a FK to `ddc(kode)`, so we must never invent a code).
 *  - **Rak** is learned from existing books that share the same DDC code
 *    (then the same main class), falling back to `RAK <kelas>`.
 *  - **Call number** follows the common Indonesian school-library format
 *    `DDC KODEPENGARANG hurufJudul` (e.g. `813.5 HIR l`).
 *  - **Kode buku** mirrors the call number and is made unique against the
 *    existing collection (`kode_buku` is UNIQUE in SQLite).
 */

export interface DdcEntry {
  kode: string;
  nama: string;
}

export interface ExistingBook {
  kodeBuku: string;
  kodeDdc?: string | null;
  rak?: string | null;
  kategori?: string | null;
}

export interface CatalogInput {
  judul: string;
  pengarang: string;
  kategori?: string | null;
  /** Subject tags from the ISBN lookup (may be empty). */
  subjects?: string[];
  ddcList: DdcEntry[];
  existing: ExistingBook[];
  /** When editing, exclude the book's current kode from uniqueness checks. */
  excludeKodeBuku?: string | null;
}

export interface CatalogResult {
  kodeDdc: string;
  rak: string;
  callNumber: string;
  kodeBuku: string;
  /** Short explanation for the UI. */
  reason: string;
}

interface KeywordRule {
  re: RegExp;
  cls: string;
  label: string;
  /** More specific DDC prefix to prefer (e.g. 741 for illustration). */
  prefer?: string;
}

/** Keyword → DDC class (Indonesian + English terms). Order matters: the more
 *  specific rules must come before the generic "seni" one. */
const KEYWORD_RULES: readonly KeywordRule[] = [
  { re: /ilustrasi|illustration|ilustrator|illustrator/i, cls: '700', label: 'ilustrasi', prefer: '741' },
  { re: /komik|kartun|karikatur|manga|comic|cartoon/i, cls: '700', label: 'komik/kartun', prefer: '741.5' },
  {
    re: /desain grafis|graphic design|poster|seni grafis|ilustrasi buku/i,
    cls: '700',
    label: 'desain grafis',
    prefer: '741.6',
  },
  { re: /menggambar|drawing/i, cls: '700', label: 'menggambar', prefer: '741' },
  { re: /fotografi|photograph/i, cls: '700', label: 'fotografi', prefer: '770' },
  { re: /musik|music/i, cls: '700', label: 'musik', prefer: '780' },
  { re: /olahraga|sport|atletik|athletic/i, cls: '700', label: 'olahraga', prefer: '796' },
  { re: /fiksi|novel|cerpen|cerita|sastra|fiction/i, cls: '800', label: 'fiksi/sastra' },
  { re: /agama|islam|quran|qur'an|hadis|fikih|tauhid|teologi|religion/i, cls: '200', label: 'agama' },
  { re: /filsafat|psikolog|philosoph|psycholog/i, cls: '100', label: 'filsafat/psikologi' },
  {
    re: /sosial|ekonomi|hukum|politik|pendidikan|masyarakat|society|social|econom|law|politic|education/i,
    cls: '300',
    label: 'ilmu sosial',
  },
  { re: /bahasa|linguistik|language|english|grammar|kamus/i, cls: '400', label: 'bahasa' },
  {
    re: /sains|fisika|kimia|biologi|matematika|science|physic|chemistr|biolog|math/i,
    cls: '500',
    label: 'sains',
  },
  {
    re: /komputer|pemrograman|programming|computer|kedokteran|medis|pertanian|teknologi|teknik|engineering/i,
    cls: '600',
    label: 'teknologi',
  },
  { re: /seni|art|hiburan|rekreasi/i, cls: '700', label: 'seni' },
  { re: /sejarah|geografi|biografi|history|geograph|travel|wisata/i, cls: '900', label: 'sejarah/geografi' },
  { re: /referensi|umum|ensiklopedia|reference|general|karya umum/i, cls: '000', label: 'karya umum' },
];

function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** First three digits of a DDC code (e.g. "813.5" → "813", "2X3.8" → "2X3"). */
export function mainClass(kodeDdc: string | null | undefined): string {
  const k = (kodeDdc ?? '').trim();
  const digits = k.match(/\d{3}/);
  if (digits) return digits[0];
  return k.slice(0, 3);
}

function keywordClass(text: string): KeywordRule | null {
  for (const rule of KEYWORD_RULES) {
    if (rule.re.test(text)) return rule;
  }
  return null;
}

/** Score how well a DDC row matches the book; higher is better. */
function scoreDdc(entry: DdcEntry, blob: string, hint: KeywordRule | null): number {
  let score = 0;
  const words = norm(entry.nama)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4);
  let hits = 0;
  for (const w of words) {
    if (blob.includes(w)) hits += 1;
  }
  score += hits * 6;
  // Prefer more specific subdivisions (741.4) over their parents (741/700).
  if (hits > 0) {
    const digits = entry.kode.replace(/[^0-9]/g, '').length;
    score += Math.max(0, digits - 3) * 1.5;
  }
  const cls = mainClass(entry.kode);
  if (hint) {
    if (cls === hint.cls) score += 5;
    if (hint.prefer && entry.kode.startsWith(hint.prefer)) score += 7;
  }
  if (blob.includes(norm(entry.kode))) score += 3;
  // Indonesian fiction/sastra is conventionally shelved at 813 ("Sastra
  // Indonesia") rather than the generic 800, so prefer that subdivision.
  if (
    /(fiksi|sastra|novel|cerita|cerpen|fiction)/.test(blob) &&
    /indonesia/.test(norm(entry.nama))
  ) {
    score += 8;
  }
  score += entry.kode.length * 0.01;
  return score;
}

function mostFrequent(values: string[]): string | null {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const v = raw.trim();
    if (!v || v === '-') continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

/** Learn a shelf location from existing books, then fall back to the class. */
function pickRak(kodeDdc: string, existing: ExistingBook[]): { rak: string; learned: boolean } {
  const cls = mainClass(kodeDdc);

  const exact = mostFrequent(
    existing.filter((b) => (b.kodeDdc ?? '').trim() === kodeDdc).map((b) => b.rak ?? ''),
  );
  if (exact) return { rak: exact, learned: true };

  const byClass = mostFrequent(
    existing.filter((b) => mainClass(b.kodeDdc) === cls).map((b) => b.rak ?? ''),
  );
  if (byClass) return { rak: byClass, learned: true };

  return { rak: cls ? `RAK ${cls}` : 'RAK 000', learned: false };
}

/** Append " 2", " 3", … until the code is unique. */
function uniqueKode(base: string, existing: ExistingBook[], exclude?: string | null): string {
  const taken = new Set(
    existing
      .map((b) => norm(b.kodeBuku))
      .filter((k) => k && k !== norm(exclude)),
  );
  if (!taken.has(norm(base))) return base;
  for (let i = 2; i <= 99; i += 1) {
    const candidate = `${base} ${i}`;
    if (!taken.has(norm(candidate))) return candidate;
  }
  return `${base} ${Date.now().toString().slice(-3)}`;
}

/**
 * Generate DDC, shelf location, call number and a unique book code.
 * Never returns a DDC code that is absent from `ddcList`.
 */
export function generateCatalog(input: CatalogInput): CatalogResult {
  const { judul, pengarang, kategori, subjects = [], ddcList, existing } = input;

  const blob = norm([kategori ?? '', subjects.join(' '), judul].filter(Boolean).join(' '));
  const hinted = keywordClass(blob);

  // Learn from the collection: if books with the same kategori already use a
  // DDC code, strongly prefer it so new books stay consistent.
  const learnedDdc = kategori
    ? mostFrequent(
        existing
          .filter((b) => norm(b.kategori) === norm(kategori))
          .map((b) => b.kodeDdc ?? ''),
      )
    : null;

  // Pick the best existing DDC entry.
  let chosen: DdcEntry | null = null;
  let bestScore = 0;
  for (const entry of ddcList) {
    let score = scoreDdc(entry, blob, hinted);
    if (learnedDdc && entry.kode === learnedDdc) score += 20;
    if (score > bestScore) {
      bestScore = score;
      chosen = entry;
    }
  }
  // Fallbacks: preferred subdivision, then main class, then "000"/first.
  if (!chosen && hinted) {
    chosen =
      (hinted.prefer
        ? ddcList.find((e) => e.kode.startsWith(hinted.prefer!))
        : undefined) ??
      ddcList.find((e) => mainClass(e.kode) === hinted.cls) ??
      null;
  }
  if (!chosen) {
    chosen = ddcList.find((e) => mainClass(e.kode) === '000') ?? ddcList[0] ?? null;
  }

  const kodeDdc = chosen?.kode ?? '';
  const { rak, learned } = pickRak(kodeDdc, existing);

  const callNumber = [kodeDdc || '000', kodePengarang(pengarang), hurufJudul(judul)]
    .filter(Boolean)
    .join(' ');
  const kodeBuku = uniqueKode(callNumber, existing, input.excludeKodeBuku);

  const reasonParts: string[] = [];
  if (chosen) {
    reasonParts.push(
      hinted && mainClass(chosen.kode) === hinted.cls
        ? `DDC ${chosen.kode} (${chosen.nama}) dari ${hinted.label}`
        : `DDC ${chosen.kode} (${chosen.nama})`,
    );
  } else {
    reasonParts.push('DDC belum tersedia di master');
  }
  reasonParts.push(learned ? `rak ${rak} dari data yang ada` : `rak ${rak} (default kelas)`);
  if (kodeBuku !== callNumber) reasonParts.push(`kode dibuat unik: ${kodeBuku}`);

  return { kodeDdc, rak, callNumber, kodeBuku, reason: reasonParts.join('; ') };
}
