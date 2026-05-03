import { createFileRoute } from '@tanstack/react-router';
import { AuditLogPage } from '@/features/settings/AuditLogPage';

export const Route = createFileRoute('/_authed/settings/audit-log')({
  component: AuditLogPage,
});
