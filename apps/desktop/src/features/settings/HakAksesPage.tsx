import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/ui/toast-manager';
import {
  DEFAULT_PERMISSION_MATRIX,
  PERMISSION_ACTIONS,
  PERMISSION_AREAS,
  type PermissionAction,
  type PermissionArea,
  type PermissionMatrix,
  type UserRole,
  settingsApi,
} from '@/lib/settings';
import { SettingsSection } from './SettingsSection';

const ROLES: UserRole[] = ['admin', 'pustakawan'];

export function HakAksesPage(): JSX.Element {
  const { t } = useTranslation('settings');
  const { showToast } = useToast();
  const [matrix, setMatrix] = React.useState<PermissionMatrix>(DEFAULT_PERMISSION_MATRIX);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    settingsApi.getPermissionMatrix().then(setMatrix);
  }, []);

  const toggle = (
    role: UserRole,
    area: PermissionArea,
    action: PermissionAction,
  ): void => {
    setMatrix((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [area]: {
          ...prev[role][area],
          [action]: !prev[role][area][action],
        },
      },
    }));
  };

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      await settingsApi.savePermissionMatrix(matrix);
      showToast({
        title: t('sections.hakAkses.saveSuccess', { defaultValue: 'Matriks izin berhasil disimpan.' }),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (): Promise<void> => {
    const next = await settingsApi.resetPermissionMatrix();
    setMatrix(next);
  };

  return (
    <SettingsSection
      i18nKey="hakAkses"
      onSave={handleSave}
      onReset={handleReset}
      saving={saving}
    >
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium">
                {t('sections.hakAkses.areas.anggota', { defaultValue: 'Area' })}
              </th>
              {ROLES.flatMap((role) =>
                PERMISSION_ACTIONS.map((act) => (
                  <th
                    key={`${role}-${act}`}
                    className="px-2 py-2 text-center text-xs font-medium"
                    title={`${role} · ${act}`}
                  >
                    <div className="flex flex-col">
                      <span className="text-[0.65rem] uppercase text-muted-foreground">
                        {t(`sections.hakAkses.roles.${role}`, { defaultValue: role })}
                      </span>
                      <span>{t(`sections.hakAkses.actions.${act}`, { defaultValue: act })}</span>
                    </div>
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_AREAS.map((area) => (
              <tr key={area} className="border-t">
                <td className="px-3 py-2 font-medium">
                  {t(`sections.hakAkses.areas.${area}`, { defaultValue: area })}
                </td>
                {ROLES.flatMap((role) =>
                  PERMISSION_ACTIONS.map((act) => (
                    <td key={`${role}-${area}-${act}`} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={matrix[role][area][act]}
                        onChange={() => toggle(role, area, act)}
                        data-testid={`perm-${role}-${area}-${act}`}
                      />
                    </td>
                  )),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SettingsSection>
  );
}
