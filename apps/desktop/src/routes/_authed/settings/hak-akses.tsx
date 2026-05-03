import { createFileRoute } from '@tanstack/react-router';
import { HakAksesPage } from '@/features/settings/HakAksesPage';

export const Route = createFileRoute('/_authed/settings/hak-akses')({
  component: HakAksesPage,
});
