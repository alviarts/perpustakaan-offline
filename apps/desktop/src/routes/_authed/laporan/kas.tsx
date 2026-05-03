import { createFileRoute } from '@tanstack/react-router';
import { LaporanKas } from '@/features/laporan/KasSubPage';

export const Route = createFileRoute('/_authed/laporan/kas')({
  component: LaporanKas,
});
