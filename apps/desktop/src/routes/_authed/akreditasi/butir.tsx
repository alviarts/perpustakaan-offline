import { createFileRoute } from '@tanstack/react-router';
import { AkreditasiButir } from '@/features/akreditasi/ButirSubPage';

export const Route = createFileRoute('/_authed/akreditasi/butir')({
  component: AkreditasiButir,
});
