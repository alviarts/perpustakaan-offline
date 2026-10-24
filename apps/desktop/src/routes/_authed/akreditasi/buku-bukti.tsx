import { createFileRoute } from '@tanstack/react-router';
import { AkreditasiBukuBukti } from '@/features/akreditasi/BukuBuktiSubPage';

export const Route = createFileRoute('/_authed/akreditasi/buku-bukti')({
  component: AkreditasiBukuBukti,
});
