import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Buku } from '@/lib/buku';
import type { BukuPilihanSlide } from '@/lib/bukuPilihan';

const ROTATE_INTERVAL_MS = 5000;

export interface OpacFeaturedCarouselProps {
  slides: BukuPilihanSlide[];
  onSelect: (buku: Buku) => void;
  /** Test hook so tests can disable the matchMedia branch deterministically. */
  reducedMotion?: boolean;
}

function usePrefersReducedMotion(override?: boolean): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (override !== undefined) return override;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  useEffect(() => {
    if (override !== undefined) {
      setReduced(override);
      return;
    }
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (): void => setReduced(mq.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, [override]);
  return reduced;
}

/**
 * E1-OPACBukuPilihan — auto-rotating carousel of admin-pinned books on
 * the OPAC home page. Renders nothing when `slides` is empty (so the
 * existing grid-only layout is unchanged on a clean install). Auto-rotate
 * pauses on hover/focus and is disabled entirely when the user opts into
 * `prefers-reduced-motion`. Keyboard nav: Left/Right cycle slides, Enter
 * opens the active book's detail dialog via `onSelect`.
 */
export function OpacFeaturedCarousel({
  slides,
  onSelect,
  reducedMotion: reducedMotionOverride,
}: OpacFeaturedCarouselProps): React.ReactElement | null {
  const { t } = useTranslation('opac');
  const reducedMotion = usePrefersReducedMotion(reducedMotionOverride);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = slides.length;

  const advance = useCallback((delta: number) => {
    setIndex((i) => (((i + delta) % Math.max(total, 1)) + Math.max(total, 1)) % Math.max(total, 1));
  }, [total]);

  // Auto-rotate. Disabled when reducedMotion is on, when only one slide
  // exists, or while the user hovers / focuses inside the carousel.
  useEffect(() => {
    if (reducedMotion || paused || total <= 1) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % total);
    }, ROTATE_INTERVAL_MS);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [reducedMotion, paused, total]);

  // Reset to first slide if the slide list changes underneath us (e.g.
  // admin unpins one while the carousel is open).
  useEffect(() => {
    if (index >= total) setIndex(0);
  }, [index, total]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      advance(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      advance(1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      const current = slides[index];
      if (current) {
        e.preventDefault();
        onSelect(current.buku);
      }
    }
  };

  if (total === 0) return null;

  const slide = slides[index];
  if (!slide) return null;

  return (
    <section
      data-testid="opac-featured-carousel"
      className="relative mx-auto w-full max-w-5xl px-6 pt-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label={t('home.featuredLabel', { defaultValue: 'Buku pilihan' })}
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Star className="h-4 w-4 text-amber-500" />
        {t('home.featuredHeading', { defaultValue: 'Buku Pilihan' })}
      </div>

      <div
        className="relative overflow-hidden rounded-xl border bg-card shadow-sm"
        data-testid="opac-featured-slide"
      >
        <button
          type="button"
          className="flex w-full flex-col items-stretch gap-4 p-6 text-left sm:flex-row sm:items-center"
          onClick={() => onSelect(slide.buku)}
          data-testid={`opac-featured-slide-${slide.id}`}
          aria-label={t('home.featuredOpen', {
            defaultValue: 'Lihat detail "{{judul}}"',
            judul: slide.buku.judul,
          })}
        >
          <div className="h-40 w-28 flex-shrink-0 overflow-hidden rounded-md bg-muted sm:h-48 sm:w-36">
            {slide.buku.coverPath ? (
              <img
                src={slide.buku.coverPath}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl text-muted-foreground">
                <Star className="h-10 w-10 opacity-30" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            {slide.label && (
              <div className="mb-1 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-100">
                {slide.label}
              </div>
            )}
            <h3 className="truncate text-xl font-semibold tracking-tight">{slide.buku.judul}</h3>
            <p className="text-sm text-muted-foreground">
              {slide.buku.pengarang ?? t('search.unknownAuthor', { defaultValue: 'Penulis tidak diketahui' })}
            </p>
            {slide.buku.deskripsi && (
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{slide.buku.deskripsi}</p>
            )}
          </div>
        </button>

        {total > 1 && (
          <>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute left-2 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-background/90 shadow"
              onClick={(e) => {
                e.stopPropagation();
                advance(-1);
              }}
              data-testid="opac-featured-prev"
              aria-label={t('home.featuredPrev', { defaultValue: 'Sebelumnya' })}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute right-2 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-background/90 shadow"
              onClick={(e) => {
                e.stopPropagation();
                advance(1);
              }}
              data-testid="opac-featured-next"
              aria-label={t('home.featuredNext', { defaultValue: 'Berikutnya' })}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        )}
      </div>

      {total > 1 && (
        <div
          className="mt-3 flex items-center justify-center gap-1.5"
          data-testid="opac-featured-dots"
          role="tablist"
        >
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={t('home.featuredGoto', {
                defaultValue: 'Slide {{n}}',
                n: i + 1,
              })}
              data-testid={`opac-featured-dot-${i}`}
              onClick={() => setIndex(i)}
              className={cn(
                'h-2.5 rounded-full transition-all',
                i === index ? 'w-6 bg-primary' : 'w-2.5 bg-muted-foreground/40',
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}
