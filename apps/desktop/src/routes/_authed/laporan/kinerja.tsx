import { createFileRoute } from '@tanstack/react-router';
import { LaporanKinerja } from '@/features/laporan/KinerjaSubPage';

export const Route = createFileRoute('/_authed/laporan/kinerja')({
  component: LaporanKinerja,
});
