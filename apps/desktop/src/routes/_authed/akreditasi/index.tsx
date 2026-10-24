import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/akreditasi/')({
  beforeLoad: () => {
    throw redirect({ to: '/akreditasi/ringkasan' });
  },
});
