import { createFileRoute } from '@tanstack/react-router';
import { StocktakePage } from '@/features/stocktake/StocktakePage';

export const Route = createFileRoute('/_authed/stocktake')({
  component: StocktakePage,
});
