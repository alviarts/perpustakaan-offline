import { createFileRoute } from '@tanstack/react-router';
import { LaporanPemanfaatan } from '@/features/laporan/PemanfaatanSubPage';

export const Route = createFileRoute('/_authed/laporan/pemanfaatan')({
  component: LaporanPemanfaatan,
});
