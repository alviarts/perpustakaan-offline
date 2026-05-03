import { createFileRoute } from '@tanstack/react-router';
import { IdentitasPage } from '@/features/settings/IdentitasPage';

export const Route = createFileRoute('/_authed/settings/identitas')({
  component: IdentitasPage,
});
