import { createFileRoute } from '@tanstack/react-router';
import { LaporanLayout } from '@/features/laporan/LaporanLayout';

export const Route = createFileRoute('/_authed/laporan')({
  component: LaporanLayout,
});
