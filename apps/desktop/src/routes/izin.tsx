import { createFileRoute, redirect } from '@tanstack/react-router';
import { PermissionsGate, permissionsDone } from '@/features/permissions/PermissionsGate';

export const Route = createFileRoute('/izin')({
  beforeLoad: () => {
    if (permissionsDone()) {
      throw redirect({ to: '/login' });
    }
  },
  component: PermissionsGate,
});
