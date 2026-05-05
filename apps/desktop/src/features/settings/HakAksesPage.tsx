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
      {/*
        Two-row header groups checkboxes by role (Admin | Pustakawan), and a
        sticky first column keeps the area label on screen while scrolling
        the role columns horizontally on narrow displays. Zebra body rows +
        hover highlight + vertical divider between role groups make it
        obvious which checkbox you're toggling for which role / area.
      */}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/60">
              <th
                rowSpan={2}
                scope="col"
                className="bg-muted/60 sticky left-0 z-10 min-w-40 border-b border-r px-3 py-2 text-left font-semibold"
              >
                {t('sections.hakAkses.headerArea', { defaultValue: 'Area' })}
              </th>
              {ROLES.map((role, roleIdx) => (
                <th
                  key={role}
                  scope="colgroup"
                  colSpan={PERMISSION_ACTIONS.length}
                  className={`border-b px-2 py-2 text-center font-semibold ${
                    roleIdx > 0 ? 'border-l' : ''
                  }`}
                >
                  {t(`sections.hakAkses.roles.${role}`, { defaultValue: role })}
                </th>
              ))}
            </tr>
            <tr className="bg-muted/40">
              {ROLES.flatMap((role, roleIdx) =>
                PERMISSION_ACTIONS.map((act, actIdx) => (
                  <th
                    key={`${role}-${act}`}
                    scope="col"
                    className={`min-w-20 border-b px-2 py-1.5 text-center text-xs font-medium ${
                      roleIdx > 0 && actIdx === 0 ? 'border-l' : ''
                    }`}
                    title={`${role} · ${act}`}
                  >
                    {t(`sections.hakAkses.actions.${act}`, { defaultValue: act })}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_AREAS.map((area, rowIdx) => (
              <tr
                key={area}
                className={`hover:bg-muted/40 ${rowIdx % 2 === 1 ? 'bg-muted/20' : ''}`}
              >
                <th
                  scope="row"
                  className={`bg-background sticky left-0 z-10 border-r px-3 py-2 text-left font-medium ${
                    rowIdx % 2 === 1 ? 'bg-muted/20' : ''
                  }`}
                >
                  {t(`sections.hakAkses.areas.${area}`, { defaultValue: area })}
                </th>
                {ROLES.flatMap((role, roleIdx) =>
                  PERMISSION_ACTIONS.map((act, actIdx) => (
                    <td
                      key={`${role}-${area}-${act}`}
                      className={`px-2 py-2 text-center ${
                        roleIdx > 0 && actIdx === 0 ? 'border-l' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={matrix[role][area][act]}
                        onChange={() => toggle(role, area, act)}
                        data-testid={`perm-${role}-${area}-${act}`}
                        aria-label={`${t(`sections.hakAkses.roles.${role}`, { defaultValue: role })} · ${t(`sections.hakAkses.areas.${area}`, { defaultValue: area })} · ${t(`sections.hakAkses.actions.${act}`, { defaultValue: act })}`}
                        className="size-4 cursor-pointer accent-primary"
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
