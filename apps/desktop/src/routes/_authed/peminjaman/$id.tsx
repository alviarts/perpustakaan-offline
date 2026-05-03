import { createFileRoute } from '@tanstack/react-router';
import { PeminjamanDetailView } from '@/features/peminjaman/PeminjamanDetail';

export const Route = createFileRoute('/_authed/peminjaman/$id')({
  component: PeminjamanDetailView,
});
