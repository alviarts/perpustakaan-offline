/**
 * Buka URL eksternal di browser default.
 *
 * Tauri/WebView2 memblokir `window.open` untuk pop-up, tetapi plugin shell
 * membuka browser sistem. Di mode browser (dev/test) jatuh ke `window.open`.
 */
export async function openExternal(url: string): Promise<void> {
  try {
    const { open } = await import('@tauri-apps/plugin-shell');
    await open(url);
    return;
  } catch {
    // Not running inside Tauri (or plugin unavailable) → fallback below.
  }
  try {
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    // ignore — user can copy the URL manually
  }
}

/** URL Google Images untuk mencari cover buku (bahasa + ISBN/judul). */
export function buildCoverSearchUrl(opts: {
  judul?: string | null;
  pengarang?: string | null;
  isbn?: string | null;
}): string {
  const parts = ['book cover'];
  if (opts.judul) parts.push(`"${opts.judul}"`);
  if (opts.pengarang) parts.push(opts.pengarang);
  if (opts.isbn) parts.push(opts.isbn);
  const q = encodeURIComponent(parts.join(' '));
  return `https://www.google.com/search?tbm=isch&q=${q}`;
}
