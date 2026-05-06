import { useTranslation } from 'react-i18next';
import { ArrowLeft, ScanLine } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface OpacKtaScanFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Stub for the KTA scan flow. The full implementation reuses
 * `useBarcodeScanner` from features/sirkulasi but that hook owns its own
 * camera lifecycle which makes it impractical to embed in a modal as
 * part of the OPAC MVP. Marked TODO; the flow is referenced in BUGS.md
 * FEAT-27 line 718 and will be wired in a follow-up once the camera
 * lifecycle is decoupled from the SirkulasiPage layout.
 */
export function OpacKtaScanFlow({ open, onOpenChange }: OpacKtaScanFlowProps): JSX.Element {
  const { t } = useTranslation('opac');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5" />
            {t('home.scanKta')}
          </DialogTitle>
          <DialogDescription>{t('session.scanInstruction')}</DialogDescription>
        </DialogHeader>

        <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-md border border-dashed bg-muted/30 text-center">
          <ScanLine className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {t('home.scanKtaSubtitle')}
          </p>
          <p className="text-xs text-muted-foreground">
            (TODO: wire decoupled camera flow — same-device-only fallback)
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t('search.back')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
