import { Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast-manager';
import { anggotaApi, type Anggota } from '@/lib/anggota';
import {
  defaultLayout,
  ktaApi,
  parseLayout,
  type KtaLayout,
  type KtaTemplate,
} from '@/lib/kta';
import { useIdentityStore } from '@/stores/identityStore';
import { TemplateEditor } from './TemplateEditor';

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
    setLayout(parseLayout(tpl.layoutJson));
  };

  const handleNew = () => {
    setActive(null);
    setName('Template Baru');
    setDescription('');
    setLayout(defaultLayout());
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast({ title: 'Nama template wajib diisi', variant: 'destructive' });
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
        <Button onClick={handleNew} data-testid="kta-new-template">
          <Plus className="size-4 mr-1" /> Template Baru
        </Button>
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

          <TemplateEditor
            layout={layout}
            onChange={setLayout}
            preview={{ anggota: previewAnggota, identity }}
          />

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
    </div>
  );
}
