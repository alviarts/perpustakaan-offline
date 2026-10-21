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
  /** Book language from the ISBN lookup / form (e.g. "id", "en", "Indonesia"). */
  language?: string | null;
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

/** Keyword → DDC class (Indonesian + English terms). Order matters: the most
 *  specific rules come first so they win over the generic ones. */
const KEYWORD_RULES: readonly KeywordRule[] = [
  // 000 — komputer, perpustakaan, media
  { re: /jaringan komputer|computer network|networking/i, cls: '000', label: 'jaringan komputer', prefer: '004.6' },
  { re: /internet|website|web|html|css/i, cls: '000', label: 'internet/web', prefer: '004.678' },
  { re: /basis data|database|sql/i, cls: '000', label: 'basis data', prefer: '005.74' },
  { re: /kecerdasan buatan|artificial intelligence|\bai\b|machine learning/i, cls: '000', label: 'kecerdasan buatan', prefer: '006.3' },
  { re: /multimedia|audio visual/i, cls: '000', label: 'multimedia', prefer: '006.7' },
  { re: /sistem operasi|operating system/i, cls: '000', label: 'sistem operasi', prefer: '005.4' },
  { re: /aplikasi|perangkat lunak|software/i, cls: '000', label: 'perangkat lunak', prefer: '005.3' },
  { re: /pemrograman|programming|coding|pemrogram/i, cls: '000', label: 'pemrograman', prefer: '005.1' },
  { re: /komputer|computer/i, cls: '000', label: 'komputer', prefer: '004' },
  { re: /perpustakaan|librar/i, cls: '000', label: 'perpustakaan', prefer: '020' },
  { re: /literasi|membaca|reading/i, cls: '000', label: 'literasi', prefer: '028' },
  { re: /ensiklopedia|encyclopedia/i, cls: '000', label: 'ensiklopedia', prefer: '030' },
  { re: /jurnalisme|jurnalistik|media|journalism/i, cls: '000', label: 'jurnalisme', prefer: '070' },
  { re: /organisasi|asosiasi|association/i, cls: '000', label: 'organisasi', prefer: '060' },

  // 100 — filsafat & psikologi
  { re: /psikologi perkembangan|developmental psycholog/i, cls: '100', label: 'psikologi perkembangan', prefer: '155' },
  { re: /kecerdasan|proses mental|mental process|cognitive/i, cls: '100', label: 'proses mental', prefer: '153' },
  { re: /psikologi terapan|applied psycholog/i, cls: '100', label: 'psikologi terapan', prefer: '158' },
  { re: /psikolog|psycholog/i, cls: '100', label: 'psikologi', prefer: '150' },
  { re: /logika|logic/i, cls: '100', label: 'logika', prefer: '160' },
  { re: /etika|ethics|moral/i, cls: '100', label: 'etika', prefer: '170' },
  { re: /metafisika|metaphysic/i, cls: '100', label: 'metafisika', prefer: '110' },
  { re: /epistemologi|epistemolog/i, cls: '100', label: 'epistemologi', prefer: '120' },
  { re: /filsafat|philosoph/i, cls: '100', label: 'filsafat', prefer: '100' },

  // 200 — agama
  { re: /qur'?an|al-?qur'?an|quran/i, cls: '200', label: 'Al-Qur\'an', prefer: '297.1' },
  { re: /hadis|hadith/i, cls: '200', label: 'hadis', prefer: '297.2' },
  { re: /tauhid|aqidah|akidah|creed/i, cls: '200', label: 'aqidah/tauhid', prefer: '297.3' },
  { re: /fikih|fiqh|syariah/i, cls: '200', label: 'fikih', prefer: '297.4' },
  { re: /akhlak|tasawuf|sufi/i, cls: '200', label: 'akhlak/tasawuf', prefer: '297.5' },
  { re: /dakwah|da'?wah/i, cls: '200', label: 'dakwah', prefer: '297.7' },
  { re: /alkitab|bibel|bible|kristen|christian/i, cls: '200', label: 'kristen', prefer: '220' },
  { re: /islam|muslim|religion|agama|teologi|theolog/i, cls: '200', label: 'agama', prefer: '200' },

  // 300 — ilmu sosial
  { re: /sosiologi|antropologi|sociolog|anthropolog/i, cls: '300', label: 'sosiologi', prefer: '301' },
  { re: /budaya|kebudayaan|culture|adat/i, cls: '300', label: 'budaya', prefer: '306' },
  { re: /statistik|statistic/i, cls: '300', label: 'statistik', prefer: '310' },
  { re: /politik|politic/i, cls: '300', label: 'politik', prefer: '320' },
  { re: /ekonomi|econom/i, cls: '300', label: 'ekonomi', prefer: '330' },
  { re: /hukum|law|legal/i, cls: '300', label: 'hukum', prefer: '340' },
  { re: /administrasi publik|public administration/i, cls: '300', label: 'administrasi publik', prefer: '350' },
  { re: /pendidikan|education/i, cls: '300', label: 'pendidikan', prefer: '370' },
  { re: /perdagangan|komunikasi|commerce|communication/i, cls: '300', label: 'perdagangan', prefer: '380' },
  { re: /folklor|cerita rakyat|folklore/i, cls: '300', label: 'folklor', prefer: '398' },
  { re: /sosial|masyarakat|society|social/i, cls: '300', label: 'ilmu sosial', prefer: '300' },

  // 400 — bahasa
  { re: /kamus|dictionary/i, cls: '400', label: 'kamus', prefer: '413' },
  { re: /tata bahasa|grammar/i, cls: '400', label: 'tata bahasa', prefer: '415' },
  { re: /linguistik|linguistic/i, cls: '400', label: 'linguistik', prefer: '410' },
  { re: /bahasa inggris|english/i, cls: '400', label: 'bahasa Inggris', prefer: '420' },
  { re: /bahasa jerman|german/i, cls: '400', label: 'bahasa Jerman', prefer: '430' },
  { re: /bahasa prancis|french/i, cls: '400', label: 'bahasa Prancis', prefer: '440' },
  { re: /bahasa|language/i, cls: '400', label: 'bahasa', prefer: '400' },

  // 500 — sains
  { re: /aljabar|algebra/i, cls: '500', label: 'aljabar', prefer: '512' },
  { re: /geometri|geometry/i, cls: '500', label: 'geometri', prefer: '516' },
  { re: /kalkulus|calculus|analisis matematika/i, cls: '500', label: 'kalkulus', prefer: '515' },
  { re: /probabilitas|probability/i, cls: '500', label: 'probabilitas', prefer: '519' },
  { re: /matematika|math/i, cls: '500', label: 'matematika', prefer: '510' },
  { re: /astronomi|astronomy/i, cls: '500', label: 'astronomi', prefer: '520' },
  { re: /fisika|physic/i, cls: '500', label: 'fisika', prefer: '530' },
  { re: /kimia|chemistr/i, cls: '500', label: 'kimia', prefer: '540' },
  { re: /ilmu bumi|geologi|geolog|earth science/i, cls: '500', label: 'ilmu bumi', prefer: '550' },
  { re: /tumbuhan|botani|botany|plant/i, cls: '500', label: 'tumbuhan', prefer: '580' },
  { re: /hewan|zoologi|zoolog|animal/i, cls: '500', label: 'hewan', prefer: '590' },
  { re: /biologi|biolog/i, cls: '500', label: 'biologi', prefer: '570' },
  { re: /sains|science/i, cls: '500', label: 'sains', prefer: '500' },

  // 600 — teknologi
  { re: /anatomi|anatomy/i, cls: '600', label: 'anatomi', prefer: '611' },
  { re: /fisiologi|physiolog/i, cls: '600', label: 'fisiologi', prefer: '612' },
  { re: /penyakit|disease/i, cls: '600', label: 'penyakit', prefer: '616' },
  { re: /farmakologi|obat|pharmacolog|medicine/i, cls: '600', label: 'farmakologi', prefer: '615' },
  { re: /gizi|makanan|minuman|nutrition|food/i, cls: '600', label: 'makanan & gizi', prefer: '641' },
  { re: /kedokteran|kesehatan|medis|medical|health/i, cls: '600', label: 'kedokteran', prefer: '610' },
  { re: /teknik mesin|teknik elektro|mechanical|electrical/i, cls: '600', label: 'teknik mesin/elektro', prefer: '621' },
  { re: /teknik sipil|civil engineering/i, cls: '600', label: 'teknik sipil', prefer: '624' },
  { re: /pertanian|agricultur/i, cls: '600', label: 'pertanian', prefer: '630' },
  { re: /peternakan|livestock/i, cls: '600', label: 'peternakan', prefer: '636' },
  { re: /perikanan|fisher/i, cls: '600', label: 'perikanan', prefer: '639' },
  { re: /akuntansi|accounting/i, cls: '600', label: 'akuntansi', prefer: '657' },
  { re: /manajemen|management/i, cls: '600', label: 'manajemen', prefer: '650' },
  { re: /pemasaran|iklan|marketing|advertis/i, cls: '600', label: 'pemasaran', prefer: '659' },
  { re: /konstruksi|construction/i, cls: '600', label: 'konstruksi', prefer: '690' },
  { re: /teknologi|teknik|engineering|technology/i, cls: '600', label: 'teknologi', prefer: '600' },

  // 700 — seni & olahraga
  { re: /ilustrasi|illustration|ilustrator|illustrator/i, cls: '700', label: 'ilustrasi', prefer: '741.4' },
  { re: /komik|kartun|karikatur|manga|comic|cartoon/i, cls: '700', label: 'komik/kartun', prefer: '741.5' },
  { re: /desain grafis|graphic design|poster|seni grafis|ilustrasi buku/i, cls: '700', label: 'desain grafis', prefer: '741.6' },
  { re: /menggambar|drawing/i, cls: '700', label: 'menggambar', prefer: '741' },
  { re: /fotografi|photograph/i, cls: '700', label: 'fotografi', prefer: '770' },
  { re: /musik|music/i, cls: '700', label: 'musik', prefer: '780' },
  { re: /film|sinema|pertunjukan|cinema/i, cls: '700', label: 'film & pertunjukan', prefer: '791' },
  { re: /teater|theater|drama/i, cls: '700', label: 'teater', prefer: '792' },
  { re: /olahraga|sport|atletik|athletic/i, cls: '700', label: 'olahraga', prefer: '796' },
  { re: /arsitektur|architecture/i, cls: '700', label: 'arsitektur', prefer: '720' },
  { re: /seni|art|hiburan|rekreasi|craft|kerajinan/i, cls: '700', label: 'seni', prefer: '700' },

  // 800 — sastra (subdivisi dipilih per bahasa di `sastraTarget`)
  { re: /puisi|sajak|poetry|poem/i, cls: '800', label: 'puisi', prefer: '808' },
  { re: /fiksi|novel|cerpen|cerita|sastra|fiction/i, cls: '800', label: 'fiksi/sastra' },

  // 900 — sejarah & geografi
  { re: /sejarah indonesia|indonesian history/i, cls: '900', label: 'sejarah Indonesia', prefer: '959.8' },
  { re: /sejarah eropa|european history/i, cls: '900', label: 'sejarah Eropa', prefer: '940' },
  { re: /sejarah asia|asian history/i, cls: '900', label: 'sejarah Asia', prefer: '950' },
  { re: /atlas|peta|map/i, cls: '900', label: 'atlas', prefer: '912' },
  { re: /geografi|perjalanan|travel|geograph/i, cls: '900', label: 'geografi', prefer: '910' },
  { re: /biografi|biography/i, cls: '900', label: 'biografi', prefer: '920' },
  { re: /sejarah dunia|world history/i, cls: '900', label: 'sejarah dunia', prefer: '909' },
  { re: /sejarah|history/i, cls: '900', label: 'sejarah', prefer: '900' },

  // Generic fallbacks
  { re: /referensi|umum|reference|general|karya umum/i, cls: '000', label: 'karya umum', prefer: '000' },
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

/** Normalise a free-form language field to a short code ("Indonesia" → "id"). */
function langCode(language?: string | null): string | null {
  const v = norm(language);
  if (!v) return null;
  if (/(^|\b)(english|inggris|en|eng)(\b|$)/.test(v)) return 'en';
  if (/(^|\b)(indonesia|indonesian|ind|id)(\b|$)/.test(v)) return 'id';
  if (/(^|\b)(de|ger|german|jerman|deutsch)(\b|$)/.test(v)) return 'de';
  if (/(^|\b)(fr|fre|french|prancis)(\b|$)/.test(v)) return 'fr';
  if (/(^|\b)(ar|ara|arab|arabic)(\b|$)/.test(v)) return 'ar';
  return null;
}

/**
 * Pick the literature subdivision for fiction. The library follows the
 * Indonesian convention where **813 = Sastra Indonesia**, so an English novel
 * must go to 823 (not 813), German to 830, and American to 810. When the
 * language is unknown we default to 813 (Indonesian library convention).
 */
function sastraTarget(blob: string, lang: string | null): string | null {
  if (/(amerika|american)/.test(blob)) return '810';
  switch (lang) {
    case 'id':
      return '813';
    case 'en':
      return '823';
    case 'de':
      return '830';
    case 'fr':
      return '840';
    case 'ar':
      return '892';
    default:
      break;
  }
  // Unknown language: default to the Indonesian literature class.
  return '813';
}

/** Score how well a DDC row matches the book; higher is better. */
function scoreDdc(
  entry: DdcEntry,
  blob: string,
  hint: KeywordRule | null,
  lang: string | null,
): number {
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

  // Fiction/sastra: choose the literature class by language, and make the
  // generic 800 lose to the matching country-specific subdivision.
  if (/(fiksi|sastra|novel|cerita|cerpen|fiction)/.test(blob)) {
    const target = sastraTarget(blob, lang);
    if (target) {
      if (entry.kode.startsWith(target)) score += 9;
      if (entry.kode === '800') score -= 4;
    }
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

/**
 * Append a 2-digit serial (`-01`, `-02`, …) until the code is unique.
 * Only `[A-Z0-9-]` is used so the value is safe for a CODE128 barcode/scan.
 */
function nextSerialCode(base: string, existing: ExistingBook[], exclude?: string | null): string {
  const taken = new Set(
    existing
      .map((b) => norm(b.kodeBuku))
      .filter((k) => k && k !== norm(exclude)),
  );
  for (let i = 1; i <= 999; i += 1) {
    const candidate = `${base}-${String(i).padStart(2, '0')}`;
    if (!taken.has(norm(candidate))) return candidate;
  }
  return `${base}-${Date.now().toString().slice(-3)}`;
}

/**
 * Generate DDC, shelf location, call number and a unique book code.
 * Never returns a DDC code that is absent from `ddcList`.
 */
export function generateCatalog(input: CatalogInput): CatalogResult {
  const { judul, pengarang, kategori, subjects = [], language, ddcList, existing } = input;

  const blob = norm([kategori ?? '', subjects.join(' '), judul].filter(Boolean).join(' '));
  const hinted = keywordClass(blob);
  const lang = langCode(language);

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
    let score = scoreDdc(entry, blob, hinted, lang);
    if (learnedDdc && entry.kode === learnedDdc) score += 20;
    if (score > bestScore) {
      bestScore = score;
      chosen = entry;
    }
  }
  // Fallbacks: preferred subdivision, sastra target, main class, then "000".
  if (!chosen && hinted) {
    const target = /(fiksi|sastra|novel|cerita|cerpen|fiction)/.test(blob)
      ? sastraTarget(blob, lang)
      : null;
    chosen =
      (hinted.prefer ? ddcList.find((e) => e.kode.startsWith(hinted.prefer!)) : undefined) ??
      (target ? ddcList.find((e) => e.kode.startsWith(target)) : undefined) ??
      ddcList.find((e) => mainClass(e.kode) === hinted.cls) ??
      null;
  }
  if (!chosen) {
    chosen = ddcList.find((e) => mainClass(e.kode) === '000') ?? ddcList[0] ?? null;
  }

  const kodeDdc = chosen?.kode ?? '';
  const { rak, learned } = pickRak(kodeDdc, existing);

  // Human-readable call number for the spine label, e.g. "813 HIR l".
  const author = kodePengarang(pengarang);
  const titleLetter = hurufJudul(judul);
  const callNumber = [kodeDdc || '000', author, titleLetter].filter(Boolean).join(' ');

  // Scannable inventory code: only A-Z, 0-9 and '-', safe for CODE128,
  // e.g. "813-HIRL-01", "7415-COMK-01", "005133-PYTB-01".
  const ddcPart = (kodeDdc || '000').replace(/[^0-9A-Za-z]/g, '');
  const baseKode = `${ddcPart}-${author}${titleLetter.toUpperCase()}`;
  const kodeBuku = nextSerialCode(baseKode, existing, input.excludeKodeBuku);

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
  reasonParts.push(`kode ${kodeBuku}`);

  return { kodeDdc, rak, callNumber, kodeBuku, reason: reasonParts.join('; ') };
}
