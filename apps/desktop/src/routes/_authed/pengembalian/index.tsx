import { createFileRoute } from '@tanstack/react-router';
import { PengembalianPage } from '@/features/pengembalian/PengembalianPage';

export const Route = createFileRoute('/_authed/pengembalian/')({
  component: PengembalianPage,
});
