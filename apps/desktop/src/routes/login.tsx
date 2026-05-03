import { createFileRoute, redirect } from '@tanstack/react-router';
import { Login } from '@/features/auth/Login';
import { useAuthStore } from '@/stores/authStore';

export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    const isAuthed = useAuthStore.getState().user !== null;
    if (isAuthed) {
      throw redirect({ to: '/dashboard' });
    }
  },
  component: Login,
});
