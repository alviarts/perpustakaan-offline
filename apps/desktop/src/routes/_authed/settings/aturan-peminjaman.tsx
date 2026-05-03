import { createFileRoute } from '@tanstack/react-router';
import { AturanPeminjamanPage } from '@/features/settings/AturanPeminjamanPage';

export const Route = createFileRoute('/_authed/settings/aturan-peminjaman')({
  component: AturanPeminjamanPage,
});
