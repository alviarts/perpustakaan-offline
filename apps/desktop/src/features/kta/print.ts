import QRCode from 'qrcode';
import { assetsApi } from '@/lib/assets';
import type { Anggota } from '@/lib/anggota';
import { buildQrPayload, type KtaField, type KtaLayout } from '@/lib/kta';
import type { LibraryIdentity } from '@/stores/identityStore';
import { resolveKtaFieldText } from './resolveField';

const MM_TO_PX = 3.78;

function escape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function buildQrDataUrl(memberId: number): Promise<string> {
  return QRCode.toDataURL(buildQrPayload(memberId), {
    errorCorrectionLevel: 'M',
    margin: 0,
    width: 256,
  });
}

/**
 * Convert a member's saved foto path to a self-contained `data:` URL.
 *
 * `anggota.fotoPath` is a relative-to-app-data path resolved by Tauri at
 * runtime via the `assets_resolve` / `assets_read_data_url` commands. The
 * generated print HTML is opened in a separate `window.open('', '_blank')`
 * popup that is **not** a Tauri webview — its document context cannot
 * resolve those paths and the `<img>` would render broken (regression
 * surfaced in v1.0.5: KTA print preview shows alt text instead of the
 * member's photo). Inlining the bytes as a base64 `data:` URL — the same
 * trick `pdf.ts::loadFotoDataUrl` already uses — keeps the print HTML
 * self-contained and works even when the print window has no Tauri
 * privileges.
 */
async function loadFotoDataUrl(fotoPath: string | null | undefined): Promise<string | null> {
  if (!fotoPath) return null;
  try {
    return await assetsApi.readDataUrl(fotoPath);
  } catch {
    return null;
  }
}

/**
 * Map a stored layout `fontSize` (CSS px at the card's natural
 * `widthMm * 3.78` size) to a `cqi`-relative CSS expression so the text
 * scales with the card's actual rendered width. Mirrors the same helper
 * in `KtaPreview.tsx` — keeping the math identical between the in-app
 * preview and the print HTML is what makes "what you see is what you
 * print" work for v1.0.6 onwards.
 */
function fontSizeCqiPrint(fontSizePx: number, layoutWidthMm: number): string {
  const refWidthPx = layoutWidthMm * MM_TO_PX;
  if (refWidthPx <= 0) return `${fontSizePx}px`;
  const cqi = (fontSizePx / refWidthPx) * 100;
  return `${cqi.toFixed(4)}cqi`;
}

/**
 * Render an `<img>` for foto / TTD slots, falling back to an inline SVG
 * placeholder when no source URL is available. Both BUG-06 (broken-image
 * glyph for missing foto) and the new TTD field share the same logic
 * because their failure mode is identical: a previously-valid path that
 * the host machine no longer resolves should *not* show "Foto" or
 * "TTD" alt text — it should show a clean labeled box instead.
 */
function imgWithFallback(src: string | null, label: string, extraStyle: string): string {
  if (src) {
    return `<img src="${src}" style="width:100%;height:100%;${extraStyle}" alt="${escape(label)}"/>`;
  }
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80"><rect width="100%" height="100%" fill="#e2e8f0"/><text x="50%" y="55%" text-anchor="middle" fill="#64748b" font-size="10" font-family="sans-serif">${label}</text></svg>`,
  );
  return `<img src="data:image/svg+xml;utf8,${svg}" style="width:100%;height:100%;${extraStyle}" alt="${escape(label)}"/>`;
}

function fieldHtml(
  field: KtaField,
  anggota: Anggota,
  identity: LibraryIdentity,
  qrUrl: string,
  fotoUrl: string | null,
  ttdUrl: string | null,
  layoutWidthMm: number,
): string {
  const baseStyle = [
    'position:absolute',
    `left:${field.x}%`,
    `top:${field.y}%`,
    `width:${field.width}%`,
    `height:${field.height}%`,
    'box-sizing:border-box',
    'padding:0 4px',
    'overflow:hidden',
    'display:flex',
    'align-items:center',
  ].join(';');

  if (field.kind === 'rect') {
    const fill = field.fill ?? '#0f172a';
    const radius = field.radius ? `border-radius:${Math.max(0, field.radius)}mm;` : '';
    return `<div style="${baseStyle};background:${fill};${radius}padding:0"></div>`;
  }

  if (field.kind === 'foto') {
    return `<div style="${baseStyle}">${imgWithFallback(fotoUrl, 'FOTO', 'object-fit:cover')}</div>`;
  }

  if (field.kind === 'ttdKepsek') {
    return `<div style="${baseStyle}">${imgWithFallback(ttdUrl, 'TTD', 'object-fit:contain')}</div>`;
  }

  if (field.kind === 'qr') {
    // BUG-02 — keep the QR strictly square. We render the image inside a
    // centered flex slot so `aspect-ratio:1/1` + `max-width/max-height:100%`
    // bound the image to the smaller of the two field dimensions instead of
    // stretching to whatever rectangular size the template author picked.
    const qrStyle = 'aspect-ratio:1/1;max-width:100%;max-height:100%;object-fit:contain';
    return `<div style="${baseStyle};justify-content:center"><img src="${qrUrl}" style="${qrStyle}" alt="QR"/></div>`;
  }

  const text = resolveKtaFieldText(field, anggota, identity, 'print');
  const align = field.align ?? 'left';
  const justify = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
  const textStyle = [
    `font-size:${fontSizeCqiPrint(field.fontSize ?? 10, layoutWidthMm)}`,
    `font-weight:${field.fontWeight ?? 'normal'}`,
    `color:${field.color ?? '#0f172a'}`,
    `text-align:${align}`,
    `justify-content:${justify}`,
    'white-space:nowrap',
    'text-overflow:ellipsis',
    'overflow:hidden',
  ].join(';');
  return `<div style="${baseStyle};${textStyle}"><span style="width:100%;overflow:hidden;text-overflow:ellipsis">${escape(text)}</span></div>`;
}

export interface KtaPrintInput {
  layout: KtaLayout;
  anggota: Anggota[];
  identity: LibraryIdentity;
}

function renderCardsGrid(
  layout: KtaLayout,
  resources: { anggota: Anggota; qrUrl: string; fotoUrl: string | null }[],
  identity: LibraryIdentity,
  ttdUrl: string | null,
): string {
  const widthPx = Math.round(layout.widthMm * MM_TO_PX);
  const heightPx = Math.round(layout.heightMm * MM_TO_PX);
  const cards: string[] = [];
  for (const r of resources) {
    const fields = layout.fields
      .map((f) =>
        fieldHtml(f, r.anggota, identity, r.qrUrl, r.fotoUrl, ttdUrl, layout.widthMm),
      )
      .join('');
    cards.push(
      `<div class="kta-card" style="width:${widthPx}px;height:${heightPx}px;background:${layout.background ?? '#ffffff'};">${fields}</div>`,
    );
  }
  return `<div class="grid">${cards.join('')}</div>`;
}

/** Build self-contained printable HTML untuk batch KTA. */
export async function buildKtaPrintHtml(input: KtaPrintInput): Promise<string> {
  const { layout, anggota, identity } = input;

  // Pre-load QR + foto data URLs for every member in parallel so the final
  // HTML is fully self-contained (no Tauri-specific path resolution needed
  // inside the popup print window).
  const resources = await Promise.all(
    anggota.map(async (a) => ({
      anggota: a,
      qrUrl: await buildQrDataUrl(a.id),
      fotoUrl: await loadFotoDataUrl(a.fotoPath),
    })),
  );

  const ttdUrl = await loadFotoDataUrl(identity.ttdKepsekPath);

  const frontGrid = renderCardsGrid(layout, resources, identity, ttdUrl);

  // FEAT-04 — when the template defines a back-side layout, render an
  // additional grid on a forced new page. CSS `break-before:page` is the
  // modern equivalent of the legacy `page-break-before` rule and is what
  // the Chromium print engine in Tauri honours.
  let backSection = '';
  if (layout.back) {
    const backGrid = renderCardsGrid(layout.back, resources, identity, ttdUrl);
    backSection = `<div class="kta-back">${backGrid}</div>`;
  }

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Cetak KTA — ${escape(identity.nama)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: 'Inter', system-ui, sans-serif; margin: 0; padding: 16px; background: #f1f5f9; }
  .grid { display: flex; flex-wrap: wrap; gap: 8mm; justify-content: flex-start; }
  .kta-back { break-before: page; page-break-before: always; margin-top: 16px; }
  .kta-card {
    position: relative;
    border: 1px dashed #94a3b8;
    border-radius: 8px;
    overflow: hidden;
    box-sizing: border-box;
    page-break-inside: avoid;
    /* Required so child text fields can use cqi units for font-size. */
    container-type: inline-size;
  }
  @media print {
    body { background: #ffffff; padding: 0; }
    .kta-card { border: none; box-shadow: none; }
    .kta-back { margin-top: 0; }
  }
</style>
</head>
<body>
  ${frontGrid}
  ${backSection}
  <script>
    window.addEventListener('load', () => {
      setTimeout(() => window.print(), 200);
    });
  </script>
</body>
</html>`;
}

/** Open printable HTML in a new window for OS print dialog. */
export function openKtaPrintWindow(html: string): void {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
