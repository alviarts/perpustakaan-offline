import { LaporanBackup } from '@/features/laporan/BackupSubPage';
import { SettingsSection } from './SettingsSection';

/**
 * Backup & Restore sub-page (revisi #24). Embeds the full backup UI introduced
 * in Devin Session 9 (`LaporanBackup`) inside the Settings shell so the
 * functionality is reachable from both Laporan and Pengaturan.
 */
export function BackupPage(): JSX.Element {
  return (
    <SettingsSection i18nKey="backup">
      <LaporanBackup />
    </SettingsSection>
  );
}
