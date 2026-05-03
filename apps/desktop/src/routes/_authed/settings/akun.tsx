import { createFileRoute } from '@tanstack/react-router';
import { AkunPage } from '@/features/settings/AkunPage';

export const Route = createFileRoute('/_authed/settings/akun')({
  component: AkunPage,
});
