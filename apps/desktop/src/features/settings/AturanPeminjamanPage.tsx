import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast-manager';
import {
  DEFAULT_LOAN_RULES,
  type LoanRules,
  settingsApi,
} from '@/lib/settings';
import { FieldRow, SettingsSection } from './SettingsSection';

const HARI_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export function AturanPeminjamanPage(): JSX.Element {
  const { t } = useTranslation('settings');
  const { showToast } = useToast();
  const [rules, setRules] = React.useState<LoanRules>(DEFAULT_LOAN_RULES);
  const [saving, setSaving] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    settingsApi.getLoanRules().then((r) => {
      setRules(r);
      setLoaded(true);
    });
  }, []);

  const handleNumber =
    (key: keyof Omit<LoanRules, 'hariLibur'>) =>
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const n = parseInt(e.target.value, 10);
      setRules((prev) => ({ ...prev, [key]: Number.isFinite(n) ? n : 0 }));
    };

  const toggleHari = (day: number): void => {
    setRules((prev) => {
      const has = prev.hariLibur.includes(day);
      return {
        ...prev,
        hariLibur: has
          ? prev.hariLibur.filter((d) => d !== day)
          : [...prev.hariLibur, day].sort(),
      };
    });
  };

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      await settingsApi.saveLoanRules(rules);
      showToast({
        title: t('sections.aturanPeminjaman.saveSuccess', {
          defaultValue: 'Aturan peminjaman berhasil disimpan.',
        }),
      });
    } catch (e) {
      showToast({
        title: t('sections.aturanPeminjaman.saveError', {
          defaultValue: 'Gagal menyimpan aturan peminjaman.',
        }),
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (): Promise<void> => {
    const next = await settingsApi.resetLoanRules();
    setRules(next);
  };

  return (
    <SettingsSection
      i18nKey="aturanPeminjaman"
      onSave={handleSave}
      onReset={handleReset}
      saving={saving || !loaded}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <FieldRow
          label={t('sections.aturanPeminjaman.fields.maksBuku', {
            defaultValue: 'Maksimum buku per anggota',
          })}
          htmlFor="aturan-maks"
        >
          <Input
            id="aturan-maks"
            type="number"
            min={1}
            value={rules.maksBukuPinjam}
            onChange={handleNumber('maksBukuPinjam')}
            data-testid="aturan-maks"
          />
        </FieldRow>
        <FieldRow
          label={t('sections.aturanPeminjaman.fields.lamaPinjam', {
            defaultValue: 'Durasi pinjam (hari)',
          })}
          htmlFor="aturan-lama"
        >
          <Input
            id="aturan-lama"
            type="number"
            min={1}
            value={rules.lamaPinjamHari}
            onChange={handleNumber('lamaPinjamHari')}
          />
        </FieldRow>
        <FieldRow
          label={t('sections.aturanPeminjaman.fields.dendaPerHari', {
            defaultValue: 'Denda per hari (Rp)',
          })}
          htmlFor="aturan-denda"
        >
          <Input
            id="aturan-denda"
            type="number"
            min={0}
            step={100}
            value={rules.dendaPerHari}
            onChange={handleNumber('dendaPerHari')}
            data-testid="aturan-denda"
          />
        </FieldRow>
      </div>

      <FieldRow
        label={t('sections.aturanPeminjaman.fields.hariLibur', {
          defaultValue: 'Hari libur (tidak dihitung sebagai hari pinjam)',
        })}
        help={t('sections.aturanPeminjaman.hariLiburHelp', {
          defaultValue: 'Pisahkan dengan koma. Contoh: 0,6 untuk Minggu & Sabtu.',
        })}
      >
        <div className="flex flex-wrap gap-2">
          {HARI_LABELS.map((label, idx) => {
            const checked = rules.hariLibur.includes(idx);
            return (
              <label
                key={idx}
                className={`flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-xs transition-colors ${
                  checked ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() => toggleHari(idx)}
                />
                {label}
              </label>
            );
          })}
        </div>
      </FieldRow>
    </SettingsSection>
  );
}
