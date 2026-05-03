import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { useAuthStore } from '@/stores/authStore';

export const Route = createFileRoute('/_authed')({
  beforeLoad: () => {
    const isAuthed = useAuthStore.getState().user !== null;
    if (!isAuthed) {
      throw redirect({ to: '/login' });
    }
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Outlet />
    </div>
  );
}
