import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeSwitcher } from '@/components/layout/ThemeSwitcher';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { useAuthStore } from '@/stores/authStore';
import { logoutRequest } from '@/lib/auth';

export const Route = createFileRoute('/_authed/dashboard')({
  component: DashboardPlaceholder,
});

function DashboardPlaceholder() {
  const { t } = useTranslation(['dashboard', 'common']);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const onLogout = async () => {
    await logoutRequest();
    logout();
  };

  return (
    <div className="container mx-auto max-w-5xl py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('dashboard:title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('dashboard:greeting', { name: user?.fullName ?? 'Guest' })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeSwitcher />
          <Button variant="outline" size="sm" onClick={onLogout} className="ml-2 gap-2">
            <LogOut className="h-4 w-4" />
            {t('common:menu.logout')}
          </Button>
        </div>
      </header>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>{t('common:appName')} v2 — Scaffolding ready</CardTitle>
          <CardDescription>{t('dashboard:placeholder')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
            <li>Tauri 2 + React 18 + TypeScript + Tailwind 3 + shadcn/ui + Zustand + TanStack Router</li>
            <li>i18n: ID / EN (11 namespaces)</li>
            <li>Theme: light / dark / system (anti-FOUC, persist)</li>
            <li>Auth: bcrypt verify (Tauri) atau mock fallback (browser dev / e2e)</li>
            <li>SQLite: schema reuse dari v1 (akan di-extend di sesi 4-11)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
