import { createFileRoute, redirect } from '@tanstack/react-router';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@/stores/authStore';
import { readLicenseState } from '@/lib/license';

export const Route = createFileRoute('/_authed')({
  beforeLoad: () => {
    const isAuthed = useAuthStore.getState().user !== null;
    if (!isAuthed) {
      throw redirect({ to: '/login' });
    }
    // Trial 30 hari: setelah habis, aplikasi terkunci sampai diaktivasi.
    const license = readLicenseState();
    if (license.status !== 'aktif' && license.status !== 'trial') {
      throw redirect({ to: '/aktivasi' });
    }
  },
  component: AppShell,
});
