import { ACCENTS, LAYOUTS } from '@/lib/appearance';
import type { AccentColor, AppLayout, DisplayPrefs } from '@/lib/settings';
import { cn } from '@/lib/utils';

export interface AppearancePickerProps {
  value: Pick<DisplayPrefs, 'layout' | 'accent'>;
  onChange: (next: { layout?: AppLayout; accent?: AccentColor }) => void;
}

/**
 * Picker "Tampilan" — 3 pilihan layout + 5 warna aksen. Dipakai di dua
 * tempat: onboarding awal (Layar izin → langkah 2) dan Settings → Tampilan.
 */
export function AppearancePicker({ value, onChange }: AppearancePickerProps): JSX.Element {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-medium">Tata letak</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {LAYOUTS.map((layout) => {
            const selected = value.layout === layout.id;
            return (
              <button
                key={layout.id}
                type="button"
                aria-pressed={selected}
                data-testid={`appearance-layout-${layout.id}`}
                onClick={() => onChange({ layout: layout.id })}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors',
                  selected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:bg-accent',
                )}
              >
                <span className="block text-sm font-semibold">{layout.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {layout.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Warna tema</p>
        <div className="flex flex-wrap gap-2">
          {ACCENTS.map((accent) => {
            const selected = value.accent === accent.id;
            return (
              <button
                key={accent.id}
                type="button"
                aria-pressed={selected}
                aria-label={accent.label}
                data-testid={`appearance-accent-${accent.id}`}
                onClick={() => onChange({ accent: accent.id })}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all',
                  selected ? 'border-foreground scale-110' : 'border-transparent hover:border-border',
                )}
              >
                <span className={cn('h-6 w-6 rounded-full', accent.swatch)} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
