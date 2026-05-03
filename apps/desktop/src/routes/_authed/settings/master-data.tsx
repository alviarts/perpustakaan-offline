import { createFileRoute } from '@tanstack/react-router';
import { MasterDataPage } from '@/features/master-data/MasterDataPage';

export const Route = createFileRoute('/_authed/settings/master-data')({
  component: MasterDataPage,
});
