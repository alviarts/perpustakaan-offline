import { createFileRoute } from '@tanstack/react-router';
import { KtaSettingsPage } from '@/features/kta/KtaSettingsPage';

export const Route = createFileRoute('/_authed/settings/kta')({
  component: KtaSettingsPage,
});
