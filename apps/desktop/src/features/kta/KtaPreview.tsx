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
  className?: string;
}

export function KtaPreview({
  layout,
  anggota,
  identity,
  selectedFieldId,
  onSelectField,
  scale = 2,
  className,
}: Props) {
  const widthPx = Math.round(layout.widthMm * MM_TO_PX * scale);
  const heightPx = Math.round(layout.heightMm * MM_TO_PX * scale);

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
        width: widthPx,
        height: heightPx,
        position: 'relative',
        background: layout.background ?? '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 4px 18px rgba(15, 23, 42, 0.12)',
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
  selected,
  onSelect,
}: {
  field: KtaField;
  anggota: Anggota | null;
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
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  };
  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.(field.id);
  };
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
