import { createFileRoute } from '@tanstack/react-router';
import { LaporanBackup } from '@/features/laporan/BackupSubPage';

export const Route = createFileRoute('/_authed/laporan/backup')({
  component: LaporanBackup,
});
