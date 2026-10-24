import { createFileRoute } from '@tanstack/react-router';
import { AkreditasiSkor } from '@/features/akreditasi/SkorSubPage';

export const Route = createFileRoute('/_authed/akreditasi/skor')({
  component: AkreditasiSkor,
});
