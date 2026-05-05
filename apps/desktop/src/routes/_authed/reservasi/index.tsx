import { createFileRoute } from '@tanstack/react-router';
import { ReservasiPage } from '@/features/reservasi/ReservasiPage';

export const Route = createFileRoute('/_authed/reservasi/')({
  component: ReservasiPage,
});
