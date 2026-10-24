import { createFileRoute } from '@tanstack/react-router';
import { AkreditasiBukti } from '@/features/akreditasi/BuktiSubPage';

export const Route = createFileRoute('/_authed/akreditasi/bukti')({
  component: AkreditasiBukti,
});
