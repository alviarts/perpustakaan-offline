import { createFileRoute } from '@tanstack/react-router';
import { AkreditasiPage } from '@/features/settings/AkreditasiPage';

export const Route = createFileRoute('/_authed/settings/akreditasi')({
  component: AkreditasiPage,
});
