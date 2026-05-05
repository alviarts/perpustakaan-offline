import { createFileRoute } from '@tanstack/react-router';
import { CetakLabelPage } from '@/features/label-buku/CetakLabelPage';

export const Route = createFileRoute('/_authed/buku/cetak-label')({
  component: CetakLabelPage,
});
