import { createFileRoute } from '@tanstack/react-router';
import { BahasaPage } from '@/features/settings/BahasaPage';

export const Route = createFileRoute('/_authed/settings/bahasa')({
  component: BahasaPage,
});
