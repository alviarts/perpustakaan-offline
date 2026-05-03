import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { type AuditLogEntry, type AuditLogQuery, settingsApi } from '@/lib/settings';
import { FieldRow, SettingsSection } from './SettingsSection';

export function AuditLogPage(): JSX.Element {
  const { t } = useTranslation('settings');
  const [query, setQuery] = React.useState<AuditLogQuery>({});
  const [entries, setEntries] = React.useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = React.useState(true);

  const search = React.useCallback(async (q: AuditLogQuery) => {
    setLoading(true);
    try {
      setEntries(await settingsApi.queryAuditLog(q));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void search({});
  }, [search]);

  const set = <K extends keyof AuditLogQuery>(k: K, v: AuditLogQuery[K]): void => {
    setQuery((prev) => ({ ...prev, [k]: v }));
  };

  return (
    <SettingsSection i18nKey="auditLog">
      <div className="grid gap-3 sm:grid-cols-3">
        <FieldRow label={t('sections.auditLog.filter.user', { defaultValue: 'Pengguna' })}>
          <Input
            value={query.user ?? ''}
            onChange={(e) => set('user', e.target.value)}
            placeholder="admin"
          />
        </FieldRow>
        <FieldRow label={t('sections.auditLog.filter.action', { defaultValue: 'Aksi' })}>
          <Input
            value={query.action ?? ''}
            onChange={(e) => set('action', e.target.value)}
            placeholder="login / create / update"
          />
        </FieldRow>
        <FieldRow label={t('sections.auditLog.filter.entity', { defaultValue: 'Entitas' })}>
          <Input
            value={query.entity ?? ''}
            onChange={(e) => set('entity', e.target.value)}
            placeholder="anggota / buku"
          />
        </FieldRow>
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={() => void search(query)} data-testid="audit-search">
          {t('actions.save', { defaultValue: 'Cari' })}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border" data-testid="audit-table">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">
                {t('sections.auditLog.table.timestamp', { defaultValue: 'Waktu' })}
              </th>
              <th className="px-3 py-2 font-medium">
                {t('sections.auditLog.table.user', { defaultValue: 'Pengguna' })}
              </th>
              <th className="px-3 py-2 font-medium">
                {t('sections.auditLog.table.action', { defaultValue: 'Aksi' })}
              </th>
              <th className="px-3 py-2 font-medium">
                {t('sections.auditLog.table.entity', { defaultValue: 'Entitas' })}
              </th>
              <th className="px-3 py-2 font-medium">
                {t('sections.auditLog.table.entityId', { defaultValue: 'ID' })}
              </th>
              <th className="px-3 py-2 font-medium">
                {t('sections.auditLog.table.detail', { defaultValue: 'Detail' })}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  …
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  {t('sections.auditLog.empty', { defaultValue: 'Belum ada catatan.' })}
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{e.createdAt}</td>
                  <td className="px-3 py-2">{e.username ?? '—'}</td>
                  <td className="px-3 py-2">{e.aksi}</td>
                  <td className="px-3 py-2">{e.entitas}</td>
                  <td className="px-3 py-2 font-mono text-xs">{e.entitasId ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{e.detail ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </SettingsSection>
  );
}
