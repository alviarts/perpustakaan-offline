import { createFileRoute } from '@tanstack/react-router';
import { LabelBukuSettingsPage } from '@/features/label-buku/LabelBukuSettingsPage';

export const Route = createFileRoute('/_authed/settings/label-buku')({
  component: LabelBukuSettingsPage,
});
