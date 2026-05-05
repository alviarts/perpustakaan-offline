import { LayoutGrid, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast-manager';
import {
  defaultBukuSample,
  defaultLayout,
  labelBukuApi,
  parseLayout,
  type LabelBukuLayout,
  type LabelBukuTemplate,
} from '@/lib/labelBuku';
import { useIdentityStore } from '@/stores/identityStore';
import { PresetGallery } from './PresetGallery';
import type { LabelBukuPreset } from './presets';
import { TemplateEditor } from './TemplateEditor';

export function LabelBukuSettingsPage() {
  const { t } = useTranslation('label-buku');
  const { showToast } = useToast();
  const identity = useIdentityStore((s) => s.identity);

  const [templates, setTemplates] = useState<LabelBukuTemplate[]>([]);
  const [active, setActive] = useState<LabelBukuTemplate | null>(null);
  const [layout, setLayout] = useState<LabelBukuLayout>(defaultLayout());
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [galleryOpen, setGalleryOpen] = useState(false);
  const sample = useMemo(() => defaultBukuSample(), []);

  useEffect(() => {
    void (async () => {
      const list = await labelBukuApi.list();
      setTemplates(list);
      const def = list.find((tpl) => tpl.isDefault) ?? list[0];
      if (def) loadTemplate(def);
    })();
  }, []);

  const loadTemplate = (tpl: LabelBukuTemplate) => {
    setActive(tpl);
    setName(tpl.nama);
    setDescription(tpl.deskripsi ?? '');
    setLayout(parseLayout(tpl.layoutJson));
  };

  const handleNew = () => {
    setActive(null);
    setName('Template Baru');
    setDescription('');
    setLayout(defaultLayout());
  };

  const handlePickPreset = (preset: LabelBukuPreset) => {
    setActive(null);
    setName(preset.nama);
    setDescription(preset.deskripsi);
    setLayout(preset.layout);
    showToast({
      title: t('gallery.applied', { defaultValue: 'Template dimuat' }),
      description: t('gallery.appliedHint', {
        defaultValue:
          'Klik "Simpan" untuk menyimpan, atau ubah dulu warna / posisi sesuai kebutuhan.',
      }),
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast({
        title: t('toast.nameRequired', { defaultValue: 'Nama template wajib diisi' }),
        variant: 'destructive',
      });
      return;
    }
    const payload = {
      nama: name.trim(),
      deskripsi: description.trim() || null,
      layoutJson: JSON.stringify(layout),
      isDefault: active?.isDefault ?? false,
    };
    try {
      const saved = active
        ? await labelBukuApi.update(active.id, payload)
        : await labelBukuApi.create(payload);
      const list = await labelBukuApi.list();
      setTemplates(list);
      loadTemplate(saved);
      showToast({ title: t('toast.saved', { defaultValue: 'Template tersimpan' }) });
    } catch (e) {
      showToast({
        title: t('toast.saveFailed', { defaultValue: 'Gagal menyimpan' }),
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!active) return;
    if (!window.confirm(`Hapus template "${active.nama}"?`)) return;
    await labelBukuApi.delete(active.id);
    const list = await labelBukuApi.list();
    setTemplates(list);
    if (list[0]) loadTemplate(list[0]);
    else handleNew();
    showToast({ title: t('toast.deleted', { defaultValue: 'Template dihapus' }) });
  };

  const handleSetDefault = async () => {
    if (!active) return;
    await labelBukuApi.setDefault(active.id);
    const list = await labelBukuApi.list();
    setTemplates(list);
    const found = list.find((tpl) => tpl.id === active.id);
    if (found) loadTemplate(found);
    showToast({ title: t('toast.defaultSet', { defaultValue: 'Template default diatur' }) });
  };

  const sidebar = useMemo(
    () => (
      <ul className="space-y-1">
        {templates.map((tpl) => (
          <li
            key={tpl.id}
            className={`flex items-center justify-between rounded-md px-3 py-2 text-sm cursor-pointer ${
              active?.id === tpl.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
            }`}
            onClick={() => loadTemplate(tpl)}
          >
            <span className="truncate flex items-center gap-1.5">
              {tpl.isDefault && <Star className="size-3 fill-amber-400 text-amber-500" />}
              {tpl.nama}
            </span>
          </li>
        ))}
      </ul>
    ),
    [templates, active?.id],
  );

  return (
    <div className="space-y-6" data-testid="label-buku-settings-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {t('settings.title', { defaultValue: 'Label Buku — Template Editor' })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('settings.subtitle', {
              defaultValue: 'Atur layout label barcode buku: judul, kode, barcode/QR.',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setGalleryOpen(true)}
            data-testid="label-buku-open-gallery"
          >
            <LayoutGrid className="size-4 mr-1" />
            {t('gallery.open', { defaultValue: 'Galeri Template' })}
          </Button>
          <Button onClick={handleNew} data-testid="label-buku-new-template">
            <Plus className="size-4 mr-1" />
            {t('settings.newTemplate', { defaultValue: 'Template Baru' })}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold mb-2">
              {t('settings.list', { defaultValue: 'Daftar Template' })}
            </h3>
            {sidebar}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-4 grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="label-buku-name">
                {t('settings.fieldName', { defaultValue: 'Nama Template' })}
              </Label>
              <Input
                id="label-buku-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="label-buku-name-input"
              />
            </div>
            <div>
              <Label htmlFor="label-buku-desc">
                {t('settings.fieldDescription', { defaultValue: 'Deskripsi' })}
              </Label>
              <Input
                id="label-buku-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <TemplateEditor
            layout={layout}
            onChange={setLayout}
            preview={{ buku: sample, identity }}
          />

          <div className="flex items-center justify-end gap-2">
            {active && !active.isDefault && (
              <Button variant="outline" onClick={handleSetDefault}>
                <Star className="size-4 mr-1" />
                {t('settings.setDefault', { defaultValue: 'Jadikan Default' })}
              </Button>
            )}
            {active && (
              <Button variant="outline" onClick={handleDelete}>
                <Trash2 className="size-4 mr-1" />
                {t('settings.delete', { defaultValue: 'Hapus' })}
              </Button>
            )}
            <Button onClick={handleSave} data-testid="label-buku-save">
              <Pencil className="size-4 mr-1" />
              {t('settings.save', { defaultValue: 'Simpan' })}
            </Button>
          </div>
        </div>
      </div>
      <PresetGallery
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        identity={identity}
        onPick={handlePickPreset}
      />
    </div>
  );
}
