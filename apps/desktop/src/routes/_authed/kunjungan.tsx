import { createFileRoute } from '@tanstack/react-router';
import { KunjunganPage } from '@/features/kunjungan/KunjunganPage';

export const Route = createFileRoute('/_authed/kunjungan')({
  component: KunjunganPage,
});
