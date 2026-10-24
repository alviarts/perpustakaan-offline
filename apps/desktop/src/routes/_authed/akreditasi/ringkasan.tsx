import { createFileRoute } from '@tanstack/react-router';
import { AkreditasiRingkasan } from '@/features/akreditasi/RingkasanSubPage';

export const Route = createFileRoute('/_authed/akreditasi/ringkasan')({
  component: AkreditasiRingkasan,
});
