import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast-manager';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { type UserInput, type UserRecord, type UserRole, settingsApi } from '@/lib/settings';
import { setSecurityQuestion } from '@/lib/auth';
import { FieldRow, SettingsSection } from './SettingsSection';

const SECURITY_QUESTION_OPTION_KEYS = ['pet', 'school', 'city', 'book', 'teacher'] as const;
const CUSTOM_QUESTION_VALUE = '__custom__';

interface UserFormState extends UserInput {
  password: string;
}

const EMPTY_FORM: UserFormState = {
  username: '',
  fullName: '',
  role: 'pustakawan',
  aktif: true,
  password: '',
};

function fmtDate(s: string | null): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

export function AkunPage(): JSX.Element {
  const { t } = useTranslation('settings');
  const { showToast } = useToast();
  const [users, setUsers] = React.useState<UserRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState<UserRecord | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [resetting, setResetting] = React.useState<UserRecord | null>(null);
  const [deleting, setDeleting] = React.useState<UserRecord | null>(null);
  const [securityFor, setSecurityFor] = React.useState<UserRecord | null>(null);
  const [form, setForm] = React.useState<UserFormState>(EMPTY_FORM);
  const [resetPw, setResetPw] = React.useState('');
  const [securityQuestionKey, setSecurityQuestionKey] = React.useState<string>(
    SECURITY_QUESTION_OPTION_KEYS[0],
  );
  const [securityCustomQuestion, setSecurityCustomQuestion] = React.useState('');
  const [securityAnswer, setSecurityAnswer] = React.useState('');
  const [securitySaving, setSecuritySaving] = React.useState(false);

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const list = await settingsApi.listUsers();
      setUsers(list);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const openCreate = (): void => {
    setForm(EMPTY_FORM);
    setEditing(null);
    setCreating(true);
  };
  const openEdit = (u: UserRecord): void => {
    setForm({
      username: u.username,
      fullName: u.fullName,
      role: u.role,
      aktif: u.aktif,
      password: '',
    });
    setEditing(u);
  };

  const handleSubmit = async (): Promise<void> => {
    try {
      if (editing) {
        await settingsApi.updateUser(editing.id, {
          username: form.username,
          fullName: form.fullName,
          role: form.role,
          aktif: form.aktif,
        });
        showToast({
          title: t('sections.akun.feedback.updateSuccess', {
            defaultValue: 'Pengguna berhasil diperbarui.',
          }),
        });
      } else {
        await settingsApi.createUser({
          username: form.username,
          fullName: form.fullName,
          role: form.role,
          aktif: form.aktif,
          password: form.password,
        });
        showToast({
          title: t('sections.akun.feedback.createSuccess', {
            defaultValue: 'Pengguna berhasil ditambahkan.',
          }),
        });
      }
      setEditing(null);
      setCreating(false);
      void reload();
    } catch (e) {
      showToast({
        title: t('sections.identitas.saveError', { defaultValue: 'Gagal menyimpan' }),
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleting) return;
    await settingsApi.deleteUser(deleting.id);
    showToast({
      title: t('sections.akun.feedback.deleteSuccess', {
        defaultValue: 'Pengguna berhasil dihapus.',
      }),
    });
    setDeleting(null);
    void reload();
  };

  const handleResetPassword = async (): Promise<void> => {
    if (!resetting) return;
    await settingsApi.resetPassword(resetting.id, resetPw);
    showToast({
      title: t('sections.akun.feedback.passwordReset', {
        defaultValue: 'Password berhasil direset.',
      }),
    });
    setResetting(null);
    setResetPw('');
  };

  const openSecurity = (u: UserRecord): void => {
    setSecurityFor(u);
    setSecurityQuestionKey(SECURITY_QUESTION_OPTION_KEYS[0]);
    setSecurityCustomQuestion('');
    setSecurityAnswer('');
  };

  const handleSaveSecurityQuestion = async (): Promise<void> => {
    if (!securityFor) return;
    const question =
      securityQuestionKey === CUSTOM_QUESTION_VALUE
        ? securityCustomQuestion.trim()
        : t(`sections.akun.security.options.${securityQuestionKey}`, {
            defaultValue: securityQuestionKey,
          });
    setSecuritySaving(true);
    try {
      await setSecurityQuestion({
        userId: securityFor.id,
        question,
        answer: securityAnswer,
      });
      showToast({
        title: t('sections.akun.feedback.securityQuestionSaved', {
          defaultValue: 'Pertanyaan keamanan berhasil disimpan.',
        }),
      });
      setSecurityFor(null);
    } catch (e) {
      showToast({
        title: t('sections.identitas.saveError', { defaultValue: 'Gagal menyimpan' }),
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSecuritySaving(false);
    }
  };

  const dialogOpen = creating || editing !== null;
  const closeDialog = (): void => {
    setCreating(false);
    setEditing(null);
  };

  return (
    <SettingsSection i18nKey="akun">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={openCreate} data-testid="akun-add">
          <Plus className="h-3.5 w-3.5" />
          {t('sections.akun.addUser', { defaultValue: 'Tambah Pengguna' })}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm" data-testid="akun-table">
          <thead className="bg-muted/40">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">
                {t('sections.akun.table.username', { defaultValue: 'Username' })}
              </th>
              <th className="px-3 py-2 font-medium">
                {t('sections.akun.table.fullName', { defaultValue: 'Nama Lengkap' })}
              </th>
              <th className="px-3 py-2 font-medium">
                {t('sections.akun.table.role', { defaultValue: 'Peran' })}
              </th>
              <th className="px-3 py-2 font-medium">
                {t('sections.akun.table.status', { defaultValue: 'Status' })}
              </th>
              <th className="px-3 py-2 font-medium">
                {t('sections.akun.table.lastLogin', { defaultValue: 'Login Terakhir' })}
              </th>
              <th className="px-3 py-2 text-right font-medium">
                {t('sections.akun.table.actions', { defaultValue: 'Aksi' })}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-muted-foreground p-6 text-center">
                  …
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-muted-foreground p-6 text-center">
                  —
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-3 py-2 font-mono">{u.username}</td>
                  <td className="px-3 py-2">{u.fullName}</td>
                  <td className="px-3 py-2 capitalize">{u.role}</td>
                  <td className="px-3 py-2">
                    {u.aktif
                      ? t('sections.akun.active', { defaultValue: 'Aktif' })
                      : t('sections.akun.inactive', { defaultValue: 'Nonaktif' })}
                  </td>
                  <td className="text-muted-foreground px-3 py-2">{fmtDate(u.lastLoginAt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(u)}
                            aria-label={t('common:actions.edit', { defaultValue: 'Ubah' })}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t('common:actions.edit', { defaultValue: 'Ubah' })}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setResetting(u);
                              setResetPw('');
                            }}
                            aria-label={t('sections.akun.resetPassword', {
                              defaultValue: 'Reset Password',
                            })}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t('sections.akun.resetPassword', { defaultValue: 'Reset Password' })}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openSecurity(u)}
                            aria-label={t('sections.akun.security.action', {
                              defaultValue: 'Pertanyaan Keamanan',
                            })}
                            data-testid={`akun-security-${u.id}`}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t('sections.akun.security.action', {
                            defaultValue: 'Pertanyaan Keamanan',
                          })}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleting(u)}
                            aria-label={t('common:actions.delete', { defaultValue: 'Hapus' })}
                          >
                            <Trash2 className="text-destructive h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t('common:actions.delete', { defaultValue: 'Hapus' })}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing
                ? t('sections.akun.editUser', { defaultValue: 'Edit Pengguna' })
                : t('sections.akun.addUser', { defaultValue: 'Tambah Pengguna' })}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <FieldRow label={t('sections.akun.table.username', { defaultValue: 'Username' })}>
              <Input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              />
            </FieldRow>
            <FieldRow label={t('sections.akun.table.fullName', { defaultValue: 'Nama Lengkap' })}>
              <Input
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              />
            </FieldRow>
            <FieldRow label={t('sections.akun.table.role', { defaultValue: 'Peran' })}>
              <Select
                value={form.role}
                onValueChange={(v) => setForm((f) => ({ ...f, role: v as UserRole }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    {t('sections.hakAkses.roles.admin', { defaultValue: 'Admin' })}
                  </SelectItem>
                  <SelectItem value="pustakawan">
                    {t('sections.hakAkses.roles.pustakawan', { defaultValue: 'Pustakawan' })}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
            {!editing && (
              <FieldRow label={t('sections.akun.newPassword', { defaultValue: 'Password Baru' })}>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </FieldRow>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.aktif}
                onChange={(e) => setForm((f) => ({ ...f, aktif: e.target.checked }))}
              />
              {t('sections.akun.active', { defaultValue: 'Aktif' })}
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>
              ✕
            </Button>
            <Button onClick={handleSubmit} data-testid="akun-save">
              {t('actions.save', { defaultValue: 'Simpan' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetting !== null} onOpenChange={(o) => !o && setResetting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('sections.akun.resetPassword', { defaultValue: 'Reset Password' })}
            </DialogTitle>
          </DialogHeader>
          <FieldRow label={t('sections.akun.newPassword', { defaultValue: 'Password Baru' })}>
            <Input type="password" value={resetPw} onChange={(e) => setResetPw(e.target.value)} />
          </FieldRow>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetting(null)}>
              ✕
            </Button>
            <Button onClick={handleResetPassword}>
              {t('actions.save', { defaultValue: 'Simpan' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={securityFor !== null} onOpenChange={(o) => !o && setSecurityFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('sections.akun.security.title', {
                username: securityFor?.username ?? '',
                defaultValue: `Pertanyaan Keamanan untuk ${securityFor?.username ?? ''}`,
              })}
            </DialogTitle>
            <DialogDescription>
              {t('sections.akun.security.description', {
                defaultValue:
                  'Dipakai pengguna saat lupa password di layar Login. Jawaban disimpan ter-hash; tidak bisa dilihat ulang.',
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <FieldRow
              label={t('sections.akun.security.questionLabel', { defaultValue: 'Pertanyaan' })}
            >
              <Select value={securityQuestionKey} onValueChange={setSecurityQuestionKey}>
                <SelectTrigger
                  aria-label={t('sections.akun.security.questionPicker', {
                    defaultValue: 'Pilih pertanyaan',
                  })}
                  data-testid="akun-security-question-picker"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECURITY_QUESTION_OPTION_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {t(`sections.akun.security.options.${key}`, { defaultValue: key })}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_QUESTION_VALUE}>
                    {t('sections.akun.security.customQuestion', {
                      defaultValue: 'Pertanyaan Sendiri',
                    })}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
            {securityQuestionKey === CUSTOM_QUESTION_VALUE ? (
              <FieldRow
                label={t('sections.akun.security.customQuestion', {
                  defaultValue: 'Pertanyaan Sendiri',
                })}
              >
                <Input
                  value={securityCustomQuestion}
                  onChange={(e) => setSecurityCustomQuestion(e.target.value)}
                  data-testid="akun-security-custom-question"
                />
              </FieldRow>
            ) : null}
            <FieldRow label={t('sections.akun.security.answerLabel', { defaultValue: 'Jawaban' })}>
              <div className="space-y-1">
                <Input
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  data-testid="akun-security-answer"
                />
                <p className="text-muted-foreground text-xs">
                  {t('sections.akun.security.answerHint', {
                    defaultValue: 'Tidak peka huruf besar/kecil. Spasi awal/akhir diabaikan.',
                  })}
                </p>
              </div>
            </FieldRow>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSecurityFor(null)}>
              ✕
            </Button>
            <Button
              onClick={handleSaveSecurityQuestion}
              disabled={
                securitySaving ||
                securityAnswer.trim().length < 2 ||
                (securityQuestionKey === CUSTOM_QUESTION_VALUE &&
                  securityCustomQuestion.trim().length === 0)
              }
              data-testid="akun-security-save"
            >
              {t('sections.akun.security.save', { defaultValue: 'Simpan Pertanyaan' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {deleting && (
        <ConfirmDialog
          open={deleting !== null}
          onOpenChange={(o) => !o && setDeleting(null)}
          title={t('sections.akun.delete.title', {
            name: deleting.username,
            defaultValue: `Hapus pengguna "${deleting.username}"?`,
          })}
          description={t('sections.akun.delete.description', {
            defaultValue: 'Pengguna tidak akan bisa login lagi setelah dihapus.',
          })}
          destructive
          onConfirm={handleDelete}
        />
      )}
    </SettingsSection>
  );
}
