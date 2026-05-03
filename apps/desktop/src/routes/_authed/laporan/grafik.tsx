import { createFileRoute } from '@tanstack/react-router';
import { LaporanGrafik } from '@/features/laporan/GrafikSubPage';

export const Route = createFileRoute('/_authed/laporan/grafik')({
  component: LaporanGrafik,
});
