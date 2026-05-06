import { ArrowDown, ArrowUp, Image as ImageIcon, Plus, Trash2, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Anggota } from '@/lib/anggota';
import { defaultBackLayout, type KtaField, type KtaFieldKind, type KtaLayout } from '@/lib/kta';
import type { LibraryIdentity } from '@/stores/identityStore';
import { KtaPreview } from './KtaPreview';

interface Props {
  layout: KtaLayout;
  onChange: (next: KtaLayout) => void;
  preview: { anggota: Anggota | null; identity: LibraryIdentity };
}

const FIELD_KINDS: KtaFieldKind[] = [
  'static',
  'identitas',
  'nama',
  'kodeAnggota',
  'kelas',
  'jurusan',
  'agama',
  'tempatTanggalLahir',
  'jenisKelamin',
  'alamat',
  'noTelp',
  'tahunMasuk',
  'berlakuSd',
  'namaKepsek',
  'foto',
  'ttdKepsek',
  'qr',
  'rect',
];

type Side = 'front' | 'back';

export function TemplateEditor({ layout, onChange, preview }: Props) {
  const { t } = useTranslation('kta');
  const [side, setSide] = useState<Side>('front');
  const activeLayout = side === 'back' ? layout.back ?? null : layout;
  const [selectedId, setSelectedId] = useState<string | null>(
    layout.fields[0]?.id ?? null,
  );

  const selected = useMemo(
    () => activeLayout?.fields.find((f) => f.id === selectedId) ?? null,
    [activeLayout, selectedId],
  );

  const setActiveLayout = (next: KtaLayout) => {
    if (side === 'back') {
      onChange({ ...layout, back: next });
    } else {
      onChange({ ...next, back: layout.back ?? null });
    }
  };

  const updateField = (id: string, patch: Partial<KtaField>) => {
    if (!activeLayout) return;
    setActiveLayout({
      ...activeLayout,
      fields: activeLayout.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    });
  };

  const addField = () => {
    if (!activeLayout) return;
    const id = `f-${Date.now()}`;
    const next: KtaField = {
      id,
      kind: 'static',
      text: 'Teks baru',
      x: 10,
      y: 10,
      width: 40,
      height: 8,
      fontSize: 10,
      color: '#0f172a',
      align: 'left',
    };
    setActiveLayout({ ...activeLayout, fields: [...activeLayout.fields, next] });
    setSelectedId(id);
  };

  const removeField = (id: string) => {
    if (!activeLayout) return;
    setActiveLayout({
      ...activeLayout,
      fields: activeLayout.fields.filter((f) => f.id !== id),
    });
    if (selectedId === id) setSelectedId(null);
  };

  /**
   * Move a field one slot earlier (-1) or later (+1) in the array. Render
   * order = array order, so moving later == drawing on top of subsequent
   * fields in both the React preview and the jsPDF backend.
   */
  const moveField = (id: string, dir: -1 | 1) => {
    if (!activeLayout) return;
    const idx = activeLayout.fields.findIndex((f) => f.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= activeLayout.fields.length) return;
    const next = [...activeLayout.fields];
    const item = next[idx];
    if (!item) return;
    next.splice(idx, 1);
    next.splice(target, 0, item);
    setActiveLayout({ ...activeLayout, fields: next });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleBackgroundUpload = (file: File) => {
    if (!activeLayout) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      window.alert(t('background.invalidType', 'Format gambar harus JPG, PNG, atau WebP.'));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      window.alert(t('background.tooLarge', 'Ukuran gambar maksimal 2 MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : null;
      if (!dataUrl) return;
      setActiveLayout({ ...activeLayout, background: dataUrl });
    };
    reader.readAsDataURL(file);
  };
  const handleClearBackground = () => {
    if (!activeLayout) return;
    setActiveLayout({ ...activeLayout, background: '#ffffff' });
  };

  const addBackSide = () => {
    onChange({ ...layout, back: defaultBackLayout() });
    setSide('back');
    const firstId = defaultBackLayout().fields[0]?.id ?? null;
    setSelectedId(firstId);
  };

  const removeBackSide = () => {
    if (!window.confirm(t('side.removeBackConfirm', 'Hapus seluruh layout sisi belakang?'))) {
      return;
    }
    onChange({ ...layout, back: null });
    setSide('front');
    setSelectedId(layout.fields[0]?.id ?? null);
  };

  return (
    <div className="space-y-3" data-testid="kta-template-editor">
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3"
        role="tablist"
        aria-label={t('side.label', 'Sisi')}
      >
        <div className="flex items-center gap-1">
          <SideTab
            active={side === 'front'}
            onClick={() => {
              setSide('front');
              setSelectedId(layout.fields[0]?.id ?? null);
            }}
            label={t('side.front', 'Depan')}
            testId="kta-side-front"
          />
          <SideTab
            active={side === 'back'}
            disabled={!layout.back}
            onClick={() => {
              if (!layout.back) return;
              setSide('back');
              setSelectedId(layout.back.fields[0]?.id ?? null);
            }}
            label={t('side.back', 'Belakang')}
            testId="kta-side-back"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden md:inline">
            {side === 'front'
              ? t('side.frontHint', 'Edit field-field di sisi depan kartu.')
              : t(
                  'side.backHint',
                  'Sisi belakang dicetak di halaman 2 (atau halaman terpisah pada PDF). Berisi Tata Tertib secara default.',
                )}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            data-testid="kta-bg-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleBackgroundUpload(f);
              e.target.value = '';
            }}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={!activeLayout}
            data-testid="kta-bg-upload"
          >
            <ImageIcon className="size-3.5 mr-1" />
            {t('background.upload', 'Upload Background')}
          </Button>
          {activeLayout?.background?.startsWith('data:image/') ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearBackground}
              data-testid="kta-bg-clear"
            >
              <X className="size-3.5 mr-1" />
              {t('background.clear', 'Hapus Background')}
            </Button>
          ) : null}
          {!layout.back ? (
            <Button
              size="sm"
              variant="outline"
              onClick={addBackSide}
              data-testid="kta-add-back"
            >
              <Plus className="size-3.5 mr-1" />
              {t('side.addBack', 'Tambah Sisi Belakang')}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={removeBackSide}
              data-testid="kta-remove-back"
            >
              <Trash2 className="size-3.5 mr-1" />
              {t('side.removeBack', 'Hapus Sisi Belakang')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-lg border border-border bg-muted/40 p-6 flex items-center justify-center">
        {activeLayout ? (
          <KtaPreview
            layout={activeLayout}
            anggota={preview.anggota}
            identity={preview.identity}
            selectedFieldId={selectedId}
            onSelectField={setSelectedId}
            scale={2.4}
          />
        ) : (
          <div className="text-sm text-muted-foreground">
            {t(
              'side.backHint',
              'Sisi belakang dicetak di halaman 2 (atau halaman terpisah pada PDF). Berisi Tata Tertib secara default.',
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Daftar Field</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={addField}
              disabled={!activeLayout}
              data-testid="kta-field-add"
            >
              <Plus className="size-3.5 mr-1" /> Tambah
            </Button>
          </div>
          <ul className="space-y-1 max-h-56 overflow-auto">
            {(activeLayout?.fields ?? []).map((f, idx) => {
              const total = activeLayout?.fields.length ?? 0;
              return (
                <li
                  key={f.id}
                  className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm cursor-pointer ${
                    selectedId === f.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                  }`}
                  onClick={() => setSelectedId(f.id)}
                  data-testid={`kta-field-row-${f.id}`}
                >
                  <span className="truncate">
                    <span className="text-xs uppercase tracking-wide opacity-60 mr-2">
                      {t(`field.${f.kind}`, f.kind)}
                    </span>
                    {f.kind === 'static' ? f.text : f.id}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveField(f.id, -1);
                          }}
                          disabled={idx === 0}
                          aria-label={t('layer.moveUp', 'Pindah ke atas')}
                          data-testid={`kta-field-up-${f.id}`}
                        >
                          <ArrowUp className="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{t('layer.moveUp', 'Pindah ke atas')}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveField(f.id, 1);
                          }}
                          disabled={idx === total - 1}
                          aria-label={t('layer.moveDown', 'Pindah ke bawah')}
                          data-testid={`kta-field-down-${f.id}`}
                        >
                          <ArrowDown className="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{t('layer.moveDown', 'Pindah ke bawah')}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeField(f.id);
                          }}
                          aria-label="Hapus field"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Hapus field</TooltipContent>
                    </Tooltip>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {selected && (
          <FieldEditor
            field={selected}
            onChange={(patch) => updateField(selected.id, patch)}
          />
        )}

        {activeLayout && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
            <h3 className="text-sm font-semibold">Dimensi Kartu (mm)</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Lebar</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={activeLayout.widthMm}
                  onChange={(e) =>
                    setActiveLayout({
                      ...activeLayout,
                      widthMm: Number.parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Tinggi</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={activeLayout.heightMm}
                  onChange={(e) =>
                    setActiveLayout({
                      ...activeLayout,
                      heightMm: Number.parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

function SideTab({
  active,
  disabled,
  onClick,
  label,
  testId,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
        active
          ? 'bg-primary text-primary-foreground'
          : disabled
            ? 'text-muted-foreground/60 cursor-not-allowed'
            : 'hover:bg-muted'
      }`}
    >
      {label}
    </button>
  );
}

const IMAGE_KINDS: KtaFieldKind[] = ['foto', 'qr', 'ttdKepsek', 'rect'];
const TEXT_OVERRIDE_KINDS: KtaFieldKind[] = ['static', 'berlakuSd'];

function FieldEditor({
  field,
  onChange,
}: {
  field: KtaField;
  onChange: (patch: Partial<KtaField>) => void;
}) {
  const { t } = useTranslation('kta');
  const isText = !IMAGE_KINDS.includes(field.kind);
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3" data-testid="kta-field-editor">
      <h3 className="text-sm font-semibold">Edit Field</h3>
      <div>
        <Label className="text-xs">Tipe</Label>
        <Select
          value={field.kind}
          onValueChange={(v) => onChange({ kind: v as KtaFieldKind })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_KINDS.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {t(`field.${kind}`, kind)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {TEXT_OVERRIDE_KINDS.includes(field.kind) && (
        <div>
          <Label className="text-xs">Teks</Label>
          <Input
            value={field.text ?? ''}
            onChange={(e) => onChange({ text: e.target.value })}
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="X (%)" value={field.x} onChange={(v) => onChange({ x: v })} />
        <NumberField label="Y (%)" value={field.y} onChange={(v) => onChange({ y: v })} />
        <NumberField
          label="Lebar (%)"
          value={field.width}
          onChange={(v) => onChange({ width: v })}
        />
        <NumberField
          label="Tinggi (%)"
          value={field.height}
          onChange={(v) => onChange({ height: v })}
        />
      </div>
      {isText && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Ukuran"
              value={field.fontSize ?? 10}
              onChange={(v) => onChange({ fontSize: v })}
            />
            <div>
              <Label className="text-xs">Warna</Label>
              <Input
                type="color"
                value={field.color ?? '#0f172a'}
                onChange={(e) => onChange({ color: e.target.value })}
                className="h-9"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Bobot</Label>
              <Select
                value={field.fontWeight ?? 'normal'}
                onValueChange={(v) => onChange({ fontWeight: v as 'normal' | 'bold' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="bold">Tebal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Rata</Label>
              <Select
                value={field.align ?? 'left'}
                onValueChange={(v) =>
                  onChange({ align: v as 'left' | 'center' | 'right' })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Kiri</SelectItem>
                  <SelectItem value="center">Tengah</SelectItem>
                  <SelectItem value="right">Kanan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        step="0.5"
        value={value}
        onChange={(e) => onChange(Number.parseFloat(e.target.value) || 0)}
      />
    </div>
  );
}
