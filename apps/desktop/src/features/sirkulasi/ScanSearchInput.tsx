/**
 * ScanSearchInput — manual scan input for SirkulasiPage with optional
 * fuzzy search across **anggota** and **buku** (v1.0.13).
 *
 * Behaviour:
 *
 * - **Slow human typing (≥ 50 ms inter-key)** with at least one
 *   alphabetic character or two characters total opens a debounced
 *   (180 ms) search dropdown, querying `anggotaApi.list({ query })`
 *   and `bukuApi.list({ query })` in parallel. Results are split into
 *   "Anggota" and "Buku" sections.
 *   - Anggota row picked → `onPickAnggota(anggota)` callback fires.
 *   - Buku row picked → `onPickBuku(buku)` callback fires (the page
 *     decides what to do — typically resolve the first available
 *     eksemplar and add it to the basket).
 *
 * - **Fast keystroke burst (≤ 35 ms inter-key, ≥ 3 chars, ends in
 *   Enter)** is recognised as a USB hand-scanner emitting a barcode.
 *   The dropdown stays closed, no search runs, and the captured
 *   payload is forwarded directly to `onSubmitKode(payload)` — same
 *   behaviour the v1.0.10 + v1.0.11 hand-scanner flow had.
 *
 * - **Manual Enter** with no dropdown selection submits the raw text
 *   via `onSubmitKode` — matches the legacy behaviour for librarians
 *   who type a kode by hand.
 *
 * - **Arrow keys + Enter** navigate through visible search results.
 *
 * The component owns its own input value and debounce timer; the
 * parent only receives the final selection callbacks. It also exposes
 * `inputRef` so the parent can refocus the input after a successful
 * scan (matches the legacy `focusManual()` flow).
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Keyboard, Loader2, User2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { anggotaApi, type Anggota } from '@/lib/anggota';
import { bukuApi, type Buku } from '@/lib/buku';

const HAND_SCANNER_MAX_INTER_KEY_MS = 35;
const HAND_SCANNER_MIN_PAYLOAD = 3;
const SEARCH_DEBOUNCE_MS = 180;
const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS_PER_GROUP = 6;

export interface ScanSearchInputHandle {
  focus: () => void;
  clear: () => void;
}

export interface ScanSearchInputProps {
  /** Whether the input is disabled (e.g. while a scan is being processed). */
  disabled?: boolean;
  /** Placeholder text. */
  placeholder?: string;
  /** Whether to enable the buku search section. Defaults to `true`. */
  enableBukuSearch?: boolean;
  /**
   * Called when the user submits a raw kode (typed-and-Enter, USB
   * scanner burst, or "Kirim" button). The parent runs the existing
   * resolve/scan pipeline.
   */
  onSubmitKode: (kode: string) => void | Promise<void>;
  /** Called when the user picks an anggota from the dropdown. */
  onPickAnggota: (anggota: Anggota) => void;
  /** Called when the user picks a buku from the dropdown. */
  onPickBuku: (buku: Buku) => void;
}

interface SearchResults {
  anggota: Anggota[];
  buku: Buku[];
  loading: boolean;
}

type FlatItem =
  | { kind: 'anggota'; data: Anggota; key: string }
  | { kind: 'buku'; data: Buku; key: string };

/**
 * Detect whether the current input change came from a hand-scanner
 * keystroke burst (very tight inter-key timing). We track timestamps
 * across keystrokes and consider it a burst as long as every gap is
 * within {@link HAND_SCANNER_MAX_INTER_KEY_MS}. Any slow keystroke
 * resets the burst tracker.
 */
function useBurstTracker(): {
  recordKey: () => void;
  isBurst: () => boolean;
  reset: () => void;
} {
  const lastTsRef = useRef(0);
  const burstLengthRef = useRef(0);
  const recordKey = useCallback(() => {
    const now = performance.now();
    const delta = now - lastTsRef.current;
    if (lastTsRef.current === 0 || delta > HAND_SCANNER_MAX_INTER_KEY_MS) {
      burstLengthRef.current = 1;
    } else {
      burstLengthRef.current += 1;
    }
    lastTsRef.current = now;
  }, []);
  const isBurst = useCallback(
    () => burstLengthRef.current >= HAND_SCANNER_MIN_PAYLOAD,
    [],
  );
  const reset = useCallback(() => {
    burstLengthRef.current = 0;
    lastTsRef.current = 0;
  }, []);
  return { recordKey, isBurst, reset };
}

export const ScanSearchInput = forwardRef<ScanSearchInputHandle, ScanSearchInputProps>(
  function ScanSearchInput(
    { disabled, placeholder, enableBukuSearch = true, onSubmitKode, onPickAnggota, onPickBuku },
    ref,
  ) {
    const { t } = useTranslation(['sirkulasi', 'common']);
    const [value, setValue] = useState('');
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const [results, setResults] = useState<SearchResults>({
      anggota: [],
      buku: [],
      loading: false,
    });

    const inputRef = useRef<HTMLInputElement>(null);
    const burst = useBurstTracker();

    useImperativeHandle(
      ref,
      () => ({
        focus: () => inputRef.current?.focus(),
        clear: () => {
          setValue('');
          setOpen(false);
          burst.reset();
        },
      }),
      [burst],
    );

    /**
     * Whether the typed value looks like a search query (has at
     * least one letter, or is short enough that exact-kode matching
     * is unlikely). If false the dropdown stays closed because the
     * value is most likely a barcode payload that just happens to
     * have been typed slowly.
     */
    const looksLikeSearch = useMemo(() => {
      const v = value.trim();
      if (v.length < MIN_QUERY_LENGTH) return false;
      // Pure-numeric strings are usually barcodes/kode — don't search.
      if (/^[A-Za-z0-9-]+$/.test(v) && /^\d+$/.test(v)) return false;
      // At least one alpha → human typing a name/title.
      return /[A-Za-z]/.test(v);
    }, [value]);

    // Run the debounced search when the value looks like a query.
    useEffect(() => {
      if (!looksLikeSearch) {
        setResults({ anggota: [], buku: [], loading: false });
        setOpen(false);
        return undefined;
      }
      let cancelled = false;
      setResults((r) => ({ ...r, loading: true }));
      const handle = setTimeout(async () => {
        try {
          const [anggotaRes, bukuRes] = await Promise.all([
            anggotaApi.list({
              query: value.trim(),
              aktif: true,
              limit: MAX_RESULTS_PER_GROUP,
            }),
            enableBukuSearch
              ? bukuApi.list({ query: value.trim(), limit: MAX_RESULTS_PER_GROUP })
              : Promise.resolve({ items: [], total: 0 }),
          ]);
          if (cancelled) return;
          setResults({
            anggota: anggotaRes.items,
            buku: bukuRes.items,
            loading: false,
          });
          // Keep dropdown closed if both results are empty *and* we're
          // not still loading — avoids an empty popover the moment the
          // user types two characters.
          setOpen(anggotaRes.items.length > 0 || bukuRes.items.length > 0);
          setHighlight(0);
        } catch {
          if (cancelled) return;
          setResults({ anggota: [], buku: [], loading: false });
          setOpen(false);
        }
      }, SEARCH_DEBOUNCE_MS);
      return () => {
        cancelled = true;
        clearTimeout(handle);
      };
    }, [value, looksLikeSearch, enableBukuSearch]);

    const flat: FlatItem[] = useMemo(() => {
      const out: FlatItem[] = [];
      for (const a of results.anggota) {
        out.push({ kind: 'anggota', data: a, key: `a-${a.id}` });
      }
      for (const b of results.buku) {
        out.push({ kind: 'buku', data: b, key: `b-${b.id}` });
      }
      return out;
    }, [results]);

    const submit = useCallback(
      (raw: string) => {
        const v = raw.trim();
        if (!v) return;
        setValue('');
        setOpen(false);
        burst.reset();
        void onSubmitKode(v);
      },
      [burst, onSubmitKode],
    );

    const pick = useCallback(
      (item: FlatItem) => {
        setValue('');
        setOpen(false);
        burst.reset();
        if (item.kind === 'anggota') {
          onPickAnggota(item.data);
        } else {
          onPickBuku(item.data);
        }
      },
      [burst, onPickAnggota, onPickBuku],
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Track inter-key timing to detect hand-scanner bursts.
      if (e.key.length === 1) {
        burst.recordKey();
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        // If the dropdown is open and a result is highlighted, pick
        // it. Otherwise submit the raw value.
        if (open && flat.length > 0 && !burst.isBurst()) {
          const item = flat[Math.max(0, Math.min(highlight, flat.length - 1))];
          if (item) {
            pick(item);
            return;
          }
        }
        submit(value);
        return;
      }

      if (!open || flat.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((h) => (h + 1) % flat.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => (h - 1 + flat.length) % flat.length);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    const showLoading = results.loading && looksLikeSearch;
    const hasResults = flat.length > 0;

    return (
      <div className="relative w-full">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(value);
          }}
          className="flex items-center gap-2"
        >
          <Keyboard className="h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              // Delay close so click on a result still fires.
              setTimeout(() => setOpen(false), 120);
            }}
            onFocus={() => {
              if (hasResults) setOpen(true);
            }}
            placeholder={
              placeholder ??
              t('sirkulasi:manual.placeholder', {
                defaultValue:
                  'Atau ketik kode / nama anggota / judul buku — Enter untuk submit',
              })
            }
            disabled={disabled}
            autoFocus
            data-testid="scan-search-input"
          />
          <Button
            type="submit"
            variant="secondary"
            disabled={disabled || !value.trim()}
          >
            {t('sirkulasi:manual.submit', { defaultValue: 'Kirim' })}
          </Button>
        </form>

        {open && (showLoading || hasResults) && (
          <div
            className="absolute left-0 right-0 z-30 mt-1 max-h-80 overflow-y-auto rounded-md border bg-popover p-1 shadow-lg"
            data-testid="scan-search-dropdown"
          >
            {showLoading && (
              <div className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>
                  {t('common:scanner.searching', { defaultValue: 'Mencari…' })}
                </span>
              </div>
            )}

            {results.anggota.length > 0 && (
              <div className="py-1">
                <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('common:scanner.sectionAnggota', { defaultValue: 'Anggota' })}
                </div>
                {results.anggota.map((a, i) => {
                  const idx = i;
                  return (
                    <button
                      type="button"
                      key={`a-${a.id}`}
                      className={cn(
                        'flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent',
                        highlight === idx && 'bg-accent',
                      )}
                      onMouseEnter={() => setHighlight(idx)}
                      onMouseDown={(e) => {
                        // mousedown so the click registers before the
                        // input's onBlur closes the dropdown.
                        e.preventDefault();
                        pick({ kind: 'anggota', data: a, key: `a-${a.id}` });
                      }}
                    >
                      <User2
                        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{a.nama}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {a.kodeAnggota}
                          {a.kelas ? ` · ${a.kelas}` : ''}
                          {a.jurusan ? ` · ${a.jurusan}` : ''}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {results.buku.length > 0 && (
              <div className="py-1">
                <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('common:scanner.sectionBuku', { defaultValue: 'Buku' })}
                </div>
                {results.buku.map((b, i) => {
                  const idx = results.anggota.length + i;
                  const tersedia = b.jumlahTersedia ?? 0;
                  return (
                    <button
                      type="button"
                      key={`b-${b.id}`}
                      className={cn(
                        'flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent',
                        highlight === idx && 'bg-accent',
                        tersedia === 0 && 'opacity-60',
                      )}
                      onMouseEnter={() => setHighlight(idx)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pick({ kind: 'buku', data: b, key: `b-${b.id}` });
                      }}
                    >
                      <BookOpen
                        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{b.judul}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {b.kodeBuku}
                          {b.pengarang ? ` · ${b.pengarang}` : ''}
                          {' · '}
                          {t('common:scanner.tersediaCount', {
                            defaultValue: '{{count}} tersedia',
                            count: tersedia,
                          })}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);
