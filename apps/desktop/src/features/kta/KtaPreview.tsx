import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { Anggota } from '@/lib/anggota';
import {
  buildQrPayload,
  type KtaField,
  type KtaLayout,
} from '@/lib/kta';
import type { LibraryIdentity } from '@/stores/identityStore';

const MM_TO_PX = 3.78;

interface Props {
  layout: KtaLayout;
  anggota: Anggota | null;
  identity: LibraryIdentity;
  /** Highlight selected field (editor mode). */
  selectedFieldId?: string | null;
  onSelectField?: (id: string | null) => void;
  scale?: number;
  /**
   * When true, the card stretches to fill the parent container's width and
   * keeps its aspect ratio via `aspect-ratio`. `scale` is ignored. Use for
   * narrow side panels (e.g. Cetak KTA preview column) where the natural
   * pixel size of an ID-1 card would overflow.
   */
  fitToWidth?: boolean;
  className?: string;
}

/**
 * Convert a `fontSize` value stored in the layout (CSS pixels at the
 * card's *natural* `widthMm * 3.78` size, i.e. scale=1 / physical print
 * scale) into a CSS expression that scales proportionally with the
 * card's actual rendered width.
 *
 * Why: the card is rendered at three different sizes — TemplateEditor
 * preview at scale=2.4, CetakKtaPage preview at fitToWidth (~280px in a
 * 320px column), and the print popup at scale=1 (physical mm size). If
 * we rendered `font-size: ${px}px` literally, a 24px header that fits
 * comfortably at scale=1 print would look tiny in the editor, prompting
 * users to crank fontSize up — which then renders the printed card with
 * oversized, clipped, or wrapped text. Mapping fontSize px to `cqi`
 * (1cqi = 1% of the card's inline size) keeps the *relative* size of
 * every text identical across editor/preview/print.
 *
 * `cqi` requires the card itself to have `container-type: inline-size`
 * (set on the wrapping `<div data-testid="kta-preview">`).
 */
function fontSizeCqi(
  fontSizePx: number | undefined,
  layoutWidthMm: number,
): string | undefined {
  if (!fontSizePx) return undefined;
  const refWidthPx = layoutWidthMm * MM_TO_PX;
  if (refWidthPx <= 0) return `${fontSizePx}px`;
  const cqi = (fontSizePx / refWidthPx) * 100;
  return `${cqi.toFixed(4)}cqi`;
}

export function KtaPreview({
  layout,
  anggota,
  identity,
  selectedFieldId,
  onSelectField,
  scale = 2,
  fitToWidth = false,
  className,
}: Props) {
  const widthPx = Math.round(layout.widthMm * MM_TO_PX * scale);
  const heightPx = Math.round(layout.heightMm * MM_TO_PX * scale);
  const sizeStyle: React.CSSProperties = fitToWidth
    ? {
        width: '100%',
        aspectRatio: `${layout.widthMm} / ${layout.heightMm}`,
      }
    : {
        width: widthPx,
        height: heightPx,
      };

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const id = anggota?.id ?? 0;
    const payload = buildQrPayload(id);
    QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 0, width: 256 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch((err) => {
        console.warn('qrcode generation failed', err);
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [anggota?.id]);

  return (
    <div
      data-testid="kta-preview"
      className={className}
      style={{
        ...sizeStyle,
        position: 'relative',
        background: layout.background ?? '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 4px 18px rgba(15, 23, 42, 0.12)',
        // Establish an inline-size containment context so child fields can
        // size their `font-size` via `cqi` (see `fontSizeCqi`). Without
        // this, fonts stay at their stored pixel value and look
        // disproportionate at scales other than 1.
        containerType: 'inline-size',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelectField?.(null);
      }}
    >
      {layout.fields.map((field) => (
        <FieldNode
          key={field.id}
          field={field}
          anggota={anggota}
          identity={identity}
          qrDataUrl={qrDataUrl}
          layoutWidthMm={layout.widthMm}
          selected={selectedFieldId === field.id}
          onSelect={onSelectField}
        />
      ))}
    </div>
  );
}

function FieldNode({
  field,
  anggota,
  identity,
  qrDataUrl,
  layoutWidthMm,
  selected,
  onSelect,
}: {
  field: KtaField;
  anggota: Anggota | null;
  identity: LibraryIdentity;
  qrDataUrl: string | null;
  layoutWidthMm: number;
  selected: boolean;
  onSelect?: (id: string) => void;
}) {
  const wrapperStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${field.x}%`,
    top: `${field.y}%`,
    width: `${field.width}%`,
    height: `${field.height}%`,
    fontSize: fontSizeCqi(field.fontSize, layoutWidthMm),
    fontWeight: field.fontWeight ?? 'normal',
    color: field.color ?? '#0f172a',
    textAlign: field.align ?? 'left',
    display: 'flex',
    alignItems: 'center',
    justifyContent:
      field.align === 'center' ? 'center' : field.align === 'right' ? 'flex-end' : 'flex-start',
    boxSizing: 'border-box',
    padding: '0 4px',
    outline: selected ? '2px dashed rgba(59, 130, 246, 0.85)' : 'none',
    cursor: onSelect ? 'pointer' : 'default',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  };
  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.(field.id);
  };
  if (field.kind === 'rect') {
    return (
      <div
        style={{
          ...wrapperStyle,
          background: field.fill ?? '#0f172a',
          borderRadius: field.radius ? `${Math.max(0, field.radius)}mm` : undefined,
          padding: 0,
        }}
        onClick={onClick}
      />
    );
  }
  if (field.kind === 'foto') {
    return (
      <div style={wrapperStyle} onClick={onClick}>
        {anggota?.fotoPath ? (
          <img
            src={anggota.fotoPath}
            alt="Foto"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: '#e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              fontSize: 10,
            }}
          >
            FOTO
          </div>
        )}
      </div>
    );
  }
  if (field.kind === 'qr') {
    return (
      <div style={wrapperStyle} onClick={onClick}>
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="QR" style={{ width: '100%', height: '100%' }} />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              fontSize: 9,
            }}
          >
            QR
          </div>
        )}
      </div>
    );
  }
  const text = resolveFieldText(field, anggota, identity);
  return (
    <div style={wrapperStyle} onClick={onClick}>
      <span style={{ width: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
    </div>
  );
}

function resolveFieldText(
  field: KtaField,
  anggota: Anggota | null,
  identity: LibraryIdentity,
): string {
  switch (field.kind) {
    case 'static':
      return field.text ?? '';
    case 'identitas':
      return identity.nama;
    case 'nama':
      return anggota?.nama ?? 'Nama Anggota';
    case 'kodeAnggota':
      return anggota?.kodeAnggota ?? 'KODE-XXX';
    case 'kelas':
      return anggota?.kelas ?? '-';
    case 'jurusan':
      return anggota?.jurusan ?? '-';
    case 'agama':
      return anggota?.agama ?? '-';
    default:
      return '';
  }
}
