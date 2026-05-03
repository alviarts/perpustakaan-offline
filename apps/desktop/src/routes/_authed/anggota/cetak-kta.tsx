import { createFileRoute } from '@tanstack/react-router';
import { CetakKtaPage } from '@/features/kta/CetakKtaPage';

export const Route = createFileRoute('/_authed/anggota/cetak-kta')({
  component: CetakKtaPage,
});
