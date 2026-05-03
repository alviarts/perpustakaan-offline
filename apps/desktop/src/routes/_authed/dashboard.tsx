import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/authStore';

export const Route = createFileRoute('/_authed/dashboard')({
  component: DashboardPlaceholder,
});

function DashboardPlaceholder() {
  const { t } = useTranslation(['dashboard', 'common']);
  const user = useAuthStore((s) => s.user);

  return (
    <div className="container mx-auto max-w-5xl p-6 md:p-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t('dashboard:title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('dashboard:greeting', { name: user?.fullName ?? 'Guest' })}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('common:appName')} v2 — Layout shell ready</CardTitle>
          <CardDescription>{t('dashboard:placeholder')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
            <li>Sidebar collapsible (Ctrl+B, persist, auto-collapse &lt; 1024px) — revisi #7</li>
            <li>Header dengan search global, theme/lang switcher, user menu</li>
            <li>Identitas perpustakaan tersinkron dari tabel <code>settings</code> — revisi #11</li>
            <li>Window responsive 800×600 → 1920×1080 tanpa glitch — revisi #13 #22</li>
            <li>Halaman fitur (Anggota, Buku, dst) akan dibuat di Devin 4–11.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
