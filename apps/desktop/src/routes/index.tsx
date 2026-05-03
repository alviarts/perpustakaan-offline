import { createFileRoute, redirect } from '@tanstack/react-router';
import { useAuthStore } from '@/stores/authStore';

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    const isAuthed = useAuthStore.getState().user !== null;
    throw redirect({ to: isAuthed ? '/dashboard' : '/login' });
  },
});
