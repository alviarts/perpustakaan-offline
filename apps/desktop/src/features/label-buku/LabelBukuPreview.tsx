import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import type { BukuSample, LabelBukuField, LabelBukuLayout } from '@/lib/labelBuku';
import type { LibraryIdentity } from '@/stores/identityStore';

const MM_TO_PX = 3.78;

interface Props {
  layout: LabelBukuLayout;
  buku: BukuSample;
  identity: LibraryIdentity;
  /** Highlight selected field (editor mode). */
  selectedFieldId?: string | null;
  onSelectField?: (id: string | null) => void;
  scale?: number;
  className?: string;
}

/**
 * Visual preview of a single book label. Mirrors `KtaPreview` so the editor
 * UX is consistent. Decorative rects render first (presets put them at the
 * top of the array), then text + barcode + qr fields.
 */
export function LabelBukuPreview({
  layout,
  buku,
  identity,
  selectedFieldId,
  onSelectField,
  scale = 2.4,
  className,
}: Props) {
  const widthPx = Math.round(layout.widthMm * MM_TO_PX * scale);
  const heightPx = Math.round(layout.heightMm * MM_TO_PX * scale);

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(buku.kodeEksemplar, { errorCorrectionLevel: 'M', margin: 0, width: 256 })
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
  }, [buku.kodeEksemplar]);

  return (
    <div
      data-testid="label-buku-preview"
      className={className}
      style={{
        width: widthPx,
        height: heightPx,
        minWidth: widthPx,
        minHeight: heightPx,
        maxWidth: widthPx,
        maxHeight: heightPx,
        position: 'relative',
        background: layout.background ?? '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: 6,
        overflow: 'hidden',
        boxShadow: '0 4px 18px rgba(15, 23, 42, 0.12)',
        flexShrink: 0,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelectField?.(null);
      }}
    >
      {layout.fields.map((field) => (
        <FieldNode
          key={field.id}
          field={field}
          buku={buku}
          identity={identity}
          qrDataUrl={qrDataUrl}
          selected={selectedFieldId === field.id}
          onSelect={onSelectField}
        />
      ))}
    </div>
  );
}

function FieldNode({
  field,
  buku,
  identity,
  qrDataUrl,
  selected,
  onSelect,
}: {
  field: LabelBukuField;
  buku: BukuSample;
  identity: LibraryIdentity;
  qrDataUrl: string | null;
  selected: boolean;
  onSelect?: (id: string) => void;
}) {
  const wrapperStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${field.x}%`,
    top: `${field.y}%`,
    width: `${field.width}%`,
    height: `${field.height}%`,
    fontSize: field.fontSize ? `${field.fontSize}px` : undefined,
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
  if (field.kind === 'barcode') {
    return (
      <div style={wrapperStyle} onClick={onClick}>
        <BarcodeNode value={buku.kodeEksemplar || buku.kodeBuku} />
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
  const text = resolveFieldText(field, buku, identity);
  return (
    <div style={wrapperStyle} onClick={onClick}>
      <span
        style={{
          width: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'normal',
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 2,
          lineHeight: 1.15,
        }}
      >
        {text}
      </span>
    </div>
  );
}

function BarcodeNode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value || '0000', {
        format: 'CODE128',
        displayValue: false,
        margin: 0,
        height: 40,
        width: 1.4,
        background: '#ffffff',
        lineColor: '#0f172a',
      });
    } catch (e) {
      console.warn('barcode render failed', e);
    }
  }, [value]);
  return (
    <svg
      ref={ref}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
      }}
      preserveAspectRatio="none"
    />
  );
}

function resolveFieldText(
  field: LabelBukuField,
  buku: BukuSample,
  identity: LibraryIdentity,
): string {
  switch (field.kind) {
    case 'static':
      return field.text ?? '';
    case 'identitas':
      return identity.nama;
    case 'judul':
      return buku.judul || 'Judul Buku';
    case 'kodeBuku':
      return buku.kodeBuku || 'KODE-BUKU';
    case 'kodeEksemplar':
      return buku.kodeEksemplar || 'B0001-01';
    case 'pengarang':
      return buku.pengarang || '-';
    case 'penerbit':
      return buku.penerbit || '-';
    case 'tahun':
      return buku.tahun || '-';
    case 'kodeDdc':
      return buku.kodeDdc || '-';
    default:
      return '';
  }
}
