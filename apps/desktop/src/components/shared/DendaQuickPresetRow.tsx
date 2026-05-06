import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { dendaQuickPresets } from '@/lib/dendaPresets';

export interface DendaQuickPresetRowProps {
  /**
   * Daily denda rate from settings (`loanRules.dendaPerHari`). Multiplier
   * buttons render this × 1, × 2, × 3 and dedupe against the fixed
   * rupiah presets. Pass `0` to hide the multiplier section entirely.
   */
  dendaPerHari: number;
  /** Called with the rupiah value (in IDR) when a preset button is clicked. */
  onSelect: (value: number) => void;
  /**
   * Stable prefix for `data-testid` attributes. The container becomes
   * `<prefix>-quick`; multiplier buttons become `<prefix>-quick-<N>x`;
   * fixed-preset buttons become `<prefix>-quick-fixed-<value>`. Used by
   * Pengembalian (`pengembalian-bayar`) and Peminjaman
   * (`peminjaman-bayar`) so e2e selectors stay stable.
   */
  testidPrefix: string;
}

function formatRupiah(value: number): string {
  return value.toLocaleString('id-ID');
}

/**
 * Quick-pick "Bayar Denda" button row shared between the Pengembalian
 * full-return flow and the Peminjaman detail inline-payment flow. Builds
 * the deduplicated preset list via {@link dendaQuickPresets} and renders
 * a wrapped flex row of small `outline` buttons.
 *
 * Returns `null` when there are no buttons to render (e.g. dendaPerHari
 * is 0 AND no fixed presets are configured), so callers can drop it
 * directly in JSX without an outer `&&` guard.
 */
export function DendaQuickPresetRow({
  dendaPerHari,
  onSelect,
  testidPrefix,
}: DendaQuickPresetRowProps): JSX.Element | null {
  const { t } = useTranslation('peminjaman');
  const buttons = useMemo(() => dendaQuickPresets(dendaPerHari), [dendaPerHari]);
  if (buttons.length === 0) return null;
  return (
    <div
      className="mt-2 flex flex-wrap gap-1.5"
      data-testid={`${testidPrefix}-quick`}
    >
      {buttons.map((preset) => {
        const testid =
          preset.kind === 'mult'
            ? `${testidPrefix}-quick-${preset.mult}x`
            : `${testidPrefix}-quick-fixed-${preset.value}`;
        return (
          <Button
            key={testid}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onSelect(preset.value)}
            data-testid={testid}
          >
            {t('pengembalian.bayarQuick', {
              defaultValue: 'Rp {{value}}',
              value: formatRupiah(preset.value),
            })}
          </Button>
        );
      })}
    </div>
  );
}
