import { createFileRoute } from '@tanstack/react-router';
import { SirkulasiPage } from '@/features/sirkulasi/SirkulasiPage';

export const Route = createFileRoute('/_authed/sirkulasi/')({
  component: SirkulasiPage,
});
