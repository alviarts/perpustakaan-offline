import QRCode from 'qrcode';
import { assetsApi } from '@/lib/assets';
import type { Anggota } from '@/lib/anggota';
import { buildQrPayload, type KtaField, type KtaLayout } from '@/lib/kta';
import type { LibraryIdentity } from '@/stores/identityStore';

const MM_TO_PX = 3.78;

function escape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function resolveText(
  field: KtaField,
  anggota: Anggota,
  identity: LibraryIdentity,
): string {
  switch (field.kind) {
    case 'static':
      return field.text ?? '';
    case 'identitas':
      return identity.nama;
    case 'nama':
      return anggota.nama;
    case 'kodeAnggota':
      return anggota.kodeAnggota;
    case 'kelas':
      return anggota.kelas ?? '-';
    case 'jurusan':
      return anggota.jurusan ?? '-';
    case 'agama':
      return anggota.agama ?? '-';
    default:
      return '';
  }
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

function fieldHtml(
  field: KtaField,
  anggota: Anggota,
  identity: LibraryIdentity,
  qrUrl: string,
  fotoUrl: string | null,
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
    const src =
      fotoUrl ??
      'data:image/svg+xml;utf8,' +
        encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80"><rect width="100%" height="100%" fill="#e2e8f0"/><text x="50%" y="55%" text-anchor="middle" fill="#64748b" font-size="10" font-family="sans-serif">FOTO</text></svg>`,
        );
    return `<div style="${baseStyle}"><img src="${src}" style="width:100%;height:100%;object-fit:cover" alt="Foto"/></div>`;
  }

  if (field.kind === 'qr') {
    return `<div style="${baseStyle}"><img src="${qrUrl}" style="width:100%;height:100%" alt="QR"/></div>`;
  }

  const text = resolveText(field, anggota, identity);
  const align = field.align ?? 'left';
  const justify = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
  const textStyle = [
    `font-size:${field.fontSize ?? 10}px`,
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

/** Build self-contained printable HTML untuk batch KTA. */
export async function buildKtaPrintHtml(input: KtaPrintInput): Promise<string> {
  const { layout, anggota, identity } = input;
  const widthPx = Math.round(layout.widthMm * MM_TO_PX);
  const heightPx = Math.round(layout.heightMm * MM_TO_PX);

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

  const cards: string[] = [];
  for (const r of resources) {
    const fields = layout.fields
      .map((f) => fieldHtml(f, r.anggota, identity, r.qrUrl, r.fotoUrl))
      .join('');
    cards.push(
      `<div class="kta-card" style="width:${widthPx}px;height:${heightPx}px;background:${layout.background ?? '#ffffff'};">${fields}</div>`,
    );
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
  .kta-card {
    position: relative;
    border: 1px dashed #94a3b8;
    border-radius: 8px;
    overflow: hidden;
    box-sizing: border-box;
    page-break-inside: avoid;
  }
  @media print {
    body { background: #ffffff; padding: 0; }
    .kta-card { border: none; box-shadow: none; }
  }
</style>
</head>
<body>
  <div class="grid">${cards.join('')}</div>
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
