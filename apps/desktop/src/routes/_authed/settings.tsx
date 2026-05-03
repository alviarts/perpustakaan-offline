import { createFileRoute } from '@tanstack/react-router';
import { SettingsLayout } from '@/features/settings/SettingsLayout';

export const Route = createFileRoute('/_authed/settings')({
  component: SettingsLayout,
});
