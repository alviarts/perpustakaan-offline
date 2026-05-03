import { createFileRoute } from '@tanstack/react-router';
import { SinkronisasiPage } from '@/features/settings/SinkronisasiPage';

export const Route = createFileRoute('/_authed/settings/sinkronisasi')({
  component: SinkronisasiPage,
});
