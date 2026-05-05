import { FileDown, FolderOpen, Printer, Search } from 'lucide-react';
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
import { bukuApi, type Buku } from '@/lib/buku';
import {
  defaultBukuSample,
  defaultLayout,
  labelBukuApi,
  parseLayout,
  type LabelBukuTemplate,
} from '@/lib/labelBuku';
import { useIdentityStore } from '@/stores/identityStore';
import { LabelBukuPreview } from './LabelBukuPreview';
import { buildLabelBukuPdfBytes } from './pdf';
import { buildLabelBukuPrintHtml, openLabelBukuPrintWindow, type LabelBukuItem } from './print';

const PAGE_SIZE = 100;

/**
 * Top-level page for printing book labels (v1.0.6 #22). Mirrors
 * `kta/CetakKtaPage` — pick a template, multi-select books, then print or
 * save as PDF. One label is generated per eksemplar (per physical copy)
 * because the barcode encodes `kode_eksemplar`, not `kode_buku`.
 */
export function CetakLabelPage() {
  const { t } = useTranslation('label-buku');
  const { showToast } = useToast();
  const identity = useIdentityStore((s) => s.identity);

  const [templates, setTemplates] = useState<LabelBukuTemplate[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [buku, setBuku] = useState<Buku[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [printing, setPrinting] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);
  const [openingFolder, setOpeningFolder] = useState(false);
  const [lastExport, setLastExport] = useState<{ filename: string; dirAbsPath: string } | null>(
    null,
  );

  useEffect(() => {
    void (async () => {
      const list = await labelBukuApi.list();
      setTemplates(list);
      const def = list.find((tpl) => tpl.isDefault) ?? list[0];
      if (def) setActiveId(def.id);
    })();
    void (async () => {
      const r = await bukuApi.list({ limit: PAGE_SIZE, offset: 0 });
      setBuku(r.items);
    })();
  }, []);

  const active = useMemo(
    () => templates.find((tpl) => tpl.id === activeId) ?? null,
    [templates, activeId],
  );
  const layout = useMemo(
    () => (active ? parseLayout(active.layoutJson) : defaultLayout()),
    [active],
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return buku;
    return buku.filter(
      (b) =>
        b.judul.toLowerCase().includes(q) ||
        b.kodeBuku.toLowerCase().includes(q) ||
        (b.pengarang ?? '').toLowerCase().includes(q),
    );
  }, [buku, search]);

  const totalEksemplarSelected = useMemo(() => {
    return [...selected]
      .map((id) => buku.find((b) => b.id === id)?.jumlahEksemplar ?? 0)
      .reduce((a, b) => a + b, 0);
  }, [selected, buku]);

  const sample = useMemo(() => {
    const pickId = [...selected][0] ?? buku[0]?.id;
    const pick = buku.find((b) => b.id === pickId);
    if (!pick) return defaultBukuSample();
    return {
      judul: pick.judul,
      kodeBuku: pick.kodeBuku,
      kodeEksemplar: `${pick.kodeBuku}-01`,
      pengarang: pick.pengarang ?? '-',
      penerbit: pick.penerbit ?? '-',
      tahun: pick.tahunTerbit ? String(pick.tahunTerbit) : '-',
      kodeDdc: pick.kodeDdc ?? '-',
    };
  }, [selected, buku]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (filtered.every((b) => selected.has(b.id))) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const b of filtered) next.delete(b.id);
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const b of filtered) next.add(b.id);
        return next;
      });
    }
  };

  /** Resolve selected books into a flat list of eksemplar-shaped items. */
  async function resolveItems(): Promise<LabelBukuItem[]> {
    const items: LabelBukuItem[] = [];
    for (const id of selected) {
      const book = buku.find((b) => b.id === id);
      if (!book) continue;
      try {
        const detail = await bukuApi.get(id);
        for (const ek of detail.eksemplar) {
          items.push({
            kodeEksemplar: ek.kodeEksemplar,
            judul: book.judul,
            kodeBuku: book.kodeBuku,
            pengarang: book.pengarang ?? '-',
            penerbit: book.penerbit ?? '-',
            tahun: book.tahunTerbit ? String(book.tahunTerbit) : '-',
            kodeDdc: book.kodeDdc ?? '-',
          });
        }
      } catch (e) {
        console.warn(`failed to load eksemplar for buku ${id}`, e);
      }
    }
    return items;
  }

  const handlePrint = async () => {
    if (selected.size === 0) {
      showToast({
        title: t('toast.selectBook', { defaultValue: 'Pilih minimal satu buku' }),
        variant: 'destructive',
      });
      return;
    }
    if (!active) {
      showToast({
        title: t('toast.selectTemplate', { defaultValue: 'Pilih template terlebih dahulu' }),
        variant: 'destructive',
      });
      return;
    }
    setPrinting(true);
    try {
      const items = await resolveItems();
      if (items.length === 0) {
        showToast({
          title: t('toast.noEksemplar', {
            defaultValue: 'Buku terpilih tidak punya eksemplar untuk dicetak',
          }),
          variant: 'destructive',
        });
        return;
      }
      const html = await buildLabelBukuPrintHtml({ layout, items, identity });
      openLabelBukuPrintWindow(html);
      showToast({
        title: t('toast.printing', { count: items.length, defaultValue: 'Mencetak {{count}} label' }),
      });
    } catch (e) {
      showToast({
        title: t('toast.printFailed', { defaultValue: 'Gagal mencetak' }),
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setPrinting(false);
    }
  };

  const handleSavePdf = async () => {
    if (selected.size === 0) {
      showToast({
        title: t('toast.selectBook', { defaultValue: 'Pilih minimal satu buku' }),
        variant: 'destructive',
      });
      return;
    }
    if (!active) {
      showToast({
        title: t('toast.selectTemplate', { defaultValue: 'Pilih template terlebih dahulu' }),
        variant: 'destructive',
      });
      return;
    }
    setSavingPdf(true);
    try {
      const items = await resolveItems();
      if (items.length === 0) {
        showToast({
          title: t('toast.noEksemplar', {
            defaultValue: 'Buku terpilih tidak punya eksemplar untuk dicetak',
          }),
          variant: 'destructive',
        });
        return;
      }
      const bytes = await buildLabelBukuPdfBytes({ layout, items, identity });
      const result = await labelBukuApi.exportPdf(new Uint8Array(bytes));
      setLastExport({ filename: result.filename, dirAbsPath: result.dirAbsPath });
      showToast({
        title: t('toast.pdfSaved', { defaultValue: 'PDF tersimpan' }),
        description: result.filename,
      });
    } catch (e) {
      showToast({
        title: t('toast.pdfFailed', { defaultValue: 'Gagal menyimpan PDF' }),
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setSavingPdf(false);
    }
  };

  const handleOpenFolder = async () => {
    setOpeningFolder(true);
    try {
      await labelBukuApi.openExportsFolder();
    } catch (e) {
      showToast({
        title: t('toast.openFolderFailed', { defaultValue: 'Gagal membuka folder hasil' }),
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setOpeningFolder(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6" data-testid="cetak-label-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {t('cetak.title', { defaultValue: 'Cetak Label & Barcode Buku' })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('cetak.subtitle', {
              defaultValue:
                'Pilih template lalu pilih buku — satu label akan dicetak untuk tiap eksemplar.',
            })}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleOpenFolder}
          disabled={openingFolder}
          data-testid="cetak-label-open-folder"
        >
          <FolderOpen className="size-4 mr-1" />
          {t('cetak.openFolder', { defaultValue: 'Buka Folder Hasil' })}
        </Button>
      </div>

      {lastExport ? (
        <div
          className="flex flex-wrap items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
          data-testid="cetak-label-last-export"
          role="status"
        >
          <FileDown className="size-4" />
          <span>
            {t('cetak.lastExport', { defaultValue: 'PDF terakhir disimpan' })}:{' '}
            <code className="font-mono">{lastExport.filename}</code>
          </span>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-emerald-900 underline dark:text-emerald-200"
            onClick={handleOpenFolder}
            disabled={openingFolder}
          >
            {t('cetak.openFolder', { defaultValue: 'Buka Folder Hasil' })}
          </Button>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Search className="size-4 text-muted-foreground" />
              <Input
                placeholder={t('cetak.searchPlaceholder', {
                  defaultValue: 'Cari judul / kode buku / pengarang…',
                })}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9"
              />
              <Button variant="outline" size="sm" onClick={toggleAll}>
                {filtered.length > 0 && filtered.every((b) => selected.has(b.id))
                  ? t('cetak.clearAll', { defaultValue: 'Hapus semua' })
                  : t('cetak.selectAll', { defaultValue: 'Pilih semua' })}
              </Button>
            </div>
            <div className="max-h-[480px] overflow-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-xs uppercase tracking-wide">
                  <tr>
                    <th className="w-10 px-2 py-2"></th>
                    <th className="px-2 py-2 text-left">
                      {t('cetak.col.kode', { defaultValue: 'Kode' })}
                    </th>
                    <th className="px-2 py-2 text-left">
                      {t('cetak.col.judul', { defaultValue: 'Judul' })}
                    </th>
                    <th className="px-2 py-2 text-right">
                      {t('cetak.col.eksemplar', { defaultValue: 'Eksemplar' })}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => (
                    <tr
                      key={b.id}
                      className={`border-t border-border cursor-pointer hover:bg-muted/40 ${
                        selected.has(b.id) ? 'bg-primary/5' : ''
                      }`}
                      onClick={() => toggle(b.id)}
                    >
                      <td className="px-2 py-1.5">
                        <Checkbox
                          checked={selected.has(b.id)}
                          onCheckedChange={() => toggle(b.id)}
                          aria-label={`Pilih ${b.judul}`}
                        />
                      </td>
                      <td className="px-2 py-1.5 font-mono text-xs">{b.kodeBuku}</td>
                      <td className="px-2 py-1.5">
                        <div className="font-medium truncate max-w-[280px]">{b.judul}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[280px]">
                          {b.pengarang ?? '-'}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-right">{b.jumlahEksemplar}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-2 py-8 text-center text-muted-foreground">
                        {t('cetak.empty', { defaultValue: 'Tidak ada buku yang cocok' })}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="text-xs text-muted-foreground">
              {t('cetak.summary', {
                defaultValue: '{{books}} buku terpilih · {{labels}} label akan dicetak',
                books: selected.size,
                labels: totalEksemplarSelected,
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div>
              <Label>{t('cetak.template', { defaultValue: 'Template' })}</Label>
              <Select
                value={activeId ? String(activeId) : ''}
                onValueChange={(v) => setActiveId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t('cetak.selectTemplate', { defaultValue: 'Pilih template…' })}
                  />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.id} value={String(tpl.id)}>
                      {tpl.nama}
                      {tpl.isDefault ? ' ★' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 flex items-center justify-center">
              <LabelBukuPreview layout={layout} buku={sample} identity={identity} scale={1.4} />
            </div>
          </div>

          <div className="space-y-2">
            <Button
              className="w-full"
              onClick={handlePrint}
              disabled={printing || selected.size === 0 || !active}
              data-testid="label-buku-print"
            >
              <Printer className="size-4 mr-1" />
              {printing
                ? t('cetak.printing', { defaultValue: 'Menyiapkan…' })
                : t('cetak.print', { defaultValue: 'Cetak' })}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleSavePdf}
              disabled={savingPdf || selected.size === 0 || !active}
              data-testid="label-buku-pdf"
            >
              <FileDown className="size-4 mr-1" />
              {savingPdf
                ? t('cetak.saving', { defaultValue: 'Menyimpan…' })
                : t('cetak.savePdf', { defaultValue: 'Simpan PDF' })}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => window.open('/settings/label-buku', '_self')}
            >
              <FolderOpen className="size-4 mr-1" />
              {t('cetak.manageTemplates', { defaultValue: 'Kelola Template' })}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
