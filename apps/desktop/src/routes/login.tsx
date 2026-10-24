import { createFileRoute, redirect } from '@tanstack/react-router';
import { Login } from '@/features/auth/Login';
import { useAuthStore } from '@/stores/authStore';
import { permissionsDone } from '@/features/permissions/PermissionsGate';

export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    // Layar izin sekali di awal (kamera + penjelasan unduh/cetak).
    if (!permissionsDone()) {
      throw redirect({ to: '/izin' });
    }
    const isAuthed = useAuthStore.getState().user !== null;
    if (isAuthed) {
      throw redirect({ to: '/dashboard' });
    }
  },
  component: Login,
});
