import { createFileRoute } from '@tanstack/react-router';
import { ManualPage } from '@/features/settings/ManualPage';

export const Route = createFileRoute('/_authed/settings/manual')({
  component: ManualPage,
});
