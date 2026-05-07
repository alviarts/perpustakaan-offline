import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Search, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast-manager';
import { bukuApi, type Buku } from '@/lib/buku';
import {
  bukuPilihanApi,
  MAX_ACTIVE_PINS,
  type BukuPilihanSlide,
} from '@/lib/bukuPilihan';

/**
 * E1-OPACBukuPilihan — admin curation page for the OPAC featured carousel.
 * Lets admins pin up to {@link MAX_ACTIVE_PINS} buku, set an optional
 * label, reorder via up/down buttons, and unpin. The OPAC home page reads
 * the same `bukuPilihanApi.listActive()` source so changes propagate after
 * navigating back.
 */
export function BukuPilihanAdminPage(): JSX.Element {
  const { t } = useTranslation(['buku', 'common']);
  const { showToast } = useToast();
  const [slides, setSlides] = useState<BukuPilihanSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Buku[]>([]);
  const [searching, setSearching] = useState(false);
  const [label, setLabel] = useState('');

  const refresh = async (): Promise<void> => {
    setLoading(true);
    try {
      const list = await bukuPilihanApi.listActive();
      setSlides(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const pinnedIds = useMemo(() => new Set(slides.map((s) => s.bukuId)), [slides]);

  const runSearch = async (): Promise<void> => {
    const q = search.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const r = await bukuApi.list({ query: q, limit: 20 });
      setResults(r.items);
    } finally {
      setSearching(false);
    }
  };

  const onPin = async (buku: Buku): Promise<void> => {
    if (slides.length >= MAX_ACTIVE_PINS) {
      showToast({
        variant: 'destructive',
        title: t('buku:pilihan.capTitle', {
          defaultValue: 'Maksimum {{n}} buku pilihan aktif',
          n: MAX_ACTIVE_PINS,
        }),
        description: t('buku:pilihan.capDescription', {
          defaultValue: 'Lepas pin lama dulu sebelum menambah yang baru.',
        }),
      });
      return;
    }
    setSaving(true);
    try {
      await bukuPilihanApi.pin({
        bukuId: buku.id,
        label: label.trim() || null,
      });
      await refresh();
      setLabel('');
      showToast({
        title: t('buku:pilihan.pinSaved', {
          defaultValue: '"{{judul}}" ditambahkan ke buku pilihan',
          judul: buku.judul,
        }),
      });
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('buku:pilihan.error', { defaultValue: 'Gagal menyimpan' }),
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  };

  const onUnpin = async (id: number): Promise<void> => {
    setSaving(true);
    try {
      await bukuPilihanApi.unpin(id);
      await refresh();
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('buku:pilihan.error', { defaultValue: 'Gagal menyimpan' }),
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  };

  const move = async (idx: number, delta: number): Promise<void> => {
    const target = idx + delta;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    const [moved] = next.splice(idx, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    setSlides(next);
    setSaving(true);
    try {
      await bukuPilihanApi.reorder(next.map((s) => s.id));
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('buku:pilihan.error', { defaultValue: 'Gagal menyimpan' }),
        description: err instanceof Error ? err.message : String(err),
      });
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          {t('buku:pilihan.title', { defaultValue: 'Atur Buku Pilihan OPAC' })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('buku:pilihan.subtitle', {
            defaultValue:
              'Pin hingga {{n}} buku untuk muncul di carousel halaman OPAC. Drag urutan dengan tombol panah.',
            n: MAX_ACTIVE_PINS,
          })}
        </p>
      </header>

      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Star className="h-4 w-4 text-amber-500" />
          {t('buku:pilihan.activeHeading', {
            defaultValue: 'Pilihan aktif ({{n}}/{{max}})',
            n: slides.length,
            max: MAX_ACTIVE_PINS,
          })}
        </h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('common:loading', { defaultValue: 'Memuat…' })}</p>
        ) : slides.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('buku:pilihan.empty', {
              defaultValue: 'Belum ada buku pilihan. Cari dan pin buku di bawah.',
            })}
          </p>
        ) : (
          <ul className="flex flex-col divide-y" data-testid="pilihan-list">
            {slides.map((s, idx) => (
              <li
                key={s.id}
                className="flex items-center gap-3 py-2"
                data-testid={`pilihan-item-${s.id}`}
              >
                <span className="w-6 text-right text-sm text-muted-foreground">{idx + 1}.</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.buku.judul}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.buku.pengarang ?? '—'}
                    {s.label ? ` · ${s.label}` : ''}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={idx === 0 || saving}
                  onClick={() => void move(idx, -1)}
                  aria-label={t('buku:pilihan.moveUp', { defaultValue: 'Naikkan' })}
                  data-testid={`pilihan-up-${s.id}`}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={idx === slides.length - 1 || saving}
                  onClick={() => void move(idx, 1)}
                  aria-label={t('buku:pilihan.moveDown', { defaultValue: 'Turunkan' })}
                  data-testid={`pilihan-down-${s.id}`}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={saving}
                  onClick={() => void onUnpin(s.id)}
                  aria-label={t('buku:pilihan.unpin', { defaultValue: 'Lepas pin' })}
                  data-testid={`pilihan-unpin-${s.id}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">
          {t('buku:pilihan.searchHeading', { defaultValue: 'Tambah buku pilihan' })}
        </h2>
        <div className="mb-3 grid gap-2 sm:grid-cols-[2fr,1fr,auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void runSearch();
                }
              }}
              placeholder={t('buku:pilihan.searchPlaceholder', {
                defaultValue: 'Cari judul / pengarang / ISBN…',
              })}
              className="pl-9"
              data-testid="pilihan-search-input"
            />
          </div>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('buku:pilihan.labelPlaceholder', {
              defaultValue: 'Label opsional (mis. "Bulan Literasi")',
            })}
            data-testid="pilihan-label-input"
          />
          <Button
            onClick={() => void runSearch()}
            disabled={searching}
            data-testid="pilihan-search-btn"
          >
            {t('common:actions.search', { defaultValue: 'Cari' })}
          </Button>
        </div>
        {results.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {searching
              ? t('common:loading', { defaultValue: 'Memuat…' })
              : t('buku:pilihan.searchHint', {
                  defaultValue: 'Ketik kata kunci dan tekan Cari.',
                })}
          </p>
        ) : (
          <ul className="flex flex-col divide-y" data-testid="pilihan-results">
            {results.map((b) => {
              const alreadyPinned = pinnedIds.has(b.id);
              return (
                <li key={b.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{b.judul}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {b.pengarang ?? '—'} · {b.kodeBuku}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={alreadyPinned ? 'outline' : 'default'}
                    disabled={alreadyPinned || saving || slides.length >= MAX_ACTIVE_PINS}
                    onClick={() => void onPin(b)}
                    data-testid={`pilihan-pin-btn-${b.id}`}
                  >
                    {alreadyPinned
                      ? t('buku:pilihan.alreadyPinned', { defaultValue: 'Sudah dipilih' })
                      : t('buku:pilihan.pin', { defaultValue: 'Pin' })}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
