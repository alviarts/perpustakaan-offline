import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface OpacScanLockedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Name of the member currently signed in. Shown in title + description. */
  memberName: string;
  /** Logout the active member then open the scan flow. */
  onLogoutAndScan: () => void;
}

export function OpacScanLockedDialog({
  open,
  onOpenChange,
  memberName,
  onLogoutAndScan,
}: OpacScanLockedDialogProps): JSX.Element {
  const { t } = useTranslation('opac');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        data-testid="opac-scan-locked-dialog"
      >
        <DialogHeader>
          <DialogTitle>{t('scanLocked.title', { nama: memberName })}</DialogTitle>
          <DialogDescription>{t('scanLocked.description')}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            data-testid="opac-scan-locked-cancel"
          >
            {t('scanLocked.cancel')}
          </Button>
          <Button
            type="button"
            onClick={onLogoutAndScan}
            data-testid="opac-scan-locked-logout"
          >
            {t('scanLocked.logoutAndScan')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
