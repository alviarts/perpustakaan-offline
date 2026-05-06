import { createFileRoute } from '@tanstack/react-router';
import { LaporanEksekutif } from '@/features/laporan/EksekutifSubPage';

export const Route = createFileRoute('/_authed/laporan/eksekutif')({
  component: LaporanEksekutif,
});
