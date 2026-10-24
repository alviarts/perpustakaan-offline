import { Crop, LayoutGrid, Pencil, Plus, SlidersHorizontal, Star, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast-manager';
import { anggotaApi, type Anggota } from '@/lib/anggota';
import { assetsApi } from '@/lib/assets';
import {
  defaultLayout,
  ktaApi,
  parseLayout,
  type KtaLayout,
  type KtaTemplate,
} from '@/lib/kta';
import { useIdentityStore } from '@/stores/identityStore';
import { KtaPreview } from './KtaPreview';
import { PresetGallery } from './PresetGallery';
import type { KtaPreset } from './presets';
import { TemplateEditor } from './TemplateEditor';

/** Ukuran kartu ID-1 (ATM/kredit) — dikunci agar hasil cetak konsisten. */
const CARD_W_MM = 85.6;
const CARD_H_MM = 53.98;

function lockCardSize(layout: KtaLayout): KtaLayout {
  return {
    ...layout,
    widthMm: CARD_W_MM,
    heightMm: CARD_H_MM,
    back: layout.back
      ? { ...layout.back, widthMm: CARD_W_MM, heightMm: CARD_H_MM }
      : layout.back,
  };
}

export function KtaSettingsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const identity = useIdentityStore((s) => s.identity);

  const [templates, setTemplates] = useState<KtaTemplate[]>([]);
  const [previewAnggota, setPreviewAnggota] = useState<Anggota | null>(null);
  const [active, setActive] = useState<KtaTemplate | null>(null);
  const [layout, setLayout] = useState<KtaLayout>(defaultLayout());
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [refitBusy, setRefitBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const list = await ktaApi.list();
      setTemplates(list);
      const def = list.find((t) => t.isDefault) ?? list[0];
      if (def) {
        loadTemplate(def);
      }
    })();
    void (async () => {
      const r = await anggotaApi.list({ limit: 1, offset: 0 });
      if (r.items.length > 0) setPreviewAnggota(r.items[0]!);
    })();
  }, []);

  const loadTemplate = (tpl: KtaTemplate) => {
    setActive(tpl);
    setName(tpl.nama);
    setDescription(tpl.deskripsi ?? '');
    setLayout(lockCardSize(parseLayout(tpl.layoutJson)));
  };

  const handleNew = () => {
    setActive(null);
    setName('Template Baru');
    setDescription('');
    setLayout(defaultLayout());
  };

  const handlePickPreset = (preset: KtaPreset) => {
    setActive(null);
    setName(preset.nama);
    setDescription(preset.deskripsi);
    setLayout(lockCardSize(preset.layout));
    showToast({
      title: t('kta:gallery.applied', 'Template dimuat'),
      description: t(
        'kta:gallery.appliedHint',
        'Klik "Simpan" untuk menyimpan, atau ubah dulu warna / posisi sesuai kebutuhan.',
      ),
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast({ title: 'Nama template wajib diisi', variant: 'destructive' });
      return;
    }
    const payload = {
      nama: name.trim(),
      deskripsi: description.trim() || null,
      layoutJson: JSON.stringify(lockCardSize(layout)),
      isDefault: active?.isDefault ?? false,
    };
    try {
      const saved = active
        ? await ktaApi.update(active.id, payload)
        : await ktaApi.create(payload);
      const list = await ktaApi.list();
      setTemplates(list);
      loadTemplate(saved);
      showToast({ title: 'Template tersimpan' });
    } catch (e) {
      showToast({
        title: 'Gagal menyimpan',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!active) return;
    if (!window.confirm(`Hapus template "${active.nama}"?`)) return;
    await ktaApi.delete(active.id);
    const list = await ktaApi.list();
    setTemplates(list);
    if (list[0]) {
      loadTemplate(list[0]);
    } else {
      handleNew();
    }
    showToast({ title: 'Template dihapus' });
  };

  const handleSetDefault = async () => {
    if (!active) return;
    await ktaApi.setDefault(active.id);
    const list = await ktaApi.list();
    setTemplates(list);
    const found = list.find((t) => t.id === active.id);
    if (found) loadTemplate(found);
    showToast({ title: 'Template default diatur' });
  };

  /**
   * BUG-19 — admin-trigger batch that re-fits every existing anggota
   * foto to portrait 3:4. New uploads are already cropped at save
   * time; this button exists only to migrate pre-existing photos
   * uploaded before the smart-fit pipeline shipped. The confirm
   * dialog uses `window.confirm` to stay framework-light — the rest
   * of the settings page already does the same for destructive ops.
   */
  const handleRefitAnggotaPhotos = async () => {
    if (refitBusy) return;
    const ok = window.confirm(
      t(
        'kta:foto.refitConfirm',
        'Re-fit semua foto anggota ke aspek 3:4 portrait? File asli akan ditimpa di tempat (tidak bisa di-undo). Foto yang sudah 3:4 akan dilewati.',
      ),
    );
    if (!ok) return;
    setRefitBusy(true);
    try {
      const result = await assetsApi.refitAnggotaPhotos();
      showToast({
        title: t('kta:foto.refitDone', 'Re-fit selesai'),
        description: t(
          'kta:foto.refitSummary',
          '{{refit}} foto di-fit, {{skipped}} dilewati, {{failed}} gagal (dari {{total}} total).',
          {
            refit: result.refit,
            skipped: result.skipped,
            failed: result.failed,
            total: result.total,
          },
        ),
      });
    } catch (err) {
      showToast({
        title: t('kta:foto.refitFailed', 'Re-fit gagal'),
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setRefitBusy(false);
    }
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
    <div className="space-y-6" data-testid="kta-settings-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('kta:title', 'KTA — Template Editor')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('kta:subtitle', 'Atur layout kartu tanda anggota: foto, identitas, QR.')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setGalleryOpen(true)}
            data-testid="kta-open-gallery"
          >
            <LayoutGrid className="size-4 mr-1" />
            {t('kta:gallery.open', 'Galeri Template')}
          </Button>
          <Button onClick={handleNew} data-testid="kta-new-template">
            <Plus className="size-4 mr-1" /> Template Baru
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold mb-2">Daftar Template</h3>
            {sidebar}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-4 grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="kta-name">Nama Template</Label>
              <Input
                id="kta-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="kta-name-input"
              />
            </div>
            <div>
              <Label htmlFor="kta-desc">Deskripsi</Label>
              <Input
                id="kta-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-4">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">Kartu (ukuran tetap)</h3>
              <p className="text-sm text-muted-foreground">
                ID-1 standar ATM/kredit: 85,6 × 53,98 mm. Ukuran tidak bisa diubah agar
                hasil cetak konsisten.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setAdvancedOpen(true)}
                data-testid="kta-open-advanced"
              >
                <SlidersHorizontal className="size-4 mr-1" />
                Advanced (layout manual)
              </Button>
            </div>
          </div>

          {/* Preview ukuran fix (ID-1) — pengaturan detail ada di popup Advanced. */}
          <div className="rounded-lg border border-border bg-card p-4">
            <KtaPreview
              layout={layout}
              anggota={previewAnggota}
              identity={identity}
              fitToWidth
            />
            {layout.back && (
              <div className="mt-4 border-t border-border pt-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Sisi belakang</p>
                <KtaPreview
                  layout={layout.back}
                  anggota={previewAnggota}
                  identity={identity}
                  fitToWidth
                />
              </div>
            )}
          </div>

          <Dialog open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Advanced — Layout Manual</DialogTitle>
                <DialogDescription>
                  Ubah posisi, ukuran, dan isi setiap elemen kartu. Perubahan di sini
                  langsung terlihat pada pratinjau.
                </DialogDescription>
              </DialogHeader>
              <TemplateEditor
                layout={layout}
                onChange={(next) => setLayout({ ...next, widthMm: 85.6, heightMm: 53.98 })}
                preview={{ anggota: previewAnggota, identity }}
              />
            </DialogContent>
          </Dialog>

          <div className="flex items-center justify-end gap-2">
            {active && !active.isDefault && (
              <Button variant="outline" onClick={handleSetDefault}>
                <Star className="size-4 mr-1" /> Jadikan Default
              </Button>
            )}
            {active && (
              <Button variant="outline" onClick={handleDelete}>
                <Trash2 className="size-4 mr-1" /> Hapus
              </Button>
            )}
            <Button onClick={handleSave} data-testid="kta-save">
              <Pencil className="size-4 mr-1" /> Simpan
            </Button>
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-4" data-testid="kta-foto-tools">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">
              {t('kta:foto.toolsHeading', 'Foto Tools — aspek 3:4')}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t(
                'kta:foto.toolsHelp',
                'Foto baru akan otomatis di-crop ke portrait 3:4 saat upload. Tombol di samping me-rewrite foto lama (sebelum fitur ini) supaya konsisten dengan slot KTA.',
              )}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleRefitAnggotaPhotos}
            disabled={refitBusy}
            data-testid="kta-refit-anggota-photos"
          >
            <Crop className="size-4 mr-1" />
            {refitBusy
              ? t('kta:foto.refitBusy', 'Memproses…')
              : t('kta:foto.refitButton', 'Re-fit semua foto')}
          </Button>
        </div>
      </div>
      <PresetGallery
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        identity={identity}
        previewAnggota={previewAnggota}
        onPick={handlePickPreset}
      />
    </div>
  );
}
