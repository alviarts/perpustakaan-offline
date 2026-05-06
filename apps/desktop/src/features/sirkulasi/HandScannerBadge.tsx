/**
 * HandScannerBadge — small status pill that surfaces the v1.0.12
 * hand-scanner detection state to the user.
 *
 * Shown next to a scan input when {@link useHandScannerDetector}
 * decides a USB hand-scanner has been used recently. We keep it
 * intentionally lightweight: a green dot + label, no controls.
 *
 * Hidden by default — the parent decides whether to render it,
 * usually by passing `isDetected` straight from the hook. This is a
 * pure presentational component.
 */
import { ScanLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface HandScannerBadgeProps {
  /** Whether the badge should render at all (driven by the hook). */
  isDetected: boolean;
  /** Optional className overrides for the wrapper. */
  className?: string;
}

export function HandScannerBadge({ isDetected, className }: HandScannerBadgeProps) {
  const { t } = useTranslation('common');
  if (!isDetected) return null;
  return (
    <Badge
      variant="success"
      className={cn('gap-1.5', className)}
      data-testid="hand-scanner-badge"
      title={t('scanner.handScannerHint')}
    >
      <ScanLine className="h-3 w-3" aria-hidden />
      <span>{t('scanner.handScannerDetected')}</span>
    </Badge>
  );
}
