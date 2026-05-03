import { createFileRoute } from '@tanstack/react-router';
import { LaporanTopPeminjam } from '@/features/laporan/TopPeminjamSubPage';

export const Route = createFileRoute('/_authed/laporan/top-peminjam')({
  component: LaporanTopPeminjam,
});
