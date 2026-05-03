import { createFileRoute } from '@tanstack/react-router';
import { PeminjamanForm } from '@/features/peminjaman/PeminjamanForm';

export const Route = createFileRoute('/_authed/peminjaman/new')({
  component: PeminjamanForm,
});
