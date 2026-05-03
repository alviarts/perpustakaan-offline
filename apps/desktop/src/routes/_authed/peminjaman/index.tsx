import { createFileRoute } from '@tanstack/react-router';
import { PeminjamanList } from '@/features/peminjaman/PeminjamanList';

export const Route = createFileRoute('/_authed/peminjaman/')({
  component: PeminjamanList,
});
