import { createFileRoute } from '@tanstack/react-router';
import { BackupPage } from '@/features/settings/BackupPage';

export const Route = createFileRoute('/_authed/settings/backup')({
  component: BackupPage,
});
