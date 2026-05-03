import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { BukuList, useBukuListSearchSync } from '@/features/buku/BukuList';

const searchSchema = z.object({
  q: z.string().optional(),
  kategori: z.string().optional(),
  bahasa: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  selected: z.coerce.number().int().positive().optional(),
});

export const Route = createFileRoute('/_authed/buku/')({
  validateSearch: (s) => searchSchema.parse(s),
  component: BukuIndexRoute,
});

function BukuIndexRoute() {
  const { search, patch } = useBukuListSearchSync();
  return <BukuList search={search} onSearchChange={patch} />;
}
