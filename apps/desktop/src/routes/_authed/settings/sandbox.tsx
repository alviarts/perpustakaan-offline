import { createFileRoute } from '@tanstack/react-router';
import { SandboxPage } from '@/features/settings/SandboxPage';

export const Route = createFileRoute('/_authed/settings/sandbox')({
  component: SandboxPage,
});
