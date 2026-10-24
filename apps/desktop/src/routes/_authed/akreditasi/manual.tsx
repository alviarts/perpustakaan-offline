import { createFileRoute } from '@tanstack/react-router';
import { AkreditasiManualPage } from '@/features/akreditasi/ManualSubPage';

export const Route = createFileRoute('/_authed/akreditasi/manual')({
  component: AkreditasiManualPage,
});
