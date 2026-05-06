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
import { useToast } from '@/components/ui/toast-manager';
import { fuzzyScore } from '@/lib/fuzzy';
import { anggotaApi, type Anggota } from '@/lib/anggota';
import { bukuApi, type Buku } from '@/lib/buku';
import { peminjamanApi, type PeminjamanRow } from '@/lib/peminjaman';
import {
  COMMAND_PALETTE_DEFAULT_ROUTE_LIMIT,
  COMMAND_PALETTE_ROUTES,
  getCommandPaletteActions,
  type CommandPaletteActionEntry,
  type CommandPaletteRouteEntry,
} from '@/components/layout/commandPaletteRegistry';

const PER_GROUP_LIMIT = 5;
const DEBOUNCE_MS = 200;
const ROUTE_ACTION_THRESHOLD = 0.3;
const PER_PALETTE_GROUP_LIMIT = 8;

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

/** Score a route/action against a query using its translated label + description. */
function scoreEntry(label: string, description: string | undefined, query: string): number {
  const labelScore = fuzzyScore(label, query);
  const descScore = description ? fuzzyScore(description, query) * 0.6 : 0;
  return Math.max(labelScore, descScore);
}

export function GlobalSearchDialog({ open, onOpenChange }: GlobalSearchDialogProps): JSX.Element {
  const { t } = useTranslation(['common']);
  const navigate = useNavigate();
  const { showToast } = useToast();
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

  const totalDataHits = useMemo(
    () => results.anggota.length + results.buku.length + results.peminjaman.length,
    [results],
  );

  const trimmed = raw.trim();
  const hasQuery = trimmed.length > 0;
  const hasDataQuery = trimmed.length >= 2;

  const visibleRoutes = useMemo<CommandPaletteRouteEntry[]>(() => {
    if (!hasQuery) {
      return COMMAND_PALETTE_ROUTES.slice(0, COMMAND_PALETTE_DEFAULT_ROUTE_LIMIT) as CommandPaletteRouteEntry[];
    }
    const scored = COMMAND_PALETTE_ROUTES.map((entry) => {
      const label = t(`commandPalette.route.${entry.key}.label`, {
        defaultValue: entry.key,
      });
      const description = t(`commandPalette.route.${entry.key}.description`, {
        defaultValue: '',
      });
      const score = scoreEntry(label, description || undefined, trimmed);
      return { entry, score };
    })
      .filter((s) => s.score >= ROUTE_ACTION_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, PER_PALETTE_GROUP_LIMIT)
      .map((s) => s.entry);
    return scored;
  }, [hasQuery, trimmed, t]);

  const allActions = useMemo(() => getCommandPaletteActions(), []);

  const visibleActions = useMemo<CommandPaletteActionEntry[]>(() => {
    if (!hasQuery) {
      return [...allActions];
    }
    const scored = allActions
      .map((entry) => {
        const label = t(`commandPalette.action.${entry.key}.label`, {
          defaultValue: entry.key,
        });
        const description = t(`commandPalette.action.${entry.key}.description`, {
          defaultValue: '',
        });
        const score = scoreEntry(label, description || undefined, trimmed);
        return { entry, score };
      })
      .filter((s) => s.score >= ROUTE_ACTION_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .map((s) => s.entry);
    return scored;
  }, [hasQuery, trimmed, allActions, t]);

  const handleActivate = (hit: GlobalSearchHit): void => {
    onOpenChange(false);
    void navigate({ to: hit.to });
  };

  const handleRoute = (entry: CommandPaletteRouteEntry): void => {
    onOpenChange(false);
    void navigate({ to: entry.to });
  };

  const handleAction = (entry: CommandPaletteActionEntry): void => {
    onOpenChange(false);
    // Defer execution so the dialog finishes closing before the action runs.
    // Otherwise toasts/confirms triggered by the action lose focus to the dialog.
    setTimeout(() => {
      void Promise.resolve(
        entry.execute({
          navigate: (path) => {
            void navigate({ to: path });
          },
          showToast,
          t,
        }),
      ).catch((err) => {
        showToast({
          variant: 'destructive',
          title: t('commandPalette.executeFail', {
            defaultValue: 'Tidak dapat menjalankan perintah',
          }),
          description: err instanceof Error ? err.message : String(err),
        });
      });
    }, 0);
  };

  const showHint = !hasQuery && visibleActions.length === 0 && visibleRoutes.length === 0;
  const showBusy = hasDataQuery && busy;
  const showEmpty =
    hasQuery &&
    !showBusy &&
    totalDataHits === 0 &&
    visibleRoutes.length === 0 &&
    visibleActions.length === 0;

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
              defaultValue: 'Cari anggota, buku, peminjaman, halaman, perintah…',
            })}
            data-testid="global-search-input"
          />
          <CommandList>
            {showHint ? (
              <div
                className="text-muted-foreground px-4 py-6 text-center text-sm"
                data-testid="global-search-hint"
              >
                {t('common:globalSearch.hint', {
                  defaultValue: 'Ketik minimal 2 huruf untuk mencari…',
                })}
              </div>
            ) : null}
            {showBusy ? (
              <div
                className="text-muted-foreground flex items-center justify-center gap-2 px-4 py-6 text-sm"
                data-testid="global-search-busy"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('common:globalSearch.busy', { defaultValue: 'Mencari…' })}
              </div>
            ) : null}
            {showEmpty ? (
              <CommandEmpty data-testid="global-search-empty">
                {t('common:globalSearch.empty', {
                  defaultValue: 'Tidak ada hasil yang cocok.',
                })}
              </CommandEmpty>
            ) : null}
            {hasDataQuery && results.anggota.length > 0 && (
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
            {hasDataQuery && results.buku.length > 0 && (
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
            {hasDataQuery && results.peminjaman.length > 0 && (
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
            {visibleRoutes.length > 0 && (
              <>
                {hasDataQuery && totalDataHits > 0 && <CommandSeparator />}
                <CommandGroup
                  heading={t('common:globalSearch.groupRoutes', {
                    defaultValue: 'Halaman',
                  })}
                >
                  {visibleRoutes.map((entry) => {
                    const Icon = entry.icon;
                    const label = t(`commandPalette.route.${entry.key}.label`, {
                      defaultValue: entry.key,
                    });
                    const description = t(`commandPalette.route.${entry.key}.description`, {
                      defaultValue: '',
                    });
                    return (
                      <CommandItem
                        key={`route:${entry.key}`}
                        value={`route:${entry.key}`}
                        onSelect={() => handleRoute(entry)}
                        data-testid={`global-search-route-${entry.key}`}
                      >
                        <Icon className="text-muted-foreground mr-2 h-4 w-4 shrink-0" />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate">{label}</span>
                          {description && (
                            <span className="text-muted-foreground truncate text-xs">
                              {description}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
            {visibleActions.length > 0 && (
              <>
                {(visibleRoutes.length > 0 || (hasDataQuery && totalDataHits > 0)) && (
                  <CommandSeparator />
                )}
                <CommandGroup
                  heading={t('common:globalSearch.groupActions', {
                    defaultValue: 'Aksi Cepat',
                  })}
                >
                  {visibleActions.map((entry) => {
                    const Icon = entry.icon;
                    const label = t(`commandPalette.action.${entry.key}.label`, {
                      defaultValue: entry.key,
                    });
                    const description = t(`commandPalette.action.${entry.key}.description`, {
                      defaultValue: '',
                    });
                    return (
                      <CommandItem
                        key={`action:${entry.key}`}
                        value={`action:${entry.key}`}
                        onSelect={() => handleAction(entry)}
                        data-testid={`global-search-action-${entry.key}`}
                      >
                        <Icon className="text-muted-foreground mr-2 h-4 w-4 shrink-0" />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate">{label}</span>
                          {description && (
                            <span className="text-muted-foreground truncate text-xs">
                              {description}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
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
