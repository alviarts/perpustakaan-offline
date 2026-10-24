import { createFileRoute } from '@tanstack/react-router';
import { NotaTemplatePage } from '@/features/settings/NotaTemplatePage';

export const Route = createFileRoute('/_authed/settings/template-nota')({
  component: NotaTemplatePage,
});
