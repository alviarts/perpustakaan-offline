import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
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
import type { KtaField, KtaFieldKind, KtaLayout } from '@/lib/kta';
import type { LibraryIdentity } from '@/stores/identityStore';
import { KtaPreview } from './KtaPreview';

interface Props {
  layout: KtaLayout;
  onChange: (next: KtaLayout) => void;
  preview: { anggota: Anggota | null; identity: LibraryIdentity };
}

const FIELD_KINDS: { value: KtaFieldKind; label: string }[] = [
  { value: 'static', label: 'Teks Statis' },
  { value: 'identitas', label: 'Identitas Perpustakaan' },
  { value: 'nama', label: 'Nama Anggota' },
  { value: 'kodeAnggota', label: 'Kode / NIS' },
  { value: 'kelas', label: 'Kelas' },
  { value: 'jurusan', label: 'Jurusan' },
  { value: 'agama', label: 'Agama' },
  { value: 'foto', label: 'Foto' },
  { value: 'qr', label: 'QR Code' },
];

export function TemplateEditor({ layout, onChange, preview }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(layout.fields[0]?.id ?? null);

  const selected = useMemo(
    () => layout.fields.find((f) => f.id === selectedId) ?? null,
    [layout.fields, selectedId],
  );

  const updateField = (id: string, patch: Partial<KtaField>) => {
    onChange({
      ...layout,
      fields: layout.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    });
  };

  const addField = () => {
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
    onChange({ ...layout, fields: [...layout.fields, next] });
    setSelectedId(id);
  };

  const removeField = (id: string) => {
    onChange({ ...layout, fields: layout.fields.filter((f) => f.id !== id) });
    if (selectedId === id) setSelectedId(null);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-lg border border-border bg-muted/40 p-6 flex items-center justify-center">
        <KtaPreview
          layout={layout}
          anggota={preview.anggota}
          identity={preview.identity}
          selectedFieldId={selectedId}
          onSelectField={setSelectedId}
          scale={2.4}
        />
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Daftar Field</h3>
            <Button size="sm" variant="outline" onClick={addField} data-testid="kta-field-add">
              <Plus className="size-3.5 mr-1" /> Tambah
            </Button>
          </div>
          <ul className="space-y-1 max-h-56 overflow-auto">
            {layout.fields.map((f) => (
              <li
                key={f.id}
                className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm cursor-pointer ${
                  selectedId === f.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                }`}
                onClick={() => setSelectedId(f.id)}
              >
                <span className="truncate">
                  <span className="text-xs uppercase tracking-wide opacity-60 mr-2">{f.kind}</span>
                  {f.kind === 'static' ? f.text : f.id}
                </span>
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
              </li>
            ))}
          </ul>
        </div>

        {selected && (
          <FieldEditor
            field={selected}
            onChange={(patch) => updateField(selected.id, patch)}
          />
        )}

        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <h3 className="text-sm font-semibold">Dimensi Kartu (mm)</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Lebar</Label>
              <Input
                type="number"
                step="0.1"
                value={layout.widthMm}
                onChange={(e) =>
                  onChange({ ...layout, widthMm: Number.parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <Label className="text-xs">Tinggi</Label>
              <Input
                type="number"
                step="0.1"
                value={layout.heightMm}
                onChange={(e) =>
                  onChange({ ...layout, heightMm: Number.parseFloat(e.target.value) || 0 })
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldEditor({
  field,
  onChange,
}: {
  field: KtaField;
  onChange: (patch: Partial<KtaField>) => void;
}) {
  const isText = !['foto', 'qr'].includes(field.kind);
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
            {FIELD_KINDS.map((k) => (
              <SelectItem key={k.value} value={k.value}>
                {k.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {field.kind === 'static' && (
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
