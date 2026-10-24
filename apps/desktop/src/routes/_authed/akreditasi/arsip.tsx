import { createFileRoute } from '@tanstack/react-router';
import { AkreditasiArsip } from '@/features/akreditasi/ArsipSubPage';

export const Route = createFileRoute('/_authed/akreditasi/arsip')({
  component: AkreditasiArsip,
});
