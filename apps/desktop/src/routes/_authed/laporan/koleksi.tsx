import { createFileRoute } from '@tanstack/react-router';
import { LaporanKoleksi } from '@/features/laporan/KoleksiSubPage';

export const Route = createFileRoute('/_authed/laporan/koleksi')({
  component: LaporanKoleksi,
});
