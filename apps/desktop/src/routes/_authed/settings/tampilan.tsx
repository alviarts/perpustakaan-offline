import { createFileRoute } from '@tanstack/react-router';
import { TampilanPage } from '@/features/settings/TampilanPage';

export const Route = createFileRoute('/_authed/settings/tampilan')({
  component: TampilanPage,
});
