import { Printer, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toast-manager';
import { anggotaApi, type Anggota } from '@/lib/anggota';
import {
  defaultLayout,
  ktaApi,
  parseLayout,
  type KtaTemplate,
} from '@/lib/kta';
import { useIdentityStore } from '@/stores/identityStore';
import { KtaPreview } from './KtaPreview';
import { buildKtaPrintHtml, openKtaPrintWindow } from './print';

export function CetakKtaPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const identity = useIdentityStore((s) => s.identity);

  const [templates, setTemplates] = useState<KtaTemplate[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [anggota, setAnggota] = useState<Anggota[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    void (async () => {
      const list = await ktaApi.list();
      setTemplates(list);
      const def = list.find((t) => t.isDefault) ?? list[0];
      if (def) setActiveId(def.id);
    })();
    void (async () => {
      const r = await anggotaApi.list({ limit: 200, offset: 0 });
      setAnggota(r.items);
    })();
  }, []);

  const active = useMemo(
    () => templates.find((t) => t.id === activeId) ?? null,
    [templates, activeId],
  );
  const layout = useMemo(
    () => (active ? parseLayout(active.layoutJson) : defaultLayout()),
    [active],
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return anggota;
    return anggota.filter(
      (a) =>
        a.nama.toLowerCase().includes(q) ||
        a.kodeAnggota.toLowerCase().includes(q) ||
        (a.kelas ?? '').toLowerCase().includes(q),
    );
  }, [anggota, search]);

  const previewAnggota = useMemo(() => {
    const first = [...selected][0];
    return anggota.find((a) => a.id === first) ?? anggota[0] ?? null;
  }, [anggota, selected]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (filtered.every((a) => selected.has(a.id))) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const a of filtered) next.delete(a.id);
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const a of filtered) next.add(a.id);
        return next;
      });
    }
  };

  const handlePrint = async () => {
    if (selected.size === 0) {
      showToast({ title: 'Pilih minimal satu anggota', variant: 'destructive' });
      return;
    }
    if (!active) {
      showToast({ title: 'Pilih template terlebih dahulu', variant: 'destructive' });
      return;
    }
    setPrinting(true);
    try {
      const items = anggota.filter((a) => selected.has(a.id));
      const html = await buildKtaPrintHtml({ layout, anggota: items, identity });
      openKtaPrintWindow(html);
      showToast({ title: `Mencetak ${items.length} KTA` });
    } catch (e) {
      showToast({
        title: 'Gagal mencetak',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="cetak-kta-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('kta:cetakTitle', 'Cetak KTA')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('kta:cetakSubtitle', 'Pilih anggota dan template, lalu cetak satu / batch.')}
          </p>
        </div>
        <Button
          onClick={handlePrint}
          disabled={printing || selected.size === 0 || !active}
          data-testid="cetak-kta-print"
        >
          <Printer className="size-4 mr-1" />
          Cetak {selected.size > 0 ? `(${selected.size})` : ''}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="kta-template">Template</Label>
              <Select
                value={activeId ? String(activeId) : ''}
                onValueChange={(v) => setActiveId(Number.parseInt(v, 10))}
              >
                <SelectTrigger id="kta-template" data-testid="kta-template-select">
                  <SelectValue placeholder="Pilih template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.id} value={String(tpl.id)}>
                      {tpl.nama} {tpl.isDefault ? '⭐' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="kta-search">Cari Anggota</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
                <Input
                  id="kta-search"
                  placeholder="nama / kode / kelas"
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border max-h-[420px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wide">
                <tr>
                  <th className="p-2 w-8">
                    <Checkbox
                      checked={
                        filtered.length > 0 && filtered.every((a) => selected.has(a.id))
                      }
                      onCheckedChange={toggleAll}
                      aria-label="Pilih semua"
                    />
                  </th>
                  <th className="p-2 text-left">Kode</th>
                  <th className="p-2 text-left">Nama</th>
                  <th className="p-2 text-left">Kelas</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr
                    key={a.id}
                    className={`border-t border-border ${
                      selected.has(a.id) ? 'bg-primary/5' : ''
                    }`}
                  >
                    <td className="p-2">
                      <Checkbox
                        checked={selected.has(a.id)}
                        onCheckedChange={() => toggle(a.id)}
                        aria-label={`Pilih ${a.nama}`}
                      />
                    </td>
                    <td className="p-2 font-mono text-xs">{a.kodeAnggota}</td>
                    <td className="p-2">{a.nama}</td>
                    <td className="p-2">{a.kelas ?? '-'}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td className="p-4 text-center text-muted-foreground" colSpan={4}>
                      Tidak ada anggota
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">Preview</h3>
          {previewAnggota ? (
            <KtaPreview layout={layout} anggota={previewAnggota} identity={identity} scale={2.4} />
          ) : (
            <p className="text-sm text-muted-foreground">Pilih anggota untuk lihat preview.</p>
          )}
        </div>
      </div>
    </div>
  );
}
