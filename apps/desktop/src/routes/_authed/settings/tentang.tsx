import { createFileRoute } from '@tanstack/react-router';
import { TentangPage } from '@/features/settings/TentangPage';

export const Route = createFileRoute('/_authed/settings/tentang')({
  component: TentangPage,
});
