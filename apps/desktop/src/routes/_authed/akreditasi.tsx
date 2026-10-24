import { createFileRoute } from '@tanstack/react-router';
import { AkreditasiLayout } from '@/features/akreditasi/AkreditasiLayout';

export const Route = createFileRoute('/_authed/akreditasi')({
  component: AkreditasiLayout,
});
