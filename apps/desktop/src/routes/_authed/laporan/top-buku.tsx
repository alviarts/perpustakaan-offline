import { createFileRoute } from '@tanstack/react-router';
import { LaporanTopBuku } from '@/features/laporan/TopBukuSubPage';

export const Route = createFileRoute('/_authed/laporan/top-buku')({
  component: LaporanTopBuku,
});
