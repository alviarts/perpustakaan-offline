import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { AnggotaList, useAnggotaListSearchSync } from '@/features/anggota/AnggotaList';

const searchSchema = z.object({
  q: z.string().optional(),
  kelas: z.string().optional(),
  jurusan: z.string().optional(),
  status: z.enum(['all', 'active', 'inactive']).optional(),
  page: z.coerce.number().int().positive().optional(),
});

export const Route = createFileRoute('/_authed/anggota/')({
  validateSearch: (s) => searchSchema.parse(s),
  component: AnggotaIndexRoute,
});

function AnggotaIndexRoute() {
  const { search, patch } = useAnggotaListSearchSync();
  return <AnggotaList search={search} onSearchChange={patch} />;
}
