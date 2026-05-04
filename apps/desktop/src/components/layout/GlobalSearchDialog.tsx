import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { BookOpen, Calendar, Loader2, User as UserIcon } from 'lucide-react';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { anggotaApi, type Anggota } from '@/lib/anggota';
import { bukuApi, type Buku } from '@/lib/buku';
import { peminjamanApi, type PeminjamanRow } from '@/lib/peminjaman';

const PER_GROUP_LIMIT = 5;
const DEBOUNCE_MS = 200;

export interface GlobalSearchHit {
  /** Stable key — `anggota:42`, `buku:7`, `peminjaman:13`. */
  key: string;
  kind: 'anggota' | 'buku' | 'peminjaman';
  id: number;
  /** Headline shown on the first line of the result. */
  primary: string;
  /** Subtitle shown muted on the second line of the result. */
  secondary?: string;
  /** Full route the result navigates to on activation. */
  to: string;
}

export function anggotaToHit(a: Anggota): GlobalSearchHit {
  const subtitleParts = [a.kodeAnggota];
  if (a.kelas) subtitleParts.push(a.kelas);
  if (a.jurusan) subtitleParts.push(a.jurusan);
  return {
    key: `anggota:${a.id}`,
    kind: 'anggota',
    id: a.id,
    primary: a.nama,
    secondary: subtitleParts.join(' • '),
    to: `/anggota/${a.id}`,
  };
}

export function bukuToHit(b: Buku): GlobalSearchHit {
  const subtitleParts = [b.kodeBuku];
  if (b.pengarang) subtitleParts.push(b.pengarang);
  if (b.tahunTerbit) subtitleParts.push(String(b.tahunTerbit));
  return {
    key: `buku:${b.id}`,
    kind: 'buku',
    id: b.id,
    primary: b.judul,
    secondary: subtitleParts.join(' • '),
    to: `/buku/${b.id}`,
  };
}

export function peminjamanToHit(p: PeminjamanRow): GlobalSearchHit {
  const subtitleParts = [p.nomorPinjam, p.anggotaNama];
  if (p.status) subtitleParts.push(p.status);
  return {
    key: `peminjaman:${p.id}`,
    kind: 'peminjaman',
    id: p.id,
    primary: `${p.nomorPinjam} — ${p.anggotaNama}`,
    secondary: subtitleParts.join(' • '),
    to: `/peminjaman/${p.id}`,
  };
}

export interface SearchResults {
  anggota: GlobalSearchHit[];
  buku: GlobalSearchHit[];
  peminjaman: GlobalSearchHit[];
}

const EMPTY_RESULTS: SearchResults = {
  anggota: [],
  buku: [],
  peminjaman: [],
};

export interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}

export function GlobalSearchDialog({ open, onOpenChange }: GlobalSearchDialogProps): JSX.Element {
  const { t } = useTranslation(['common']);
  const navigate = useNavigate();
  const [raw, setRaw] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [busy, setBusy] = useState(false);
  const requestId = useRef(0);

  // Reset state when the dialog closes so reopening is a fresh slate.
  useEffect(() => {
    if (!open) {
      setRaw('');
      setDebouncedQuery('');
      setResults(EMPTY_RESULTS);
      setBusy(false);
    }
  }, [open]);

  // Local 200ms debounce — kept inline (not the shared hook) because we want to
  // reset both `raw` and `debouncedQuery` together when the dialog closes.
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => setDebouncedQuery(raw), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [raw, open]);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!open) return;
    if (q.length < 2) {
      setResults(EMPTY_RESULTS);
      setBusy(false);
      return;
    }
    const myId = ++requestId.current;
    setBusy(true);
    void Promise.allSettled([
      anggotaApi.list({ query: q, limit: PER_GROUP_LIMIT, offset: 0 }),
      bukuApi.list({ query: q, limit: PER_GROUP_LIMIT, offset: 0 }),
      peminjamanApi.list({ query: q, limit: PER_GROUP_LIMIT, offset: 0 }),
    ]).then(([a, b, p]) => {
      if (myId !== requestId.current) return; // a newer query already raced past us.
      setResults({
        anggota: a.status === 'fulfilled' ? a.value.items.map(anggotaToHit) : [],
        buku: b.status === 'fulfilled' ? b.value.items.map(bukuToHit) : [],
        peminjaman: p.status === 'fulfilled' ? p.value.items.map(peminjamanToHit) : [],
      });
      setBusy(false);
    });
  }, [debouncedQuery, open]);

  const totalHits = useMemo(
    () => results.anggota.length + results.buku.length + results.peminjaman.length,
    [results],
  );

  const handleActivate = (hit: GlobalSearchHit): void => {
    onOpenChange(false);
    void navigate({ to: hit.to });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="overflow-hidden p-0 sm:max-w-[640px]"
        data-testid="global-search-dialog"
      >
        <DialogTitle className="sr-only">
          {t('common:globalSearch.title', { defaultValue: 'Pencarian Global' })}
        </DialogTitle>
        <Command shouldFilter={false} loop>
          <CommandInput
            value={raw}
            onValueChange={setRaw}
            placeholder={t('common:globalSearch.placeholder', {
              defaultValue: 'Cari anggota, buku, peminjaman…',
            })}
            data-testid="global-search-input"
          />
          <CommandList>
            {raw.trim().length < 2 ? (
              <div
                className="text-muted-foreground px-4 py-6 text-center text-sm"
                data-testid="global-search-hint"
              >
                {t('common:globalSearch.hint', {
                  defaultValue: 'Ketik minimal 2 huruf untuk mencari…',
                })}
              </div>
            ) : busy ? (
              <div
                className="text-muted-foreground flex items-center justify-center gap-2 px-4 py-6 text-sm"
                data-testid="global-search-busy"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('common:globalSearch.busy', { defaultValue: 'Mencari…' })}
              </div>
            ) : totalHits === 0 ? (
              <CommandEmpty data-testid="global-search-empty">
                {t('common:globalSearch.empty', {
                  defaultValue: 'Tidak ada hasil yang cocok.',
                })}
              </CommandEmpty>
            ) : (
              <>
                {results.anggota.length > 0 && (
                  <CommandGroup
                    heading={t('common:globalSearch.groupAnggota', {
                      defaultValue: 'Anggota',
                    })}
                  >
                    {results.anggota.map((hit) => (
                      <CommandItem
                        key={hit.key}
                        value={hit.key}
                        onSelect={() => handleActivate(hit)}
                        data-testid={`global-search-item-${hit.key}`}
                      >
                        <UserIcon className="text-muted-foreground mr-2 h-4 w-4 shrink-0" />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate">{hit.primary}</span>
                          {hit.secondary && (
                            <span className="text-muted-foreground truncate text-xs">
                              {hit.secondary}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {results.buku.length > 0 && (
                  <>
                    {results.anggota.length > 0 && <CommandSeparator />}
                    <CommandGroup
                      heading={t('common:globalSearch.groupBuku', {
                        defaultValue: 'Buku',
                      })}
                    >
                      {results.buku.map((hit) => (
                        <CommandItem
                          key={hit.key}
                          value={hit.key}
                          onSelect={() => handleActivate(hit)}
                          data-testid={`global-search-item-${hit.key}`}
                        >
                          <BookOpen className="text-muted-foreground mr-2 h-4 w-4 shrink-0" />
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate">{hit.primary}</span>
                            {hit.secondary && (
                              <span className="text-muted-foreground truncate text-xs">
                                {hit.secondary}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </>
                )}
                {results.peminjaman.length > 0 && (
                  <>
                    {(results.anggota.length > 0 || results.buku.length > 0) && (
                      <CommandSeparator />
                    )}
                    <CommandGroup
                      heading={t('common:globalSearch.groupPeminjaman', {
                        defaultValue: 'Peminjaman',
                      })}
                    >
                      {results.peminjaman.map((hit) => (
                        <CommandItem
                          key={hit.key}
                          value={hit.key}
                          onSelect={() => handleActivate(hit)}
                          data-testid={`global-search-item-${hit.key}`}
                        >
                          <Calendar className="text-muted-foreground mr-2 h-4 w-4 shrink-0" />
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate">{hit.primary}</span>
                            {hit.secondary && (
                              <span className="text-muted-foreground truncate text-xs">
                                {hit.secondary}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </>
                )}
              </>
            )}
          </CommandList>
          <div className="border-border text-muted-foreground flex items-center justify-between gap-2 border-t px-3 py-2 text-[10px]">
            <span>
              {t('common:globalSearch.footerHint', {
                defaultValue: 'Enter untuk buka • ↑↓ navigasi • Esc tutup',
              })}
            </span>
            <kbd className="border-border bg-muted rounded border px-1.5 py-0.5 font-mono">⌃K</kbd>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
