import { createFileRoute } from '@tanstack/react-router';
import { BukuPilihanAdminPage } from '@/features/buku/BukuPilihanAdminPage';

export const Route = createFileRoute('/_authed/buku/buku-pilihan')({
  component: BukuPilihanAdminPage,
});
