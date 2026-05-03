import { createFileRoute, redirect } from '@tanstack/react-router';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@/stores/authStore';

export const Route = createFileRoute('/_authed')({
  beforeLoad: () => {
    const isAuthed = useAuthStore.getState().user !== null;
    if (!isAuthed) {
      throw redirect({ to: '/login' });
    }
  },
  component: AppShell,
});
