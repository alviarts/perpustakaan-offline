import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/laporan/')({
  beforeLoad: () => {
    throw redirect({ to: '/laporan/grafik' });
  },
});
