import { createFileRoute } from '@tanstack/react-router';
import { Aktivasi } from '@/features/license/Aktivasi';

export const Route = createFileRoute('/aktivasi')({
  component: Aktivasi,
});
