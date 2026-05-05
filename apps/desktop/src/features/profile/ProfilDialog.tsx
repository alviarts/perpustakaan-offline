import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FilePickerInput } from '@/components/shared/FilePickerInput';
import { useToast } from '@/components/ui/toast-manager';
import { useAuthStore } from '@/stores/authStore';
import { userProfileApi, type UserProfile, type UserProfileInput } from '@/lib/userProfile';
import { formatTauriError } from '@/lib/errors';

interface ProfilDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AGAMA_OPTIONS = [
  'Islam',
  'Kristen',
  'Katolik',
  'Hindu',
  'Buddha',
  'Konghucu',
  'Lainnya',
] as const;

/**
 * Operator profile / biodata dialog (v1.0.4 #16). Lets the signed-in user
 * edit their display name, portrait, contact info, and personal data
 * without going through Settings → Akun (which is admin-only and covers
 * username + password + role).
 *
 * The username, role, and password are intentionally read-only here — the
 * user explicitly asked to "tetap login admin" and only edit the *display*
 * data.
 */
export function ProfilDialog({ open, onOpenChange }: ProfilDialogProps): JSX.Element {
  const { t } = useTranslation(['common']);
  const toast = useToast();
  const sessionUser = useAuthStore((s) => s.user);
  const setSessionUser = useAuthStore((s) => s.setUser);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<UserProfileInput>(blankInput());

  useEffect(() => {
    if (!open || !sessionUser) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const fetched = await userProfileApi.get(sessionUser.id);
        if (cancelled) return;
        setProfile(fetched);
        setForm({
          fullName: fetched.fullName,
          fotoPath: fetched.fotoPath,
          tanggalLahir: fetched.tanggalLahir,
          tempatLahir: fetched.tempatLahir,
          telepon: fetched.telepon,
          email: fetched.email,
          alamat: fetched.alamat,
          jenisKelamin: fetched.jenisKelamin,
          agama: fetched.agama,
        });
      } catch (err) {
        toast.showToast({
          variant: 'destructive',
          title: t('common:profile.loadFailed', { defaultValue: 'Gagal memuat profil' }),
          description: formatTauriError(err),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, sessionUser, t, toast]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!sessionUser) return;
    if (form.fullName.trim().length === 0) {
      toast.showToast({
        variant: 'destructive',
        title: t('common:profile.validationName', {
          defaultValue: 'Nama lengkap wajib diisi',
        }),
      });
      return;
    }
    setSubmitting(true);
    try {
      const next = await userProfileApi.update(sessionUser.id, {
        ...form,
        fullName: form.fullName.trim(),
      });
      setProfile(next);
      // Sync the auth store so the header avatar + greeting update without
      // a full page reload.
      setSessionUser({
        ...sessionUser,
        fullName: next.fullName,
      });
      toast.showToast({
        title: t('common:profile.saved', { defaultValue: 'Profil disimpan' }),
        description: next.fullName,
      });
      onOpenChange(false);
    } catch (err) {
      toast.showToast({
        variant: 'destructive',
        title: t('common:profile.saveFailed', { defaultValue: 'Gagal menyimpan profil' }),
        description: formatTauriError(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" data-testid="profil-dialog">
        <DialogHeader>
          <DialogTitle>{t('common:profile.title', { defaultValue: 'Profil Pengguna' })}</DialogTitle>
          <DialogDescription>
            {t('common:profile.description', {
              defaultValue:
                'Ubah biodata akun Anda. Username, peran, dan kata sandi diatur lewat Pengaturan → Akun.',
            })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <section className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-start">
            <div>
              <FilePickerInput
                value={form.fotoPath}
                onChange={(p) => setForm((f) => ({ ...f, fotoPath: p }))}
                category="user"
                rounded
                previewSize={112}
                pickLabel={t('common:profile.changePhoto', { defaultValue: 'Ubah Foto' })}
                clearLabel={t('common:profile.removePhoto', { defaultValue: 'Hapus' })}
                testId="profil-foto"
                disabled={loading || submitting}
              />
            </div>
            <div className="grid gap-3">
              <ReadOnlyField
                label={t('common:profile.username', { defaultValue: 'Username' })}
                value={profile?.username ?? sessionUser?.username ?? '—'}
              />
              <ReadOnlyField
                label={t('common:profile.role', { defaultValue: 'Peran' })}
                value={profile?.role ?? sessionUser?.role ?? '—'}
              />
              <Field label={t('common:profile.fullName', { defaultValue: 'Nama Lengkap' })}>
                <Input
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  data-testid="profil-fullname"
                  required
                  maxLength={120}
                  disabled={submitting}
                />
              </Field>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <Field label={t('common:profile.tempatLahir', { defaultValue: 'Tempat Lahir' })}>
              <Input
                value={form.tempatLahir ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tempatLahir: e.target.value || null }))
                }
                disabled={submitting}
                maxLength={80}
              />
            </Field>
            <Field label={t('common:profile.tanggalLahir', { defaultValue: 'Tanggal Lahir' })}>
              <Input
                type="date"
                value={form.tanggalLahir ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tanggalLahir: e.target.value || null }))
                }
                disabled={submitting}
              />
            </Field>
            <Field label={t('common:profile.jenisKelamin', { defaultValue: 'Jenis Kelamin' })}>
              <Select
                value={form.jenisKelamin ?? ''}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, jenisKelamin: (v as 'L' | 'P') || null }))
                }
                disabled={submitting}
              >
                <SelectTrigger data-testid="profil-jenis-kelamin">
                  <SelectValue
                    placeholder={t('common:profile.choose', { defaultValue: 'Pilih…' })}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">
                    {t('common:profile.male', { defaultValue: 'Laki-laki' })}
                  </SelectItem>
                  <SelectItem value="P">
                    {t('common:profile.female', { defaultValue: 'Perempuan' })}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('common:profile.agama', { defaultValue: 'Agama' })}>
              <Select
                value={form.agama ?? ''}
                onValueChange={(v) => setForm((f) => ({ ...f, agama: v || null }))}
                disabled={submitting}
              >
                <SelectTrigger data-testid="profil-agama">
                  <SelectValue
                    placeholder={t('common:profile.choose', { defaultValue: 'Pilih…' })}
                  />
                </SelectTrigger>
                <SelectContent>
                  {AGAMA_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('common:profile.telepon', { defaultValue: 'Telepon' })}>
              <Input
                value={form.telepon ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, telepon: e.target.value || null }))}
                disabled={submitting}
                maxLength={32}
              />
            </Field>
            <Field label={t('common:profile.email', { defaultValue: 'Email' })}>
              <Input
                type="email"
                value={form.email ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value || null }))}
                disabled={submitting}
                maxLength={120}
              />
            </Field>
          </section>

          <Field label={t('common:profile.alamat', { defaultValue: 'Alamat' })}>
            <textarea
              value={form.alamat ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, alamat: e.target.value || null }))}
              disabled={submitting}
              rows={2}
              maxLength={320}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-16 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </Field>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {t('common:actions.cancel', { defaultValue: 'Batal' })}
            </Button>
            <Button type="submit" disabled={submitting || loading} data-testid="profil-save">
              {submitting
                ? t('common:profile.saving', { defaultValue: 'Menyimpan…' })
                : t('common:actions.save', { defaultValue: 'Simpan' })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function blankInput(): UserProfileInput {
  return {
    fullName: '',
    fotoPath: null,
    tanggalLahir: null,
    tempatLahir: null,
    telepon: null,
    email: null,
    alamat: null,
    jenisKelamin: null,
    agama: null,
  };
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

function Field({ label, children }: FieldProps): JSX.Element {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}

interface ReadOnlyFieldProps {
  label: string;
  value: string;
}

function ReadOnlyField({ label, value }: ReadOnlyFieldProps): JSX.Element {
  return (
    <div className="grid gap-1.5 text-sm">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      <span className="bg-muted/40 rounded-md border px-3 py-2 font-mono text-xs">{value}</span>
    </div>
  );
}
