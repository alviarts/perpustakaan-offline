import { createFileRoute } from '@tanstack/react-router';
import { WishlistAdminPage } from '@/features/wishlist/WishlistAdminPage';

export const Route = createFileRoute('/_authed/wishlist')({
  component: WishlistAdminPage,
});
