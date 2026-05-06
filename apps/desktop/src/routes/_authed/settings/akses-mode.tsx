import { createFileRoute } from '@tanstack/react-router';
import { AksesModePage } from '@/features/settings/AksesModePage';

export const Route = createFileRoute('/_authed/settings/akses-mode')({
  component: AksesModePage,
});
