import { read, utils, write, type WorkBook } from 'xlsx';

export interface ImportFieldDef<TItem> {
  key: keyof TItem & string;
  label: string;
  required: boolean;
  /** Aliases (case-insensitive, normalized) used for auto-detect. */
  aliases: string[];
  /** Optional row-level validator. Return error message or null. */
  validate?: (value: string, row: TItem) => string | null;
  /** Sample value used when generating a template workbook. */
  sample?: string;
}

export interface ParsedFile {
  filename: string;
  headers: string[];
  rows: Array<Record<string, string>>;
}

export type Mapping = Record<string, string>;

export interface MappedRow<TItem> {
  rowNumber: number;
  raw: Record<string, string>;
  item: TItem;
  errors: string[];
}

const NORM_RE = /[\s./_\-:()]+/g;

export function normalizeHeader(raw: string): string {
  return raw.toLowerCase().trim().replace(NORM_RE, '_');
}

/** Parse an in-memory workbook (xlsx/csv) buffer into headers + rows. */
export function parseBytes(filename: string, buf: ArrayBuffer | Uint8Array): ParsedFile {
  const wb: WorkBook = read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { filename, headers: [], rows: [] };
  }
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    return { filename, headers: [], rows: [] };
  }
  const aoa = utils.sheet_to_json<Array<unknown>>(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  });
  if (aoa.length === 0) {
    return { filename, headers: [], rows: [] };
  }
  const headerRow = aoa[0] ?? [];
  const headers = headerRow.map((h) => (h == null ? '' : String(h).trim()));
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i] ?? [];
    const obj: Record<string, string> = {};
    let hasAny = false;
    for (let c = 0; c < headers.length; c++) {
      const h = headers[c];
      if (!h) continue;
      const cell = r[c];
      const str = cell == null ? '' : String(cell).trim();
      obj[h] = str;
      if (str) hasAny = true;
    }
    if (hasAny) rows.push(obj);
  }
  return { filename, headers, rows };
}

export async function parseFile(file: File): Promise<ParsedFile> {
  // happy-dom's File lacks arrayBuffer; FileReader is available in both jsdom
  // and the real browser, so use it as a portable fallback when needed.
  let buf: ArrayBuffer;
  if (typeof (file as unknown as { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer === 'function') {
    buf = await file.arrayBuffer();
  } else {
    buf = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const r = reader.result;
        if (r instanceof ArrayBuffer) resolve(r);
        else reject(new Error('FileReader did not return ArrayBuffer'));
      };
      reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
      reader.readAsArrayBuffer(file);
    });
  }
  return parseBytes(file.name, buf);
}

/**
 * Auto-map source headers to target field keys based on alias matches.
 * Returns Mapping where key = source header, value = target field key
 * (or empty string when unmapped).
 */
export function autoMap<TItem>(
  fields: ImportFieldDef<TItem>[],
  headers: string[],
): Mapping {
  const mapping: Mapping = {};
  const used = new Set<string>();
  for (const h of headers) {
    if (!h) continue;
    const norm = normalizeHeader(h);
    let target = '';
    for (const f of fields) {
      if (used.has(f.key)) continue;
      const candidates = [normalizeHeader(f.key), normalizeHeader(f.label), ...f.aliases.map(normalizeHeader)];
      if (candidates.includes(norm)) {
        target = f.key;
        break;
      }
    }
    if (target) used.add(target);
    mapping[h] = target;
  }
  return mapping;
}

/** Build a per-row mapped item from raw cells using the supplied mapping. */
export function buildMappedRows<TItem>(
  fields: ImportFieldDef<TItem>[],
  parsed: ParsedFile,
  mapping: Mapping,
  rowParser: (rawByKey: Record<string, string>) => TItem,
): MappedRow<TItem>[] {
  const result: MappedRow<TItem>[] = [];
  // Track duplicate detection across the whole batch for fields whose key
  // looks like a unique identifier (contains "kode"). Anggota and buku both
  // have a "kodeAnggota" / "kodeBuku" required field; this catches dupes
  // before the backend rejects them.
  const seenKey = new Map<string, Set<string>>();
  for (const f of fields) {
    if (f.required && f.key.toLowerCase().includes('kode')) {
      seenKey.set(f.key, new Set());
    }
  }

  parsed.rows.forEach((rawRow, idx) => {
    const rawByKey: Record<string, string> = {};
    for (const [src, tgt] of Object.entries(mapping)) {
      if (!tgt) continue;
      const value = rawRow[src] ?? '';
      rawByKey[tgt] = value;
    }
    const item = rowParser(rawByKey);
    const errors: string[] = [];
    for (const f of fields) {
      const value = rawByKey[f.key] ?? '';
      if (f.required && !value) {
        errors.push(`${f.label} wajib diisi`);
      }
      if (value && f.validate) {
        const msg = f.validate(value, item);
        if (msg) errors.push(msg);
      }
    }
    for (const f of fields) {
      const set = seenKey.get(f.key);
      if (!set) continue;
      const value = rawByKey[f.key] ?? '';
      if (!value) continue;
      if (set.has(value)) {
        errors.push(`${f.label} '${value}' duplikat di file`);
      } else {
        set.add(value);
      }
    }
    result.push({
      rowNumber: idx + 2, // +1 for header, +1 for 1-based
      raw: rawRow,
      item,
      errors,
    });
  });

  return result;
}

/**
 * Build a sample template workbook (.xlsx) listing the required+optional
 * headers and one example row. Returns Uint8Array suitable for download.
 */
export function buildTemplateBytes<TItem>(
  fields: ImportFieldDef<TItem>[],
  sheetName: string,
): Uint8Array {
  const headers = fields.map((f) => f.label);
  const sample = fields.map((f) => f.sample ?? '');
  const aoa: (string | number)[][] = [headers, sample];
  const sheet = utils.aoa_to_sheet(aoa);
  sheet['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 2, 14) }));
  const wb = utils.book_new();
  utils.book_append_sheet(wb, sheet, sheetName.slice(0, 28));
  const out = write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Uint8Array(out);
}

/** Build a CSV with the per-row error report for failed imports. */
export function buildErrorReportCsv(
  errors: Array<{ row: number; message: string }>,
): string {
  const head = 'row,message\n';
  const body = errors
    .map((e) => `${e.row},"${e.message.replace(/"/g, '""')}"`)
    .join('\n');
  return `${head}${body}\n`;
}

/** Trigger a browser download for an arbitrary blob. */
export function triggerDownload(filename: string, data: Blob | Uint8Array, mime?: string): void {
  let blob: Blob;
  if (data instanceof Blob) {
    blob = data;
  } else {
    // Copy into a fresh ArrayBuffer to satisfy DOM BlobPart typing
    // (some TS lib variants reject SharedArrayBuffer-backed Uint8Array).
    const ab = new ArrayBuffer(data.byteLength);
    new Uint8Array(ab).set(data);
    blob = new Blob([ab], { type: mime ?? 'application/octet-stream' });
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}
